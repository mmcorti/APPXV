
const games = {};

const createInitialState = (eventId) => ({
    eventId,
    status: 'ACTIVE', // ACTIVE, STOPPED
    backgroundUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAJYU2fuJI3YWUzaClnJ1-pbOWFMmCXVkZTkVHXDuGTH-spj8sCaB2AfldGssXgmb2WBREtSiWzSj2GQz-lY0JiMYKElcgdLjKVp3V0_7T6OrPWANOdtVXkc8Rwi64YNIJzqu3EU43z05_hntrsuPrbZWNoeyPfysSqIUHdSyLFm3hVg5_W0bNWRJsxLsh_MUFg7AM5fba-TuZ0eA2aM6yvc2UaKZpvaLAykRpUlj18bnFmrmWaXIZsVXvrU02ZtPd6c9wtmALPNIk',
    messages: [] // Array of { id, text, author, timestamp, color, rotate }
});

export const confessionsGameService = {
    getGame: (eventId) => {
        if (!games[eventId]) {
            games[eventId] = createInitialState(eventId);
        }
        return games[eventId];
    },

    updateConfig: (eventId, { backgroundUrl, status }) => {
        const game = confessionsGameService.getGame(eventId);
        if (backgroundUrl !== undefined) game.backgroundUrl = backgroundUrl;
        if (status !== undefined) game.status = status;
        return game;
    },

    addMessage: (eventId, { text, author }) => {
        const game = confessionsGameService.getGame(eventId);

        // Don't accept messages if stopped
        if (game.status === 'STOPPED') {
            throw new Error('Game is not accepting messages');
        }

        const colors = ["#fef08a", "#bfdbfe", "#bbf7d0", "#fecaca", "#ddd6fe", "#fde68a"];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        const randomRotate = Math.floor(Math.random() * 24) - 12 + 'deg'; // -12 to 12 deg

        const message = {
            id: Math.random().toString(36).substr(2, 9),
            text: text.substring(0, 140), // Hard limit
            author: author || 'Anonymous', // Optional
            timestamp: new Date().toISOString(),
            color: randomColor,
            rotate: randomRotate,
            isNew: true // Flag for animation
        };

        game.messages.push(message);

        // Keep only last 100 messages for memory safety
        if (game.messages.length > 100) {
            game.messages = game.messages.slice(-100);
        }

        return message;
    },

    reset: (eventId) => {
        const game = confessionsGameService.getGame(eventId);
        game.messages = [];
        return game;
    }
};
