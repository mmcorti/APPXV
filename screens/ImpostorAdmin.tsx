
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, Guest } from '../types';
import { impostorService, ImpostorState } from '../services/impostorService';
import { notionService } from '../services/notion';

interface ImpostorAdminProps {
    user: User | null;
}

const ImpostorAdmin: React.FC<ImpostorAdminProps> = ({ user }) => {
    const { id: eventId } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [state, setState] = useState<ImpostorState | null>(null);
    const [loading, setLoading] = useState(true);
    const [guests, setGuests] = useState<Guest[]>([]);

    // UI Local State
    const [mainPrompt, setMainPrompt] = useState('');
    const [impostorPrompt, setImpostorPrompt] = useState('');
    const [playerCount, setPlayerCount] = useState(5);
    const [impostorCount, setImpostorCount] = useState(1);

    useEffect(() => {
        if (!eventId) return;
        loadData();

        const unsubscribe = impostorService.subscribe(eventId, (newState) => {
            setState(newState);
            // Sync local refs if needed, but usually we just want to update display
        });

        return () => unsubscribe();
    }, [eventId]);

    const loadData = async () => {
        if (!eventId) return;
        try {
            const [currentState, eventGuests] = await Promise.all([
                impostorService.getState(eventId),
                notionService.getGuests(eventId)
            ]);

            setState(currentState);
            setGuests(eventGuests.filter(g => g.status === 'confirmed'));

            setMainPrompt(currentState.config.mainPrompt);
            setImpostorPrompt(currentState.config.impostorPrompt);
            setPlayerCount(currentState.config.playerCount);
            setImpostorCount(currentState.config.impostorCount);

        } catch (e) {
            console.error('Failed to load impostor admin data', e);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveConfig = async () => {
        if (!eventId) return;
        await impostorService.updateConfig(eventId, {
            mainPrompt,
            impostorPrompt,
            playerCount,
            impostorCount
        });
    };

    const handleSelectPlayers = async () => {
        if (!eventId) return;
        // Map guests to the simplified candidate format
        const candidates = guests.map(g => ({
            id: String(g.id),
            name: g.name,
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${g.id}`
        }));
        await impostorService.selectPlayers(eventId, candidates);
    };

    const handleStart = async () => {
        if (!eventId) return;
        await impostorService.startRound(eventId);
    };

    const handleReveal = async () => {
        if (!eventId) return;
        await impostorService.revealImpostor(eventId);
    };

    const handleReset = async () => {
        if (!eventId || !confirm('Reset current game session?')) return;
        await impostorService.resetGame(eventId);
    };

    if (loading) return <div className="p-8 text-white">Loading...</div>;
    if (!state) return <div className="p-8 text-white">Error loading state</div>;

    return (
        <div className="min-h-screen bg-slate-950 text-white font-display pb-20">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={() => navigate(`/dashboard`)} className="p-2 hover:bg-slate-800 rounded-full text-slate-400">
                            <span className="material-symbols-outlined">arrow_back</span>
                        </button>
                        <div>
                            <h1 className="text-xl font-bold uppercase tracking-tight">El Impostor</h1>
                            <div className="flex items-center gap-2">
                                <span className="bg-primary/20 text-primary text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">{state.status}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <main className="max-w-4xl mx-auto p-4 space-y-6">

                {/* Configuration Card */}
                <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Configuración del Juego</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase">Consigna Civil</label>
                            <textarea
                                value={mainPrompt}
                                onChange={(e) => setMainPrompt(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm focus:ring-1 focus:ring-primary outline-none min-h-[80px]"
                                placeholder="Ej: Describe a la cumpleañera..."
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-primary uppercase opacity-80">Consigna Impostor</label>
                            <textarea
                                value={impostorPrompt}
                                onChange={(e) => setImpostorPrompt(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700/50 rounded-xl p-3 text-sm focus:ring-1 focus:ring-primary outline-none min-h-[80px]"
                                placeholder="Ej: Describe el salón de fiestas..."
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                        <div className="flex gap-4">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Jugadores</label>
                                <input
                                    type="number"
                                    value={playerCount}
                                    onChange={(e) => setPlayerCount(parseInt(e.target.value))}
                                    className="w-16 bg-slate-800 border border-slate-700 rounded-lg p-2 text-center font-bold"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Impostores</label>
                                <input
                                    type="number"
                                    value={impostorCount}
                                    onChange={(e) => setImpostorCount(parseInt(e.target.value))}
                                    className="w-16 bg-slate-800 border border-slate-700 rounded-lg p-2 text-center font-bold text-primary"
                                />
                            </div>
                        </div>
                        <button
                            onClick={handleSaveConfig}
                            className="bg-slate-800 hover:bg-slate-700 px-6 py-2 rounded-xl font-bold text-sm transition-all"
                        >
                            Guardar Cambios
                        </button>
                    </div>
                </div>

                {/* Main Actions Area */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                        onClick={() => window.open(`#/impostor/${eventId}/screen`, '_blank')}
                        className="bg-white/5 hover:bg-white/10 border border-white/10 p-6 rounded-3xl flex flex-col items-center justify-center gap-3 transition-all group"
                    >
                        <span className="material-symbols-outlined text-4xl text-primary group-hover:scale-110 transition-transform">tv</span>
                        <span className="font-bold tracking-tight">Projector View</span>
                    </button>

                    <button
                        onClick={() => window.open(`#/impostor/${eventId}/guest`, '_blank')}
                        className="bg-white/5 hover:bg-white/10 border border-white/10 p-6 rounded-3xl flex flex-col items-center justify-center gap-3 transition-all group"
                    >
                        <span className="material-symbols-outlined text-4xl text-green-400 group-hover:scale-110 transition-transform">cell_tower</span>
                        <span className="font-bold tracking-tight">Guest Simulation</span>
                    </button>
                </div>

                {/* Game Control Panel */}
                <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 shadow-2xl">
                    <h3 className="text-xl font-bold mb-6 flex items-center gap-3">
                        <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
                        Status: {state.status}
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                            onClick={handleSelectPlayers}
                            className="h-14 bg-slate-800 hover:bg-slate-700 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
                        >
                            <span className="material-symbols-outlined">person_search</span>
                            SELECCIONAR JUGADORES
                        </button>

                        <button
                            onClick={handleStart}
                            disabled={state.activePlayers.length === 0}
                            className="h-14 bg-primary text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-primary/20 disabled:opacity-50"
                        >
                            <span className="material-symbols-outlined">play_arrow</span>
                            INICIAR RONDA
                        </button>

                        <button
                            onClick={handleReveal}
                            disabled={state.status !== 'VOTING'}
                            className="h-14 bg-red-600 hover:bg-red-500 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-red-900/20 disabled:opacity-50"
                        >
                            <span className="material-symbols-outlined">visibility</span>
                            REVELAR IMPOSTOR
                        </button>

                        <button
                            onClick={handleReset}
                            className="h-14 bg-slate-950 border border-slate-800 hover:bg-slate-900 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
                        >
                            <span className="material-symbols-outlined">refresh</span>
                            REINICIAR TODO
                        </button>
                    </div>

                    {/* Active Players Preview */}
                    {state.activePlayers.length > 0 && (
                        <div className="mt-8 pt-8 border-t border-slate-800">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Jugadores Seleccionados</h4>
                            <div className="flex flex-wrap gap-3">
                                {state.activePlayers.map(p => (
                                    <div key={p.id} className={`flex items-center gap-3 p-2 rounded-xl border ${p.role === 'IMPOSTOR' ? 'border-primary/50 bg-primary/5' : 'border-slate-800 bg-slate-950/50'}`}>
                                        <img src={p.avatar} className="w-8 h-8 rounded-full bg-slate-800" />
                                        <div>
                                            <p className="text-sm font-bold leading-tight">{p.name}</p>
                                            <p className={`text-[10px] font-bold uppercase tracking-wider ${p.role === 'IMPOSTOR' ? 'text-primary' : 'text-slate-500'}`}>{p.role}</p>
                                        </div>
                                        {p.answer && <span className="material-symbols-outlined text-green-500 text-sm">check_circle</span>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default ImpostorAdmin;
