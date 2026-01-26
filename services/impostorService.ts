
export interface ImpostorPlayer {
    id: string;
    name: string;
    role: 'CIVILIAN' | 'IMPOSTOR';
    answer: string;
    avatar: string;
}

export interface ImpostorState {
    status: 'WAITING' | 'SUBMITTING' | 'VOTING' | 'REVEAL';
    config: {
        playerCount: number;
        impostorCount: number;
        mainPrompt: string;
        impostorPrompt: string;
        knowsRole: boolean;
    };
    activePlayers: ImpostorPlayer[];
    lobby: { id: string, name: string, avatar: string }[];
    votes: Record<string, string>;
    winner: 'PUBLIC' | 'IMPOSTOR' | null;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:10000/api';

export const impostorService = {
    async getState(eventId: string): Promise<ImpostorState> {
        const res = await fetch(`${API_URL}/impostor/${eventId}`);
        return res.json();
    },

    async joinSession(eventId: string, player: { id: string, name: string, avatar?: string }): Promise<ImpostorState> {
        const res = await fetch(`${API_URL}/impostor/${eventId}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(player)
        });
        return res.json();
    },

    async updateConfig(eventId: string, config: Partial<ImpostorState['config']> & { hostPlan?: string }): Promise<ImpostorState> {
        const res = await fetch(`${API_URL}/impostor/${eventId}/config`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });
        return res.json();
    },

    async selectPlayers(eventId: string, candidates: { id: string, name: string, avatar?: string }[]): Promise<ImpostorState> {
        const res = await fetch(`${API_URL}/impostor/${eventId}/select-players`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ candidates })
        });
        return res.json();
    },

    async startRound(eventId: string): Promise<ImpostorState> {
        const res = await fetch(`${API_URL}/impostor/${eventId}/start`, {
            method: 'POST'
        });
        return res.json();
    },

    async submitAnswer(eventId: string, playerId: string, answer: string): Promise<ImpostorState> {
        const res = await fetch(`${API_URL}/impostor/${eventId}/answer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerId, answer })
        });
        return res.json();
    },

    async castVote(eventId: string, voterId: string, targetId: string): Promise<ImpostorState> {
        const res = await fetch(`${API_URL}/impostor/${eventId}/vote`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ voterId, targetId })
        });
        return res.json();
    },

    async revealImpostor(eventId: string): Promise<ImpostorState> {
        const res = await fetch(`${API_URL}/impostor/${eventId}/reveal`, {
            method: 'POST'
        });
        return res.json();
    },

    async resetGame(eventId: string): Promise<ImpostorState> {
        const res = await fetch(`${API_URL}/impostor/${eventId}/reset`, {
            method: 'POST'
        });
        return res.json();
    },

    subscribe(eventId: string, callback: (state: ImpostorState) => void) {
        const eventSource = new EventSource(`${API_URL}/events/${eventId}/stream`);

        eventSource.addEventListener('IMPOSTOR_UPDATE', (event: any) => {
            const data = JSON.parse(event.data);
            callback(data.state);
        });

        return () => eventSource.close();
    }
};
