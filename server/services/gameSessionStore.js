import { supabase } from '../supabase.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const sessionIdCache = new Map(); // `${gameType}:${eventId}` -> session uuid
const persistTimers = new Map();  // `${gameType}:${eventId}` -> { timer, eventId, gameType, buildPayload }

/**
 * Load a persisted game session row from Supabase `game_sessions`.
 * Returns null if not found, non-UUID eventId, or DB error.
 */
export async function loadGameSession(eventId, gameType) {
    if (!UUID_REGEX.test(String(eventId || ''))) return null;

    try {
        const { data, error } = await supabase
            .from('game_sessions')
            .select('id, status, config, state')
            .eq('event_id', eventId)
            .eq('game_type', gameType)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            console.warn(`⚠️ [GAME DB:${gameType}] Load error:`, error.message);
            return null;
        }
        if (!data) return null;

        sessionIdCache.set(`${gameType}:${eventId}`, data.id);
        return data;
    } catch (err) {
        console.warn(`⚠️ [GAME DB:${gameType}] Unexpected load error:`, err.message);
        return null;
    }
}

/**
 * Persist a game session immediately to Supabase `game_sessions`.
 */
export async function persistGameSessionNow(eventId, gameType, { status, config, state }) {
    if (!UUID_REGEX.test(String(eventId || ''))) return;

    const cacheKey = `${gameType}:${eventId}`;
    try {
        const payload = {
            event_id: eventId,
            game_type: gameType,
            status: status || 'WAITING',
            config: config && typeof config === 'object' ? config : {},
            state: state && typeof state === 'object' ? state : {},
            updated_at: new Date().toISOString(),
        };

        let existingId = sessionIdCache.get(cacheKey);
        if (!existingId) {
            const { data: found } = await supabase
                .from('game_sessions')
                .select('id')
                .eq('event_id', eventId)
                .eq('game_type', gameType)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (found?.id) {
                existingId = found.id;
                sessionIdCache.set(cacheKey, existingId);
            }
        }

        if (existingId) {
            const { error } = await supabase
                .from('game_sessions')
                .update(payload)
                .eq('id', existingId);
            if (error) console.warn(`⚠️ [GAME DB:${gameType}] Update error:`, error.message);
        } else {
            const { data: inserted, error } = await supabase
                .from('game_sessions')
                .insert(payload)
                .select('id')
                .single();
            if (error) {
                console.warn(`⚠️ [GAME DB:${gameType}] Insert error:`, error.message);
            } else if (inserted?.id) {
                sessionIdCache.set(cacheKey, inserted.id);
            }
        }
    } catch (err) {
        console.warn(`⚠️ [GAME DB:${gameType}] Persist error:`, err.message);
    }
}

/**
 * Schedule a debounced persist (250ms) for a game session.
 * `buildPayload` returns { status, config, state }.
 */
export function scheduleGamePersist(eventId, gameType, buildPayload) {
    if (!UUID_REGEX.test(String(eventId || ''))) return;

    const cacheKey = `${gameType}:${eventId}`;
    const existing = persistTimers.get(cacheKey);
    if (existing?.timer) {
        clearTimeout(existing.timer);
    }

    const timer = setTimeout(async () => {
        persistTimers.delete(cacheKey);
        try {
            const data = buildPayload();
            if (data) await persistGameSessionNow(eventId, gameType, data);
        } catch (err) {
            console.warn(`⚠️ [GAME DB:${gameType}] Deferred persist failed:`, err.message);
        }
    }, 250);

    persistTimers.set(cacheKey, { timer, eventId, gameType, buildPayload });
}

/**
 * Flush all pending debounced game session persists (called on SIGTERM/SIGINT).
 */
export async function flushAllPendingGameSessions() {
    const entries = Array.from(persistTimers.entries());
    persistTimers.clear();
    await Promise.allSettled(
        entries.map(async ([, entry]) => {
            clearTimeout(entry.timer);
            const data = entry.buildPayload();
            if (data) {
                await persistGameSessionNow(entry.eventId, entry.gameType, data);
            }
        })
    );
}
