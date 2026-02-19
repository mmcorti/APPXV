import React, { useState, useEffect } from 'react';
import { gameService, getStoredState } from '../services/gameService';
import { GameState, Question, Player } from '../types';

const BigScreenView: React.FC = () => {
    const [gameState, setGameState] = useState<GameState>(getStoredState());
    const [timeLeft, setTimeLeft] = useState(0);

    useEffect(() => {
        const unsubscribe = gameService.subscribe(setGameState);
        return unsubscribe;
    }, []);

    // Timer Logic
    useEffect(() => {
        if (!gameState.currentQuestionId || !gameState.questionStartTime) {
            setTimeLeft(0);
            return;
        }

        const currentQuestion = gameState.questions.find(q => q.id === gameState.currentQuestionId);
        if (!currentQuestion) return;

        const interval = setInterval(() => {
            const elapsed = (Date.now() - (gameState.questionStartTime || 0)) / 1000;
            const remaining = Math.max(0, Math.ceil(currentQuestion.durationSeconds - elapsed));
            setTimeLeft(remaining);

            if (remaining <= 0) {
                clearInterval(interval);
            }
        }, 100);

        return () => clearInterval(interval);
    }, [gameState.currentQuestionId, gameState.questionStartTime, gameState.questions]);

    // Derived Data
    const currentQuestion = gameState.questions.find(q => q.id === gameState.currentQuestionId);
    const isTimeUp = timeLeft === 0;

    // Calculate Leaderboard
    const getLeaderboard = () => {
        return (Object.values(gameState.players) as Player[])
            .sort((a, b) => b.score - a.score)
            .slice(0, 10); // Top 10
    };

    const renderWaitingScreen = () => (
        <div className="flex flex-col items-center justify-center h-full animate-fade-in space-y-12">
            <h1 className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-brand-primary to-brand-accent tracking-tighter drop-shadow-2xl">
                TRIVIA NIGHT
            </h1>

            <div className="flex items-center gap-12 bg-white/5 p-12 rounded-3xl backdrop-blur-sm border border-white/10 shadow-2xl">
                <div className="bg-white p-4 rounded-xl">
                    {/* Generate QR pointing to the base URL */}
                    <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(window.location.origin + '/#/')}`}
                        alt="Scan to Join"
                        className="w-64 h-64"
                    />
                </div>
                <div className="text-left space-y-4">
                    <h2 className="text-5xl font-bold text-white">Join the Game</h2>
                    <ol className="text-3xl text-gray-300 space-y-2 list-decimal list-inside font-light">
                        <li>Scan the QR Code</li>
                        <li>Enter your Name</li>
                        <li>Wait for start</li>
                    </ol>
                    <div className="mt-6 pt-6 border-t border-white/10">
                        <p className="text-2xl text-brand-primary font-mono animate-pulse">
                            {Object.values(gameState.players).filter((p: any) => p.online !== false).length} Players Ready
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderQuestionScreen = () => {
        if (!currentQuestion) return null;

        return (
            <div className="h-full flex flex-col pt-10 pb-10 px-20">
                {/* Timer Bar */}
                <div className="w-full h-4 bg-gray-800 rounded-full mb-8 overflow-hidden">
                    <div
                        className={`h-full transition-all duration-100 ease-linear ${timeLeft < 5 ? 'bg-brand-error' : 'bg-brand-success'}`}
                        style={{ width: `${(timeLeft / currentQuestion.durationSeconds) * 100}%` }}
                    />
                </div>

                <div className="flex justify-between items-start mb-12">
                    <h2 className="text-6xl font-bold leading-tight max-w-5xl">
                        {currentQuestion.text}
                    </h2>
                    <div className={`text-8xl font-black font-mono ${timeLeft < 5 ? 'text-brand-error animate-pulse-fast' : 'text-white'}`}>
                        {timeLeft}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-8 flex-1">
                    {currentQuestion.options.map((opt) => {
                        const isCorrect = opt.key === currentQuestion.correctOption;
                        const showResult = gameState.isAnswerRevealed || (isTimeUp && false); // Only show if revealed by admin, or maybe wait for admin

                        let bgClass = "bg-gray-800 border-gray-700";
                        if (gameState.isAnswerRevealed) {
                            if (isCorrect) bgClass = "bg-brand-success border-brand-success shadow-[0_0_50px_rgba(16,185,129,0.4)] scale-105 z-10";
                            else bgClass = "opacity-30 bg-gray-800 border-gray-700 grayscale";
                        }

                        return (
                            <div
                                key={opt.key}
                                className={`
                                relative flex items-center p-8 rounded-2xl border-4 transition-all duration-500
                                ${bgClass}
                            `}
                            >
                                <div className={`
                                w-20 h-20 rounded-full flex items-center justify-center text-4xl font-black mr-8 border-4
                                ${gameState.isAnswerRevealed && isCorrect ? 'bg-white text-brand-success border-white' : 'bg-white/10 text-white border-white/20'}
                            `}>
                                    {opt.key}
                                </div>
                                <span className="text-5xl font-semibold">{opt.text}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderLeaderboard = () => {
        const leaders = getLeaderboard();
        return (
            <div className="h-full flex flex-col items-center justify-center p-12">
                <h2 className="text-7xl font-black text-brand-warning mb-12 uppercase tracking-widest drop-shadow-lg">Final Standings</h2>

                <div className="w-full max-w-4xl space-y-4">
                    {leaders.map((player, idx) => (
                        <div
                            key={player.id}
                            className={`
                            flex justify-between items-center p-6 rounded-xl border border-white/10
                            ${idx === 0 ? 'bg-gradient-to-r from-yellow-600/40 to-yellow-900/40 border-yellow-500 scale-110 mb-6 shadow-2xl' : 'bg-gray-800'}
                            animate-slide-up
                        `}
                            style={{ animationDelay: `${idx * 100}ms` }}
                        >
                            <div className="flex items-center gap-6">
                                <span className={`font-mono font-bold text-4xl w-16 ${idx === 0 ? 'text-yellow-400' : 'text-gray-500'}`}>
                                    #{idx + 1}
                                </span>
                                <span className="text-4xl font-bold truncate max-w-lg">{player.name}</span>
                            </div>
                            <span className="text-5xl font-mono text-brand-success font-bold">{player.score}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="w-screen h-screen bg-[#0b0f19] text-white overflow-hidden relative">
            {/* Background Ambient Effects */}
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-brand-primary/20 blur-[150px] rounded-full mix-blend-screen animate-pulse-slow pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-brand-accent/20 blur-[150px] rounded-full mix-blend-screen animate-pulse-slow pointer-events-none" />

            {gameState.status === 'WAITING' && renderWaitingScreen()}
            {gameState.status === 'PLAYING' && (gameState.currentQuestionId ? renderQuestionScreen() : renderWaitingScreen())}
            {gameState.status === 'FINISHED' && renderLeaderboard()}

            <style>{`
            @keyframes pulse-slow {
                0%, 100% { opacity: 0.5; }
                50% { opacity: 0.8; }
            }
            .animate-pulse-slow {
                animation: pulse-slow 8s ease-in-out infinite;
            }
            @keyframes slide-up {
                from { transform: translateY(50px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            .animate-slide-up {
                animation: slide-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
        `}</style>
        </div>
    );
};

export default BigScreenView;