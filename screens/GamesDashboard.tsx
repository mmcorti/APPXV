import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlan } from '../hooks/usePlan';
import { InvitationData, User } from '../types';

interface Game {
    id: string;
    name: string;
    description: string;
    icon: string;
    image: string;
    category: 'trivia' | 'interactive' | 'photo';
    estimatedTime: string;
    status: 'idle' | 'waiting' | 'ready' | 'running';
    badge?: string;
}

const DEFAULT_GAMES: Game[] = [
    {
        id: 'photo-bingo',
        name: 'Photo Bingo',
        description: 'Encuentra items en el salón y toma una foto creativa.',
        icon: 'photo_camera',
        image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=800&q=80',
        category: 'photo',
        estimatedTime: '15 MINS',
        status: 'idle'
    },
    {
        id: 'event-trivia',
        name: 'Trivia de Evento',
        description: 'Demuestra qué tanto conoces al anfitrión con preguntas rápidas.',
        icon: 'quiz',
        image: 'https://images.unsplash.com/photo-1606326608606-aa0b62935f2b?auto=format&fit=crop&w=800&q=80',
        category: 'trivia',
        estimatedTime: '10 MINS',
        status: 'idle'
    },
    {
        id: 'confessions',
        name: 'Confesiones',
        description: 'Mensajes anónimos proyectados en la pantalla grande.',
        icon: 'chat_bubble',
        image: 'https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&w=800&q=80',
        category: 'interactive',
        estimatedTime: 'ILIMITADO',
        status: 'idle'
    },
    {
        id: 'raffle',
        name: 'Sorteos',
        description: 'Elige ganadores aleatorios entre los invitados presentes.',
        icon: 'emoji_events',
        image: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?auto=format&fit=crop&w=800&q=80',
        category: 'interactive',
        estimatedTime: '5 MINS',
        status: 'idle'
    },
    {
        id: 'impostor',
        name: 'El Impostor',
        badge: 'INCOGNITO',
        description: 'Encuentra al infiltrado secreto entre tus invitados.',
        icon: 'theater_comedy',
        image: 'https://images.unsplash.com/photo-1509248961158-e54f6934749c?auto=format&fit=crop&w=800&q=80',
        category: 'interactive',
        estimatedTime: '15 MINS',
        status: 'idle'
    }
];

interface GamesDashboardProps {
    invitations: InvitationData[];
    user: User | null;
}

