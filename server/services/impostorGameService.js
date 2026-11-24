
/**
 * Impostor Game Service
 * Handles the state and logic for the "El Impostor" game.
 */

// Add import
import { checkLimit } from '../planLimits.js';
import { loadGameSession, scheduleGamePersist } from './gameSessionStore.js';

const gameSessions = new Map();
const loadPromises = new Map();

const createInitialSession = () => ({
    status: 'WAITING', // WAITING, SUBMITTING, VOTING, REVEAL
    hostPlan: 'freemium', // Default
    config: {
        playerCount: 20,
        impostorCount: 1,
        mainPrompt: "Nombrá una canción que hace bailar a toda la fiesta",
        impostorPrompt: "Nombrá una canción tranquila para escuchar manejando",
        knowsRole: true,
        customImageUrl: 'https://res.cloudinary.com/djetzdm5n/image/upload/v1769432962/appxv-events/jp6fbqmcpg53lfbhtm42.png'
    },
    round: 1,
    players: [], // { id, name, role: 'CIVILIAN'|'IMPOSTOR', answer, avatar }
    lobby: [], // { id, name, avatar } - People who joined but aren't playing this round
    votes: {}, // { voterId: targetPlayerId }
    activePlayers: [], // The selected group for the current round
    eliminatedPlayers: [], // Players eliminated in previous rounds
    lastEliminated: null, // { id, name, role, round }
    winner: null // 'PUBLIC' or 'IMPOSTOR'
});

const persistImpostor = (eventId) => {
    scheduleGamePersist(eventId, 'impostor', () => {
        const session = gameSessions.get(eventId);
        if (!session) return null;
        return {
            status: session.status || 'WAITING',
            config: {
                hostPlan: session.hostPlan || 'freemium',
                ...(session.config || {}),
            },
            state: {
                round: session.round || 1,
                players: session.players || [],
                lobby: session.lobby || [],
                votes: session.votes || {},
                activePlayers: session.activePlayers || [],
                eliminatedPlayers: session.eliminatedPlayers || [],
                lastEliminated: session.lastEliminated || null,
                winner: session.winner || null,
            },
        };
    });
};

const evaluateWinState = (session) => {
    const remainingImpostors = session.activePlayers.filter(p => p.role === 'IMPOSTOR').length;
    const remainingCivilians = session.activePlayers.filter(p => p.role === 'CIVILIAN').length;

    if (remainingImpostors === 0) {
        session.status = 'REVEAL';
        session.winner = 'PUBLIC';
        return true;
    }

    // Impostor wins when only impostors remain OR when 1 impostor & 1 civilian remain (remainingCivilians <= remainingImpostors)
    if (remainingCivilians <= remainingImpostors) {
        session.status = 'REVEAL';
        session.winner = 'IMPOSTOR';
        return true;
    }

    return false;
};

