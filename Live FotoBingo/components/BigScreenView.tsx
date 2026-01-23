import React, { useState, useEffect } from 'react';
import { gameService } from '../services/gameService';
import { GameState, Submission } from '../types';

export const BigScreenView: React.FC = () => {
  const [state, setState] = useState<GameState>(gameService.getState());
  const [submissions, setSubmissions] = useState<Submission[]>([]);

  useEffect(() => {
    const update = () => {
      setState(gameService.getState());
      setSubmissions(gameService.getSubmissions());
    };
    const unsub = gameService.subscribe(update);
    update();
    return unsub;
  }, []);

  // Filter for display
  const latestPending = submissions.find(s => s.status === 'PENDING');
  const winner = state.winner;

  // Render Waiting Screen
  if (state.status === 'WAITING') {
    return (
      <div className="h-screen w-screen bg-slate-900 text-white flex flex-col items-center justify-center overflow-hidden relative">
        {/* Background Animation */}
        <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] animate-pulse"></div>
        
        <div className="z-10 text-center space-y-8 p-12 bg-white/5 backdrop-blur-lg rounded-3xl border border-white/10 shadow-2xl max-w-4xl w-full">
          <h1 className="text-7xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 drop-shadow-lg">
            PHOTO BINGO
          </h1>
          
          <div className="flex flex-col md:flex-row items-center justify-center gap-12 mt-8">
            <div className="bg-white p-4 rounded-xl shadow-lg transform -rotate-2 hover:rotate-0 transition-transform duration-500">
               {/* Placeholder QR Code - In a real app, generate dynamically based on current URL */}
               <img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=window.location.href" alt="Join QR" className="w-64 h-64 mix-blend-multiply" />
            </div>
            <div className="text-left space-y-4">
              <h2 className="text-4xl font-bold">How to play:</h2>
              <ol className="text-2xl space-y-3 text-gray-300">
                <li className="flex items-center gap-4"><span className="bg-indigo-600 rounded-full w-10 h-10 flex items-center justify-center text-lg font-bold">1</span> Scan the QR Code</li>
                <li className="flex items-center gap-4"><span className="bg-indigo-600 rounded-full w-10 h-10 flex items-center justify-center text-lg font-bold">2</span> Enter your Name</li>
                <li className="flex items-center gap-4"><span className="bg-indigo-600 rounded-full w-10 h-10 flex items-center justify-center text-lg font-bold">3</span> Wait for Start!</li>
              </ol>
            </div>
          </div>
          
          <div className="pt-8 text-xl font-mono animate-bounce text-indigo-400">
            Waiting for host to start...
          </div>
        </div>
      </div>
    );
  }

  // Render Winner Screen
  if (state.status === 'WINNER' && winner) {
    return (
      <div className="h-screen w-screen bg-indigo-900 flex flex-col items-center justify-center relative overflow-hidden">
        {/* Confetti Effect (CSS only sim) */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <div key={i} className="absolute animate-float" style={{
              left: `${Math.random() * 100}%`,
              top: '-10%',
              animationDuration: `${Math.random() * 3 + 2}s`,
              animationDelay: `${Math.random() * 2}s`,
              fontSize: `${Math.random() * 2 + 1}rem`
            }}>
              {['🎉', '🎊', '✨', '🏆'][i % 4]}
            </div>
          ))}
        </div>

        <div className="text-center z-10 animate-zoom-in">
          <h2 className="text-4xl text-yellow-300 font-bold tracking-widest uppercase mb-4 drop-shadow-md">
            We have a winner!
          </h2>
          <div className="bg-white text-indigo-900 p-12 rounded-[3rem] shadow-[0_0_60px_rgba(255,255,255,0.3)] transform scale-110">
            <h1 className="text-8xl font-black mb-4">{winner.player.name}</h1>
            <div className="inline-block bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-3xl font-bold px-8 py-3 rounded-full shadow-lg uppercase tracking-wider">
              {winner.type === 'BINGO' ? 'FULL HOUSE!' : 'LINE COMPLETED!'}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render Live Game / Review Screen
  return (
    <div className="h-screen w-screen bg-slate-900 text-white p-8 flex gap-8 font-sans">
      {/* Sidebar: Leaderboard/Stats */}
      <aside className="w-1/4 bg-slate-800/50 rounded-3xl p-6 border border-slate-700 flex flex-col">
        <h2 className="text-2xl font-bold text-indigo-400 mb-6 flex items-center gap-2">
          <span className="material-symbols-outlined">leaderboard</span> Live Feed
        </h2>
        <div className="flex-1 overflow-y-auto space-y-4 no-scrollbar">
           {submissions.map((sub, i) => (
             <div key={sub.id} className={`p-4 rounded-xl border ${sub.status === 'APPROVED' ? 'bg-green-900/40 border-green-500' : 'bg-slate-700/50 border-slate-600'} transition-all`}>
                <div className="flex justify-between items-center">
                  <span className="font-bold text-lg">{sub.player.name}</span>
                  <span className="text-xs opacity-70">
                    {sub.card.isFullHouse ? 'FULL HOUSE' : 'LINE'}
                  </span>
                </div>
             </div>
           ))}
           {submissions.length === 0 && (
             <div className="text-center text-slate-500 mt-10">
               Waiting for submissions...
             </div>
           )}
        </div>
      </aside>

      {/* Main Area: Current Focus */}
      <main className="flex-1 bg-slate-800/30 rounded-3xl border border-slate-700 flex items-center justify-center p-8 relative overflow-hidden">
        {latestPending ? (
          <div className="w-full h-full flex flex-col items-center justify-center animate-fade-in">
             <div className="absolute top-8 right-8 flex items-center gap-3 bg-yellow-500 text-black px-6 py-2 rounded-full font-bold shadow-lg animate-pulse">
               <span className="material-symbols-outlined">hourglass_top</span>
               VERIFYING SUBMISSION...
             </div>
             
             <h2 className="text-5xl font-bold mb-8">{latestPending.player.name}'s Card</h2>
             
             {/* Show the card grid visually */}
             <div className="grid grid-cols-3 gap-4 w-full max-w-4xl aspect-square">
                {state.prompts.map(prompt => {
                  const cell = latestPending.card.cells[prompt.id];
                  return (
                    <div key={prompt.id} className={`relative rounded-xl overflow-hidden border-2 ${cell?.photoUrl ? 'border-green-400' : 'border-slate-600 bg-slate-800'}`}>
                      {cell?.photoUrl ? (
                         <img src={cell.photoUrl} className="w-full h-full object-cover" alt="Bingo Cell" />
                      ) : (
                         <div className="flex items-center justify-center h-full text-slate-600">
                           <span className="material-symbols-outlined text-4xl">{prompt.icon}</span>
                         </div>
                      )}
                    </div>
                  );
                })}
             </div>
          </div>
        ) : (
          <div className="text-center opacity-40">
            <span className="material-symbols-outlined text-9xl mb-4">photo_camera</span>
            <h1 className="text-5xl font-bold">Snap & Upload!</h1>
            <p className="text-2xl mt-4">Fill lines to win prizes.</p>
          </div>
        )}
      </main>
    </div>
  );
};