// Event-aware Trivia Game Service
// Uses BroadcastChannel + localStorage for real-time sync across tabs

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
    players: Record<string, TriviaPlayer>;
}

export type TriviaEvent =
    | { type: 'STATE_UPDATE'; payload: TriviaGameState }
    | { type: 'RESET_GAME' };

const getChannelName = (eventId: string) => `trivia_channel_${eventId}`;
const getStorageKey = (eventId: string) => `trivia_state_${eventId}`;

const createInitialState = (eventId: string): TriviaGameState => ({
    eventId,
    status: 'WAITING',
    questions: [],
    currentQuestionIndex: -1,
    questionStartTime: null,
    isAnswerRevealed: false,
    players: {},
});

// Channel cache to avoid recreating
const channelCache: Record<string, BroadcastChannel> = {};

// Local subscribers (for same-tab updates - BroadcastChannel only notifies OTHER tabs)
const localSubscribers: Record<string, Set<(state: TriviaGameState) => void>> = {};

const getChannel = (eventId: string): BroadcastChannel => {
    if (!channelCache[eventId]) {
        channelCache[eventId] = new BroadcastChannel(getChannelName(eventId));
    }
    return channelCache[eventId];
};

export const getStoredState = (eventId: string): TriviaGameState => {
    const stored = localStorage.getItem(getStorageKey(eventId));
    return stored ? JSON.parse(stored) : createInitialState(eventId);
};

const saveState = (eventId: string, state: TriviaGameState) => {
    localStorage.setItem(getStorageKey(eventId), JSON.stringify(state));

    // Notify other tabs via BroadcastChannel
    const channel = getChannel(eventId);
    channel.postMessage({ type: 'STATE_UPDATE', payload: state });

    // Notify local subscribers (same tab) - BroadcastChannel doesn't do this!
    const subscribers = localSubscribers[eventId];
    if (subscribers) {
        subscribers.forEach(callback => callback(state));
    }
};

export const triviaService = {
    // Subscribe to state changes
    subscribe: (eventId: string, callback: (state: TriviaGameState) => void) => {
        // Register local subscriber
        if (!localSubscribers[eventId]) {
            localSubscribers[eventId] = new Set();
        }
        localSubscribers[eventId].add(callback);

        // Initial load
        callback(getStoredState(eventId));

        // Listen to other tabs
        const channel = getChannel(eventId);
        const handler = (event: MessageEvent<TriviaEvent>) => {
            if (event.data.type === 'STATE_UPDATE') {
                callback(event.data.payload);
            }
        };
        channel.addEventListener('message', handler);

        // Cleanup function
        return () => {
            channel.removeEventListener('message', handler);
            localSubscribers[eventId]?.delete(callback);
        };
    },

    // --- Admin Actions ---

    setQuestions: (eventId: string, questions: TriviaQuestion[]) => {
        const state = getStoredState(eventId);
        saveState(eventId, { ...state, questions });
    },

    addQuestion: (eventId: string, question: Omit<TriviaQuestion, 'id'>) => {
        const state = getStoredState(eventId);
        const newQuestion: TriviaQuestion = {
            ...question,
            id: crypto.randomUUID(),
        };
        saveState(eventId, { ...state, questions: [...state.questions, newQuestion] });
    },

    updateQuestion: (eventId: string, questionId: string, updates: Partial<TriviaQuestion>) => {
        const state = getStoredState(eventId);
        const questions = state.questions.map(q =>
            q.id === questionId ? { ...q, ...updates } : q
        );
        saveState(eventId, { ...state, questions });
    },

    deleteQuestion: (eventId: string, questionId: string) => {
        const state = getStoredState(eventId);
        const questions = state.questions.filter(q => q.id !== questionId);
        saveState(eventId, { ...state, questions });
    },

    startGame: (eventId: string) => {
        const state = getStoredState(eventId);
        saveState(eventId, {
            ...state,
            status: 'PLAYING',
            currentQuestionIndex: -1,
            isAnswerRevealed: false,
        });
    },

    nextQuestion: (eventId: string) => {
        const state = getStoredState(eventId);
        const nextIndex = state.currentQuestionIndex + 1;

        if (nextIndex >= state.questions.length) {
            return false; // No more questions
        }

        saveState(eventId, {
            ...state,
            currentQuestionIndex: nextIndex,
            questionStartTime: Date.now(),
            isAnswerRevealed: false,
        });
        return true;
    },

    revealAnswer: (eventId: string) => {
        const state = getStoredState(eventId);
        saveState(eventId, { ...state, isAnswerRevealed: true });
    },

    endGame: (eventId: string) => {
        const state = getStoredState(eventId);
        saveState(eventId, {
            ...state,
            status: 'FINISHED',
            currentQuestionIndex: -1,
        });
    },

    resetGame: (eventId: string) => {
        saveState(eventId, createInitialState(eventId));
    },

    // --- Guest Actions ---

    joinPlayer: (eventId: string, playerId: string, name: string) => {
        const state = getStoredState(eventId);
        if (!state.players[playerId]) {
            const newPlayers = {
                ...state.players,
                [playerId]: { id: playerId, name, score: 0, answers: {} },
            };
            saveState(eventId, { ...state, players: newPlayers });
        }
    },

    submitAnswer: (eventId: string, playerId: string, questionId: string, answer: OptionKey) => {
        const state = getStoredState(eventId);
        const player = state.players[playerId];
        const currentQuestion = state.questions[state.currentQuestionIndex];

        // Validation
        if (!player) return false;
        if (!currentQuestion || currentQuestion.id !== questionId) return false;
        if (player.answers[questionId]) return false; // Already answered

        // Calculate score
        let newScore = player.score;
        if (currentQuestion.correctOption === answer) {
            newScore += 1;
        }

        const updatedPlayer = {
            ...player,
            score: newScore,
            answers: { ...player.answers, [questionId]: answer },
        };

        saveState(eventId, {
            ...state,
            players: { ...state.players, [playerId]: updatedPlayer },
        });

        return true;
    },

    // --- Utility ---

    getCurrentQuestion: (eventId: string): TriviaQuestion | null => {
        const state = getStoredState(eventId);
        if (state.currentQuestionIndex < 0 || state.currentQuestionIndex >= state.questions.length) {
            return null;
        }
        return state.questions[state.currentQuestionIndex];
    },

    getLeaderboard: (eventId: string): TriviaPlayer[] => {
        const state = getStoredState(eventId);
        return Object.values(state.players).sort((a, b) => b.score - a.score);
    },

    getPlayerRank: (eventId: string, playerId: string): number => {
        const leaderboard = triviaService.getLeaderboard(eventId);
        const index = leaderboard.findIndex(p => p.id === playerId);
        return index >= 0 ? index + 1 : 0;
    },
};
