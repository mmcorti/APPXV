import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { bingoService, BingoGameState, BingoSubmission } from '../services/bingoService';

const BingoBigScreen: React.FC = () => {
    const { id: eventId } = useParams<{ id: string }>();
    const [state, setState] = useState<BingoGameState | null>(null);
    const [selectedSubmission, setSelectedSubmission] = useState<BingoSubmission | null>(null);
    const [fullscreenPhoto, setFullscreenPhoto] = useState<{ url: string; prompt: string } | null>(null);
    const [celebration, setCelebration] = useState<'LINE' | 'BINGO' | null>(null);

    useEffect(() => {
        if (!eventId) return;

        const unsubscribe = bingoService.subscribe(eventId, (newState) => {
            setState(newState);
        });

        return unsubscribe;
    }, [eventId]);

    // Trigger celebration animation
    const triggerCelebration = (type: 'LINE' | 'BINGO') => {
        setCelebration(type);
        setTimeout(() => setCelebration(null), 4000);
    };

    // Handle verdict
    const handleVerdict = async (verdict: 'BINGO' | 'LINE' | 'REJECT') => {
        if (!eventId || !selectedSubmission) return;

        if (verdict === 'REJECT') {
            await bingoService.rejectSubmission(eventId, selectedSubmission.id);
        } else {
            await bingoService.approveSubmission(eventId, selectedSubmission.id);
            triggerCelebration(verdict === 'BINGO' ? 'BINGO' : 'LINE');
        }

        setSelectedSubmission(null);
    };

    if (!state) {
        return (
            <div className="h-screen w-screen bg-slate-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white"></div>
            </div>
        );
    }

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
                {/* Fireworks for BINGO */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    {[...Array(40)].map((_, i) => (
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
                            {['🎆', '🎇', '✨', '🏆', '🔥', '💫', '⭐', '🌟'][i % 8]}
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

    // Sort submissions by arrival order (submittedAt timestamp)
    const sortedSubmissions = [...state.submissions].sort((a, b) => a.submittedAt - b.submittedAt);

    // PLAYING / REVIEW SCREEN
    return (
        <div className="h-screen w-screen bg-slate-900 text-white p-6 flex gap-6 font-sans relative overflow-hidden">
            {/* Celebration Animations */}
            {celebration && (
                <div className="absolute inset-0 z-50 pointer-events-none overflow-hidden">
                    {celebration === 'LINE' ? (
                        // Confetti for LINE
                        [...Array(60)].map((_, i) => (
                            <div
                                key={i}
                                className="absolute animate-fall"
                                style={{
                                    left: `${Math.random() * 100}%`,
                                    top: `-5%`,
                                    animationDuration: `${Math.random() * 2 + 2}s`,
                                    animationDelay: `${Math.random() * 1}s`,
                                }}
                            >
                                <div
                                    className="w-3 h-8 rounded-sm"
                                    style={{
                                        backgroundColor: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#FF69B4'][i % 8],
                                        transform: `rotate(${Math.random() * 360}deg)`,
                                    }}
                                />
                            </div>
                        ))
                    ) : (
                        // Fireworks for BINGO
                        [...Array(50)].map((_, i) => (
                            <div
                                key={i}
                                className="absolute animate-firework"
                                style={{
                                    left: `${Math.random() * 100}%`,
                                    top: `${Math.random() * 100}%`,
                                    animationDuration: `${Math.random() * 1 + 0.5}s`,
                                    animationDelay: `${Math.random() * 2}s`,
                                    fontSize: `${Math.random() * 3 + 2}rem`
                                }}
                            >
                                {['🎆', '🎇', '✨', '💥', '⭐', '🔥', '💫', '🌟'][i % 8]}
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Sidebar: Player Queue */}
            <aside className="w-72 bg-slate-800/50 rounded-2xl p-5 border border-slate-700 flex flex-col">
                <h2 className="text-xl font-bold text-indigo-400 mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined">leaderboard</span>
                    En Vivo
                </h2>
                <div className="mb-4 text-center">
                    <span className="text-4xl font-bold">{playerCount}</span>
                    <p className="text-gray-400 text-sm">jugadores</p>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2">
                    {sortedSubmissions.length === 0 ? (
                        <div className="text-center text-slate-500 mt-10 text-sm">
                            Esperando envíos...
                        </div>
                    ) : (
                        sortedSubmissions.map((sub, idx) => (
                            <button
                                key={sub.id}
                                onClick={() => sub.status === 'PENDING' && setSelectedSubmission(sub)}
                                disabled={sub.status !== 'PENDING'}
                                className={`w-full p-3 rounded-xl border transition-all text-left ${selectedSubmission?.id === sub.id
                                        ? 'bg-indigo-600/50 border-indigo-400 ring-2 ring-indigo-400'
                                        : sub.status === 'APPROVED'
                                            ? 'bg-green-900/30 border-green-500/50 cursor-default'
                                            : sub.status === 'REJECTED'
                                                ? 'bg-red-900/30 border-red-500/50 opacity-60 cursor-default'
                                                : 'bg-slate-700/50 border-slate-600 hover:bg-slate-700 hover:border-slate-500 cursor-pointer'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    {/* Order Badge */}
                                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${sub.status === 'APPROVED' ? 'bg-green-500' :
                                            sub.status === 'REJECTED' ? 'bg-red-500' :
                                                'bg-slate-600'
                                        }`}>
                                        {sub.status === 'APPROVED' ? '✓' : sub.status === 'REJECTED' ? '✕' : `#${idx + 1}`}
                                    </span>

                                    <div className="flex-1 min-w-0">
                                        <span className="font-bold text-base block truncate">{sub.player.name}</span>
                                        <span className={`text-xs ${sub.status === 'APPROVED' ? 'text-green-400' :
                                                sub.status === 'REJECTED' ? 'text-red-400' :
                                                    'text-gray-400'
                                            }`}>
                                            {sub.status === 'APPROVED'
                                                ? (sub.card.isFullHouse ? '🎯 BINGO' : '📏 LÍNEA')
                                                : sub.status === 'REJECTED'
                                                    ? 'Rechazado'
                                                    : (sub.card.isFullHouse ? 'Bingo' : 'Línea')}
                                        </span>
                                    </div>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </aside>

            {/* Main Area */}
            <main className="flex-1 bg-slate-800/30 rounded-2xl border border-slate-700 flex flex-col items-center justify-center p-6 relative overflow-hidden">
                {selectedSubmission ? (
                    <div className="w-full h-full flex flex-col animate-fade-in">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-3xl font-bold">
                                Cartón de <span className="text-indigo-400">{selectedSubmission.player.name}</span>
                            </h2>
                            <button
                                onClick={() => setSelectedSubmission(null)}
                                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        {/* Photo Grid */}
                        <div className="grid grid-cols-3 gap-3 flex-1 max-h-[calc(100vh-280px)]">
                            {state.prompts.map(prompt => {
                                const cell = selectedSubmission.card.cells[prompt.id];
                                return (
                                    <button
                                        key={prompt.id}
                                        onClick={() => cell?.photoUrl && setFullscreenPhoto({ url: cell.photoUrl, prompt: prompt.text })}
                                        className={`relative aspect-square rounded-xl overflow-hidden border-4 transition-all group ${cell?.photoUrl
                                                ? 'border-green-400 hover:border-green-300 hover:scale-[1.02] cursor-pointer'
                                                : 'border-slate-600 bg-slate-800 cursor-default'
                                            }`}
                                    >
                                        {cell?.photoUrl ? (
                                            <>
                                                <img src={cell.photoUrl} className="w-full h-full object-cover" alt="Bingo Cell" />
                                                {/* Prompt Overlay */}
                                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3">
                                                    <p className="text-white text-sm font-medium truncate">{prompt.text}</p>
                                                </div>
                                                {/* Zoom Icon */}
                                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <span className="material-symbols-outlined text-4xl text-white">zoom_in</span>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center h-full text-slate-600">
                                                <span className="material-symbols-outlined text-4xl mb-2">{prompt.icon}</span>
                                                <span className="text-xs text-center px-2">{prompt.text}</span>
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Verdict Buttons */}
                        <div className="flex gap-4 justify-center mt-6">
                            <button
                                onClick={() => handleVerdict('LINE')}
                                className="flex items-center gap-3 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black px-8 py-4 rounded-2xl font-bold text-xl shadow-lg transform hover:scale-105 transition-all"
                            >
                                <span className="material-symbols-outlined">horizontal_rule</span>
                                LÍNEA
                            </button>
                            <button
                                onClick={() => handleVerdict('BINGO')}
                                className="flex items-center gap-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-8 py-4 rounded-2xl font-bold text-xl shadow-lg transform hover:scale-105 transition-all"
                            >
                                <span className="material-symbols-outlined">grid_view</span>
                                BINGO
                            </button>
                            <button
                                onClick={() => handleVerdict('REJECT')}
                                className="flex items-center gap-3 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white px-8 py-4 rounded-2xl font-bold text-xl shadow-lg transform hover:scale-105 transition-all"
                            >
                                <span className="material-symbols-outlined">close</span>
                                RECHAZAR
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="text-center">
                        <span className="material-symbols-outlined text-9xl mb-4 text-slate-600">photo_camera</span>
                        <h1 className="text-4xl font-bold text-slate-400">¡Toma Fotos!</h1>
                        <p className="text-xl mt-4 text-slate-500">Completa líneas para ganar.</p>
                        {state.status === 'PLAYING' && (
                            <div className="mt-8 bg-green-500/20 text-green-400 px-6 py-3 rounded-full text-xl font-bold inline-block">
                                🟢 Juego en progreso
                            </div>
                        )}
                        {sortedSubmissions.filter(s => s.status === 'PENDING').length > 0 && (
                            <div className="mt-6 text-amber-400 animate-pulse">
                                👈 Selecciona un cartón para revisar
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* Fullscreen Photo Modal */}
            {fullscreenPhoto && (
                <div
                    className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-8"
                    onClick={() => setFullscreenPhoto(null)}
                >
                    <button
                        onClick={() => setFullscreenPhoto(null)}
                        className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                    >
                        <span className="material-symbols-outlined text-3xl">close</span>
                    </button>
                    <div className="max-w-5xl max-h-[85vh] flex flex-col items-center">
                        <img
                            src={fullscreenPhoto.url}
                            alt="Foto ampliada"
                            className="max-w-full max-h-[75vh] object-contain rounded-2xl shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        />
                        <div className="mt-4 bg-white/10 backdrop-blur-lg px-6 py-3 rounded-full">
                            <p className="text-xl font-medium">{fullscreenPhoto.prompt}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* CSS for animations */}
            <style>{`
                @keyframes fall {
                    0% { transform: translateY(-100px) rotate(0deg); opacity: 1; }
                    100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
                }
                @keyframes firework {
                    0% { transform: scale(0); opacity: 1; }
                    50% { transform: scale(1.5); opacity: 1; }
                    100% { transform: scale(2); opacity: 0; }
                }
                .animate-fall {
                    animation: fall linear forwards;
                }
                .animate-firework {
                    animation: firework ease-out forwards;
                }
                .animate-fade-in {
                    animation: fadeIn 0.3s ease-out;
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }
            `}</style>
        </div>
    );
};

export default BingoBigScreen;
