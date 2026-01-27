
export interface ConfessionMessage {
    id: string;
    text: string;
    author: string;
    timestamp: string;
    color: string;
    rotate: string;
    isNew?: boolean;
}

export interface ConfessionsState {
    eventId: string;
    status: 'ACTIVE' | 'STOPPED';
    backgroundUrl: string;
    messages: ConfessionMessage[];
}

const API_BASE = '/api/confessions';

export const confessionsService = {
    subscribe: (eventId: string, callback: (state: ConfessionsState) => void, playerId?: string) => {
        const url = playerId
            ? `${API_BASE}/${eventId}/stream?clientId=${playerId}`
            : `${API_BASE}/${eventId}/stream`;
        const eventSource = new EventSource(url);

        eventSource.onmessage = (event) => {
            try {
                const state = JSON.parse(event.data);
                callback(state);
            } catch (e) {
                console.error('Confessions SSE parse error:', e);
            }
        };

        eventSource.onerror = (err) => {
            console.error('Confessions SSE error:', err);
            // Reconnect logic could be added here
        };

        return () => {
            eventSource.close();
        };
    },

    getState: async (eventId: string): Promise<ConfessionsState> => {
        const response = await fetch(`${API_BASE}/${eventId}`);
        return response.json();
    },

    updateConfig: async (eventId: string, config: Partial<ConfessionsState>) => {
        const response = await fetch(`${API_BASE}/${eventId}/config`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });
        return response.json();
    },

    sendMessage: async (eventId: string, text: string, author?: string) => {
        const response = await fetch(`${API_BASE}/${eventId}/message`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, author })
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to send message');
        }
        return response.json();
    },

    resetGame: async (eventId: string) => {
        const response = await fetch(`${API_BASE}/${eventId}/reset`, {
            method: 'POST'
        });
        return response.json();
    }
};
