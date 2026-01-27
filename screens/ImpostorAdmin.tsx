
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
    const [activeTab, setActiveTab] = useState<'LIVE' | 'CONFIG'>('LIVE');

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
        if (!eventId || !confirm('¿Reiniciar la sesión del juego?')) return;
        await impostorService.resetGame(eventId);
    };

    if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
    if (!state) return <div className="p-8 text-white">Error loading state</div>;

    return (
        <div className="min-h-screen bg-gray-50 text-slate-800 font-sans">
            {/* Header */}
            <header className="bg-slate-900 text-white p-4 shadow-md flex justify-between items-center sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate(`/games/${eventId}`)}
                        className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <div>
                        <h1 className="text-xl font-bold flex items-center gap-2">
                            <span className="material-symbols-outlined text-purple-400">mystery</span>
                            El Impostor - Admin
                        </h1>
                        <div className="flex items-center gap-2 text-sm">
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${state.status === 'SUBMITTING' || state.status === 'VOTING' ? 'bg-green-500' :
                                state.status === 'REVEAL' ? 'bg-purple-500' :
                                    'bg-gray-600'
                                }`}>
                                {state.status === 'WAITING' ? 'EN ESPERA' :
                                    state.status === 'SUBMITTING' ? 'ESCRIBIENDO' :
                                        state.status === 'VOTING' ? 'VOTANDO' :
                                            state.status === 'REVEAL' ? 'REVELADO' : state.status}
                            </span>
                            <span className="text-pink-400">{state.lobby.length} conectados</span>
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
            </header>

            <main className="max-w-6xl mx-auto p-6">
                {/* Tabs */}
                <div className="flex gap-4 mb-6 border-b border-gray-200">
                    <button
                        onClick={() => setActiveTab('LIVE')}
                        className={`pb-2 px-4 font-semibold ${activeTab === 'LIVE' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500'}`}
                    >
                        Juego en Vivo
                    </button>
                    <button
                        onClick={() => setActiveTab('CONFIG')}
                        className={`pb-2 px-4 font-semibold ${activeTab === 'CONFIG' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500'}`}
                    >
                        Configuración
                    </button>
                </div>

                {/* LIVE TAB */}
                {activeTab === 'LIVE' && (
                    <div className="space-y-6 animate-fade-in">
                        {/* Game Control Panel - Status Module */}
                        <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <h3 className="text-xl font-bold mb-4 flex items-center gap-3">
                                <span className={`w-3 h-3 rounded-full animate-pulse ${state.status === 'WAITING' ? 'bg-yellow-500' : state.status === 'REVEAL' ? 'bg-purple-500' : 'bg-green-500'}`}></span>
                                Status: {state.status === 'WAITING' ? 'En Espera' :
                                    state.status === 'SUBMITTING' ? 'Escribiendo Respuestas' :
                                        state.status === 'VOTING' ? 'Votación Activa' :
                                            state.status === 'REVEAL' ? 'Impostor Revelado' : state.status}
                            </h3>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <button
                                    onClick={handleSelectPlayers}
                                    disabled={state.lobby.length < state.config.playerCount}
                                    className="h-14 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                                >
                                    <span className="material-symbols-outlined">person_search</span>
                                    Seleccionar ({state.lobby.length}/{state.config.playerCount})
                                </button>

                                <button
                                    onClick={handleStart}
                                    disabled={state.activePlayers.length === 0}
                                    className="h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-indigo-200 disabled:opacity-50"
                                >
                                    <span className="material-symbols-outlined">play_arrow</span>
                                    Iniciar Ronda
                                </button>

                                <button
                                    onClick={handleReveal}
                                    disabled={state.status !== 'VOTING'}
                                    className="h-14 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-purple-200 disabled:opacity-50"
                                >
                                    <span className="material-symbols-outlined">visibility</span>
                                    Revelar Impostor
                                </button>

                                <button
                                    onClick={handleReset}
                                    className="h-14 bg-red-100 text-red-700 hover:bg-red-200 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
                                >
                                    <span className="material-symbols-outlined">refresh</span>
                                    Reiniciar
                                </button>
                            </div>

                            {/* Active Players Preview */}
                            {state.activePlayers.length > 0 && (
                                <div className="mt-6 pt-6 border-t border-gray-100">
                                    <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-4">Jugadores Seleccionados</h4>
                                    <div className="flex flex-wrap gap-3">
                                        {state.activePlayers.map(p => (
                                            <div key={p.id} className={`flex items-center gap-3 p-3 rounded-xl border ${p.role === 'IMPOSTOR' ? 'border-purple-300 bg-purple-50' : 'border-gray-200 bg-gray-50'}`}>
                                                <img src={p.avatar} className="w-10 h-10 rounded-full bg-gray-200" />
                                                <div>
                                                    <p className="text-sm font-bold leading-tight">{p.name}</p>
                                                    <p className={`text-xs font-bold uppercase ${p.role === 'IMPOSTOR' ? 'text-purple-600' : 'text-gray-400'}`}>{p.role}</p>
                                                </div>
                                                {p.answer && <span className="material-symbols-outlined text-green-500 text-sm">check_circle</span>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </section>

                        {/* Lobby de Espera */}
                        <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <span className="material-symbols-outlined text-indigo-600">groups</span>
                                Lobby de Espera
                            </h3>
                            <div className="flex flex-wrap gap-4">
                                {state.lobby.length > 0 ? state.lobby.map(p => (
                                    <div key={p.id} className="flex flex-col items-center gap-2">
                                        <img src={p.avatar} className="w-14 h-14 rounded-full bg-gray-200 border-2 border-gray-300" />
                                        <span className="text-xs font-bold uppercase truncate w-16 text-center text-gray-700">{p.name}</span>
                                    </div>
                                )) : (
                                    <div className="text-gray-400 text-sm italic flex items-center gap-2">
                                        <span className="material-symbols-outlined text-lg">hourglass_empty</span>
                                        Esperando que los invitados escaneen el QR...
                                    </div>
                                )}
                            </div>

                            {/* QR Code */}
                            <div className="mt-6 pt-6 border-t border-gray-100 flex justify-center">
                                <div className="text-center">
                                    <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200 inline-block">
                                        <img
                                            src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`${window.location.origin}/#/impostor/${eventId}/guest`)}`}
                                            alt="QR para participar"
                                            className="w-32 h-32"
                                        />
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2">Escanea para unirte</p>
                                    <button
                                        onClick={() => navigator.clipboard.writeText(`${window.location.origin}/#/impostor/${eventId}/guest`)}
                                        className="mt-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1 mx-auto"
                                    >
                                        <span className="material-symbols-outlined text-sm">content_copy</span>
                                        Copiar enlace
                                    </button>
                                </div>
                            </div>
                        </section>
                    </div>
                )}

                {/* CONFIG TAB */}
                {activeTab === 'CONFIG' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
                        {/* Left Column: Game Settings */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Game Configuration */}
                            <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                                    <span className="material-symbols-outlined">settings</span>
                                    Configuración del Juego
                                </h2>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700">Consigna Civil</label>
                                        <textarea
                                            value={mainPrompt}
                                            onChange={(e) => setMainPrompt(e.target.value)}
                                            className="w-full bg-gray-50 border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-h-[100px]"
                                            placeholder="Ej: Describe a la cumpleañera..."
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-purple-700">Consigna Impostor</label>
                                        <textarea
                                            value={impostorPrompt}
                                            onChange={(e) => setImpostorPrompt(e.target.value)}
                                            className="w-full bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-purple-500 outline-none min-h-[100px]"
                                            placeholder="Ej: Describe el salón de fiestas..."
                                        />
                                    </div>
                                </div>

                                <div className="flex items-end justify-between gap-4">
                                    <div className="flex gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Jugadores</label>
                                            <input
                                                type="number"
                                                value={playerCount}
                                                onChange={(e) => setPlayerCount(parseInt(e.target.value))}
                                                className="w-20 bg-gray-50 border border-gray-300 rounded-lg p-2 text-center font-bold"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-purple-700 mb-1">Impostores</label>
                                            <input
                                                type="number"
                                                value={impostorCount}
                                                onChange={(e) => setImpostorCount(parseInt(e.target.value))}
                                                className="w-20 bg-purple-50 border border-purple-300 rounded-lg p-2 text-center font-bold text-purple-700"
                                            />
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleSaveConfigWithImage()}
                                        className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium flex items-center gap-2"
                                    >
                                        <span className="material-symbols-outlined text-sm">save</span>
                                        Guardar Cambios
                                    </button>
                                </div>
                            </section>

                            {/* Background Image */}
                            <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                                    <span className="material-symbols-outlined">image</span>
                                    Imagen de Fondo
                                </h2>
                                <div className="flex flex-col gap-3">
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            className="flex-1 bg-gray-50 border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                            placeholder="URL de imagen..."
                                            value={customImage}
                                            onChange={e => setCustomImage(e.target.value)}
                                        />
                                        <label className="bg-white border-2 border-indigo-600 text-indigo-600 px-4 py-3 rounded-lg cursor-pointer hover:bg-indigo-50 transition-colors flex items-center justify-center min-w-[50px]">
                                            <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={uploading} />
                                            {uploading ? (
                                                <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                                            ) : (
                                                <span className="material-symbols-outlined">upload</span>
                                            )}
                                        </label>
                                    </div>
                                    {customImage && (
                                        <div className="relative group w-full h-40">
                                            <img src={customImage} className="h-full w-full object-cover rounded-xl border border-gray-200" alt="Preview" />
                                            <button
                                                onClick={() => { setCustomImage(''); handleSaveConfigWithImage(''); }}
                                                className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <span className="material-symbols-outlined text-sm">close</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </section>
                        </div>

                        {/* Right Column: Guest Simulation & QR */}
                        <div className="space-y-6">
                            {/* Guest Simulation */}
                            <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 text-center">
                                <h2 className="text-lg font-bold mb-3 flex items-center justify-center gap-2">
                                    <span className="material-symbols-outlined">cell_tower</span>
                                    Guest Simulation
                                </h2>
                                <p className="text-sm text-gray-500 mb-4">Abre la vista de invitado para probar el flujo</p>
                                <button
                                    onClick={() => window.open(`#/impostor/${eventId}/guest`, '_blank')}
                                    className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
                                >
                                    <span className="material-symbols-outlined">open_in_new</span>
                                    Abrir Simulador
                                </button>
                            </section>

                            {/* QR Code */}
                            <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 text-center">
                                <h2 className="text-lg font-bold mb-3 flex items-center justify-center gap-2">
                                    <span className="material-symbols-outlined">qr_code_2</span>
                                    Enlace para Jugadores
                                </h2>
                                <div className="bg-gray-50 p-4 rounded-lg inline-block">
                                    <img
                                        src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`${window.location.origin}/#/impostor/${eventId}/guest`)}`}
                                        alt="QR Code para jugar"
                                        className="w-44 h-44 mx-auto"
                                    />
                                </div>
                                <p className="text-xs text-gray-500 mt-3 break-all px-2">
                                    {`${window.location.origin}/#/impostor/${eventId}/guest`}
                                </p>
                                <button
                                    onClick={() => navigator.clipboard.writeText(`${window.location.origin}/#/impostor/${eventId}/guest`)}
                                    className="mt-3 text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1 mx-auto"
                                >
                                    <span className="material-symbols-outlined text-sm">content_copy</span>
                                    Copiar enlace
                                </button>
                            </section>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default ImpostorAdmin;