export const impostorGameService = {
    ensureSession: async (eventId) => {
        if (gameSessions.has(eventId)) return gameSessions.get(eventId);
        if (!loadPromises.has(eventId)) {
            loadPromises.set(eventId, (async () => {
                const base = createInitialSession();
                const saved = await loadGameSession(eventId, 'impostor');
                if (saved) {
                    const cfg = saved.config || {};
                    const st = saved.state || {};
                    const { hostPlan, ...restCfg } = cfg;
                    gameSessions.set(eventId, {
                        ...base,
                        status: saved.status || base.status,
                        hostPlan: hostPlan || base.hostPlan,
                        config: { ...base.config, ...restCfg },
                        round: st.round || 1,
                        players: Array.isArray(st.players) ? st.players : [],
                        lobby: Array.isArray(st.lobby) ? st.lobby.map(p => ({ ...p, online: false })) : [],
                        votes: st.votes && typeof st.votes === 'object' ? st.votes : {},
                        activePlayers: Array.isArray(st.activePlayers) ? st.activePlayers.map(p => ({ ...p, online: false })) : [],
                        eliminatedPlayers: Array.isArray(st.eliminatedPlayers) ? st.eliminatedPlayers : [],
                        lastEliminated: st.lastEliminated ?? null,
                        winner: st.winner ?? null,
                    });
                } else if (!gameSessions.has(eventId)) {
                    gameSessions.set(eventId, base);
                }
                return gameSessions.get(eventId);
            })().finally(() => loadPromises.delete(eventId)));
        }
        return loadPromises.get(eventId);
    },

    getOrCreateSession: (eventId) => {
        if (!gameSessions.has(eventId)) {
            gameSessions.set(eventId, createInitialSession());
        }
        return gameSessions.get(eventId);
    },

    persist: (eventId) => persistImpostor(eventId),

    joinSession: (eventId, player) => {
        const session = impostorGameService.getOrCreateSession(eventId);
        const exists = session.lobby.find(p => p.id === player.id);

        if (!exists) {
            // Check limits
            const limitCheck = checkLimit({
                plan: session.hostPlan || 'freemium',
                resource: 'gameParticipants',
                currentCount: session.lobby.length
            });

            if (!limitCheck.allowed) {
                throw new Error(limitCheck.reason || 'Lobby lleno (Plan Limit)');
            }

            session.lobby.push({
                id: player.id,
                name: player.name,
                avatar: player.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${player.id}`,
                online: true
            });
        }
        return session;
    },

    setPlayerStatus: (eventId, playerId, isOnline) => {
        const session = gameSessions.get(eventId);
        if (session) {
            // Update in Lobby
            const lobbyPlayer = session.lobby.find(p => p.id === playerId);
            if (lobbyPlayer) lobbyPlayer.online = isOnline;

            // Update in Active Game
            const activePlayer = session.activePlayers.find(p => p.id === playerId);
            if (activePlayer) activePlayer.online = isOnline;

            return true;
        }
        return false;
    },

    updateConfig: (eventId, config) => {
        const session = impostorGameService.getOrCreateSession(eventId);
        // Extract hostPlan if present, otherwise spread into config
        if (config.hostPlan) {
            session.hostPlan = config.hostPlan;
            delete config.hostPlan; // Don't add to config object if it stays there
        }
        session.config = { ...session.config, ...config };
        return session;
    },

    selectPlayers: (eventId, candidates) => {
        const session = impostorGameService.getOrCreateSession(eventId);

        // Use provided candidates or fallback to lobby
        const pool = (candidates && candidates.length > 0) ? candidates : session.lobby;
        const impostorCount = Math.max(1, Number(session.config.impostorCount) || 1);
        const minPlayers = Math.max(3, impostorCount + 1);
        const maxPlayers = Math.max(minPlayers, Number(session.config.playerCount) || 20);

        if (pool.length < minPlayers) {
            throw new Error(`Se necesitan al menos ${minPlayers} jugadores conectados para iniciar`);
        }

        // Shuffle and pick up to maxPlayers (doesn't require reaching maxPlayers)
        const shuffled = [...pool].sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, Math.min(maxPlayers, pool.length));

        // Assign roles
        const impostorIndices = new Set();
        while (impostorIndices.size < impostorCount) {
            impostorIndices.add(Math.floor(Math.random() * selected.length));
        }

        session.activePlayers = selected.map((guest, index) => ({
            id: String(guest.id),
            name: guest.name,
            role: impostorIndices.has(index) ? 'IMPOSTOR' : 'CIVILIAN',
            answer: '',
            avatar: guest.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${guest.id}`
        }));

        session.round = 1;
        session.eliminatedPlayers = [];
        session.lastEliminated = null;
        session.status = 'WAITING';
        session.votes = {};
        session.winner = null;
        return session;
    },

    startRound: (eventId) => {
        const session = impostorGameService.getOrCreateSession(eventId);
        if (session.activePlayers.length === 0) {
            impostorGameService.selectPlayers(eventId, []);
        }
        session.status = 'SUBMITTING';
        return session;
    },

    submitAnswer: (eventId, playerId, answer) => {
        const session = impostorGameService.getOrCreateSession(eventId);
        const player = session.activePlayers.find(p => p.id === playerId);
        if (player) {
            player.answer = answer;
        }

        // Check if all answers are in
        const allAnswered = session.activePlayers.every(p => p.answer && p.answer.trim().length > 0);
        if (allAnswered) {
            session.status = 'VOTING';
        }
        return session;
    },

    castVote: (eventId, voterId, targetId) => {
        const session = impostorGameService.getOrCreateSession(eventId);
        if (session.status !== 'VOTING') return session;

        session.votes[voterId] = targetId;
        return session;
    },

    showVotingResults: (eventId) => {
        const session = impostorGameService.getOrCreateSession(eventId);
        session.status = 'VOTING';
        return session;
    },

    nextRound: (eventId) => {
        const session = impostorGameService.getOrCreateSession(eventId);
        if (session.status !== 'VOTING') {
            throw new Error('La partida no está en fase de votación');
        }

        const voteValues = Object.values(session.votes || {});
        if (voteValues.length === 0) {
            throw new Error('Aún no hay votos para evaluar la ronda');
        }

        const voteCounts = {};
        voteValues.forEach(targetId => {
            voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
        });

        let mostVotedId = null;
        let maxVotes = -1;
        for (const [id, count] of Object.entries(voteCounts)) {
            if (count > maxVotes) {
                maxVotes = count;
                mostVotedId = id;
            }
        }

        const eliminated = session.activePlayers.find(p => p.id === mostVotedId);
        if (!eliminated) {
            throw new Error('No se pudo determinar al jugador más votado');
        }

        session.eliminatedPlayers = [...(session.eliminatedPlayers || []), eliminated];
        session.activePlayers = session.activePlayers.filter(p => p.id !== eliminated.id);
        session.lastEliminated = {
            id: eliminated.id,
            name: eliminated.name,
            role: eliminated.role,
            round: session.round || 1
        };

        if (!evaluateWinState(session)) {
            // Continue to next round with remaining players
            session.round = (session.round || 1) + 1;
            session.activePlayers = session.activePlayers.map(p => ({ ...p, answer: '' }));
            session.votes = {};
            session.status = 'SUBMITTING';
        }

        return session;
    },

    removePlayer: (eventId, playerId) => {
        const session = impostorGameService.getOrCreateSession(eventId);
        const idStr = String(playerId);

        session.lobby = session.lobby.filter(p => String(p.id) !== idStr);
        if (session.votes) {
            delete session.votes[idStr];
            for (const [voterId, targetId] of Object.entries(session.votes)) {
                if (String(targetId) === idStr) delete session.votes[voterId];
            }
        }

        const activeTarget = session.activePlayers.find(p => String(p.id) === idStr);
        if (activeTarget) {
            session.activePlayers = session.activePlayers.filter(p => String(p.id) !== idStr);
            session.eliminatedPlayers = [...(session.eliminatedPlayers || []), activeTarget];
            session.lastEliminated = {
                id: activeTarget.id,
                name: activeTarget.name,
                role: activeTarget.role,
                round: session.round || 1,
                disconnected: true
            };

            if (session.status !== 'WAITING' && session.status !== 'REVEAL') {
                const ended = evaluateWinState(session);
                if (!ended && session.status === 'SUBMITTING') {
                    const allAnswered = session.activePlayers.length > 0 &&
                        session.activePlayers.every(p => p.answer && p.answer.trim().length > 0);
                    if (allAnswered) {
                        session.status = 'VOTING';
                    }
                }
            }
        }

        return session;
    },

    revealImpostor: (eventId) => {
        const session = impostorGameService.getOrCreateSession(eventId);
        session.status = 'REVEAL';

        // Calculate winner
        const voteCounts = {};
        Object.values(session.votes).forEach(targetId => {
            voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
        });

        // Find most voted
        let mostVotedId = null;
        let maxVotes = -1;
        for (const [id, count] of Object.entries(voteCounts)) {
            if (count > maxVotes) {
                maxVotes = count;
                mostVotedId = id;
            }
        }

        const mostVotedPlayer = session.activePlayers.find(p => p.id === mostVotedId);
        if (mostVotedPlayer && mostVotedPlayer.role === 'IMPOSTOR') {
            session.winner = 'PUBLIC';
        } else {
            session.winner = 'IMPOSTOR';
        }

        return session;
    },

    resetGame: (eventId) => {
        gameSessions.delete(eventId);
        return impostorGameService.getOrCreateSession(eventId);
    },

    leaveSession: (eventId, playerId) => {
        const session = gameSessions.get(eventId);
        if (session) {
            session.lobby = session.lobby.filter(p => p.id !== playerId);
            // Optionally remove from activePlayers if game is in WAITING state?
            // User said "desaparezca de la pantalla de conectados", which usually means the lobby.
            return true;
        }
        return false;
    }
};
