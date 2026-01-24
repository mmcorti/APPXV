
// Similar to Bingo, but simpler logic.
import { googlePhotosService } from './googlePhotos.js';

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
            games[eventId] = createInitialState(eventId);
        }
        return games[eventId];
    },

    updateConfig: (eventId, { googlePhotosUrl, customImageUrl, mode }) => {
        const game = raffleGameService.getGame(eventId);
        if (googlePhotosUrl !== undefined) game.googlePhotosUrl = googlePhotosUrl;
        if (customImageUrl !== undefined) game.customImageUrl = customImageUrl;
        if (mode !== undefined) game.mode = mode;
        return game;
    },

    joinParticipant: (eventId, name) => {
        const game = raffleGameService.getGame(eventId);
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
            let photoUrl = 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30'; // fallback

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
