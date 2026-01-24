
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { raffleService } from '../services/raffleService';
import { RaffleState } from '../types/raffleTypes';

const RaffleBigScreen: React.FC = () => {
    const { id: eventId } = useParams<{ id: string }>();
    const [state, setState] = useState<RaffleState | null>(null);
    const [shuffleName, setShuffleName] = useState('');

    useEffect(() => {
        if (!eventId) return;
        const unsubscribe = raffleService.subscribe(eventId, setState);
        return unsubscribe;
    }, [eventId]);

    // Shuffle effect for suspense
    useEffect(() => {
        if (state?.status === 'COUNTDOWN' && state.mode === 'PARTICIPANT') {
            const participants = Object.values(state.participants) as any[];
            const names = participants.map(p => p.name);
            if (names.length === 0) return;

            const interval = setInterval(() => {
                const randomName = names[Math.floor(Math.random() * names.length)];
                setShuffleName(randomName);
            }, 100);
            return () => clearInterval(interval);
        }
    }, [state?.status, state?.participants, state?.mode]);

    if (!state) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Cargando...</div>;

    const isWinner = state.status === 'WINNER';
    const isPhoto = state.mode === 'PHOTO';

    return (
        <div className="min-h-screen bg-slate-950 text-white font-display overflow-hidden relative selection:bg-indigo-500 selection:text-white">

            {/* Background Effects */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/20 rounded-full blur-[120px] animate-pulse-slow"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-purple-600/10 rounded-full blur-[140px] animate-pulse-slow" style={{ animationDelay: '2s' }}></div>
            </div>

            {/* Header */}
            <div className="relative z-10 flex items-center justify-between p-8">
                <div className="flex items-center gap-3 bg-slate-900/50 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full">
                    <span className="material-symbols-outlined text-yellow-400">emoji_events</span>
                    <span className="font-bold tracking-wide text-sm uppercase">Sorteo en Vivo</span>
                </div>
                {state.participants && state.mode === 'PARTICIPANT' && !isWinner && (
                    <div className="flex items-center gap-2 text-slate-400 font-mono text-sm">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        {Object.keys(state.participants).length} Participantes
                    </div>
                )}
            </div>

            {/* MAIN CONTENT */}
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center min-h-[80vh] w-full max-w-7xl mx-auto px-6">

                {state.status === 'COUNTDOWN' ? (
                    // SUSPENSE / COUNTDOWN VIEW
                    <div className="flex flex-col items-center justify-center animate-fade-in text-center">
                        <div className="mb-12">
                            <div className="w-24 h-24 border-4 border-indigo-500 border-t-white rounded-full animate-spin mx-auto mb-6 shadow-[0_0_30px_rgba(79,70,229,0.5)]"></div>
                            <h2 className="text-4xl font-black tracking-widest uppercase bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400 animate-pulse">
                                SORTEANDO...
                            </h2>
                        </div>

                        {state.mode === 'PARTICIPANT' ? (
                            <div className="h-40 flex items-center justify-center">
                                <span className="text-6xl md:text-8xl font-black text-white/20 blur-sm absolute transform -translate-y-10 scale-90 translate-x-10">
                                    {shuffleName}
                                </span>
                                <span className="text-6xl md:text-8xl font-black text-white/20 blur-sm absolute transform translate-y-12 scale-90 -translate-x-12">
                                    {shuffleName}
                                </span>
                                <span className="relative text-7xl md:text-9xl font-black text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.3)] animate-bounce-small">
                                    {shuffleName}
                                </span>
                            </div>
                        ) : (
                            <div className="relative w-full max-w-xl aspect-video bg-slate-800 rounded-2xl overflow-hidden border-2 border-white/10 shadow-2xl">
                                <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/40 to-slate-950/40"></div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-8xl text-indigo-500/30 animate-ping">search</span>
                                </div>
                                <div className="absolute top-0 left-0 w-full h-[2px] bg-indigo-400 shadow-[0_0_15px_rgba(129,140,248,0.8)] animate-scan"></div>
                            </div>
                        )}

                        <p className="mt-12 text-slate-500 font-mono tracking-widest uppercase text-sm">El azar está decidiendo</p>
                    </div>
                ) : state.status !== 'WINNER' ? (
                    // WAITING VIEW
                    <div className="flex flex-col md:flex-row items-center gap-12 w-full animate-fade-in">

                        {/* Left/Main Visual */}
                        <div className="flex-1 w-full max-w-2xl relative group">
                            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                            <div className="relative aspect-video bg-slate-900 rounded-xl overflow-hidden shadow-2xl border border-white/10 ring-1 ring-white/5">
                                <img
                                    src={(state.customImageUrl && state.customImageUrl.trim().length > 5) ? state.customImageUrl : 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80'}
                                    alt="Event Branding"
                                    className="w-full h-full object-cover opacity-80"
                                    onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80'; }}
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent"></div>
                                <div className="absolute bottom-8 left-0 right-0 text-center">
                                    <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white drop-shadow-lg mb-2 text-balance">
                                        {state.status === 'IDLE' ? 'PREPARANDO SORTEO' : '¡PARTICIPA AHORA!'}
                                    </h1>
                                    <p className="text-indigo-200 font-medium text-lg">
                                        {isPhoto ? 'Sorteo por Fotos de Google' : 'Escanea el código para unirte'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Right/QR (Only for Participant Mode) */}
                        {state.mode !== 'PHOTO' && (
                            <div className="w-full md:w-auto flex flex-col items-center animate-fade-in-up delay-200">
                                <div className="bg-white p-4 rounded-2xl shadow-[0_0_40px_-10px_rgba(255,255,255,0.1)] transform rotate-2 hover:rotate-0 transition-transform duration-500">
                                    <img
                                        src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(`${window.location.origin}/#/raffle/${eventId}/guest`)}`}
                                        alt="Scan to Join"
                                        className="w-64 h-64 mix-blend-multiply"
                                    />
                                </div>
                                <div className="mt-6 text-center">
                                    <p className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">Escanea el QR</p>
                                    <p className="text-slate-500">Ingresa tu nombre para participar</p>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    // WINNER VIEW
                    <div className="flex flex-col items-center justify-center animate-zoom-in text-center relative w-full h-full py-20">
                        {/* Confetti should be handled by CSS or library, adding simple CSS placeholders */}
                        <div className="absolute top-0 left-1/4 w-2 h-2 bg-red-500 animate-ping"></div>
                        <div className="absolute top-10 right-1/4 w-3 h-3 bg-yellow-500 animate-bounce"></div>

                        <div className="inline-flex items-center gap-2 bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 px-6 py-2 rounded-full mb-8 animate-fade-in-down">
                            <span className="material-symbols-outlined filled">emoji_events</span>
                            <span className="font-bold tracking-wider uppercase">¡Tenemos un Ganador!</span>
                        </div>

                        {/* Winner Content */}
                        {isPhoto ? (
                            <div className="relative w-full max-w-3xl aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl border-4 border-yellow-500/50 glow-effect bg-slate-800 animate-slide-up">
                                <img
                                    src={(state.winner?.photoUrl && state.winner.photoUrl.trim() !== '') ? state.winner.photoUrl : (state.customImageUrl || 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30')}
                                    alt="Winning Photo"
                                    className="w-full h-full object-contain"
                                    onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30'; }}
                                />
                            </div>
                        ) : (
                            <div className="relative py-20 animate-slide-up">
                                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 blur-3xl opacity-30 animate-pulse-slow"></div>
                                <h1 className="relative text-7xl md:text-9xl font-black text-white tracking-tighter drop-shadow-2xl">
                                    {state.winner?.participant?.name || 'Nombre Genérico'}
                                </h1>
                                <p className="relative mt-8 text-2xl text-indigo-200 font-medium tracking-widest uppercase opacity-80">
                                    ¡Felicidades!
                                </p>
                            </div>
                        )}

                    </div>
                )}

            </div>
        </div>
    );
};

export default RaffleBigScreen;
