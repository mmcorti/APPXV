import { supabase } from './supabase.js';

const BINGO_BUCKET = 'fotobingo';
const CACHE_CONTROL_SECONDS = '31536000'; // 1 year browser/CDN cache
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let bucketReadyPromise = null;
const sessionIdCache = new Map();
const persistTimers = new Map();

/**
 * Ensures the public 'fotobingo' Storage bucket exists.
 */
export async function ensureBingoBucket() {
    if (!bucketReadyPromise) {
        bucketReadyPromise = (async () => {
            try {
                const { data: buckets, error } = await supabase.storage.listBuckets();
                if (error) {
                    console.warn('⚠️ [BINGO STORAGE] Could not list buckets:', error.message);
                    bucketReadyPromise = null;
                    return false;
                }
                if (!buckets?.some((b) => b.name === BINGO_BUCKET)) {
                    const { error: createErr } = await supabase.storage.createBucket(BINGO_BUCKET, {
                        public: true,
                    });
                    if (createErr && !createErr.message.toLowerCase().includes('already')) {
                        console.warn('⚠️ [BINGO STORAGE] Could not create bucket:', createErr.message);
                        bucketReadyPromise = null;
                        return false;
                    }
                    console.log(`✅ [BINGO STORAGE] Created public bucket '${BINGO_BUCKET}'`);
                }
                return true;
            } catch (err) {
                console.warn('⚠️ [BINGO STORAGE] Bucket check failed:', err.message);
                bucketReadyPromise = null;
                return false;
            }
        })();
    }
    return bucketReadyPromise;
}

/**
 * Uploads a Base64 data URL photo to Supabase Storage with long Cache-Control.
 * Falls back to the original photoUrl if it is already an HTTP URL or upload fails.
 */
