
/**
 * Impostor Game Service
 * Handles the state and logic for the "El Impostor" game.
 */

const gameSessions = new Map();

export const impostorGameService = {
    getOrCreateSession: (eventId) => {
        if (!gameSessions.has(eventId)) {
            gameSessions.set(eventId, {
                status: 'WAITING', // WAITING, SUBMITTING, VOTING, REVEAL
                config: {
                    playerCount: 5,
                    impostorCount: 1,
                    mainPrompt: "Describe a la homenajeada en una palabra",
                    impostorPrompt: "Describe la fiesta en una palabra",
                    knowsRole: true
                },
                players: [], // { id, name, role: 'CIVILIAN'|'IMPOSTOR', answer, avatar }
                lobby: [], // { id, name, avatar } - People who joined but aren't playing this round
                votes: {}, // { voterId: targetPlayerId }
                activePlayers: [], // The selected group for the current round
                winner: null // 'PUBLIC' or 'IMPOSTOR'
            });
        }
        return gameSessions.get(eventId);
    },

    joinSession: (eventId, player) => {
        const session = impostorGameService.getOrCreateSession(eventId);
        const exists = session.lobby.find(p => p.id === player.id);
        if (!exists) {
            session.lobby.push({
                id: player.id,
                name: player.name,
                avatar: player.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${player.id}`
            });
        }
        return session;
    },

    updateConfig: (eventId, config) => {
        const session = impostorGameService.getOrCreateSession(eventId);
        session.config = { ...session.config, ...config };
        return session;
    },

    selectPlayers: (eventId, candidates) => {
        const session = impostorGameService.getOrCreateSession(eventId);

        // Use provided candidates or fallback to lobby
        const pool = (candidates && candidates.length > 0) ? candidates : session.lobby;

        if (pool.length === 0) return session;

        // Shuffle and pick N players
        const shuffled = [...pool].sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, session.config.playerCount);

        // Assign roles
        const impostorIndices = new Set();
        while (impostorIndices.size < Math.min(session.config.impostorCount, selected.length)) {
            impostorIndices.add(Math.floor(Math.random() * selected.length));
        }

        session.activePlayers = selected.map((guest, index) => ({
            id: String(guest.id),
            name: guest.name,
            role: impostorIndices.has(index) ? 'IMPOSTOR' : 'CIVILIAN',
            answer: '',
            avatar: guest.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${guest.id}`
        }));

        session.status = 'WAITING';
        session.votes = {};
        session.winner = null;
        return session;
    },

    startRound: (eventId) => {
        const session = impostorGameService.getOrCreateSession(eventId);
        if (session.activePlayers.length === 0) throw new Error("No players selected");
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
    }
};
