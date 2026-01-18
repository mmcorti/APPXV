
export interface GuestAllotment {
  adults: number;
  teens: number;
  kids: number;
  infants: number;
}

export interface GuestCompanionNames {
  adults: string[];
  teens: string[];
  kids: string[];
  infants: string[];
}

export interface CompanionData {
  id?: string;
  name: string;
  index: number;
  type: 'adult' | 'teen' | 'kid' | 'infant';
}

export interface Guest {
  id: string | number;
  name: string;
  email?: string;
  status: 'confirmed' | 'pending' | 'declined';
  allotted: GuestAllotment;
  confirmed: GuestAllotment;
  companionNames?: GuestCompanionNames;
  companions?: CompanionData[]; // Rich companion data
  sent?: boolean;
}

export interface SeatedGuest {
  guestId: string | number;
  companionId?: string; // Optional ID for dedicated companion record
  companionIndex?: number; // -1 para el principal, 0+ para acompañantes específicos
  name: string;
  status: 'confirmed' | 'pending';
}

export interface Table {
  id: string;
  name: string;
  capacity: number;
  order?: number;
  guests: SeatedGuest[];
}

export interface InvitationData {
  id: string;
  eventName: string;
  hostName: string;
  date: string;
  time: string;
  location: string;
  image: string;
  message: string;
  giftType: 'alias' | 'list';
  giftDetail: string;
  guests: Guest[];
  tables?: Table[]; // Nueva propiedad para el armado de mesas
  fotowall?: {
    albumUrl: string;
    interval: number;
    shuffle: boolean;
    overlayTitle: string;
    mode: 'ai' | 'manual';
    filters: any;
  };
}

export interface User {
  name: string;
  email: string;
  avatar: string;
  role?: string;
}

export enum ImageSize {
  SIZE_1K = '1K',
  SIZE_2K = '2K',
  SIZE_4K = '4K'
}
