import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
    triviaService,
    getStoredState,
    TriviaGameState,
    TriviaQuestion,
    TriviaPlayer,
} from '../services/triviaService';

const TriviaBigScreen: React.FC = () => {
    const { id: eventId } = useParams<{ id: string }>();
    const [gameState, setGameState] = useState<TriviaGameState | null>(null);
    const [timeLeft, setTimeLeft] = useState(0);

    useEffect(() => {
        if (!eventId) return;
        const unsubscribe = triviaService.subscribe(eventId, setGameState);
        return unsubscribe;
    }, [eventId]);

    // Timer Logic
    useEffect(() => {
        if (!gameState || !eventId) return;

        const currentQuestion = gameState.questions[gameState.currentQuestionIndex];
        if (!currentQuestion || !gameState.questionStartTime) {
            setTimeLeft(0);
            return;
        }

        const interval = setInterval(() => {
            const elapsed = (Date.now() - gameState.questionStartTime!) / 1000;
            const remaining = Math.max(0, Math.ceil(currentQuestion.durationSeconds - elapsed));
            setTimeLeft(remaining);

            if (remaining <= 0) {
                clearInterval(interval);
            }
        }, 100);

        return () => clearInterval(interval);
    }, [gameState?.currentQuestionIndex, gameState?.questionStartTime, eventId]);

    if (!eventId || !gameState) {
        return (
            <div className="w-screen h-screen bg-slate-950 flex items-center justify-center">
                <div className="text-white text-2xl">Cargando...</div>
            </div>
        );
    }

    const currentQuestion = gameState.currentQuestionIndex >= 0
        ? gameState.questions[gameState.currentQuestionIndex]
        : null;
    const qrUrl = `${window.location.origin}/#/trivia/${eventId}/play`;

    // Leaderboard
    const getLeaderboard = (): TriviaPlayer[] => {
        return (Object.values(gameState.players) as TriviaPlayer[])
            .sort((a, b) => b.score - a.score)
            .slice(0, 10);
    };

    // === WAITING SCREEN ===
    const renderWaitingScreen = () => (
        <div className="flex flex-col items-center justify-center h-full animate-fade-in space-y-12">
            <h1 className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-pink-500 tracking-tighter drop-shadow-2xl">
                TRIVIA TIME
            </h1>

            <div className="flex items-center gap-12 bg-white/5 p-12 rounded-3xl backdrop-blur-sm border border-white/10 shadow-2xl">
                <div className="bg-white p-4 rounded-xl">
                    <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrUrl)}`}
                        alt="Scan to Join"
                        className="w-64 h-64"
                    />
                </div>
                <div className="text-left space-y-4">
                    <h2 className="text-5xl font-bold text-white">¡Únete al Juego!</h2>
                    <ol className="text-3xl text-gray-300 space-y-2 list-decimal list-inside font-light">
                        <li>Escanea el código QR</li>
                        <li>Ingresa tu nombre</li>
                        <li>¡Espera a que comience!</li>
                    </ol>
                    <div className="mt-6 pt-6 border-t border-white/10">
                        <p className="text-3xl text-pink-400 font-mono animate-pulse">
                            {Object.values(gameState.players).filter((p: any) => p.online).length} Jugadores Conectados
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );

    // === QUESTION SCREEN ===
    const renderQuestionScreen = () => {
        if (!currentQuestion) return null;

        const optionColors = [
            'bg-red-600 border-red-500',
            'bg-blue-600 border-blue-500',
            'bg-amber-500 border-amber-400',
            'bg-green-600 border-green-500',
        ];

        return (
            <div className="h-full flex flex-col pt-8 pb-8 px-16">
                {/* Timer Bar */}
                <div className="w-full h-4 bg-gray-800 rounded-full mb-6 overflow-hidden">
                    <div
                        className={`h-full transition-all duration-100 ease-linear ${timeLeft < 5 ? 'bg-red-500' : 'bg-green-500'
                            }`}
                        style={{ width: `${(timeLeft / currentQuestion.durationSeconds) * 100}%` }}
                    />
                </div>

                {/* Question Header */}
                <div className="flex justify-between items-start mb-8">
                    <div className="flex-1">
                        <p className="text-2xl text-slate-400 mb-2">
                            Pregunta {gameState.currentQuestionIndex + 1} de {gameState.questions.length}
                        </p>
                        <h2 className="text-6xl font-bold leading-tight max-w-5xl">
                            {currentQuestion.text}
                        </h2>
                    </div>
                    <div
                        className={`text-8xl font-black font-mono ${timeLeft < 5 ? 'text-red-500 animate-pulse' : 'text-white'
                            }`}
                    >
                        {timeLeft}
                    </div>
                </div>

                {/* Options Grid */}
                <div className="grid grid-cols-2 gap-6 flex-1">
                    {currentQuestion.options.map((opt, idx) => {
                        const isCorrect = opt.key === currentQuestion.correctOption;

                        let bgClass = optionColors[idx];
                        if (gameState.isAnswerRevealed) {
                            if (isCorrect) {
                                bgClass = 'bg-green-500 border-green-400 shadow-[0_0_60px_rgba(34,197,94,0.5)] scale-105 z-10';
                            } else {
                                bgClass = 'opacity-30 bg-gray-800 border-gray-700 grayscale';
                            }
                        }

                        return (
                            <div
                                key={opt.key}
                                className={`
                  relative flex items-center p-8 rounded-2xl border-4 transition-all duration-500
                  ${bgClass}
                `}
                            >
                                <div
                                    className={`
                    w-20 h-20 rounded-full flex items-center justify-center text-4xl font-black mr-8 
                    ${gameState.isAnswerRevealed && isCorrect
                                            ? 'bg-white text-green-600'
                                            : 'bg-white/20 text-white'
                                        }
                  `}
                                >
                                    {opt.key}
                                </div>
                                <span className="text-4xl font-semibold">{opt.text}</span>

                                {gameState.isAnswerRevealed && isCorrect && (
                                    <span className="absolute top-4 right-4 material-symbols-outlined text-4xl text-white">
                                        check_circle
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    // === LEADERBOARD SCREEN ===
    const renderLeaderboard = () => {
        const leaders = getLeaderboard();

        return (
            <div className="h-full flex flex-col items-center justify-center p-12">
                <h2 className="text-7xl font-black text-amber-400 mb-12 uppercase tracking-widest drop-shadow-lg">
                    🏆 Resultados Finales
                </h2>

                <div className="w-full max-w-4xl space-y-4">
                    {leaders.map((player, idx) => (
                        <div
                            key={player.id}
                            className={`
                flex justify-between items-center p-6 rounded-xl border border-white/10
                ${idx === 0
                                    ? 'bg-gradient-to-r from-yellow-600/40 to-amber-900/40 border-yellow-500 scale-110 mb-6 shadow-2xl'
                                    : idx === 1
                                        ? 'bg-gradient-to-r from-slate-400/30 to-slate-600/30 border-slate-400'
                                        : idx === 2
                                            ? 'bg-gradient-to-r from-amber-700/30 to-amber-900/30 border-amber-600'
                                            : 'bg-gray-800'
                                }
                animate-slide-up
              `}
                            style={{ animationDelay: `${idx * 100}ms` }}
                        >
                            <div className="flex items-center gap-6">
                                <span
                                    className={`font-mono font-bold text-4xl w-16 ${idx === 0 ? 'text-yellow-400' :
                                        idx === 1 ? 'text-slate-300' :
                                            idx === 2 ? 'text-amber-500' : 'text-gray-500'
                                        }`}
                                >
                                    #{idx + 1}
                                </span>
                                <span className="text-4xl font-bold truncate max-w-lg">{player.name}</span>
                            </div>
                            <span className="text-5xl font-mono text-green-400 font-bold">{player.score}</span>
                        </div>
                    ))}

                    {leaders.length === 0 && (
                        <div className="text-center text-slate-500 text-2xl py-12">
                            No hay jugadores aún
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="w-screen h-screen bg-[#0b0f19] text-white overflow-hidden relative">
            {/* Background Image/Effects */}
            {gameState.backgroundUrl ? (
                <div className="absolute inset-0 z-0 opacity-40 blur-sm scale-105" style={{
                    backgroundImage: `url("${gameState.backgroundUrl}")`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                }}></div>
            ) : (
                <>
                    <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/20 blur-[150px] rounded-full mix-blend-screen animate-pulse pointer-events-none" />
                    <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-pink-500/20 blur-[150px] rounded-full mix-blend-screen animate-pulse pointer-events-none" />
                </>
            )}

            {gameState.status === 'WAITING' && renderWaitingScreen()}
            {gameState.status === 'PLAYING' && (currentQuestion ? renderQuestionScreen() : renderWaitingScreen())}
            {gameState.status === 'FINISHED' && renderLeaderboard()}

            <style>{`
        @keyframes slide-up {
          from { transform: translateY(50px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-up {
          animation: slide-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation: fade-in 0.5s ease-out;
        }
      `}</style>
        </div>
    );
};

export default TriviaBigScreen;