export async function uploadBingoPhoto({ eventId, playerId, promptId, photoUrl }) {
    if (!photoUrl || typeof photoUrl !== 'string') return photoUrl;
    if (!photoUrl.startsWith('data:image/')) return photoUrl;

    const match = photoUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (!match) return photoUrl;

    const mimeType = match[1];
    const base64Data = match[2];
    const rawExt = mimeType.split('/')[1]?.split('+')[0] || 'jpg';
    const ext = rawExt === 'jpeg' ? 'jpg' : rawExt;

    try {
        const ready = await ensureBingoBucket();
        if (!ready) return photoUrl;

        const buffer = Buffer.from(base64Data, 'base64');
        const safeEventId = String(eventId).replace(/[^a-zA-Z0-9_-]/g, '_');
        const safePlayerId = String(playerId).replace(/[^a-zA-Z0-9_-]/g, '_');
        const filePath = `${safeEventId}/${safePlayerId}/${promptId}-${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
            .from(BINGO_BUCKET)
            .upload(filePath, buffer, {
                contentType: mimeType,
                cacheControl: CACHE_CONTROL_SECONDS,
                upsert: true,
            });

        if (uploadError) {
            console.warn('⚠️ [BINGO STORAGE] Upload failed, using fallback:', uploadError.message);
            return photoUrl;
        }

        const { data: publicData } = supabase.storage.from(BINGO_BUCKET).getPublicUrl(filePath);
        if (publicData?.publicUrl) {
            console.log(`📸 [BINGO STORAGE] Uploaded ${filePath} (${(buffer.length / 1024).toFixed(1)}KB)`);
            return publicData.publicUrl;
        }
        return photoUrl;
    } catch (err) {
        console.warn('⚠️ [BINGO STORAGE] Unexpected upload error, using fallback:', err.message);
        return photoUrl;
    }
}

/**
 * Hydrates a Bingo game state from Supabase `game_sessions` if it exists.
 */
export async function loadBingoSession(eventId, defaultStateFactory) {
    const baseState = defaultStateFactory(eventId);
    if (!UUID_REGEX.test(eventId)) return baseState;

    try {
        const { data, error } = await supabase
            .from('game_sessions')
            .select('id, status, config, state')
            .eq('event_id', eventId)
            .eq('game_type', 'bingo')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            console.warn('⚠️ [BINGO DB] Could not load session:', error.message);
            return baseState;
        }
        if (!data) return baseState;

        sessionIdCache.set(eventId, data.id);
        const cfg = data.config && typeof data.config === 'object' ? data.config : {};
        const saved = data.state && typeof data.state === 'object' ? data.state : {};
        const now = Date.now();

        // Mark hydrated players offline until their SSE reconnects and refresh lastSeen
        const hydratedPlayers = {};
        if (saved.players && typeof saved.players === 'object') {
            for (const [pid, player] of Object.entries(saved.players)) {
                hydratedPlayers[pid] = {
                    ...player,
                    online: false,
                    lastSeen: now,
                };
            }
        }

        console.log(`♻️ [BINGO DB] Hydrated session ${data.id} for event ${eventId.substring(0, 8)}... (${Object.keys(hydratedPlayers).length} players)`);

        return {
            ...baseState,
            status: data.status || baseState.status,
            hostPlan: cfg.hostPlan || baseState.hostPlan,
            prompts: Array.isArray(cfg.prompts) && cfg.prompts.length === 9 ? cfg.prompts : baseState.prompts,
            googlePhotosLink: cfg.googlePhotosLink ?? baseState.googlePhotosLink,
            customImageUrl: cfg.customImageUrl ?? baseState.customImageUrl,
            winner: saved.winner ?? null,
            players: hydratedPlayers,
            cards: saved.cards && typeof saved.cards === 'object' ? saved.cards : {},
            submissions: Array.isArray(saved.submissions) ? saved.submissions : [],
        };
    } catch (err) {
        console.warn('⚠️ [BINGO DB] Unexpected load error:', err.message);
        return baseState;
    }
}

/**
 * Persists the lightweight Bingo state to Supabase `game_sessions` (debounced per event).
 */
export function scheduleBingoPersist(eventId, state) {
    if (!UUID_REGEX.test(eventId)) return;

    if (persistTimers.has(eventId)) {
        clearTimeout(persistTimers.get(eventId));
    }

    const timer = setTimeout(async () => {
        persistTimers.delete(eventId);
        await persistBingoSessionNow(eventId, state);
    }, 250);

    persistTimers.set(eventId, timer);
}

async function persistBingoSessionNow(eventId, state) {
    try {
        const payload = {
            event_id: eventId,
            game_type: 'bingo',
            status: state.status || 'WAITING',
            config: {
                hostPlan: state.hostPlan || 'freemium',
                prompts: state.prompts || [],
                googlePhotosLink: state.googlePhotosLink || '',
                customImageUrl: state.customImageUrl || '',
            },
            state: {
                winner: state.winner || null,
                players: state.players || {},
                cards: state.cards || {},
                submissions: state.submissions || [],
            },
            updated_at: new Date().toISOString(),
        };

        let existingId = sessionIdCache.get(eventId);
        if (!existingId) {
            const { data: found } = await supabase
                .from('game_sessions')
                .select('id')
                .eq('event_id', eventId)
                .eq('game_type', 'bingo')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            if (found?.id) {
                existingId = found.id;
                sessionIdCache.set(eventId, existingId);
            }
        }

        if (existingId) {
            const { error } = await supabase
                .from('game_sessions')
                .update(payload)
                .eq('id', existingId);
            if (error) console.warn('⚠️ [BINGO DB] Update error:', error.message);
        } else {
            const { data: inserted, error } = await supabase
                .from('game_sessions')
                .insert(payload)
                .select('id')
                .single();
            if (error) {
                console.warn('⚠️ [BINGO DB] Insert error:', error.message);
            } else if (inserted?.id) {
                sessionIdCache.set(eventId, inserted.id);
            }
        }
    } catch (err) {
        console.warn('⚠️ [BINGO DB] Persist error:', err.message);
    }
}

const CRC32_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let k = 0; k < 8; k++) {
            c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        }
        table[i] = c >>> 0;
    }
    return table;
})();

function crc32(buf) {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
        crc = CRC32_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Lists all uploaded Bingo photos for an event from Supabase Storage.
 */
export async function listBingoPhotos(eventId) {
    const ready = await ensureBingoBucket();
    if (!ready) return [];

    const safeEventId = String(eventId).replace(/[^a-zA-Z0-9_-]/g, '_');
    const { data: folders, error } = await supabase.storage
        .from(BINGO_BUCKET)
        .list(safeEventId, { limit: 1000 });

    if (error || !folders) {
        console.warn('⚠️ [BINGO STORAGE] List folders error:', error?.message);
        return [];
    }

    const photos = [];
    for (const item of folders) {
        if (!item.name) continue;
        // Subfolder per playerId (item.id === null for folders in Supabase Storage)
        if (item.id === null) {
            const prefix = `${safeEventId}/${item.name}`;
            const { data: files } = await supabase.storage.from(BINGO_BUCKET).list(prefix, { limit: 1000 });
            for (const f of files || []) {
                if (!f.name || f.id === null) continue;
                const fullPath = `${prefix}/${f.name}`;
                const { data: pub } = supabase.storage.from(BINGO_BUCKET).getPublicUrl(fullPath);
                photos.push({
                    path: fullPath,
                    name: `${item.name.slice(0, 8)}_${f.name}`,
                    url: pub?.publicUrl || '',
                    playerId: item.name,
                    createdAt: f.created_at || null,
                });
            }
        } else {
            const fullPath = `${safeEventId}/${item.name}`;
            const { data: pub } = supabase.storage.from(BINGO_BUCKET).getPublicUrl(fullPath);
            photos.push({
                path: fullPath,
                name: item.name,
                url: pub?.publicUrl || '',
                playerId: null,
                createdAt: item.created_at || null,
            });
        }
    }

    return photos.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

/**
 * Builds an uncompressed ZIP archive Buffer containing all Bingo photos for an event.
 */
export async function buildBingoPhotosZip(eventId) {
    const photos = await listBingoPhotos(eventId);
    const localParts = [];
    const centralParts = [];
    let offset = 0;

    for (const photo of photos) {
        const { data: blob, error } = await supabase.storage.from(BINGO_BUCKET).download(photo.path);
        if (error || !blob) continue;

        const fileData = Buffer.from(await blob.arrayBuffer());
        const fileNameBuf = Buffer.from(photo.name, 'utf8');
        const crc = crc32(fileData);

        // Local file header (30 bytes + filename)
        const localHeader = Buffer.alloc(30);
        localHeader.writeUInt32LE(0x04034b50, 0);
        localHeader.writeUInt16LE(20, 4); // version needed
        localHeader.writeUInt16LE(0x0800, 6); // UTF-8 flag
        localHeader.writeUInt16LE(0, 8); // compression: store (0)
        localHeader.writeUInt16LE(0, 10);
        localHeader.writeUInt16LE(0, 12);
        localHeader.writeUInt32LE(crc, 14);
        localHeader.writeUInt32LE(fileData.length, 18);
        localHeader.writeUInt32LE(fileData.length, 22);
        localHeader.writeUInt16LE(fileNameBuf.length, 26);
        localHeader.writeUInt16LE(0, 28);

        localParts.push(localHeader, fileNameBuf, fileData);

        // Central directory header (46 bytes + filename)
        const centralHeader = Buffer.alloc(46);
        centralHeader.writeUInt32LE(0x02014b50, 0);
        centralHeader.writeUInt16LE(20, 4);
        centralHeader.writeUInt16LE(20, 6);
        centralHeader.writeUInt16LE(0x0800, 8);
        centralHeader.writeUInt16LE(0, 10);
        centralHeader.writeUInt16LE(0, 12);
        centralHeader.writeUInt16LE(0, 14);
        centralHeader.writeUInt32LE(crc, 16);
        centralHeader.writeUInt32LE(fileData.length, 20);
        centralHeader.writeUInt32LE(fileData.length, 24);
        centralHeader.writeUInt16LE(fileNameBuf.length, 28);
        centralHeader.writeUInt16LE(0, 30);
        centralHeader.writeUInt16LE(0, 32);
        centralHeader.writeUInt16LE(0, 34);
        centralHeader.writeUInt16LE(0, 36);
        centralHeader.writeUInt32LE(0, 38);
        centralHeader.writeUInt32LE(offset, 42);

        centralParts.push(centralHeader, fileNameBuf);
        offset += localHeader.length + fileNameBuf.length + fileData.length;
    }

    const centralDir = Buffer.concat(centralParts);
    const entryCount = centralParts.length / 2;
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(0, 4);
    eocd.writeUInt16LE(0, 6);
    eocd.writeUInt16LE(entryCount, 8);
    eocd.writeUInt16LE(entryCount, 10);
    eocd.writeUInt32LE(centralDir.length, 12);
    eocd.writeUInt32LE(offset, 16);
    eocd.writeUInt16LE(0, 20);

    return {
        buffer: Buffer.concat([...localParts, centralDir, eocd]),
        count: entryCount,
    };
}
