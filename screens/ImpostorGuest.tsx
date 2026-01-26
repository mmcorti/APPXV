
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { impostorService, ImpostorState, ImpostorPlayer } from '../services/impostorService';
import { User } from '../types';

interface ImpostorGuestProps {
    user: User | null;
}

const ImpostorGuest: React.FC<ImpostorGuestProps> = ({ user }) => {
    const { id: eventId } = useParams<{ id: string }>();
    const [state, setState] = useState<ImpostorState | null>(null);
    const [myPlayer, setMyPlayer] = useState<ImpostorPlayer | null>(null);
    const [playerName, setPlayerName] = useState(localStorage.getItem('imp_name') || '');
    const [isJoined, setIsJoined] = useState(false);
    const [answer, setAnswer] = useState('');
    const [selectedVote, setSelectedVote] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const guestId = user?.id || localStorage.getItem('imp_id') || 'guest-' + Math.random().toString(36).substr(2, 9);

    useEffect(() => {
        if (!localStorage.getItem('imp_id')) {
            localStorage.setItem('imp_id', String(guestId));
        }
    }, [guestId]);

    useEffect(() => {
        if (!eventId) return;

        loadInitial();

        const unsubscribe = impostorService.subscribe(eventId, (newState) => {
            setState(newState);
            updateRole(newState);
            // Auto-detect if joined
            if (newState.lobby.some(p => p.id === String(guestId))) {
                setIsJoined(true);
            }
        });

        return () => unsubscribe();
    }, [eventId, guestId]);

    const loadInitial = async () => {
        if (!eventId) return;
        try {
            const currentState = await impostorService.getState(eventId);
            setState(currentState);
            updateRole(currentState);
            if (currentState.lobby.some(p => p.id === String(guestId))) {
                setIsJoined(true);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleJoin = async () => {
        if (!eventId || !playerName.trim()) return;
        localStorage.setItem('imp_name', playerName);
        await impostorService.joinSession(eventId, {
            id: String(guestId),
            name: playerName
        });
        setIsJoined(true);
    };

    const updateRole = (s: ImpostorState) => {
        const p = s.activePlayers.find(player => player.id === String(guestId));
        setMyPlayer(p || null);
    };

    const handleSubmitAnswer = async () => {
        if (!eventId || !answer.trim()) return;
        await impostorService.submitAnswer(eventId, String(guestId), answer);
    };

    const handleVote = async (playerId: string) => {
        if (!eventId || state?.status !== 'VOTING' || selectedVote) return;
        setSelectedVote(playerId);
        await impostorService.castVote(eventId, String(guestId), playerId);
    };

    if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center p-8 text-white">Loading...</div>;
    if (!state) return <div className="min-h-screen bg-slate-950 flex items-center justify-center p-8 text-white">Error loading session</div>;

    const isPlayer = !!myPlayer;
    const hasAnswered = !!myPlayer?.answer;

    return (
        <div className="min-h-screen bg-slate-950 text-white font-display p-4 pb-20 overflow-x-hidden">

            {/* Context Header */}
            <div className="flex flex-col items-center gap-2 mb-8 mt-4">
                <div className="w-12 h-1 bg-slate-800 rounded-full mb-4" />
                <h2 className="text-2xl font-black italic tracking-tighter uppercase">EL IMPOSTOR</h2>
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Partida en curso</span>
                </div>
            </div>

            <main className="max-w-md mx-auto">
                <AnimatePresence mode="wait">

                    {/* CASE: JOIN LOBBY */}
                    {!isJoined && !isPlayer && (
                        <motion.div
                            key="join-lobby"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-6 shadow-2xl"
                        >
                            <div className="text-center space-y-2">
                                <h3 className="text-2xl font-black italic uppercase tracking-tighter">¡Sumate al juego!</h3>
                                <p className="text-slate-400 text-sm">Ingresá tu nombre para participar</p>
                            </div>

                            <div className="space-y-4">
                                <input
                                    type="text"
                                    value={playerName}
                                    onChange={(e) => setPlayerName(e.target.value)}
                                    placeholder="Tu Apodo..."
                                    className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 text-center text-xl font-bold outline-none focus:ring-2 focus:ring-primary"
                                />
                                <button
                                    onClick={handleJoin}
                                    disabled={!playerName.trim()}
                                    className="w-full bg-primary py-4 rounded-2xl font-black text-xl italic uppercase tracking-tighter shadow-xl shadow-primary/20 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
                                >
                                    INGRESAR
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* CASE: PLAYER - NEEDS TO SUBMIT ANSWER */}
                    {isJoined && isPlayer && state.status === 'SUBMITTING' && (
                        <motion.div
                            key="player-submission"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="space-y-6"
                        >
                            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-10">
                                    <span className="material-symbols-outlined text-6xl">lock</span>
                                </div>

                                <span className="bg-primary/20 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest mb-4 inline-block">
                                    TU CONSIGNA SECRETA
                                </span>

                                <h3 className="text-3xl font-black italic leading-tight mb-4 tracking-tighter">
                                    {myPlayer.role === 'IMPOSTOR' ? state.config.impostorPrompt : state.config.mainPrompt}
                                </h3>
                                <p className="text-slate-500 text-sm italic">Oculto: No dejes que el público sospeche de vos.</p>
                            </div>

                            {!hasAnswered ? (
                                <div className="space-y-4">
                                    <textarea
                                        value={answer}
                                        onChange={(e) => setAnswer(e.target.value)}
                                        placeholder="Escribe tu respuesta aquí..."
                                        className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-5 text-lg font-bold outline-none focus:ring-2 focus:ring-primary h-32 resize-none"
                                    />
                                    <button
                                        onClick={handleSubmitAnswer}
                                        disabled={!answer.trim()}
                                        className="w-full bg-primary py-5 rounded-2xl font-black text-xl italic uppercase tracking-tighter shadow-xl shadow-primary/20 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
                                    >
                                        ENVIAR RESPUESTA
                                    </button>
                                </div>
                            ) : (
                                <div className="text-center p-8 bg-green-500/10 border border-green-500/20 rounded-2xl">
                                    <span className="material-symbols-outlined text-4xl text-green-500 mb-2">check_circle</span>
                                    <p className="text-lg font-bold">Respuesta enviada</p>
                                    <p className="text-slate-500 text-sm">Mira la pantalla gigante...</p>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* CASE: SPECTATOR OR WAITING - VOTING PHASE */}
                    {state.status === 'VOTING' && (
                        <motion.div
                            key="voting-phase"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="space-y-6"
                        >
                            <div className="text-center">
                                <h3 className="text-3xl font-black italic tracking-tighter mb-2">¿QUIÉN ES EL IMPOSTOR?</h3>
                                <p className="text-slate-500 font-medium">Observa las respuestas y vota:</p>
                            </div>

                            <div className="space-y-3">
                                {state.activePlayers.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => handleVote(p.id)}
                                        disabled={!!selectedVote || p.id === String(guestId)}
                                        className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${selectedVote === p.id
                                            ? 'bg-primary border-primary shadow-lg shadow-primary/20 scale-105'
                                            : 'bg-slate-900 border-slate-800 hover:border-slate-600'
                                            } disabled:grayscale disabled:opacity-80`}
                                    >
                                        <div className="flex items-center gap-4 text-left">
                                            <img src={p.avatar} className="w-12 h-12 rounded-full bg-slate-800" />
                                            <div>
                                                <p className="font-bold leading-tight">{p.name}</p>
                                                <p className="text-primary text-xs font-black uppercase tracking-widest italic">"{p.answer}"</p>
                                            </div>
                                        </div>
                                        {selectedVote === p.id && <span className="material-symbols-outlined font-bold">check_circle</span>}
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {/* CASE: REVEAL PHASE */}
                    {state.status === 'REVEAL' && (
                        <motion.div
                            key="reveal-phase"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="text-center p-8 bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl space-y-6"
                        >
                            <h3 className="text-2xl font-black italic uppercase">FIN DE LA RONDA</h3>

                            {state.activePlayers.filter(p => p.role === 'IMPOSTOR').map(imp => (
                                <div key={imp.id} className="flex flex-col items-center gap-4">
                                    <img src={imp.avatar} className="w-32 h-32 rounded-full border-4 border-red-500 shadow-2xl" />
                                    <p className="text-slate-400 text-sm uppercase font-bold tracking-widest">El Impostor era</p>
                                    <p className="text-4xl font-black italic text-red-500 uppercase">{imp.name}</p>
                                </div>
                            ))}

                            <div className="pt-6 border-t border-slate-800">
                                <p className="text-xl font-bold uppercase tracking-tight">
                                    {state.winner === 'PUBLIC' ? '¡GANÓ EL PÚBLICO!' : '¡EL IMPOSTOR GANÓ!'}
                                </p>
                            </div>
                        </motion.div>
                    )}

                    {/* CASE: WAITING PHASE (Spectator) */}
                    {isJoined && state.status === 'WAITING' && !isPlayer && (
                        <div className="text-center p-12 space-y-4">
                            <span className="material-symbols-outlined text-6xl text-slate-800 animate-spin">search_check</span>
                            <p className="text-xl font-bold italic text-slate-500">Preparando ronda...</p>
                            <p className="text-sm text-slate-700">Mirá la pantalla gigante para conocer a los jugadores.</p>
                        </div>
                    )}

                </AnimatePresence>
            </main>
        </div>
    );
};

export default ImpostorGuest;
