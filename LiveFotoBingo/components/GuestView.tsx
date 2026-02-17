import React, { useState, useEffect, useRef } from 'react';
import { gameService } from '../services/gameService';
import { GameState, BingoCard, Prompt } from '../types';

export const GuestView: React.FC = () => {
  const [state, setState] = useState<GameState>(gameService.getState());
  const [playerName, setPlayerName] = useState('');
  const [isRegistered, setIsRegistered] = useState(false);
  const [card, setCard] = useState<BingoCard | undefined>(undefined);
  const [activePrompt, setActivePrompt] = useState<Prompt | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);

  useEffect(() => {
    // Check local storage for session recovery
    const pid = sessionStorage.getItem('bingo_player_id');
    if (pid) {
      setPlayerId(pid);
      setIsRegistered(true);
      setCard(gameService.getPlayerCard(pid));
    }

    const update = () => {
      setState(gameService.getState());
      if (pid) {
        setCard(gameService.getPlayerCard(pid));
      }
    };
    const unsub = gameService.subscribe(update);
    return unsub;
  }, []);

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) return;
    const p = gameService.registerPlayer(playerName);
    sessionStorage.setItem('bingo_player_id', p.id);
    setPlayerId(p.id);
    setCard(gameService.getPlayerCard(p.id));
    setIsRegistered(true);
  };

  const handleCellClick = (prompt: Prompt) => {
    if (state.status !== 'PLAYING') return;
    if (card?.submittedAt) return; // Prevent editing after submit
    setActivePrompt(prompt);
    // Trigger file input
    setTimeout(() => {
       fileInputRef.current?.click();
    }, 100);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && activePrompt && playerId) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (ev) => {
        const result = ev.target?.result as string;
        gameService.updateCardCell(playerId, activePrompt.id, result);
        setActivePrompt(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = () => {
    if (!playerId) return;
    if (confirm("Are you sure? You cannot change photos after sending.")) {
       gameService.submitCard(playerId);
    }
  };

  // --- Render Login ---
  if (!isRegistered) {
    return (
      <div className="min-h-screen bg-indigo-500 flex items-center justify-center p-6 font-sans">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-8 text-center">
          <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-3xl">camera_alt</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Join Photo Bingo</h1>
          <p className="text-gray-500 mb-6 text-sm">Enter your name to start playing!</p>
          <form onSubmit={handleRegister}>
             <input 
               type="text" 
               className="w-full border-2 border-gray-200 rounded-xl p-3 text-center text-lg focus:border-indigo-500 focus:outline-none mb-4"
               placeholder="Your Name"
               value={playerName}
               onChange={(e) => setPlayerName(e.target.value)}
             />
             <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">
               Let's Play!
             </button>
          </form>
        </div>
      </div>
    );
  }

  // --- Render Waiting Room ---
  if (state.status === 'WAITING') {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8 text-center font-sans">
        <div className="animate-bounce mb-4 text-6xl">⏳</div>
        <h2 className="text-xl font-bold mb-2">Welcome, {playerName}!</h2>
        <p className="text-gray-500">Waiting for the host to start the game.</p>
        <div className="mt-8 p-4 bg-gray-50 rounded-xl text-sm text-gray-400">
          Tip: Make sure you have camera permissions enabled!
        </div>
      </div>
    );
  }

  // --- Render Game Grid ---
  const cellCount = card ? Object.keys(card.cells).length : 0;
  const isEligible = (card?.completedLines || 0) > 0 || card?.isFullHouse;

  return (
    <div className="min-h-screen bg-gray-100 pb-24 font-sans max-w-md mx-auto relative shadow-2xl">
      {/* Header */}
      <header className="bg-indigo-600 text-white p-4 pt-safe-top sticky top-0 z-20 shadow-md">
        <div className="flex justify-between items-center">
           <div className="font-bold text-lg">Photo Bingo</div>
           <div className="text-xs bg-indigo-500 px-2 py-1 rounded-full">{cellCount}/9 Photos</div>
        </div>
        {/* Progress Bar */}
        <div className="w-full bg-indigo-800 h-1.5 mt-3 rounded-full overflow-hidden">
          <div className="bg-yellow-400 h-full transition-all duration-500" style={{ width: `${(cellCount / 9) * 100}%` }}></div>
        </div>
      </header>

      {/* Grid */}
      <div className="p-4 grid grid-cols-3 gap-3">
         {state.prompts.map(prompt => {
           const cell = card?.cells[prompt.id];
           const hasPhoto = !!cell?.photoUrl;
           
           return (
             <button
               key={prompt.id}
               onClick={() => handleCellClick(prompt)}
               className={`aspect-square rounded-xl relative overflow-hidden transition-all transform active:scale-95 shadow-sm border-2 
                 ${hasPhoto ? 'border-green-500' : 'border-white bg-white'}`}
               disabled={state.status !== 'PLAYING'}
             >
               {hasPhoto ? (
                 <>
                   <img src={cell.photoUrl} className="w-full h-full object-cover" alt="Snapped" />
                   <div className="absolute top-1 right-1 bg-green-500 text-white rounded-full p-0.5 shadow-md">
                      <span className="material-symbols-outlined text-sm block">check</span>
                   </div>
                 </>
               ) : (
                 <div className="flex flex-col items-center justify-center h-full p-1 text-gray-400 hover:bg-gray-50">
                   <span className="material-symbols-outlined text-3xl mb-1 text-indigo-300">{prompt.icon}</span>
                   <span className="text-[10px] font-bold text-center leading-tight text-gray-600">{prompt.text}</span>
                 </div>
               )}
             </button>
           );
         })}
      </div>

      {/* Hidden File Input */}
      <input 
        type="file" 
        accept="image/*" 
        capture="environment"
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Footer Action */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 z-30 max-w-md mx-auto">
         {state.status === 'REVIEW' || state.status === 'WINNER' ? (
           <div className="bg-yellow-100 text-yellow-800 p-3 rounded-xl text-center font-bold">
             Game is under review!
           </div>
         ) : (
           <button 
            onClick={handleSubmit}
            disabled={!isEligible}
            className={`w-full py-3 rounded-xl font-bold text-lg shadow-lg transition-all flex items-center justify-center gap-2
              ${isEligible 
                ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white animate-pulse' 
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
           >
             {isEligible ? (
               <>
                 <span className="material-symbols-outlined">send</span> Send Bingo Card!
               </>
             ) : (
               'Complete a line to send'
             )}
           </button>
         )}
      </div>
    </div>
  );
};