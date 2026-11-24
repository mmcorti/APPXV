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
