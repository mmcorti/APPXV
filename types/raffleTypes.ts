
export type RaffleMode = 'PHOTO' | 'PARTICIPANT';
export type RaffleStatus = 'IDLE' | 'WAITING' | 'COUNTDOWN' | 'WINNER';

export interface RaffleParticipant {
    id: string;
    name: string;
    joinedAt: string; // ISO Date
}

export interface RaffleWinner {
    type: RaffleMode;
    participant?: RaffleParticipant;
    photoUrl?: string;
    timestamp: string;
}

export interface RaffleState {
    eventId: string;
    status: RaffleStatus;
    mode: RaffleMode;
    googlePhotosUrl: string;
    customImageUrl: string;
    participants: Record<string, RaffleParticipant>; // Map for easier lookup
    winner?: RaffleWinner;
    config: {
        allowRegistration: boolean;
    };
}
