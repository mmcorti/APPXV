
// Similar to Bingo, but simpler logic.
import { googlePhotosService } from './googlePhotos.js';
import { checkLimit } from '../planLimits.js';

const games = {};

const createInitialState = (eventId) => ({
    eventId,
    status: 'IDLE', // IDLE, WAITING, WINNER
    mode: 'PHOTO', // PHOTO, PARTICIPANT
    googlePhotosUrl: '',
    customImageUrl: '',
    participants: {}, // map id -> {id, name, joinedAt}
    winner: null
});

export const raffleGameService = {
    getGame: (eventId) => {
        if (!games[eventId]) {
            games[eventId] = {
                ...createInitialState(eventId),
                hostPlan: 'freemium' // Default
            };
        }
        return games[eventId];
    },

    updateConfig: (eventId, { googlePhotosUrl, customImageUrl, mode, hostPlan }) => {
        const game = raffleGameService.getGame(eventId);
        if (googlePhotosUrl !== undefined) game.googlePhotosUrl = googlePhotosUrl;
        if (customImageUrl !== undefined) game.customImageUrl = customImageUrl;
        if (mode !== undefined) game.mode = mode;
        if (hostPlan !== undefined) game.hostPlan = hostPlan;
        return game;
    },

    joinParticipant: (eventId, name) => {
        const game = raffleGameService.getGame(eventId);

        // Check limits
        const currentCount = Object.keys(game.participants).length;
        const limitCheck = checkLimit({
            plan: game.hostPlan || 'freemium',
            resource: 'gameParticipants',
            currentCount
        });

        if (!limitCheck.allowed) {
            throw new Error(limitCheck.reason || 'Límite de participantes alcanzado');
        }

        // Simple dedupe by name for this session demo
        const existing = Object.values(game.participants).find(p => p.name.toLowerCase() === name.toLowerCase());
        if (existing) return existing;

        const id = Math.random().toString(36).substr(2, 9);
        const participant = {
            id,
            name,
            joinedAt: new Date().toISOString()
        };
        game.participants[id] = participant;
        return participant;
    },

    start: (eventId) => {
        const game = raffleGameService.getGame(eventId);
        game.status = 'WAITING'; // Ready to draw or showing QR
        game.winner = null;
        return game;
    },

    drawWinner: async (eventId, broadcastCallback) => {
        const game = raffleGameService.getGame(eventId);

        // 1. Set to COUNTDOWN for suspense
        game.status = 'COUNTDOWN';
        game.countdownEnd = Date.now() + 4000; // 4 seconds of suspense
        game.winner = null;
        if (broadcastCallback) broadcastCallback(eventId);

        // 2. Prepare the winner in background
        if (game.mode === 'PARTICIPANT') {
            const ids = Object.keys(game.participants);
            if (ids.length === 0) {
                game.status = 'IDLE';
                if (broadcastCallback) broadcastCallback(eventId);
                return { error: 'No participants' };
            }
            const randomId = ids[Math.floor(Math.random() * ids.length)];
            const winnerParticipant = game.participants[randomId];
            game.winner = {
                type: 'PARTICIPANT',
                participant: winnerParticipant,
                timestamp: new Date().toISOString()
            };
        } else {
            // PHOTO MODE - Fetch real photos if possible
            let photoUrl = game.customImageUrl && game.customImageUrl.trim().length > 5 ? game.customImageUrl : 'https://res.cloudinary.com/djetzdm5n/image/upload/v1769432962/appxv-events/jp6fbqmcpg53lfbhtm42.png';

            if (game.googlePhotosUrl) {
                try {
                    const photos = await googlePhotosService.getAlbumPhotos(game.googlePhotosUrl);
                    if (photos && photos.length > 0) {
                        const randomPhoto = photos[Math.floor(Math.random() * photos.length)];
                        photoUrl = randomPhoto.src;
                    }
                } catch (err) {
                    console.error('[Raffle] Failed to fetch Google Photos:', err.message);
                }
            }

            game.winner = {
                type: 'PHOTO',
                photoUrl: photoUrl,
                timestamp: new Date().toISOString()
            };
        }

        // 3. Wait for suspense to finish, then reveal
        setTimeout(() => {
            game.status = 'WINNER';
            if (broadcastCallback) broadcastCallback(eventId);
        }, 4000);

        return game;
    },

    reset: (eventId) => {
        const game = raffleGameService.getGame(eventId);
        game.status = 'IDLE';
        game.winner = null;
        // Optionally clear participants? Prompt says "Reiniciar sorteo", "Otro ganador".
        // "Reiniciar para otro ganador" implies keeping list but picking another.
        // "Volver / Reiniciar Sorteo" might mean full reset.
        // Let's keep participants for now to allow multiple draws.
        return game;
    }
};
