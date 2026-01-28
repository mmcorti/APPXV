// Event-aware Trivia Game Service
// Uses SSE (Server-Sent Events) for real-time cross-device sync

const API_BASE = '/api/trivia';

export type OptionKey = 'A' | 'B' | 'C' | 'D';

export interface TriviaAnswerOption {
    key: OptionKey;
    text: string;
}

export interface TriviaQuestion {
    id: string;
    text: string;
    options: TriviaAnswerOption[];
    correctOption: OptionKey;
    durationSeconds: number;
}

export interface TriviaPlayer {
    id: string;
    name: string;
    score: number;
    answers: Record<string, OptionKey>; // questionId -> answer
}

export type TriviaGameStatus = 'WAITING' | 'PLAYING' | 'FINISHED';

export interface TriviaGameState {
    eventId: string;
    status: TriviaGameStatus;
    questions: TriviaQuestion[];
    currentQuestionIndex: number;
    questionStartTime: number | null;
    isAnswerRevealed: boolean;
    backgroundUrl: string;
    players: Record<string, TriviaPlayer>;
}

// Create initial state (for loading state)
const createInitialState = (eventId: string): TriviaGameState => ({
    eventId,
    status: 'WAITING',
    questions: [],
    currentQuestionIndex: -1,
    questionStartTime: null,
    isAnswerRevealed: false,
    backgroundUrl: '',
    players: {},
});

export const getStoredState = (eventId: string): TriviaGameState => {
    return createInitialState(eventId);
};

export const triviaService = {
    // Subscribe to real-time state updates via SSE
    subscribe: (eventId: string, callback: (state: TriviaGameState) => void, playerId?: string) => {
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
                console.error('Failed to parse SSE data:', e);
            }
        };

        eventSource.onerror = (error) => {
            console.error('SSE connection error:', error);
            // Reconnect after 3 seconds
            setTimeout(() => {
                if (eventSource.readyState === EventSource.CLOSED) {
                    console.log('SSE reconnecting...');
                    triviaService.subscribe(eventId, callback);
                }
            }, 3000);
        };

        // Return cleanup function
        return () => {
            eventSource.close();
        };
    },

    // --- Admin Actions ---

    addQuestion: async (eventId: string, question: Omit<TriviaQuestion, 'id'>, userPlan?: string, userRole?: string) => {
        const response = await fetch(`${API_BASE}/${eventId}/questions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...question, userPlan, userRole }),
        });
        return response.json();
    },

    updateQuestion: async (eventId: string, questionId: string, updates: Partial<TriviaQuestion>) => {
        const response = await fetch(`${API_BASE}/${eventId}/questions/${questionId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
        });
        return response.json();
    },

    updateAllDurations: async (eventId: string, durationSeconds: number) => {
        const response = await fetch(`${API_BASE}/${eventId}/questions/duration`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ durationSeconds }),
        });
        return response.json();
    },

    deleteQuestion: async (eventId: string, questionId: string) => {
        const response = await fetch(`${API_BASE}/${eventId}/questions/${questionId}`, {
            method: 'DELETE',
        });
        return response.json();
    },

    startGame: async (eventId: string) => {
        const response = await fetch(`${API_BASE}/${eventId}/start`, {
            method: 'POST',
        });
        return response.json();
    },

    nextQuestion: async (eventId: string) => {
        const response = await fetch(`${API_BASE}/${eventId}/next`, {
            method: 'POST',
        });
        const data = await response.json();
        return data.success;
    },

    revealAnswer: async (eventId: string) => {
        const response = await fetch(`${API_BASE}/${eventId}/reveal`, {
            method: 'POST',
        });
        return response.json();
    },

    endGame: async (eventId: string) => {
        const response = await fetch(`${API_BASE}/${eventId}/end`, {
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

    updateConfig: async (eventId: string, config: { backgroundUrl?: string }) => {
        const response = await fetch(`${API_BASE}/${eventId}/config`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config),
        });
        return response.json();
    },

    generateQuestions: async (theme: string, count: number) => {
        const response = await fetch(`${API_BASE}/generate-questions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ theme, count }),
        });
        return response.json();
    },

    // --- Guest Actions ---

    joinPlayer: async (eventId: string, playerId: string, name: string) => {
        const response = await fetch(`${API_BASE}/${eventId}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerId, name }),
        });
        return response.json();
    },

    submitAnswer: async (eventId: string, playerId: string, questionId: string, answer: OptionKey) => {
        const response = await fetch(`${API_BASE}/${eventId}/answer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerId, questionId, answer }),
        });
        const data = await response.json();
        return data.success;
    },

    // --- Utility ---

    getState: async (eventId: string): Promise<TriviaGameState> => {
        const response = await fetch(`${API_BASE}/${eventId}`);
        return response.json();
    },

    getCurrentQuestion: async (eventId: string): Promise<TriviaQuestion | null> => {
        const state = await triviaService.getState(eventId);
        if (state.currentQuestionIndex < 0 || state.currentQuestionIndex >= state.questions.length) {
            return null;
        }
        return state.questions[state.currentQuestionIndex];
    },

    getLeaderboard: async (eventId: string): Promise<TriviaPlayer[]> => {
        const state = await triviaService.getState(eventId);
        return Object.values(state.players).sort((a, b) => b.score - a.score);
    },

    getPlayerRank: async (eventId: string, playerId: string): Promise<number> => {
        const leaderboard = await triviaService.getLeaderboard(eventId);
        const index = leaderboard.findIndex(p => p.id === playerId);
        return index >= 0 ? index + 1 : 0;
    },
};
