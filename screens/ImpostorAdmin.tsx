
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
    const [customImage, setCustomImage] = useState('');
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        if (!eventId) return;
        loadData();

        // Sync plan if user exists
        if (user?.plan) {
            impostorService.updateConfig(eventId, { hostPlan: user.plan });
        }

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
            setCustomImage(currentState.config.customImageUrl || '');

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
            impostorCount,
            hostPlan: user?.plan
        });
    };


    const handleSaveConfigWithImage = async (imageOverride?: string) => {
        if (!eventId) return;
        await impostorService.updateConfig(eventId, {
            mainPrompt,
            impostorPrompt,
            playerCount,
            impostorCount,
            hostPlan: user?.plan,
            customImageUrl: imageOverride !== undefined ? imageOverride : customImage
        });
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !eventId) return;

        setUploading(true);
        try {
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64 = reader.result as string;
                const url = await notionService.uploadImage(base64);
                setCustomImage(url);
                await handleSaveConfigWithImage(url);
            };
            reader.readAsDataURL(file);
        } catch (err) {
            console.error("Upload failed:", err);
            alert("Error al subir la imagen");
        } finally {
            setUploading(false);
        }
    };

    const handleSelectPlayers = async () => {
        if (!eventId) return;
        // The service now handles picking from the lobby if candidates is empty
        await impostorService.selectPlayers(eventId, []);
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
                        <button onClick={() => navigate(`/games/${eventId}`)} className="p-2 hover:bg-slate-800 rounded-full text-slate-400">
                            <span className="material-symbols-outlined">arrow_back</span>
                        </button>
                        <div>
                            <h1 className="text-xl font-bold uppercase tracking-tight">El Impostor</h1>
                            <div className="flex items-center gap-2">
                                <span className="bg-primary/20 text-primary text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">{state.status}</span>
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{state.lobby.length} Conectados</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => window.open(`#/impostor/${eventId}/screen`, '_blank')}
                            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg font-medium transition-colors"
                        >
                            <span className="material-symbols-outlined text-sm">tv</span>
                            Pantalla Gigante
                        </button>
                    </div>
                </div>
            </div>

            <main className="max-w-4xl mx-auto p-4 space-y-6">

                {/* Lobby Review Card */}
                <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                        <span className="material-symbols-outlined text-6xl">groups</span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Lobby de Espera</h3>
                    <div className="flex flex-wrap gap-4">
                        {state.lobby.length > 0 ? state.lobby.map(p => (
                            <div key={p.id} className="flex flex-col items-center gap-2">
                                <img src={p.avatar} className="w-12 h-12 rounded-full bg-slate-800 border-2 border-slate-700" />
                                <span className="text-[10px] font-bold uppercase truncate w-16 text-center">{p.name}</span>
                            </div>
                        )) : (
                            <p className="text-slate-500 text-sm italic">Esperando que los invitados escaneen el QR...</p>
                        )}
                    </div>
                </div>

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
                </div>

                {/* Branding Image Input */}
                <div className="mb-6">
                    <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Imagen de Fondo (Default / Espera)</label>
                    <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary outline-none"
                                placeholder="URL de imagen..."
                                value={customImage}
                                onChange={e => setCustomImage(e.target.value)}
                            />
                            <label className="bg-slate-800 border-2 border-slate-700 text-slate-400 px-4 py-3 rounded-xl cursor-pointer hover:bg-slate-700 transition-colors flex items-center justify-center min-w-[50px]">
                                <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={uploading} />
                                {uploading ? (
                                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                    <span className="material-symbols-outlined">upload</span>
                                )}
                            </label>
                        </div>
                        {customImage && (
                            <div className="mt-2 relative group w-full h-32">
                                <img src={customImage} className="h-full w-full object-cover rounded-xl border border-slate-700" alt="Preview" />
                                <button
                                    onClick={() => { setCustomImage(''); handleSaveConfigWithImage(''); }}
                                    className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <span className="material-symbols-outlined text-sm">close</span>
                                </button>
                            </div>
                        )}
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
                        onClick={() => handleSaveConfigWithImage()}
                        className="bg-slate-800 hover:bg-slate-700 px-6 py-2 rounded-xl font-bold text-sm transition-all"
                    >
                        Guardar Cambios
                    </button>
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
                            disabled={state.lobby.length < state.config.playerCount}
                            className="h-14 bg-slate-800 hover:bg-slate-700 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                        >
                            <span className="material-symbols-outlined">person_search</span>
                            SELECCIONAR JUGADORES ({state.lobby.length}/{state.config.playerCount})
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
            </main >
        </div >
    );
};

export default ImpostorAdmin;
