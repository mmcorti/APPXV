
import { RaffleState, RaffleMode, RaffleStatus } from '../types/raffleTypes';

const API_BASE = '/api/raffle';

export const raffleService = {
    // Subscribe to real-time state updates via SSE
    subscribe: (eventId: string, callback: (state: RaffleState) => void) => {
        const eventSource = new EventSource(`${API_BASE}/${eventId}/stream`);

        eventSource.onmessage = (event) => {
            try {
                const state = JSON.parse(event.data);
                callback(state);
            } catch (e) {
                console.error('Failed to parse Raffle SSE data:', e);
            }
        };

        eventSource.onerror = (error) => {
            console.error('Raffle SSE connection error:', error);
            // Reconnect logic could go here
        };

        return () => {
            eventSource.close();
        };
    },

    // --- Admin Actions ---

    // Update configuration (Photos link, image, mode)
    updateConfig: async (eventId: string, config: { googlePhotosUrl?: string; customImageUrl?: string; mode?: RaffleMode }) => {
        const response = await fetch(`${API_BASE}/${eventId}/config`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config),
        });
        return response.json();
    },

    // Start the raffle (Accepting participants or Ready to draw)
    startRaffle: async (eventId: string) => {
        const response = await fetch(`${API_BASE}/${eventId}/start`, {
            method: 'POST',
        });
        return response.json();
    },

    // Draw a winner
    drawWinner: async (eventId: string) => {
        const response = await fetch(`${API_BASE}/${eventId}/draw`, {
            method: 'POST',
        });
        return response.json();
    },

    // Reset the game
    resetRaffle: async (eventId: string) => {
        const response = await fetch(`${API_BASE}/${eventId}/reset`, {
            method: 'POST',
        });
        return response.json();
    },

    // --- Guest Actions ---

    // Join the raffle (for Participant mode)
    joinRaffle: async (eventId: string, name: string) => {
        const response = await fetch(`${API_BASE}/${eventId}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
        });
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to join');
        }
        return response.json();
    },

    // Get state once
    getState: async (eventId: string) => {
        const response = await fetch(`${API_BASE}/${eventId}`);
        return response.json();
    }
};