const GamesDashboard: React.FC<GamesDashboardProps> = ({ invitations, user }) => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { limits } = usePlan();
    const [games] = useState<Game[]>(DEFAULT_GAMES);
    const [connectedDevices, setConnectedDevices] = useState(0);
    const [currentMode] = useState<'Lobby / Idle' | 'Game Active'>('Lobby / Idle');

    const invitation = invitations.find(inv => inv.id === id);

    useEffect(() => {
        if (!id) return;

        // Subscribe to event SSE to get real connected device count
        const API_URL = import.meta.env.VITE_API_URL || '/api';
        const eventSource = new EventSource(`${API_URL}/events/${id}/stream`);

        eventSource.onopen = () => {
            // We're connected — at least 1 device
            setConnectedDevices(prev => Math.max(prev, 1));
        };

        eventSource.addEventListener('CONNECTED_COUNT', (event: any) => {
            try {
                const data = JSON.parse(event.data);
                if (typeof data.count === 'number') {
                    setConnectedDevices(data.count);
                }
            } catch (e) {
                // ignore parse errors
            }
        });

        // Fallback: fetch counts from individual game states
        const fetchCounts = async () => {
            try {
                const [triviaRes, bingoRes] = await Promise.allSettled([
                    fetch(`${API_URL}/trivia/${id}`).then(r => r.json()),
                    fetch(`${API_URL}/bingo/${id}`).then(r => r.json()),
                ]);

                let total = 0;
                if (triviaRes.status === 'fulfilled' && triviaRes.value?.players) {
                    total += Object.values(triviaRes.value.players).filter((p: any) => p.online !== false).length;
                }
                if (bingoRes.status === 'fulfilled' && bingoRes.value?.players) {
                    total += Object.values(bingoRes.value.players).filter((p: any) => p.online !== false).length;
                }
                setConnectedDevices(total);
            } catch {
                // Silently fail
            }
        };

        fetchCounts();
        const interval = setInterval(fetchCounts, 15000); // Refresh every 15s

        return () => {
            eventSource.close();
            clearInterval(interval);
        };
    }, [id]);

    const handleStartGame = (gameId: string) => {
        let path = '';
        if (gameId === 'event-trivia') path = `/trivia/${id}/admin`;
        else if (gameId === 'photo-bingo') path = `/bingo/${id}/admin`;
        else if (gameId === 'raffle') path = `/raffle/${id}/admin`;
        else if (gameId === 'confessions') path = `/confessions/${id}/admin`;
        else if (gameId === 'impostor') path = `/impostor/${id}/admin`;

        if (path) {
            window.open(`#${path}`, '_blank');
        }
    };

    return (
        <div className="min-h-screen bg-[#020617] text-white font-sans selection:bg-pink-500/30">
            {/* Header */}
            <header className="px-8 py-6 flex items-center justify-between border-b border-white/5 bg-[#020617]/80 backdrop-blur-xl sticky top-0 z-50">
                <div className="flex items-center gap-6">
                    <button
                        onClick={() => navigate(`/dashboard`)}
                        className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/5 transition-colors"
                    >
                        <span className="material-symbols-outlined text-slate-400">arrow_back</span>
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-xl font-black tracking-tight">{invitation?.eventName || 'Mi Evento'}</h1>
                            <span className="bg-pink-500 text-[10px] font-black px-2 py-0.5 rounded-full tracking-widest uppercase">#PARTY</span>
                        </div>
                        <p className="text-[11px] font-black text-pink-500 flex items-center gap-1.5 mt-0.5 uppercase tracking-wider">
                            <span className="material-symbols-outlined text-[14px]">cell_tower</span>
                            {connectedDevices} Dispositivos Conectados
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-8">
                    <div className="text-right">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Modo Actual</p>
                        <p className="text-sm font-bold text-slate-200">{currentMode}</p>
                    </div>
                    <button className="flex items-center gap-2 bg-slate-900 border border-white/10 hover:bg-red-950/20 hover:border-red-500/50 hover:text-red-500 px-5 py-2.5 rounded-xl font-black text-xs transition-all uppercase tracking-widest group">
                        <span className="material-symbols-outlined text-sm group-hover:animate-pulse">stop_circle</span>
                        Detener Todo
                    </button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-8 py-12">
                {limits.maxGameParticipants !== Infinity && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-12 bg-indigo-900/30 border border-indigo-500/30 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 backdrop-blur-sm"
                    >
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 bg-indigo-500/20 rounded-2xl flex items-center justify-center text-indigo-400">
                                <span className="material-symbols-outlined text-2xl">group_add</span>
                            </div>
                            <div>
                                <h3 className="font-bold text-lg text-indigo-100 mb-1">Límite de Jugadores: {limits.maxGameParticipants}</h3>
                                <p className="text-indigo-200/60 text-sm max-w-md">
                                    Tu plan actual permite hasta {limits.maxGameParticipants} participantes simultáneos en los juegos interactivos.
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => navigate('/prices')}
                            className="bg-indigo-500 hover:bg-indigo-400 text-white px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg shadow-indigo-500/20 transition-all active:scale-95 whitespace-nowrap"
                        >
                            Aumentar Límite
                        </button>
                    </motion.div>
                )}

                <div className="mb-14">
                    <h2 className="text-5xl font-black tracking-tighter mb-4">Selecciona una Actividad</h2>
                    <p className="text-slate-400 text-lg max-w-2xl font-medium leading-relaxed">
                        Lanza un juego a la pantalla grande. Los participantes se unirán automáticamente desde sus dispositivos.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {games.map((game, index) => (
                        <motion.div
                            key={game.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="group relative bg-[#0f172a] rounded-[2.5rem] overflow-hidden border border-white/5 hover:border-white/10 transition-all shadow-2xl"
                        >
                            {/* Image Background */}
                            <div className="aspect-[4/3] relative overflow-hidden">
                                <img
                                    src={game.image}
                                    alt={game.name}
                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-60 group-hover:opacity-80"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] via-[#0f172a]/40 to-transparent" />

                                <div className="absolute top-6 right-6">
                                    <div className="w-12 h-12 bg-pink-500/20 backdrop-blur-md border border-white/20 rounded-2xl flex items-center justify-center text-pink-500 group-hover:bg-pink-500 group-hover:text-white transition-all duration-300">
                                        <span className="material-symbols-outlined">{game.icon}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="absolute bottom-0 left-0 right-0 p-8 pt-0">
                                <div className="mb-6">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h3 className="text-3xl font-black tracking-tight">{game.name}</h3>
                                        {game.badge && (
                                            <span className="bg-pink-600 text-[8px] font-black px-2 py-0.5 rounded flex items-center justify-center leading-none tracking-[0.2em] uppercase">{game.badge}</span>
                                        )}
                                    </div>
                                    <p className="text-slate-400 text-sm font-medium leading-relaxed line-clamp-2 min-h-[40px]">
                                        {game.description}
                                    </p>
                                </div>

                                <div className="flex items-center justify-between border-t border-white/5 pt-6">
                                    <div className="flex items-center gap-2 text-slate-500 font-black text-[10px] tracking-widest uppercase">
                                        <span className="material-symbols-outlined text-sm">schedule</span>
                                        {game.estimatedTime}
                                    </div>
                                    <button
                                        onClick={() => handleStartGame(game.id)}
                                        className="bg-pink-600 hover:bg-pink-500 text-white px-6 py-3 rounded-2xl font-black text-[11px] tracking-[0.15em] uppercase transition-all active:scale-95 shadow-lg shadow-pink-600/30"
                                    >
                                        Lanzar Juego
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </main>

            {/* Participation Footer */}
            <div className="fixed bottom-0 left-0 right-0 bg-[#020617]/90 backdrop-blur-2xl border-t border-white/5 px-8 py-4 z-50">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-12">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 bg-pink-500 rounded-full animate-ping"></div>
                            <span className="text-xs font-black tracking-[0.3em] text-white uppercase">Participación</span>
                        </div>

                        <div className="flex items-center gap-8">
                            <div className="flex items-center gap-4 bg-white/5 px-5 py-2 rounded-2xl border border-white/5">
                                <span className="text-xl font-black text-white">0</span>
                                <span className="text-[10px] font-bold text-slate-500 leading-tight uppercase tracking-wider">fotos subidas en el <br /> último min</span>
                            </div>
                            <div className="flex items-center gap-4 bg-white/5 px-5 py-2 rounded-2xl border border-white/5">
                                <span className="text-xl font-black text-pink-500">0%</span>
                                <span className="text-[10px] font-bold text-slate-500 leading-tight uppercase tracking-wider">tasa de <br /> participación</span>
                            </div>
                        </div>
                    </div>

                    <button className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors group">
                        <span className="text-[10px] font-black uppercase tracking-widest">Ver analíticas completas</span>
                        <span className="material-symbols-outlined text-lg group-hover:translate-x-1 transition-transform">chevron_right</span>
                    </button>
                </div>
            </div>

            {/* Spacer for footer */}
            <div className="h-24"></div>
        </div>
    );
};

export default GamesDashboard;
