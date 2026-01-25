
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { impostorService, ImpostorState } from '../services/impostorService';
import { motion, AnimatePresence } from 'framer-motion';

const ImpostorBigScreen: React.FC = () => {
    const { id: eventId } = useParams<{ id: string }>();
    const [state, setState] = useState<ImpostorState | null>(null);

    useEffect(() => {
        if (!eventId) return;

        impostorService.getState(eventId).then(setState);

        const unsubscribe = impostorService.subscribe(eventId, (newState) => {
            setState(newState);
        });

        return () => unsubscribe();
    }, [eventId]);

    if (!state) return null;

    // Calculate vote stats
    const voteCounts: Record<string, number> = {};
    Object.values(state.votes).forEach((targetId: string) => {
        voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
    });
    const totalVotes = Object.keys(state.votes).length;

    return (
        <div className="min-h-screen bg-[#0a050f] text-white flex flex-col items-center justify-center p-8 overflow-hidden font-display relative">
            {/* Background Effects */}
            <div className="absolute inset-0 bg-radial-gradient from-primary/10 via-transparent to-transparent opacity-50" />
            <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-primary/20 blur-[150px] rounded-full" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[60%] bg-purple-600/10 blur-[150px] rounded-full" />

            <div className="relative z-10 w-full max-w-7xl">

                {/* WAITING PHASE */}
                {state.status === 'WAITING' && (
                    <div className="text-center space-y-8">
                        <motion.h1
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-7xl font-black italic tracking-tighter uppercase"
                        >
                            ¿Quién es el <span className="text-primary drop-shadow-[0_0_20px_rgba(164,19,236,0.6)]">Impostor</span>?
                        </motion.h1>

                        <div className="flex flex-wrap justify-center gap-8 mt-12">
                            {state.activePlayers.length > 0 ? (
                                state.activePlayers.map((player, i) => (
                                    <motion.div
                                        key={player.id}
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: i * 0.1 }}
                                        className="flex flex-col items-center gap-4"
                                    >
                                        <div className="relative">
                                            <div className="absolute inset-0 bg-primary/40 blur-xl rounded-full scale-110" />
                                            <img src={player.avatar} className="w-40 h-40 rounded-full bg-slate-800 relative z-10 border-4 border-white/10 shadow-2xl" />
                                        </div>
                                        <h3 className="text-3xl font-bold uppercase tracking-tight">{player.name}</h3>
                                    </motion.div>
                                ))
                            ) : (
                                <div className="text-slate-500 text-3xl font-medium animate-pulse">Esperando jugadores...</div>
                            )}
                        </div>
                    </div>
                )}

                {/* SUBMITTING PHASE */}
                {state.status === 'SUBMITTING' && (
                    <div className="text-center space-y-12">
                        <h2 className="text-6xl font-black uppercase tracking-tighter italic">Escribiendo respuestas...</h2>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8">
                            {state.activePlayers.map((player) => (
                                <div key={player.id} className="flex flex-col items-center gap-4 opacity-80">
                                    <div className="relative">
                                        <img src={player.avatar} className="w-32 h-32 rounded-full grayscale" />
                                        <AnimatePresence>
                                            {player.answer ? (
                                                <motion.div
                                                    initial={{ scale: 0 }}
                                                    animate={{ scale: 1 }}
                                                    className="absolute bottom-0 right-0 bg-green-500 w-10 h-10 rounded-full flex items-center justify-center border-4 border-[#0a050f]"
                                                >
                                                    <span className="material-symbols-outlined text-white font-bold">check</span>
                                                </motion.div>
                                            ) : (
                                                <div className="absolute inset-0 border-4 border-slate-700 rounded-full animate-spin border-t-primary" />
                                            )}
                                        </AnimatePresence>
                                    </div>
                                    <p className="text-xl font-bold uppercase text-slate-400">{player.name}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* VOTING PHASE */}
                {state.status === 'VOTING' && (
                    <div className="space-y-12">
                        <div className="text-center">
                            <h2 className="text-6xl font-black uppercase tracking-tighter italic mb-4">¡A VOTAR!</h2>
                            <p className="text-3xl text-slate-400 font-medium italic">¿Quién dio la respuesta del Impostor?</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 px-4">
                            {state.activePlayers.map((player, i) => {
                                const votes = voteCounts[player.id] || 0;
                                const percentage = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;

                                return (
                                    <motion.div
                                        key={player.id}
                                        initial={{ opacity: 0, x: i % 2 === 0 ? -50 : 50 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="bg-white/5 border border-white/10 rounded-[40px] p-8 flex items-center justify-between gap-6 backdrop-blur-3xl overflow-hidden relative group"
                                    >
                                        <div className="flex items-center gap-8 relative z-10 flex-1">
                                            <img src={player.avatar} className="w-24 h-24 rounded-full border-4 border-white/20" />
                                            <div className="flex-1">
                                                <h3 className="text-2xl font-black uppercase tracking-tight text-primary mb-1">{player.name}</h3>
                                                <p className="text-4xl font-bold leading-tight tracking-tight italic">"{player.answer}"</p>
                                            </div>
                                        </div>

                                        <div className="text-right flex flex-col items-end gap-2 relative z-10">
                                            <span className="text-5xl font-black italic">{Math.round(percentage)}%</span>
                                            <span className="text-sm font-bold uppercase tracking-widest text-slate-500">{votes} VOTOS</span>
                                        </div>

                                        {/* Progress Bar Background */}
                                        <div
                                            className="absolute left-0 top-0 bottom-0 bg-primary/20 transition-all duration-1000 ease-out"
                                            style={{ width: `${percentage}%` }}
                                        />
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* REVEAL PHASE */}
                {state.status === 'REVEAL' && (
                    <div className="text-center space-y-12 h-screen flex flex-col items-center justify-center">
                        <motion.div
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            className="space-y-8"
                        >
                            <h2 className="text-4xl font-black text-slate-400 uppercase tracking-widest">El Impostor era...</h2>

                            {state.activePlayers.filter(p => p.role === 'IMPOSTOR').map(impostor => (
                                <div key={impostor.id} className="flex flex-col items-center gap-6">
                                    <div className="relative">
                                        <div className="absolute inset-0 bg-red-500/50 blur-[100px] rounded-full scale-150 animate-pulse" />
                                        <img src={impostor.avatar} className="w-64 h-64 rounded-full border-8 border-red-500 relative z-10 shadow-[0_0_50px_rgba(239,68,68,0.5)]" />
                                    </div>
                                    <h1 className="text-9xl font-black italic uppercase tracking-tighter text-red-500 drop-shadow-[0_0_30px_rgba(239,68,68,0.8)]">
                                        {impostor.name}
                                    </h1>
                                </div>
                            ))}

                            <div className="mt-12 bg-white/5 border border-white/10 p-8 rounded-3xl inline-block backdrop-blur-xl">
                                <h3 className="text-3xl font-bold uppercase tracking-tight mb-4">
                                    {state.winner === 'PUBLIC' ? '¡GANÓ EL PÚBLICO!' : '¡GANÓ EL IMPOSTOR!'}
                                </h3>
                                <div className="grid grid-cols-2 gap-8 text-left border-t border-white/10 pt-6 mt-6">
                                    <div>
                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Consigna Civiles</p>
                                        <p className="text-lg font-bold">{state.config.mainPrompt}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-red-500 uppercase tracking-widest mb-1">Consigna Impostor</p>
                                        <p className="text-lg font-bold">{state.config.impostorPrompt}</p>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ImpostorBigScreen;
