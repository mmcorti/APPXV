import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { bingoService, BingoGameState, BingoSubmission } from '../services/bingoService';

// Photo evaluation state for each cell
interface PhotoEvaluation {
    [promptId: number]: 'approved' | 'rejected' | null;
}

const BingoBigScreen: React.FC = () => {
    const { id: eventId } = useParams<{ id: string }>();
    const [state, setState] = useState<BingoGameState | null>(null);
    const [selectedSubmission, setSelectedSubmission] = useState<BingoSubmission | null>(null);
    const [fullscreenPhoto, setFullscreenPhoto] = useState<{ url: string; prompt: string; promptId: number } | null>(null);
    const [celebration, setCelebration] = useState<'LINE' | 'BINGO' | null>(null);
    const [photoEvaluations, setPhotoEvaluations] = useState<PhotoEvaluation>({});
    const [showWinner, setShowWinner] = useState(true);

    useEffect(() => {
        if (!eventId) return;

        const unsubscribe = bingoService.subscribe(eventId, (newState) => {
            setState(newState);
        });

        return unsubscribe;
    }, [eventId]);

    // Reset evaluations when selecting a new submission
    useEffect(() => {
        if (selectedSubmission) {
            setPhotoEvaluations({});
        }
    }, [selectedSubmission?.id]);

    // Check for line or bingo based on evaluations
    const checkForWin = () => {
        if (!state) return { hasLine: false, hasBingo: false };

        const approvedPrompts = Object.entries(photoEvaluations)
            .filter(([_, status]) => status === 'approved')
            .map(([id]) => parseInt(id));

        const rejectedPrompts = Object.entries(photoEvaluations)
            .filter(([_, status]) => status === 'rejected')
            .map(([id]) => parseInt(id));

        // Check for bingo (all 9 approved AND none rejected)
        // Must have exactly 9 approved and 0 rejected
        const hasBingo = approvedPrompts.length === 9 && rejectedPrompts.length === 0;

        // Check for lines (3 in a row)
        // Assuming prompts are indexed 1-9 in a 3x3 grid:
        // 1 2 3
        // 4 5 6
        // 7 8 9
        const lines = [
            [1, 2, 3], [4, 5, 6], [7, 8, 9], // Rows
            [1, 4, 7], [2, 5, 8], [3, 6, 9], // Columns
            [1, 5, 9], [3, 5, 7]             // Diagonals
        ];

        const hasLine = lines.some(line =>
            line.every(promptId => approvedPrompts.includes(promptId))
        );

        return { hasLine, hasBingo };
    };

    const { hasLine, hasBingo } = checkForWin();

    // Toggle photo evaluation
    const togglePhotoEval = (promptId: number, status: 'approved' | 'rejected') => {
        setPhotoEvaluations(prev => ({
            ...prev,
            [promptId]: prev[promptId] === status ? null : status
        }));
    };

    // Trigger celebration animation
    const triggerCelebration = (type: 'LINE' | 'BINGO') => {
        setCelebration(type);
        setTimeout(() => setCelebration(null), 4000);
    };

    // Handle final verdict
    const handleVerdict = async (verdict: 'BINGO' | 'LINE' | 'REJECT') => {
        if (!eventId || !selectedSubmission) return;

        if (verdict === 'REJECT') {
            await bingoService.rejectSubmission(eventId, selectedSubmission.id);
        } else {
            await bingoService.approveSubmission(eventId, selectedSubmission.id);
            triggerCelebration(verdict === 'BINGO' ? 'BINGO' : 'LINE');
        }

        setSelectedSubmission(null);
        setPhotoEvaluations({});
    };

    // Dismiss winner screen
    const dismissWinner = () => {
        setShowWinner(false);
    };

    if (!state) {
        return (
            <div className="h-screen w-screen bg-slate-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white"></div>
            </div>
        );
    }

    const playerCount = Object.values(state.players).filter((p: any) => p.online).length;

    // Generate QR URL
    const guestUrl = window.location.origin + `/#/bingo/${eventId}/play`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(guestUrl)}`;

    // WAITING SCREEN
    if (state.status === 'WAITING') {
        return (
            <div className="h-screen w-screen bg-slate-900 text-white flex flex-col items-center justify-center overflow-hidden relative">
                <div className="absolute inset-0 opacity-10 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500"></div>

                <div className="z-10 text-center space-y-8 p-12 bg-white/5 backdrop-blur-lg rounded-3xl border border-white/10 shadow-2xl max-w-4xl w-full">
                    <h1 className="text-7xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 drop-shadow-lg">
                        PHOTO BINGO
                    </h1>

                    {/* Branding Image */}
                    {(state.customImageUrl && state.customImageUrl.length > 5) && (
                        <div className="max-w-xl mx-auto rounded-xl overflow-hidden shadow-2xl border-2 border-white/10 -mt-4 mb-4">
                            <img
                                src={state.customImageUrl}
                                className="w-full h-48 object-cover"
                                alt="Event Branding"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                        </div>
                    )}

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

    // WINNER SCREEN (with dismiss button)
    if (state.status === 'WINNER' && state.winner && showWinner) {
        return (
            <div className="h-screen w-screen bg-indigo-900 flex flex-col items-center justify-center relative overflow-hidden">
                {/* Fireworks */}
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

                {/* Dismiss Button */}
                <button
                    onClick={dismissWinner}
                    className="absolute top-6 right-6 z-20 bg-white/20 hover:bg-white/30 backdrop-blur-sm px-6 py-3 rounded-full text-white font-bold flex items-center gap-2 transition-all"
                >
                    <span className="material-symbols-outlined">arrow_back</span>
                    Volver al juego
                </button>

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

    // Sort submissions by arrival order
    const sortedSubmissions = [...state.submissions].sort((a, b) => a.submittedAt - b.submittedAt);

    // PLAYING / REVIEW SCREEN
    return (
        <div className="h-screen w-screen bg-slate-900 text-white p-6 flex gap-6 font-sans relative overflow-hidden">
            {/* Celebration Animations */}
            {celebration && (
                <div className="absolute inset-0 z-50 pointer-events-none overflow-hidden">
                    {celebration === 'LINE' ? (
                        [...Array(80)].map((_, i) => (
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
                        [...Array(60)].map((_, i) => (
                            <div
                                key={i}
                                className="absolute animate-firework"
                                style={{
                                    left: `${Math.random() * 100}%`,
                                    top: `${Math.random() * 100}%`,
                                    animationDuration: `${Math.random() * 1 + 0.5}s`,
                                    animationDelay: `${Math.random() * 2}s`,
                                    fontSize: `${Math.random() * 4 + 2}rem`
                                }}
                            >
                                {['🎆', '🎇', '✨', '💥', '⭐', '🔥', '💫', '🌟', '🎊', '🎉'][i % 10]}
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Sidebar: Player Queue with Thumbnails */}
            <aside className="w-80 bg-slate-800/50 rounded-2xl p-5 border border-slate-700 flex flex-col">
                <h2 className="text-xl font-bold text-indigo-400 mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined">leaderboard</span>
                    En Vivo
                </h2>
                <div className="mb-4 text-center">
                    <span className="text-4xl font-bold">{playerCount}</span>
                    <p className="text-gray-400 text-sm">jugadores</p>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3">
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
                                <div className="flex items-center gap-3 mb-2">
                                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${sub.status === 'APPROVED' ? 'bg-green-500' :
                                        sub.status === 'REJECTED' ? 'bg-red-500' :
                                            'bg-slate-600'
                                        }`}>
                                        {sub.status === 'APPROVED' ? '✓' : sub.status === 'REJECTED' ? '✕' : `#${idx + 1}`}
                                    </span>

                                    <div className="flex-1 min-w-0">
                                        <span className="font-bold text-sm block truncate">{sub.player.name}</span>
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

                                {/* Mini Thumbnail Grid */}
                                <div className="grid grid-cols-3 gap-1">
                                    {state.prompts.slice(0, 9).map(prompt => {
                                        const cell = sub.card.cells[prompt.id];
                                        return (
                                            <div
                                                key={prompt.id}
                                                className={`aspect-square rounded overflow-hidden ${cell?.photoUrl ? 'bg-slate-600' : 'bg-slate-700/50'
                                                    }`}
                                            >
                                                {cell?.photoUrl ? (
                                                    <img
                                                        src={cell.photoUrl}
                                                        className="w-full h-full object-cover"
                                                        alt=""
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-slate-500 text-[8px]">
                                                        <span className="material-symbols-outlined text-xs">{prompt.icon}</span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
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
                            <div className="flex items-center gap-4">
                                <h2 className="text-3xl font-bold">
                                    Cartón de <span className="text-indigo-400">{selectedSubmission.player.name}</span>
                                </h2>
                                {/* Win indicators */}
                                {hasBingo && (
                                    <span className="bg-purple-600 px-4 py-1 rounded-full text-sm font-bold animate-pulse">
                                        🎯 ¡BINGO DETECTADO!
                                    </span>
                                )}
                                {hasLine && !hasBingo && (
                                    <span className="bg-amber-500 text-black px-4 py-1 rounded-full text-sm font-bold animate-pulse">
                                        📏 ¡LÍNEA DETECTADA!
                                    </span>
                                )}
                            </div>
                            <button
                                onClick={() => { setSelectedSubmission(null); setPhotoEvaluations({}); }}
                                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        {/* Photo Grid with Evaluation Buttons */}
                        <div className="grid grid-cols-3 gap-4 flex-1 max-h-[calc(100vh-280px)]">
                            {state.prompts.map(prompt => {
                                const cell = selectedSubmission.card.cells[prompt.id];
                                const evalStatus = photoEvaluations[prompt.id];

                                return (
                                    <div
                                        key={prompt.id}
                                        className={`relative aspect-square rounded-xl overflow-hidden border-4 transition-all ${evalStatus === 'approved' ? 'border-green-400 ring-2 ring-green-400/50' :
                                            evalStatus === 'rejected' ? 'border-red-400 ring-2 ring-red-400/50' :
                                                cell?.photoUrl ? 'border-slate-500' : 'border-slate-600 bg-slate-800'
                                            }`}
                                    >
                                        {cell?.photoUrl ? (
                                            <>
                                                <img
                                                    src={cell.photoUrl}
                                                    className="w-full h-full object-cover cursor-pointer"
                                                    onClick={() => setFullscreenPhoto({ url: cell.photoUrl!, prompt: prompt.text, promptId: prompt.id })}
                                                    alt="Bingo Cell"
                                                />

                                                {/* Prompt Overlay */}
                                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-2">
                                                    <p className="text-white text-xs font-medium truncate">{prompt.text}</p>
                                                </div>

                                                {/* Evaluation Buttons */}
                                                <div className="absolute top-2 right-2 flex gap-1">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); togglePhotoEval(prompt.id, 'approved'); }}
                                                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-lg ${evalStatus === 'approved'
                                                            ? 'bg-green-500 text-white scale-110'
                                                            : 'bg-white/80 text-green-600 hover:bg-green-500 hover:text-white'
                                                            }`}
                                                    >
                                                        <span className="material-symbols-outlined text-xl">check</span>
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); togglePhotoEval(prompt.id, 'rejected'); }}
                                                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-lg ${evalStatus === 'rejected'
                                                            ? 'bg-red-500 text-white scale-110'
                                                            : 'bg-white/80 text-red-600 hover:bg-red-500 hover:text-white'
                                                            }`}
                                                    >
                                                        <span className="material-symbols-outlined text-xl">close</span>
                                                    </button>
                                                </div>

                                                {/* Status Overlay */}
                                                {evalStatus && (
                                                    <div className={`absolute inset-0 pointer-events-none ${evalStatus === 'approved' ? 'bg-green-500/20' : 'bg-red-500/20'
                                                        }`}>
                                                        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-6xl ${evalStatus === 'approved' ? 'text-green-400' : 'text-red-400'
                                                            }`}>
                                                            {evalStatus === 'approved' ? '✓' : '✕'}
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center h-full text-slate-600">
                                                <span className="material-symbols-outlined text-4xl mb-2">{prompt.icon}</span>
                                                <span className="text-xs text-center px-2">{prompt.text}</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Verdict Buttons */}
                        <div className="flex gap-4 justify-center mt-6">
                            <button
                                onClick={() => handleVerdict('LINE')}
                                disabled={!hasLine}
                                className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-bold text-xl shadow-lg transform transition-all ${hasLine
                                    ? 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black hover:scale-105'
                                    : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                                    }`}
                            >
                                <span className="material-symbols-outlined">horizontal_rule</span>
                                LÍNEA
                            </button>
                            <button
                                onClick={() => handleVerdict('BINGO')}
                                disabled={!hasBingo}
                                className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-bold text-xl shadow-lg transform transition-all ${hasBingo
                                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white hover:scale-105'
                                    : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                                    }`}
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

                    {/* Evaluation buttons in fullscreen */}
                    <div className="absolute top-6 left-1/2 -translate-x-1/2 flex gap-4">
                        <button
                            onClick={(e) => { e.stopPropagation(); togglePhotoEval(fullscreenPhoto.promptId, 'approved'); }}
                            className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold text-lg transition-all ${photoEvaluations[fullscreenPhoto.promptId] === 'approved'
                                ? 'bg-green-500 text-white scale-110'
                                : 'bg-white/20 hover:bg-green-500 text-white'
                                }`}
                        >
                            <span className="material-symbols-outlined">check</span>
                            Aprobar
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); togglePhotoEval(fullscreenPhoto.promptId, 'rejected'); }}
                            className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold text-lg transition-all ${photoEvaluations[fullscreenPhoto.promptId] === 'rejected'
                                ? 'bg-red-500 text-white scale-110'
                                : 'bg-white/20 hover:bg-red-500 text-white'
                                }`}
                        >
                            <span className="material-symbols-outlined">close</span>
                            Rechazar
                        </button>
                    </div>

                    <div className="max-w-5xl max-h-[80vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
                        <img
                            src={fullscreenPhoto.url}
                            alt="Foto ampliada"
                            className="max-w-full max-h-[70vh] object-contain rounded-2xl shadow-2xl"
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
