
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
                            className="text-6xl md:text-7xl font-black italic tracking-tighter uppercase"
                        >
                            ¿Quién es el <span className="text-primary drop-shadow-[0_0_20px_rgba(164,19,236,0.6)]">Impostor</span>?
                        </motion.h1>

                        <div className="flex flex-col lg:flex-row items-center justify-center gap-12 bg-white/5 p-10 rounded-[50px] border border-white/10 backdrop-blur-xl shadow-2xl">

                            {/* LEFT: QR Section - MAIN PROTAGONIST */}
                            <div className="flex flex-col items-center gap-6">
                                <motion.div
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ type: "spring", stiffness: 200, damping: 15 }}
                                    className="relative"
                                >
                                    {/* Glowing effect behind QR */}
                                    <div className="absolute inset-0 bg-primary/30 blur-[50px] rounded-3xl scale-110" />
                                    <div className="relative bg-white p-8 rounded-3xl shadow-[0_0_80px_rgba(255,255,255,0.3)]">
                                        <img
                                            src={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(`${window.location.origin}/#/impostor/${eventId}/guest`)}`}
                                            alt="Scan to Join"
                                            className="w-72 h-72 md:w-80 md:h-80"
                                        />
                                    </div>
                                </motion.div>
                                <div className="text-center">
                                    <p className="text-3xl font-bold uppercase tracking-widest text-primary mb-2">¡Escaneá para jugar!</p>
                                    <p className="text-slate-400 text-lg font-medium">Sumate a la votación desde tu celular</p>
                                </div>

                                {/* Logo/Branding Image - BELOW QR */}
                                {(state.config.customImageUrl && state.config.customImageUrl.length > 5) && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.3 }}
                                        className="max-w-xs rounded-2xl overflow-hidden shadow-lg border-2 border-white/10"
                                    >
                                        <img
                                            src={state.config.customImageUrl}
                                            className="w-full h-32 object-cover"
                                            alt="Event Branding"
                                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                        />
                                    </motion.div>
                                )}
                            </div>

                            {/* Divider for desktop */}
                            <div className="hidden lg:block w-px h-96 bg-white/10" />

                            {/* RIGHT: Lobby / Players List */}
                            <div className="flex flex-col items-center gap-6 min-w-[300px]">
                                <h3 className="text-2xl font-bold uppercase tracking-tight text-white/80">
                                    {state.activePlayers.length > 0 ? "Jugadores en Escena" : "Lobby de Invitados"}
                                </h3>
                                <div className="flex flex-wrap justify-center gap-5 max-w-lg">
                                    {(state.activePlayers.length > 0 ? state.activePlayers : state.lobby).length > 0 ? (
                                        (state.activePlayers.length > 0 ? state.activePlayers : state.lobby).map((player, i) => (
                                            <motion.div
                                                key={player.id}
                                                initial={{ opacity: 0, scale: 0.8 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                transition={{ delay: i * 0.1 }}
                                                className="flex flex-col items-center gap-2"
                                            >
                                                <div className="relative">
                                                    <div className="absolute inset-0 bg-primary/30 blur-lg rounded-full" />
                                                    <img src={player.avatar} className="w-16 h-16 rounded-full bg-slate-800 relative z-10 border-2 border-white/20" />
                                                </div>
                                                <span className="text-xs font-bold uppercase tracking-tight w-20 truncate text-center">{player.name}</span>
                                            </motion.div>
                                        ))
                                    ) : (
                                        <div className="text-slate-500 text-xl font-medium animate-pulse py-8 flex flex-col items-center gap-3">
                                            <span className="material-symbols-outlined text-4xl">hourglass_empty</span>
                                            ¡Escaneá el código para unirte!
                                        </div>
                                    )}
                                </div>
                                <div className="text-center mt-4">
                                    <span className="inline-flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full text-sm font-bold">
                                        <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                                        {state.lobby.length} conectados
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* SUBMITTING PHASE */}
                {state.status === 'SUBMITTING' && (
                    <div className="text-center space-y-12">
                        <div className="space-y-4">
                            <h2 className="text-6xl font-black uppercase tracking-tighter italic">Escribiendo respuestas...</h2>
                            <p className="text-2xl text-slate-500 drop-shadow-lg">Los jugadores están recibiendo sus consignas secretas</p>
                        </div>
                        <div className="flex flex-wrap justify-center gap-12">
                            {state.activePlayers.map((player) => (
                                <div key={player.id} className="flex flex-col items-center gap-4">
                                    <div className="relative">
                                        <div className={`absolute inset-0 blur-2xl rounded-full transition-all duration-500 ${player.answer ? 'bg-green-500/40' : 'bg-primary/20'}`} />
                                        <img src={player.avatar} className={`w-32 h-32 rounded-full relative z-10 transition-all duration-500 ${player.answer ? 'grayscale-0 scale-110' : 'grayscale opacity-50'}`} />
                                        <AnimatePresence>
                                            {player.answer ? (
                                                <motion.div
                                                    initial={{ scale: 0 }}
                                                    animate={{ scale: 1 }}
                                                    className="absolute -bottom-2 -right-2 bg-green-500 w-12 h-12 rounded-full flex items-center justify-center border-4 border-[#0a050f] z-20"
                                                >
                                                    <span className="material-symbols-outlined text-white font-bold">check</span>
                                                </motion.div>
                                            ) : (
                                                <div className="absolute inset-0 border-4 border-slate-700/50 rounded-full animate-spin border-t-primary z-20" />
                                            )}
                                        </AnimatePresence>
                                    </div>
                                    <p className={`text-xl font-black uppercase tracking-tight transition-colors ${player.answer ? 'text-white' : 'text-slate-500'}`}>{player.name}</p>
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

            {/* Persistent Floating QR for other phases */}
            {state.status !== 'WAITING' && (
                <motion.div
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="absolute bottom-10 right-10 z-50 flex items-center gap-4 bg-white/5 backdrop-blur-md p-4 rounded-3xl border border-white/10 shadow-2xl"
                >
                    <div className="text-right hidden sm:block">
                        <p className="text-xs font-bold uppercase tracking-widest text-primary mb-0.5">¡Sumate!</p>
                        <p className="text-[10px] font-medium text-slate-400">Escaneá para votar</p>
                    </div>
                    <div className="bg-white p-2 rounded-xl">
                        <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`${window.location.origin}/#/impostor/${eventId}/guest`)}`}
                            alt="Scan to Join"
                            className="w-16 h-16"
                        />
                    </div>
                </motion.div>
            )}
        </div>
    );
};

export default ImpostorBigScreen;
