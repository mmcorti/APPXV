import { GameState, Player, Submission, Prompt, BingoCard } from '../types';

// Initial Mock Data
const INITIAL_PROMPTS: Prompt[] = [
  { id: 1, text: "Selfie with the host", icon: "person_pin" },
  { id: 2, text: "Someone laughing", icon: "sentiment_very_satisfied" },
  { id: 3, text: "The tallest person", icon: "height" },
  { id: 4, text: "A weird drink", icon: "local_bar" },
  { id: 5, text: "Group selfie (3+)", icon: "groups" },
  { id: 6, text: "Someone wearing red", icon: "palette" },
  { id: 7, text: "Funny dance move", icon: "music_note" },
  { id: 8, text: "The oldest guest", icon: "elderly" },
  { id: 9, text: "Toast cheers!", icon: "celebration" },
];

class GameService {
  private state: GameState = {
    status: 'WAITING',
    prompts: INITIAL_PROMPTS,
    googlePhotosLink: '',
  };

  private players: Map<string, Player> = new Map();
  private cards: Map<string, BingoCard> = new Map(); // playerId -> Card
  private submissions: Submission[] = [];
  private listeners: (() => void)[] = [];

  constructor() {
    // Load state from local storage if available for persistence during refresh
    const savedState = localStorage.getItem('bingo_state');
    if (savedState) {
      this.state = JSON.parse(savedState);
    }
  }

  // --- Helpers ---
  private notify() {
    localStorage.setItem('bingo_state', JSON.stringify(this.state));
    this.listeners.forEach(cb => cb());
  }

  subscribe(callback: () => void) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  getState() {
    return { ...this.state };
  }

  getPlayers() {
    return Array.from(this.players.values());
  }

  getSubmissions() {
    return [...this.submissions];
  }

  // --- Admin Actions ---
  setGooglePhotosLink(link: string) {
    this.state.googlePhotosLink = link;
    this.notify();
  }

  updatePrompts(prompts: Prompt[]) {
    this.state.prompts = prompts;
    this.notify();
  }

  startGame() {
    this.state.status = 'PLAYING';
    this.state.winner = undefined;
    this.submissions = [];
    this.notify();
  }

  stopGame() {
    this.state.status = 'REVIEW';
    this.notify();
  }

  resetGame() {
    this.state.status = 'WAITING';
    this.state.winner = undefined;
    this.submissions = [];
    this.cards.clear();
    this.players.clear();
    this.notify();
  }

  approveSubmission(submissionId: string) {
    const submission = this.submissions.find(s => s.id === submissionId);
    if (!submission) return;

    submission.status = 'APPROVED';
    this.state.status = 'WINNER';
    this.state.winner = {
      player: submission.player,
      type: submission.card.isFullHouse ? 'BINGO' : 'LINE'
    };
    this.notify();
  }

  rejectSubmission(submissionId: string) {
    const submission = this.submissions.find(s => s.id === submissionId);
    if (!submission) return;
    
    submission.status = 'REJECTED';
    // Logic: In a real game, maybe we notify the user. 
    // Here we just remove it from the queue visually or mark as rejected.
    this.notify();
  }

  // --- Player Actions ---
  registerPlayer(name: string): Player {
    const id = Math.random().toString(36).substring(7);
    const player: Player = { id, name, joinedAt: Date.now() };
    this.players.set(id, player);
    
    // Initialize empty card
    this.cards.set(id, {
      playerId: id,
      cells: {},
      completedLines: 0,
      isFullHouse: false
    });
    
    this.notify();
    return player;
  }

  getPlayerCard(playerId: string): BingoCard | undefined {
    return this.cards.get(playerId);
  }

  updateCardCell(playerId: string, promptId: number, photoUrl: string) {
    const card = this.cards.get(playerId);
    if (!card) return;

    card.cells[promptId] = {
      promptId,
      photoUrl,
      timestamp: Date.now()
    };

    // Calculate lines/bingo logic
    this.calculateBingoStatus(card);
    this.notify();
  }

  submitCard(playerId: string) {
    const player = this.players.get(playerId);
    const card = this.cards.get(playerId);
    
    if (!player || !card) return;

    // Basic validation
    if (Object.keys(card.cells).length === 0) return;

    const submission: Submission = {
      id: Math.random().toString(36).substring(7),
      player,
      card: { ...card }, // Snapshot
      status: 'PENDING'
    };

    this.submissions.push(submission);
    
    // Auto-switch game state to review if it was playing
    if (this.state.status === 'PLAYING') {
      this.state.status = 'REVIEW';
    }
    
    this.notify();
  }

  // --- Bingo Logic ---
  private calculateBingoStatus(card: BingoCard) {
    // 3x3 Grid IDs:
    // 1 2 3
    // 4 5 6
    // 7 8 9
    // Map prompt IDs to grid positions for standard checking if prompts are always 1-9.
    // However, prompts might have arbitrary IDs. Let's assume prompts array index maps to grid.
    
    const filledPromptIds = new Set(Object.keys(card.cells).map(Number));
    const promptIds = this.state.prompts.map(p => p.id);

    // Helper to check if a set of indices (0-8) are filled
    const checkIndices = (indices: number[]) => {
      return indices.every(idx => filledPromptIds.has(promptIds[idx]));
    };

    const winningLines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // Cols
      [0, 4, 8], [2, 4, 6]             // Diagonals
    ];

    let lines = 0;
    for (const line of winningLines) {
      if (checkIndices(line)) lines++;
    }

    card.completedLines = lines;
    card.isFullHouse = filledPromptIds.size === 9;
  }
}

export const gameService = new GameService();