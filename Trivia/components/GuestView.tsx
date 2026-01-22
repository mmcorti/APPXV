import React, { useState, useEffect } from 'react';
import { gameService, getStoredState } from '../services/gameService';
import { GameState, Question, OptionKey, Player } from '../types';

const GuestView: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(getStoredState());
  const [playerId, setPlayerId] = useState<string | null>(localStorage.getItem('antigravity_player_id'));
  const [playerName, setPlayerName] = useState<string>(localStorage.getItem('antigravity_player_name') || '');
  const [inputName, setInputName] = useState('');
  
  // Local timer for smooth UI feedback
  const [localTimeLeft, setLocalTimeLeft] = useState(0);

  useEffect(() => {
    const unsubscribe = gameService.subscribe(setGameState);
    return unsubscribe;
  }, []);

  // Timer Sync
  useEffect(() => {
    if (!gameState.currentQuestionId || !gameState.questionStartTime || gameState.status !== 'PLAYING') {
      setLocalTimeLeft(0);
      return;
    }

    const currentQuestion = gameState.questions.find(q => q.id === gameState.currentQuestionId);
    if (!currentQuestion) return;

    const interval = setInterval(() => {
        const elapsed = (Date.now() - (gameState.questionStartTime || 0)) / 1000;
        const remaining = Math.max(0, Math.ceil(currentQuestion.durationSeconds - elapsed));
        setLocalTimeLeft(remaining);
        if (remaining <= 0) clearInterval(interval);
    }, 200);

    return () => clearInterval(interval);
  }, [gameState.currentQuestionId, gameState.questionStartTime]);

  const handleJoin = () => {
    if (!inputName.trim()) return;
    const newId = crypto.randomUUID();
    localStorage.setItem('antigravity_player_id', newId);
    localStorage.setItem('antigravity_player_name', inputName);
    setPlayerId(newId);
    setPlayerName(inputName);
    gameService.joinPlayer(newId, inputName);
  };

  const handleAnswer = (option: OptionKey) => {
      if (!playerId || !gameState.currentQuestionId || localTimeLeft <= 0) return;
      gameService.submitAnswer(playerId, gameState.currentQuestionId, option);
  };

  const currentQuestion = gameState.questions.find(q => q.id === gameState.currentQuestionId);
  const player = playerId ? gameState.players[playerId] : null;
  const hasAnswered = playerId && currentQuestion && gameState.players[playerId]?.answers[currentQuestion.id];
  const isTimeUp = localTimeLeft === 0 && gameState.status === 'PLAYING' && !!gameState.currentQuestionId;

  // --- Render Steps ---

  // 1. Join Screen
  if (!playerId) {
    return (
      <div className="h-screen bg-brand-dark flex flex-col justify-center p-8 text-center">
        <h1 className="text-4xl font-bold text-brand-primary mb-2">Antigravity</h1>
        <p className="text-gray-400 mb-8">Enter your name to join the game</p>
        <input 
            type="text" 
            placeholder="Your Name"
            className="bg-gray-800 border border-gray-600 rounded-lg p-4 text-xl text-center text-white mb-4 focus:outline-none focus:border-brand-primary"
            value={inputName}
            onChange={(e) => setInputName(e.target.value)}
            maxLength={12}
        />
        <button 
            onClick={handleJoin}
            disabled={!inputName}
            className="bg-brand-primary text-white font-bold py-4 rounded-lg text-xl shadow-lg disabled:opacity-50 disabled:shadow-none"
        >
            JOIN GAME
        </button>
      </div>
    );
  }

  // 2. Waiting (Lobby or Between Questions)
  if (gameState.status === 'WAITING' || (gameState.status === 'PLAYING' && !currentQuestion)) {
    return (
        <div className="h-screen bg-brand-dark flex flex-col items-center justify-center p-8">
            <div className="w-20 h-20 border-4 border-brand-primary border-t-transparent rounded-full animate-spin mb-8"></div>
            <h2 className="text-2xl font-bold mb-2">You are in!</h2>
            <p className="text-gray-400">Waiting for the big screen...</p>
            <div className="mt-8 bg-gray-800 p-4 rounded-lg w-full max-w-xs text-center">
                <p className="text-sm text-gray-500">Playing as</p>
                <p className="text-xl font-bold text-white">{playerName}</p>
            </div>
        </div>
    );
  }

  // 3. Scoreboard (Finished)
  if (gameState.status === 'FINISHED') {
      const players = Object.values(gameState.players) as Player[];
      const rank = players.sort((a,b) => b.score - a.score).findIndex(p => p.id === playerId) + 1;
      return (
          <div className="h-screen bg-brand-dark flex flex-col items-center justify-center p-8 text-center">
              <h2 className="text-3xl font-bold text-white mb-6">Game Over!</h2>
              <div className="bg-gray-800 p-8 rounded-2xl w-full max-w-sm shadow-2xl border border-gray-700">
                  <p className="text-gray-400 uppercase text-sm font-bold tracking-wider mb-2">Your Score</p>
                  <p className="text-6xl font-black text-brand-success mb-6">{player?.score || 0}</p>
                  <div className="h-px bg-gray-700 w-full mb-6"></div>
                  <p className="text-gray-400">Rank</p>
                  <p className="text-2xl font-bold text-white">#{rank}</p>
              </div>
          </div>
      );
  }

  // 4. Question Active
  if (currentQuestion) {
      return (
          <div className="h-screen bg-brand-dark flex flex-col pb-safe">
              {/* Header */}
              <div className="flex justify-between items-center p-4 bg-gray-900 border-b border-gray-800">
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                      {playerName}
                  </div>
                  <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-brand-success animate-pulse"></div>
                      <span className="text-brand-primary font-bold">{player?.score || 0} pts</span>
                  </div>
              </div>

              {/* Question Text */}
              <div className="p-6 flex-1 flex flex-col justify-center">
                  <div className="mb-2 flex justify-between text-sm text-gray-400">
                    <span>Question</span>
                    <span className={`${localTimeLeft < 5 ? 'text-red-500 font-bold' : ''}`}>{localTimeLeft}s</span>
                  </div>
                  <h2 className="text-2xl font-bold leading-snug text-white">
                      {currentQuestion.text}
                  </h2>
                  
                  {isTimeUp && !gameState.isAnswerRevealed && (
                      <div className="mt-4 p-3 bg-gray-800 rounded text-center text-gray-400 text-sm">
                          Time's up! Wait for reveal.
                      </div>
                  )}

                  {gameState.isAnswerRevealed && (
                      <div className="mt-4 p-3 rounded text-center font-bold">
                          {hasAnswered === currentQuestion.correctOption 
                            ? <span className="text-green-500">Correct! +1 Point</span> 
                            : <span className="text-red-500">Wrong! It was {currentQuestion.correctOption}</span>
                          }
                      </div>
                  )}
              </div>

              {/* Answer Grid */}
              <div className="p-4 grid grid-cols-2 gap-4 h-1/2">
                  {currentQuestion.options.map((opt) => {
                      const isSelected = hasAnswered === opt.key;
                      const isDisabled = !!hasAnswered || isTimeUp || gameState.isAnswerRevealed;
                      
                      let btnColor = "bg-gray-700 hover:bg-gray-600";
                      // Visual feedback only AFTER selection
                      if (isSelected) btnColor = "bg-brand-primary ring-4 ring-brand-primary/30";
                      
                      // Reveal state visual override
                      if (gameState.isAnswerRevealed) {
                          if (opt.key === currentQuestion.correctOption) {
                              btnColor = "bg-brand-success text-white ring-4 ring-green-500/30"; // Correct
                          } else if (isSelected) {
                              btnColor = "bg-brand-error text-white opacity-50"; // Wrong pick
                          } else {
                              btnColor = "bg-gray-800 opacity-20"; // Irrelevant
                          }
                      }

                      return (
                        <button
                            key={opt.key}
                            onClick={() => handleAnswer(opt.key)}
                            disabled={isDisabled}
                            className={`
                                flex flex-col items-center justify-center rounded-xl transition-all duration-200 active:scale-95
                                ${btnColor}
                                ${isDisabled && !gameState.isAnswerRevealed ? 'cursor-not-allowed opacity-80' : ''}
                            `}
                        >
                            <span className="text-3xl font-black mb-1 opacity-50">{opt.key}</span>
                            {/* In a real event, text might be too small on phone, sometimes just A/B/C/D is better, but prompt asked to show options */}
                            {/* <span className="text-sm font-medium px-2 text-center line-clamp-2 leading-tight opacity-90">{opt.text}</span> */}
                        </button>
                      );
                  })}
              </div>
          </div>
      );
  }

  return null;
};

export default GuestView;