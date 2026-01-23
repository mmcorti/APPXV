import React, { useState, useEffect } from 'react';
import { gameService } from '../services/gameService';
import { GameState, Prompt, Submission } from '../types';

export const AdminView: React.FC = () => {
  const [state, setState] = useState<GameState>(gameService.getState());
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [activeTab, setActiveTab] = useState<'CONFIG' | 'LIVE'>('CONFIG');
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);

  useEffect(() => {
    const update = () => {
      setState(gameService.getState());
      setSubmissions(gameService.getSubmissions());
    };
    // Subscribe and update immediately
    const unsub = gameService.subscribe(update);
    update();
    return unsub;
  }, []);

  const handlePromptChange = (id: number, text: string) => {
    const newPrompts = state.prompts.map(p => p.id === id ? { ...p, text } : p);
    gameService.updatePrompts(newPrompts);
  };

  const handleStart = () => {
    if (!state.googlePhotosLink) {
      alert("Please set a Google Photos link first!");
      return;
    }
    gameService.startGame();
    setActiveTab('LIVE');
  };

  const pendingSubmissions = submissions.filter(s => s.status === 'PENDING');

  return (
    <div className="min-h-screen bg-gray-50 text-slate-800 font-sans">
      <header className="bg-slate-900 text-white p-4 shadow-md flex justify-between items-center sticky top-0 z-10">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <span className="material-symbols-outlined text-yellow-400">admin_panel_settings</span>
          Admin Control
        </h1>
        <div className="flex gap-2 text-sm">
          <span className={`px-3 py-1 rounded-full ${state.status === 'PLAYING' ? 'bg-green-500' : 'bg-gray-600'}`}>
            {state.status}
          </span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6">
        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-gray-200">
          <button 
            onClick={() => setActiveTab('CONFIG')}
            className={`pb-2 px-4 font-semibold ${activeTab === 'CONFIG' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500'}`}
          >
            Configuration
          </button>
          <button 
            onClick={() => setActiveTab('LIVE')}
            className={`pb-2 px-4 font-semibold ${activeTab === 'LIVE' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500'}`}
          >
            Live Game
          </button>
        </div>

        {activeTab === 'CONFIG' && (
          <div className="space-y-8 animate-fade-in">
            {/* Game Setup */}
            <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined">settings</span>
                Global Settings
              </h2>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Google Photos Album Link</label>
                <input 
                  type="text" 
                  className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="https://photos.app.goo.gl/..."
                  value={state.googlePhotosLink}
                  onChange={(e) => gameService.setGooglePhotosLink(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">Photos will be backed up here automatically (simulated).</p>
              </div>
              <div className="flex gap-4">
                <button 
                  onClick={handleStart}
                  disabled={state.status === 'PLAYING'}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <span className="material-symbols-outlined">play_arrow</span>
                  Start Game
                </button>
                <button 
                  onClick={() => gameService.resetGame()}
                  className="bg-red-100 text-red-700 hover:bg-red-200 px-6 py-2 rounded-lg font-bold flex items-center gap-2"
                >
                  <span className="material-symbols-outlined">restart_alt</span>
                  Reset Game
                </button>
              </div>
            </section>

            {/* Prompt Grid Editor */}
            <section>
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined">grid_on</span>
                Bingo Board (9 Prompts)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {state.prompts.map((prompt, idx) => (
                  <div key={prompt.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm relative group">
                    <div className="absolute top-2 right-2 text-gray-300 font-mono text-xs">#{idx + 1}</div>
                    <div className="flex items-start gap-3">
                      <div className="bg-indigo-50 p-2 rounded-lg text-indigo-600">
                         <span className="material-symbols-outlined">{prompt.icon}</span>
                      </div>
                      <div className="w-full">
                        <label className="text-xs font-bold text-gray-500 uppercase">Prompt</label>
                        <textarea 
                          className="w-full text-sm border-gray-300 border-b focus:border-indigo-500 outline-none py-1 resize-none bg-transparent"
                          rows={2}
                          value={prompt.text}
                          onChange={(e) => handlePromptChange(prompt.id, e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'LIVE' && (
          <div className="space-y-6 animate-fade-in">
             {/* Stats */}
             <div className="grid grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-blue-500">
                  <div className="text-2xl font-bold">{gameService.getPlayers().length}</div>
                  <div className="text-gray-500 text-sm">Players Joined</div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-yellow-500">
                  <div className="text-2xl font-bold">{pendingSubmissions.length}</div>
                  <div className="text-gray-500 text-sm">Pending Review</div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-green-500">
                  <div className="text-2xl font-bold">{submissions.filter(s => s.status === 'APPROVED').length}</div>
                  <div className="text-gray-500 text-sm">Winners</div>
                </div>
             </div>

             {/* Review Queue */}
             <section>
                <h2 className="text-xl font-bold mb-4">Review Queue</h2>
                {pendingSubmissions.length === 0 ? (
                  <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300 text-gray-400">
                    <span className="material-symbols-outlined text-4xl mb-2">inbox</span>
                    <p>No pending submissions waiting for review.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {pendingSubmissions.map(sub => (
                      <div key={sub.id} className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                        <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                          <div>
                            <h3 className="font-bold text-lg">{sub.player.name}</h3>
                            <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-medium">
                              {sub.card.isFullHouse ? 'FULL HOUSE BINGO!' : 'LINE COMPLETED'}
                            </span>
                          </div>
                          <div className="text-sm text-gray-500">
                            Submitted just now
                          </div>
                        </div>
                        
                        {/* Photos Grid for Validation */}
                        <div className="p-4">
                          <p className="text-sm text-gray-600 mb-3">Verify the photos match the prompts:</p>
                          <div className="grid grid-cols-3 gap-2">
                            {state.prompts.map(prompt => {
                              const cell = sub.card.cells[prompt.id];
                              if (!cell || !cell.photoUrl) return null;
                              return (
                                <div key={prompt.id} className="relative group aspect-square bg-gray-100 rounded-lg overflow-hidden">
                                  <img src={cell.photoUrl} className="w-full h-full object-cover" alt="Submission" />
                                  <div className="absolute bottom-0 left-0 w-full bg-black/60 text-white text-[10px] p-1 truncate">
                                    {prompt.text}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                          <button 
                            onClick={() => gameService.rejectSubmission(sub.id)}
                            className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg font-medium transition-colors"
                          >
                            Reject
                          </button>
                          <button 
                            onClick={() => gameService.approveSubmission(sub.id)}
                            className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold shadow-md transform active:scale-95 transition-all flex items-center gap-2"
                          >
                            <span className="material-symbols-outlined">check_circle</span>
                            Confirm Winner
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
             </section>
          </div>
        )}
      </main>
    </div>
  );
};