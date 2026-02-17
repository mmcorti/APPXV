export type GameStatus = 'WAITING' | 'PLAYING' | 'REVIEW' | 'WINNER';

export interface Prompt {
  id: number;
  text: string;
  icon?: string; // Material symbol name
}

export interface Player {
  id: string;
  name: string;
  joinedAt: number;
}

export interface BingoCell {
  promptId: number;
  photoUrl?: string; // DataURL or Blob URL
  timestamp?: number;
}

export interface BingoCard {
  playerId: string;
  cells: Record<number, BingoCell>; // Key is promptId
  completedLines: number;
  isFullHouse: boolean;
  submittedAt?: number;
}

export interface Submission {
  id: string;
  player: Player;
  card: BingoCard;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export interface GameState {
  status: GameStatus;
  prompts: Prompt[];
  googlePhotosLink: string;
  winner?: {
    player: Player;
    type: 'LINE' | 'BINGO';
  };
}