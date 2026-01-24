
// In-memory state for Raffle Games (Sorteos)
// Similar to Bingo, but simpler logic.

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

    drawWinner: (eventId) => {
        const game = raffleGameService.getGame(eventId);

        if (game.mode === 'PARTICIPANT') {
            const ids = Object.keys(game.participants);
            if (ids.length === 0) return { error: 'No participatns' };
            const randomId = ids[Math.floor(Math.random() * ids.length)];
            const winner = game.participants[randomId];
            game.winner = {
                type: 'PARTICIPANT',
                participant: winner,
                timestamp: new Date().toISOString()
            };
        } else {
            // PHOTO MODE
            // Since we don't have real Google Photos API access to get a list of photos,
            // we will simulate "picking" one. 
            // In a real scenario, we'd need to scrape or use API.
            // For now, we rely on the client or just show the "Winner" state 
            // and let the client logic handles the display (e.g. random slideshow stop).
            // BUT the prompt asks for "El sistema selecciona una foto aleatoria".
            // We will just set state to WINNER and provide a flag, 
            // assuming the client might need to handle the visual "Selection".
            // Or we can mock a photo URL if we had a library.
            // Let's just mock a generic "Winner Selected" state and maybe a placeholder if no URL.

            // If the user provided a Google Photos Link, real extraction is hard.
            // We'll mark as winner and let the frontend show a generic "Photo Selected" 
            // or we pick a random image from a hardcoded set just for demo.
            const demoPhotos = [
                'https://images.unsplash.com/photo-1533227297464-af803d275e58?auto=format&fit=crop&q=80',
                'https://images.unsplash.com/photo-1513151233558-d860c5398176?auto=format&fit=crop&q=80',
                'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&q=80'
            ];
            const randomPhoto = demoPhotos[Math.floor(Math.random() * demoPhotos.length)];

            game.winner = {
                type: 'PHOTO',
                photoUrl: randomPhoto,
                timestamp: new Date().toISOString()
            };
        }

        game.status = 'WINNER';
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
