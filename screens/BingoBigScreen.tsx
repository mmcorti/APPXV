import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { bingoService, BingoGameState, BingoSubmission } from '../services/bingoService';

const BingoBigScreen: React.FC = () => {
    const { id: eventId } = useParams<{ id: string }>();
    const [state, setState] = useState<BingoGameState | null>(null);

    useEffect(() => {
        if (!eventId) return;

        const unsubscribe = bingoService.subscribe(eventId, (newState) => {
            setState(newState);
        });

        return unsubscribe;
    }, [eventId]);

    if (!state) {
        return (
            <div className="h-screen w-screen bg-slate-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white"></div>
            </div>
        );
    }

    const latestPending = state.submissions.find(s => s.status === 'PENDING');
    const playerCount = Object.keys(state.players).length;

    // Generate QR URL (uses current page URL for guest access)
    const guestUrl = window.location.origin + `/#/bingo/${eventId}/play`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(guestUrl)}`;

    // WAITING SCREEN
    if (state.status === 'WAITING') {
        return (
            <div className="h-screen w-screen bg-slate-900 text-white flex flex-col items-center justify-center overflow-hidden relative">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-10 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500"></div>

                <div className="z-10 text-center space-y-8 p-12 bg-white/5 backdrop-blur-lg rounded-3xl border border-white/10 shadow-2xl max-w-4xl w-full">
                    <h1 className="text-7xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 drop-shadow-lg">
                        PHOTO BINGO
                    </h1>

                    <div className="flex flex-col md:flex-row items-center justify-center gap-12 mt-8">
                        <div className="bg-white p-4 rounded-xl shadow-lg transform -rotate-2 hover:rotate-0 transition-transform duration-500">
                            <img src={qrUrl} alt="Join QR" className="w-64 h-64" />
                        </div>
                        <div className="text-left space-y-4">
                            <h2 className="text-4xl font-bold">¿Cómo jugar?</h2>
                            <ol className="text-2xl space-y-3 text-gray-300">
                                <li className="flex items-center gap-4">
                                    <span className="bg-indigo-600 rounded-full w-10 h-10 flex items-center justify-center text-lg font-bold">1</span>
                                    Escanea el código QR
                                </li>
                                <li className="flex items-center gap-4">
                                    <span className="bg-indigo-600 rounded-full w-10 h-10 flex items-center justify-center text-lg font-bold">2</span>
                                    Ingresa tu nombre
                                </li>
                                <li className="flex items-center gap-4">
                                    <span className="bg-indigo-600 rounded-full w-10 h-10 flex items-center justify-center text-lg font-bold">3</span>
                                    ¡Espera que inicie!
                                </li>
                            </ol>
                        </div>
                    </div>

                    <div className="pt-8 flex items-center justify-center gap-4">
                        <span className="text-6xl font-bold text-indigo-400">{playerCount}</span>
                        <span className="text-2xl text-gray-400">jugadores conectados</span>
                    </div>

                    <div className="text-xl font-mono animate-pulse text-indigo-400">
                        Esperando que el host inicie el juego...
                    </div>
                </div>
            </div>
        );
    }

    // WINNER SCREEN
    if (state.status === 'WINNER' && state.winner) {
        return (
            <div className="h-screen w-screen bg-indigo-900 flex flex-col items-center justify-center relative overflow-hidden">
                {/* Confetti Effect */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    {[...Array(30)].map((_, i) => (
                        <div
                            key={i}
                            className="absolute animate-bounce"
                            style={{
                                left: `${Math.random() * 100}%`,
                                top: `${Math.random() * 100}%`,
                                animationDuration: `${Math.random() * 2 + 1}s`,
                                animationDelay: `${Math.random() * 2}s`,
                                fontSize: `${Math.random() * 3 + 2}rem`
                            }}
                        >
                            {['🎉', '🎊', '✨', '🏆', '📸', '🌟'][i % 6]}
                        </div>
                    ))}
                </div>

                <div className="text-center z-10">
                    <h2 className="text-5xl text-yellow-300 font-bold tracking-widest uppercase mb-6 drop-shadow-md animate-pulse">
                        ¡Tenemos Ganador!
                    </h2>
                    <div className="bg-white text-indigo-900 p-16 rounded-[3rem] shadow-[0_0_60px_rgba(255,255,255,0.3)] transform scale-110">
                        <h1 className="text-8xl font-black mb-6">{state.winner.player.name}</h1>
                        <div className="inline-block bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-4xl font-bold px-10 py-4 rounded-full shadow-lg uppercase tracking-wider">
                            {state.winner.type === 'BINGO' ? '¡BINGO COMPLETO!' : '¡LÍNEA COMPLETADA!'}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // PLAYING / REVIEW SCREEN
    return (
        <div className="h-screen w-screen bg-slate-900 text-white p-8 flex gap-8 font-sans">
            {/* Sidebar: Live Feed */}
            <aside className="w-1/4 bg-slate-800/50 rounded-3xl p-6 border border-slate-700 flex flex-col">
                <h2 className="text-2xl font-bold text-indigo-400 mb-6 flex items-center gap-2">
                    <span className="material-symbols-outlined">leaderboard</span>
                    En Vivo
                </h2>
                <div className="mb-4 text-center">
                    <span className="text-5xl font-bold">{playerCount}</span>
                    <p className="text-gray-400">jugadores</p>
                </div>
                <div className="flex-1 overflow-y-auto space-y-4">
                    {state.submissions.map((sub) => (
                        <div
                            key={sub.id}
                            className={`p-4 rounded-xl border transition-all ${sub.status === 'APPROVED'
                                    ? 'bg-green-900/40 border-green-500'
                                    : sub.status === 'REJECTED'
                                        ? 'bg-red-900/40 border-red-500 opacity-50'
                                        : 'bg-slate-700/50 border-slate-600'
                                }`}
                        >
                            <div className="flex justify-between items-center">
                                <span className="font-bold text-lg">{sub.player.name}</span>
                                <span className="text-xs opacity-70">
                                    {sub.card.isFullHouse ? 'BINGO' : 'LÍNEA'}
                                </span>
                            </div>
                        </div>
                    ))}
                    {state.submissions.length === 0 && (
                        <div className="text-center text-slate-500 mt-10">
                            Esperando envíos...
                        </div>
                    )}
                </div>
            </aside>

            {/* Main Area */}
            <main className="flex-1 bg-slate-800/30 rounded-3xl border border-slate-700 flex items-center justify-center p-8 relative overflow-hidden">
                {state.status === 'REVIEW' && latestPending ? (
                    <div className="w-full h-full flex flex-col items-center justify-center animate-fade-in">
                        <div className="absolute top-8 right-8 flex items-center gap-3 bg-yellow-500 text-black px-6 py-2 rounded-full font-bold shadow-lg animate-pulse">
                            <span className="material-symbols-outlined">hourglass_top</span>
                            VERIFICANDO ENVÍO...
                        </div>

                        <h2 className="text-5xl font-bold mb-8">Cartón de {latestPending.player.name}</h2>

                        {/* Card Grid */}
                        <div className="grid grid-cols-3 gap-4 w-full max-w-3xl">
                            {state.prompts.map(prompt => {
                                const cell = latestPending.card.cells[prompt.id];
                                return (
                                    <div
                                        key={prompt.id}
                                        className={`relative aspect-square rounded-xl overflow-hidden border-4 ${cell?.photoUrl ? 'border-green-400' : 'border-slate-600 bg-slate-800'
                                            }`}
                                    >
                                        {cell?.photoUrl ? (
                                            <img src={cell.photoUrl} className="w-full h-full object-cover" alt="Bingo Cell" />
                                        ) : (
                                            <div className="flex items-center justify-center h-full text-slate-600">
                                                <span className="material-symbols-outlined text-6xl">{prompt.icon}</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <div className="text-center">
                        <span className="material-symbols-outlined text-9xl mb-4 text-slate-600">photo_camera</span>
                        <h1 className="text-5xl font-bold text-slate-400">¡Toma Fotos!</h1>
                        <p className="text-2xl mt-4 text-slate-500">Completa líneas para ganar.</p>
                        {state.status === 'PLAYING' && (
                            <div className="mt-8 bg-green-500/20 text-green-400 px-6 py-3 rounded-full text-xl font-bold inline-block">
                                🟢 Juego en progreso
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
};

export default BingoBigScreen;
