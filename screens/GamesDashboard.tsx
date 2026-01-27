import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
    participantCount?: number;
    runningTime?: string;
}

const DEFAULT_GAMES: Game[] = [
    {
        id: 'photo-bingo',
        name: 'Photo Bingo',
        description: 'Encuentra items en el salón y toma una foto!',
        icon: 'photo_camera',
        image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=400&q=80',
        category: 'photo',
        estimatedTime: '~15 MINS',
        status: 'idle'
    },
    {
        id: 'event-trivia',
        name: 'Event Trivia',
        description: 'Demuestra qué tanto conoces al anfitrión.',
        icon: 'quiz',
        image: 'https://images.unsplash.com/photo-1606326608606-aa0b62935f2b?auto=format&fit=crop&w=400&q=80',
        category: 'trivia',
        estimatedTime: '~10 MINS',
        status: 'idle'
    },
    {
        id: 'confessions',
        name: 'Confessions',
        description: 'Mensajes anónimos en la pantalla grande.',
        icon: 'chat_bubble',
        image: 'https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&w=400&q=80',
        category: 'interactive',
        estimatedTime: '~∞',
        status: 'idle'
    },
    {
        id: 'who-is-who',
        name: 'Who is Who?',
        description: 'Adivina la foto de la infancia del invitado.',
        icon: 'face',
        image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=400&q=80',
        category: 'interactive',
        estimatedTime: '~12 MINS',
        status: 'idle'
    },
    {
        id: 'mystery-guest',
        name: 'Mystery Guest',
        description: 'Revela datos de un invitado secreto.',
        icon: 'person_search',
        image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=400&q=80',
        category: 'interactive',
        estimatedTime: '~8 MINS',
        status: 'idle'
    },
    {
        id: 'raffle',
        name: 'Sorteos',
        description: 'Sortea premios entre los invitados (QR o Fotos).',
        icon: 'emoji_events',
        image: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?auto=format&fit=crop&w=400&q=80',
        category: 'interactive',
        estimatedTime: '~5 MINS',
        status: 'idle'
    },
    {
        id: 'impostor',
        name: 'El Impostor',
        description: 'Encuentra al infiltrado entre tus invitados.',
        icon: 'incognito',
        image: 'https://images.unsplash.com/photo-1509248961158-e54f6934749c?auto=format&fit=crop&w=400&q=80',
        category: 'interactive',
        estimatedTime: '~15 MINS',
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
    const [games, setGames] = useState<Game[]>(DEFAULT_GAMES);
    const [filter, setFilter] = useState<'all' | 'trivia' | 'interactive'>('all');
    const [connectedDevices, setConnectedDevices] = useState(0);
    const [currentMode, setCurrentMode] = useState<'Lobby / Idle' | 'Game Active'>('Lobby / Idle');

    const invitation = invitations.find(inv => inv.id === id);

    // Simulate connected devices realistically
    useEffect(() => {
        if (!invitation) return;

        // Base the number on confirmed guests
        const confirmedCount = invitation.guests?.filter(g => g.status === 'confirmed').length || 0;

        if (runningGame) {
            // When game is running, participation is higher (40-80%)
            const activeCount = Math.floor(confirmedCount * (Math.random() * 0.4 + 0.4));
            setConnectedDevices(Math.max(activeCount, confirmedCount > 0 ? 5 : 0));
        } else {
            // When idle, only a few are "listening" or browsing (e.g., 2-5%)
            // If it's a new event with 0 guests, show 0.
            const idleCount = confirmedCount > 0 ? Math.floor(confirmedCount * (Math.random() * 0.03 + 0.02)) : 0;
            setConnectedDevices(idleCount);
        }
    }, [invitation, runningGame]);

    // Check if any game is running
    const runningGame = games.find(g => g.status === 'running');

    useEffect(() => {
        setCurrentMode(runningGame ? 'Game Active' : 'Lobby / Idle');
    }, [runningGame]);

    const filteredGames = games.filter(game => {
        if (filter === 'all') return true;
        if (filter === 'trivia') return game.category === 'trivia';
        return game.category === 'interactive' || game.category === 'photo';
    });

    const handleStartGame = (gameId: string) => {
        // Navigate to Trivia Admin for 'event-trivia' game
        if (gameId === 'event-trivia') {
            navigate(`/trivia/${id}/admin`);
            return;
        }

        // Navigate to Bingo Admin for 'photo-bingo' game
        if (gameId === 'photo-bingo') {
            navigate(`/bingo/${id}/admin`);
            return;
        }

        // Navigate to Bingo Admin for 'photo-bingo' game
        if (gameId === 'photo-bingo') {
            navigate(`/bingo/${id}/admin`);
            return;
        }

        // Navigate to Trivia Admin for 'event-trivia' game
        if (gameId === 'event-trivia') {
            navigate(`/trivia/${id}/admin`);
            return;
        }

        // Navigate to Raffle Admin for 'raffle' game
        if (gameId === 'raffle') {
            navigate(`/raffle/${id}/admin`);
            return;
        }

        // Navigate to Confessions Admin for 'confessions' game
        if (gameId === 'confessions') {
            navigate(`/confessions/${id}/admin`);
            return;
        }

        // Navigate to Impostor Admin for 'impostor' game
        if (gameId === 'impostor') {
            navigate(`/impostor/${id}/admin`);
            return;
        }

        setGames(prev => prev.map(g => {
            if (g.id === gameId) {
                return { ...g, status: 'running' as const, runningTime: '0M 0S', participantCount: Math.floor(Math.random() * 100) + 50 };
            }
            // Stop other running games
            if (g.status === 'running') {
                return { ...g, status: 'idle' as const };
            }
            return g;
        }));
    };

    const handleEndGame = (gameId: string) => {
        setGames(prev => prev.map(g =>
            g.id === gameId ? { ...g, status: 'idle' as const, runningTime: undefined } : g
        ));
    };

    const handleStopAll = () => {
        setGames(prev => prev.map(g => ({ ...g, status: 'idle' as const, runningTime: undefined })));
    };

    const getStatusBadge = (game: Game) => {
        switch (game.status) {
            case 'waiting':
                return (
                    <div className="absolute top-3 right-3 bg-amber-500/90 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">groups</span>
                        {game.participantCount || 0} Waiting
                    </div>
                );
            case 'ready':
                return (
                    <div className="absolute top-3 right-3 bg-emerald-500/90 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">groups</span>
                        {game.participantCount || 0} Ready
                    </div>
                );
            case 'running':
                return (
                    <div className="absolute top-3 right-3 bg-rose-500 text-white text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 animate-pulse">
                        <span className="w-2 h-2 bg-white rounded-full"></span>
                        LIVE NOW
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white">
            {/* Header */}
            <header className="bg-slate-900/80 backdrop-blur-sm border-b border-slate-800 px-6 py-4 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    {/* Left: Back + Event Info */}
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate(`/dashboard`)}
                            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                        >
                            <span className="material-symbols-outlined">arrow_back</span>
                        </button>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-xl font-bold">{invitation?.eventName || 'Evento'}</h1>
                                <span className="bg-slate-700 text-slate-300 text-xs px-2 py-0.5 rounded">#PARTY</span>
                            </div>
                            <p className="text-sm text-pink-400 flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm">devices</span>
                                {connectedDevices} Connected Devices
                            </p>
                        </div>
                    </div>

                    {/* Right: Mode + Stop All */}
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <p className="text-xs text-slate-400">Current Mode</p>
                            <p className="font-medium">{currentMode}</p>
                        </div>
                        <button
                            onClick={handleStopAll}
                            disabled={!runningGame}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all ${runningGame
                                ? 'bg-rose-600 hover:bg-rose-700 text-white'
                                : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                                }`}
                        >
                            <span className="material-symbols-outlined">stop_circle</span>
                            STOP ALL
                        </button>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto p-6">
                {/* Title + Filters */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-2xl font-bold">Select an Activity</h2>
                        <p className="text-slate-400">Launch a game to the big screen. Participants will join automatically.</p>
                    </div>
                    <div className="flex bg-slate-800 rounded-lg p-1">
                        <button
                            onClick={() => setFilter('all')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === 'all' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
                                }`}
                        >
                            All Games
                        </button>
                        <button
                            onClick={() => setFilter('trivia')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === 'trivia' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
                                }`}
                        >
                            Trivia
                        </button>
                        <button
                            onClick={() => setFilter('interactive')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === 'interactive' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
                                }`}
                        >
                            Interactive
                        </button>
                    </div>
                </div>

                {/* Games Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredGames.map(game => (
                        <div
                            key={game.id}
                            className={`bg-slate-900 rounded-2xl overflow-hidden border transition-all hover:scale-[1.02] ${game.status === 'running'
                                ? 'border-pink-500/50 ring-2 ring-pink-500/20'
                                : 'border-slate-800 hover:border-slate-700'
                                }`}
                        >
                            {/* Image */}
                            <div className="relative h-40 overflow-hidden">
                                <img
                                    src={game.image}
                                    alt={game.name}
                                    className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />
                                {getStatusBadge(game)}
                            </div>

                            {/* Content */}
                            <div className="p-4">
                                <div className="flex items-start justify-between mb-2">
                                    <h3 className="text-lg font-bold">{game.name}</h3>
                                    <span className="material-symbols-outlined text-pink-400 bg-pink-500/10 p-1.5 rounded-lg text-xl">
                                        {game.icon}
                                    </span>
                                </div>
                                <p className="text-sm text-slate-400 mb-4 line-clamp-2">{game.description}</p>

                                {/* Footer */}
                                <div className="flex items-center justify-between">
                                    {game.status === 'running' ? (
                                        <>
                                            <span className="text-pink-400 text-sm font-medium">
                                                RUNNING: {game.runningTime || '0M 0S'}
                                            </span>
                                            <button
                                                onClick={() => handleEndGame(game.id)}
                                                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-full text-sm font-bold transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-sm">stop</span>
                                                End Game
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <span className="text-slate-500 text-sm">{game.estimatedTime}</span>
                                            <button
                                                onClick={() => handleStartGame(game.id)}
                                                className="flex items-center gap-2 bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded-full text-sm font-bold transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-sm">play_arrow</span>
                                                Start Game
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Add Custom Activity Card */}
                    <div className="bg-slate-900/50 rounded-2xl border-2 border-dashed border-slate-700 hover:border-slate-600 transition-colors flex flex-col items-center justify-center p-8 min-h-[280px] cursor-pointer group">
                        <div className="w-14 h-14 rounded-full bg-slate-800 group-hover:bg-slate-700 flex items-center justify-center mb-4 transition-colors">
                            <span className="material-symbols-outlined text-2xl text-slate-400 group-hover:text-white">add</span>
                        </div>
                        <h3 className="text-lg font-bold mb-1">Add Custom Activity</h3>
                        <p className="text-slate-500 text-sm">Create a poll or slide</p>
                    </div>
                </div>

                {/* Engagement Footer */}
                <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-sm border-t border-slate-800 px-6 py-3">
                    <div className="max-w-7xl mx-auto flex items-center justify-between">
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-2 text-pink-400">
                                <span className="material-symbols-outlined">monitoring</span>
                                <span className="font-bold">ENGAGEMENT</span>
                            </div>
                            <div className="flex items-center gap-4 text-sm">
                                <span className="text-slate-400">
                                    <span className="text-white font-bold">{runningGame ? Math.floor(Math.random() * 8 + 2) : 0}</span> photos uploaded in last min
                                </span>
                                <span className="text-slate-400">
                                    <span className="text-white font-bold">{connectedDevices > 0 ? (runningGame ? '89%' : '12%') : '0%'}</span> participation rate
                                </span>
                            </div>
                        </div>
                        <button className="text-pink-400 hover:text-pink-300 text-sm font-bold transition-colors">
                            VIEW ANALYTICS
                        </button>
                    </div>
                </div>

                {/* Bottom padding for fixed footer */}
                <div className="h-16" />
            </div>
        </div>
    );
};

export default GamesDashboard;
