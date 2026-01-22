import React, { useState, useEffect } from 'react';
import { gameService, getStoredState } from '../services/gameService';
import { GameState, Question, OptionKey } from '../types';
import { Link } from 'react-router-dom';

const AdminView: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(getStoredState());
  const [newTopic, setNewTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const unsubscribe = gameService.subscribe(setGameState);
    return unsubscribe;
  }, []);

  const handleStartGame = () => gameService.startGame();
  const handleEndGame = () => gameService.endGame();
  const handleReset = () => {
    if (window.confirm('Are you sure you want to reset the entire game?')) {
      gameService.resetGame();
    }
  };

  const handleNextQuestion = () => {
    if (!gameState.currentQuestionId) {
      // Start first question
      if (gameState.questions.length > 0) {
        gameService.nextQuestion(gameState.questions[0].id);
      }
    } else {
      // Find current index
      const idx = gameState.questions.findIndex(q => q.id === gameState.currentQuestionId);
      if (idx >= 0 && idx < gameState.questions.length - 1) {
        gameService.nextQuestion(gameState.questions[idx + 1].id);
      } else {
        alert("No more questions! End the game.");
      }
    }
  };

  const handleReveal = () => {
    gameService.revealAnswer();
  };

  const handleGenerate = async () => {
    if (!newTopic) return;
    setIsGenerating(true);
    const questions = await gameService.generateQuestions(newTopic, 5);
    gameService.setQuestions([...gameState.questions, ...questions]);
    setIsGenerating(false);
    setNewTopic('');
  };

  const activeQuestion = gameState.questions.find(q => q.id === gameState.currentQuestionId);
  const totalPlayers = Object.keys(gameState.players).length;

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6 flex flex-col gap-6 max-w-5xl mx-auto">
      <header className="flex justify-between items-center border-b border-gray-700 pb-4">
        <h1 className="text-2xl font-bold text-brand-primary">Antigravity Admin</h1>
        <div className="text-sm font-mono bg-gray-800 px-3 py-1 rounded">
          Status: <span className={`font-bold ${gameState.status === 'PLAYING' ? 'text-green-400' : 'text-yellow-400'}`}>{gameState.status}</span>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Col: Game Controls */}
        <div className="md:col-span-1 space-y-4">
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
            <h2 className="text-lg font-semibold mb-3">Live Control</h2>
            
            <div className="flex flex-col gap-3">
              {gameState.status === 'WAITING' && (
                <button onClick={handleStartGame} className="btn-primary py-3">
                  START GAME
                </button>
              )}

              {gameState.status === 'PLAYING' && (
                <>
                  <div className="p-3 bg-gray-900 rounded mb-2 border border-gray-700">
                    <p className="text-xs text-gray-400 uppercase">Current Question</p>
                    <p className="font-bold truncate">{activeQuestion ? activeQuestion.text : 'None'}</p>
                  </div>

                  {!gameState.currentQuestionId ? (
                     <button onClick={handleNextQuestion} className="btn-primary">
                        Launch First Question
                     </button>
                  ) : (
                    <>
                       <button 
                        onClick={handleReveal} 
                        disabled={gameState.isAnswerRevealed}
                        className={`btn-secondary ${gameState.isAnswerRevealed ? 'opacity-50 cursor-not-allowed' : ''}`}
                       >
                         {gameState.isAnswerRevealed ? 'Answer Revealed' : 'Reveal Answer'}
                       </button>

                       <button onClick={handleNextQuestion} className="btn-primary bg-indigo-600 hover:bg-indigo-500">
                         Next Question &rarr;
                       </button>
                    </>
                  )}

                  <button onClick={handleEndGame} className="btn-danger mt-4">
                    Stop Game
                  </button>
                </>
              )}

              {gameState.status === 'FINISHED' && (
                <button onClick={handleReset} className="btn-danger">
                  Reset System
                </button>
              )}
            </div>
          </div>

          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
             <h2 className="text-lg font-semibold mb-2">Stats</h2>
             <div className="flex justify-between items-center">
                <span>Active Players:</span>
                <span className="text-2xl font-mono text-brand-success">{totalPlayers}</span>
             </div>
          </div>
        </div>

        {/* Right Col: Question Management */}
        <div className="md:col-span-2 space-y-4">
           <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
              <h2 className="text-lg font-semibold mb-3">Questions ({gameState.questions.length})</h2>
              
              <div className="flex gap-2 mb-4">
                 <input 
                    type="text" 
                    value={newTopic}
                    onChange={(e) => setNewTopic(e.target.value)}
                    placeholder="Enter topic (e.g. 'Science 1990s')..."
                    className="flex-1 bg-gray-900 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-brand-primary"
                 />
                 <button 
                    onClick={handleGenerate} 
                    disabled={isGenerating || !newTopic}
                    className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 px-4 py-2 rounded font-medium transition-colors"
                 >
                    {isGenerating ? 'AI Thinking...' : 'AI Generate'}
                 </button>
              </div>

              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                 {gameState.questions.map((q, idx) => (
                    <div 
                        key={q.id} 
                        className={`p-3 rounded border ${gameState.currentQuestionId === q.id ? 'border-brand-success bg-brand-success/10' : 'border-gray-700 bg-gray-900'}`}
                    >
                        <div className="flex justify-between">
                            <span className="font-bold text-gray-400 mr-2">#{idx + 1}</span>
                            <span className="flex-1 font-medium">{q.text}</span>
                            <span className="text-xs text-gray-500 ml-2">{q.durationSeconds}s</span>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-gray-400">
                            {q.options.map(opt => (
                                <span key={opt.key} className={opt.key === q.correctOption ? 'text-brand-success font-bold' : ''}>
                                    {opt.key}: {opt.text}
                                </span>
                            ))}
                        </div>
                    </div>
                 ))}
                 {gameState.questions.length === 0 && (
                    <div className="text-center text-gray-500 py-10">
                        No questions yet. Use AI to generate some!
                    </div>
                 )}
              </div>
           </div>
        </div>

      </div>

      <style>{`
        .btn-primary {
            @apply w-full bg-brand-primary hover:bg-indigo-500 text-white font-bold py-3 px-4 rounded transition-all active:scale-95 shadow-lg shadow-indigo-500/30;
        }
        .btn-secondary {
            @apply w-full bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-4 rounded transition-all active:scale-95;
        }
        .btn-danger {
            @apply w-full bg-brand-error hover:bg-red-500 text-white font-bold py-2 px-4 rounded transition-all;
        }
      `}</style>
    </div>
  );
};

export default AdminView;