export type OptionKey = 'A' | 'B' | 'C' | 'D';

export interface AnswerOption {
  key: OptionKey;
  text: string;
}

export interface Question {
  id: string;
  text: string;
  options: AnswerOption[];
  correctOption: OptionKey;
  durationSeconds: number;
}

export interface Player {
  id: string;
  name: string;
  score: number;
  answers: Record<string, OptionKey>; // questionId -> answer
}

// Global Game State stored in "Backend" (simulated)
export type GameStatus = 'WAITING' | 'PLAYING' | 'FINISHED';

export interface GameState {
  status: GameStatus;
  questions: Question[];
  currentQuestionId: string | null;
  // Timestamp when the current question started (for sync timer)
  questionStartTime: number | null; 
  // If true, the correct answer is revealed on the big screen
  isAnswerRevealed: boolean;
  players: Record<string, Player>;
}

// Events for the BroadcastChannel
export type GameEvent = 
  | { type: 'STATE_UPDATE'; payload: GameState }
  | { type: 'PLAYER_JOIN'; payload: { id: string; name: string } }
  | { type: 'PLAYER_ANSWER'; payload: { playerId: string; questionId: string; answer: OptionKey } }
  | { type: 'RESET_GAME' };

export const INITIAL_GAME_STATE: GameState = {
  status: 'WAITING',
  questions: [],
  currentQuestionId: null,
  questionStartTime: null,
  isAnswerRevealed: false,
  players: {},
};
