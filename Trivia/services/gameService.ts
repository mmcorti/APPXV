import { GameState, GameEvent, INITIAL_GAME_STATE, Question } from '../types';
import { GoogleGenAI, Type } from "@google/genai";

const CHANNEL_NAME = 'antigravity_trivia_channel';
const STORAGE_KEY = 'antigravity_trivia_state';

// Using BroadcastChannel to simulate WebSocket behavior across tabs
const channel = new BroadcastChannel(CHANNEL_NAME);

// --- State Management (Simulated Database) ---

export const getStoredState = (): GameState => {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : INITIAL_GAME_STATE;
};

const saveState = (state: GameState) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  // Broadcast the new state to all listeners
  channel.postMessage({ type: 'STATE_UPDATE', payload: state });
};

// --- Actions (Client -> "Server") ---

export const gameService = {
  subscribe: (callback: (state: GameState) => void) => {
    // Initial load
    callback(getStoredState());

    const handler = (event: MessageEvent<GameEvent>) => {
      if (event.data.type === 'STATE_UPDATE') {
        callback(event.data.payload);
      }
    };
    channel.addEventListener('message', handler);
    return () => channel.removeEventListener('message', handler);
  },

  // --- Admin Actions ---

  setQuestions: (questions: Question[]) => {
    const state = getStoredState();
    saveState({ ...state, questions });
  },

  startGame: () => {
    const state = getStoredState();
    saveState({ ...state, status: 'PLAYING', currentQuestionId: null, isAnswerRevealed: false });
  },

  nextQuestion: (questionId: string) => {
    const state = getStoredState();
    saveState({
      ...state,
      currentQuestionId: questionId,
      questionStartTime: Date.now(),
      isAnswerRevealed: false,
    });
  },

  revealAnswer: () => {
    const state = getStoredState();
    saveState({ ...state, isAnswerRevealed: true });
  },

  endGame: () => {
    const state = getStoredState();
    saveState({ ...state, status: 'FINISHED', currentQuestionId: null });
  },

  resetGame: () => {
    saveState(INITIAL_GAME_STATE);
  },

  // --- Guest Actions ---

  joinPlayer: (id: string, name: string) => {
    const state = getStoredState();
    if (!state.players[id]) {
      const newPlayers = {
        ...state.players,
        [id]: { id, name, score: 0, answers: {} }
      };
      saveState({ ...state, players: newPlayers });
    }
  },

  submitAnswer: (playerId: string, questionId: string, answer: any) => { // using any for ease, cast to OptionKey
    const state = getStoredState();
    const player = state.players[playerId];
    
    // Validation: Game must be playing, question must match, player must exist
    if (!player || state.currentQuestionId !== questionId) return;
    if (player.answers[questionId]) return; // Already answered

    // Calculate score immediately (Simulating server-side logic)
    const question = state.questions.find(q => q.id === questionId);
    let newScore = player.score;
    
    if (question && question.correctOption === answer) {
      newScore += 1;
    }

    const updatedPlayer = {
      ...player,
      score: newScore,
      answers: { ...player.answers, [questionId]: answer }
    };

    saveState({
      ...state,
      players: { ...state.players, [playerId]: updatedPlayer }
    });
  },

  // --- AI Generation ---

  generateQuestions: async (topic: string, count: number = 5): Promise<Question[]> => {
    if (!process.env.API_KEY) {
      console.warn("No API KEY found");
      return [];
    }
    
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const prompt = `Generate ${count} trivia questions about "${topic}".
    Strictly follow this JSON structure for the output.
    Duration should be between 10 and 20 seconds.
    The output must be a valid JSON array.`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            text: { type: Type.STRING },
                            options: { 
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        key: { type: Type.STRING, enum: ["A", "B", "C", "D"] },
                                        text: { type: Type.STRING }
                                    }
                                }
                            },
                            correctOption: { type: Type.STRING, enum: ["A", "B", "C", "D"] },
                            durationSeconds: { type: Type.NUMBER }
                        }
                    }
                }
            }
        });

        const rawData = response.text ? JSON.parse(response.text) : [];
        
        // Map to our internal ID structure
        return rawData.map((q: any) => ({
            ...q,
            id: crypto.randomUUID(),
        }));
    } catch (e) {
        console.error("Failed to generate questions", e);
        return [];
    }
  }
};