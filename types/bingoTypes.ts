// Photo Bingo Game Types
// Matching the structure from the Live FotoBingo example

export type BingoGameStatus = 'WAITING' | 'PLAYING' | 'REVIEW' | 'WINNER';

export interface BingoPrompt {
    id: number;
    text: string;
    icon?: string; // Material symbol name
}

export interface BingoPlayer {
    id: string;
    name: string;
    joinedAt: number;
}

export interface BingoCell {
    promptId: number;
    photoUrl?: string; // DataURL or Blob URL
    hasPhoto?: boolean; // Lightweight flag when server doesn't send full Base64
    timestamp?: number;
}

export interface BingoCard {
    playerId: string;
    cells: Record<number, BingoCell>; // Key is promptId
    completedLines: number;
    isFullHouse: boolean;
    submittedAt?: number;
}

export interface BingoSubmission {
    id: string;
    player: BingoPlayer;
    card: BingoCard;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    submittedAt: number;
}

export interface BingoWinner {
    player: BingoPlayer;
    type: 'LINE' | 'BINGO';
}

export interface BingoGameState {
    eventId: string;
    status: BingoGameStatus;
    prompts: BingoPrompt[];
    googlePhotosLink: string;
    customImageUrl?: string;
    winner?: BingoWinner;
    players: Record<string, BingoPlayer>;
    cards: Record<string, BingoCard>;
    submissions: BingoSubmission[];
}

// Default prompts for initial setup
export const DEFAULT_BINGO_PROMPTS: BingoPrompt[] = [
    { id: 1, text: "Selfie con el anfitrión", icon: "person_pin" },
    { id: 2, text: "Alguien riendo", icon: "sentiment_very_satisfied" },
    { id: 3, text: "La persona más alta", icon: "height" },
    { id: 4, text: "Un trago raro", icon: "local_bar" },
    { id: 5, text: "Selfie grupal (3+)", icon: "groups" },
    { id: 6, text: "Alguien de rojo", icon: "palette" },
    { id: 7, text: "Paso de baile gracioso", icon: "music_note" },
    { id: 8, text: "El invitado más viejo", icon: "elderly" },
    { id: 9, text: "¡Brindis!", icon: "celebration" },
];
