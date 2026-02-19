// Photo Bingo Game Service
// Uses SSE (Server-Sent Events) for real-time cross-device sync

import {
    BingoGameState,
    BingoPrompt,
    BingoPlayer,
    BingoSubmission,
    DEFAULT_BINGO_PROMPTS
} from '../game-types/bingoTypes';

const API_BASE = '/api/bingo';

// Create initial state (for loading state)
const createInitialState = (eventId: string): BingoGameState => ({
    eventId,
    status: 'WAITING',
    prompts: [...DEFAULT_BINGO_PROMPTS],
    googlePhotosLink: '',
    customImageUrl: 'https://res.cloudinary.com/djetzdm5n/image/upload/v1769432962/appxv-events/jp6fbqmcpg53lfbhtm42.png',
    winner: undefined,
    players: {},
    cards: {},
    submissions: []
});

export const bingoService = {
    // Subscribe to real-time state updates via SSE
    subscribe: (eventId: string, callback: (state: BingoGameState) => void, playerId?: string) => {
        const url = playerId
            ? `${API_BASE}/${eventId}/stream?clientId=${playerId}`
            : `${API_BASE}/${eventId}/stream`;

        // Create SSE connection
        const eventSource = new EventSource(url);

        eventSource.onmessage = (event) => {
            try {
                const state = JSON.parse(event.data);
                callback(state);
            } catch (e) {
                console.error('Failed to parse Bingo SSE data:', e);
            }
        };

        eventSource.onerror = (error) => {
            console.error('Bingo SSE connection error:', error);
            // Reconnect after 3 seconds
            setTimeout(() => {
                if (eventSource.readyState === EventSource.CLOSED) {
                    console.log('Bingo SSE reconnecting...');
                    bingoService.subscribe(eventId, callback);
                }
            }, 3000);
        };

        // Return cleanup function
        return () => {
            eventSource.close();
        };
    },

    // --- Get State ---
    getState: async (eventId: string): Promise<BingoGameState> => {
        const response = await fetch(`${API_BASE}/${eventId}`);
        return response.json();
    },

    // --- Admin Actions ---


    updatePrompts: async (eventId: string, prompts: BingoPrompt[]) => {
        const response = await fetch(`${API_BASE}/${eventId}/prompts`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompts }),
        });
        return response.json();
    },

    generatePrompts: async (theme: string, count: number = 9): Promise<{ prompts: BingoPrompt[] }> => {
        const response = await fetch(`${API_BASE}/generate-prompts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ theme, count }),
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Error del servidor' }));
            throw new Error(errorData.error || `Server error: ${response.status}`);
        }
        return response.json();
    },


    updateSettings: async (eventId: string, settings: { googlePhotosLink?: string, hostPlan?: string, customImageUrl?: string }) => {
        const response = await fetch(`${API_BASE}/${eventId}/settings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings),
        });
        return response.json();
    },

    startGame: async (eventId: string) => {
        const response = await fetch(`${API_BASE}/${eventId}/start`, {
            method: 'POST',
        });
        return response.json();
    },

    stopGame: async (eventId: string) => {
        const response = await fetch(`${API_BASE}/${eventId}/stop`, {
            method: 'POST',
        });
        return response.json();
    },

    finishGame: async (eventId: string) => {
        const response = await fetch(`${API_BASE}/${eventId}/finish`, {
            method: 'POST',
        });
        return response.json();
    },

    approveSubmission: async (eventId: string, submissionId: string) => {
        const response = await fetch(`${API_BASE}/${eventId}/approve/${submissionId}`, {
            method: 'POST',
        });
        return response.json();
    },

    rejectSubmission: async (eventId: string, submissionId: string) => {
        const response = await fetch(`${API_BASE}/${eventId}/reject/${submissionId}`, {
            method: 'POST',
        });
        return response.json();
    },

    resetGame: async (eventId: string) => {
        const response = await fetch(`${API_BASE}/${eventId}/reset`, {
            method: 'POST',
        });
        return response.json();
    },

    // --- Guest Actions ---

    joinPlayer: async (eventId: string, name: string, userPlan?: string, userRole?: string) => {
        const response = await fetch(`${API_BASE}/${eventId}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, userPlan, userRole }),
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Failed to join game');
        }
        return data;
    },

    uploadPhoto: async (eventId: string, playerId: string, promptId: number, photoUrl: string) => {
        const response = await fetch(`${API_BASE}/${eventId}/upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerId, promptId, photoUrl }),
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Failed to upload photo');
        }
        return data;
    },

    submitCard: async (eventId: string, playerId: string) => {
        const response = await fetch(`${API_BASE}/${eventId}/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerId }),
        });

        // Handle empty or error responses gracefully
        const text = await response.text();
        let data;
        try {
            data = text ? JSON.parse(text) : {};
        } catch (e) {
            throw new Error('Error de conexión con el servidor');
        }

        if (!response.ok) {
            throw new Error(data.error || 'Failed to submit card');
        }
        return data;
    },

    // --- Utility ---

    getSubmissions: async (eventId: string): Promise<BingoSubmission[]> => {
        const state = await bingoService.getState(eventId);
        return state.submissions;
    },

    getPlayerCount: async (eventId: string): Promise<number> => {
        const state = await bingoService.getState(eventId);
        return Object.values(state.players).filter((p: any) => p.online !== false).length;
    },

    createInitialState,
};

export type { BingoGameState, BingoPrompt, BingoPlayer, BingoSubmission };
