
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, Guest } from '../types';
import { impostorService, ImpostorState } from '../services/impostorService';
import { apiService } from '../services/apiService';

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
    const [playerCount, setPlayerCount] = useState(20);
    const [impostorCount, setImpostorCount] = useState(1);
    const [customImage, setCustomImage] = useState('');
    const [uploading, setUploading] = useState(false);

    // AI State
    const [aiTheme, setAiTheme] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

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
                apiService.getGuests(eventId)
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
            const base64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
                reader.readAsDataURL(file);
            });
            const url = await apiService.uploadImage(base64);
            setCustomImage(url);
            await handleSaveConfigWithImage(url);
        } catch (err) {
            console.error("Upload failed:", err);
            alert("Error al subir la imagen");
        } finally {
            setUploading(false);
        }
    };

    const handleSelectPlayers = async () => {
        if (!eventId) return;
        try {
            await impostorService.selectPlayers(eventId, []);
        } catch (err: any) {
            alert(err.message || 'No se pudieron seleccionar jugadores');
        }
    };

    const handleStart = async () => {
        if (!eventId) return;
        try {
            await impostorService.startRound(eventId);
        } catch (err: any) {
            alert(err.message || 'No se pudo iniciar la ronda');
        }
    };

    const handleNextRound = async () => {
        if (!eventId) return;
        try {
            await impostorService.nextRound(eventId);
        } catch (err: any) {
            alert(err.message || 'No se pudo evaluar la ronda');
        }
    };

    const handleReveal = async () => {
        if (!eventId) return;
        await impostorService.revealImpostor(eventId);
    };

    const handleRemovePlayer = async (playerId: string, playerName: string) => {
        if (!eventId) return;
        if (!confirm(`¿Desconectar y eliminar a "${playerName}" de la partida?`)) return;
        await impostorService.removePlayer(eventId, playerId);
    };

    const handleReset = async () => {
        if (!eventId || !confirm('¿Reiniciar la sesión del juego?')) return;
        await impostorService.resetGame(eventId);
    };

    const handleGenerateTasks = async () => {
        if (!aiTheme) return alert('Ingresa una temática');
        setIsGenerating(true);
        try {
            const result = await impostorService.generateTasks(aiTheme);
            console.log('[ImpostorAdmin] AI generate result:', result);

            if (!result.mainPrompt || !result.impostorPrompt) {
                console.error('[ImpostorAdmin] Missing keys in result:', Object.keys(result));
                throw new Error('La IA devolvió un formato inválido');
            }

            setMainPrompt(result.mainPrompt);
            setImpostorPrompt(result.impostorPrompt);
        } catch (error) {
            console.error('[ImpostorAdmin] Generate error:', error);
            alert('Error al generar consignas: ' + (error instanceof Error ? error.message : 'Error desconocido'));
        } finally {
            setIsGenerating(false);
        }
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
                        {/* Stats */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-blue-500">
                                <div className="text-2xl font-bold">{state.lobby.length}</div>
                                <div className="text-gray-500 text-sm">Conectados en Lobby</div>
                            </div>
                            <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-purple-500">
                                <div className="text-2xl font-bold">
                                    {state.activePlayers.length} <span className="text-gray-400 text-lg font-normal">/ {state.config.playerCount} máx</span>
                                </div>
                                <div className="text-gray-500 text-sm">Activos (Ronda {state.round || 1})</div>
                            </div>
                            <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-green-500">
                                <div className="text-2xl font-bold">
                                    {state.status === 'WAITING' ? 'En Espera' :
                                        state.status === 'SUBMITTING' ? 'Escribiendo' :
                                            state.status === 'VOTING' ? 'Votando' :
                                                state.status === 'REVEAL' ? 'Revelado' : state.status}
                                </div>
                                <div className="text-gray-500 text-sm">Estado</div>
                            </div>
                        </div>

                        {state.lastEliminated && state.status !== 'REVEAL' && (
                            <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2">
                                <span className="material-symbols-outlined text-amber-600">person_remove</span>
                                Ronda {state.lastEliminated.round}: salió <b>{state.lastEliminated.name}</b> ({state.lastEliminated.role === 'IMPOSTOR' ? 'era Impostor, pero quedan más' : 'era Civil'}). ¡El juego continúa!
                            </div>
                        )}

                        {/* Game Controls */}
                        <div className="flex flex-wrap gap-3">
                            <button
                                onClick={handleSelectPlayers}
                                disabled={state.lobby.length <= state.config.playerCount}
                                className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 disabled:opacity-50"
                            >
                                <span className="material-symbols-outlined">person_search</span>
                                Seleccionar ({Math.min(state.lobby.length, state.config.playerCount)}/{state.config.playerCount} máx)
                            </button>

                            <button
                                onClick={handleStart}
                                disabled={
                                    state.status === 'SUBMITTING' ||
                                    state.status === 'VOTING' ||
                                    (state.activePlayers.length === 0 && state.lobby.length < Math.max(3, state.config.impostorCount + 1))
                                }
                                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 disabled:opacity-50"
                            >
                                <span className="material-symbols-outlined">play_arrow</span>
                                Iniciar Ronda
                            </button>

                            {state.status === 'VOTING' && (
                                <button
                                    onClick={handleNextRound}
                                    disabled={Object.keys(state.votes || {}).length === 0}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 disabled:opacity-50"
                                >
                                    <span className="material-symbols-outlined">how_to_vote</span>
                                    Evaluar y Siguiente Ronda
                                </button>
                            )}

                            <button
                                onClick={handleReveal}
                                disabled={state.status !== 'VOTING'}
                                className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 disabled:opacity-50"
                            >
                                <span className="material-symbols-outlined">visibility</span>
                                Revelar Impostor
                            </button>

                            <button
                                onClick={handleReset}
                                className="bg-red-100 text-red-700 hover:bg-red-200 px-6 py-2 rounded-lg font-bold flex items-center gap-2"
                            >
                                <span className="material-symbols-outlined">restart_alt</span>
                                Reiniciar Juego
                            </button>
                        </div>

                        {/* Active Players Preview */}
                        {state.activePlayers.length > 0 && (
                            <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                <h3 className="text-lg font-bold mb-4">Jugadores Seleccionados</h3>
                                <div className="flex flex-wrap gap-3">
                                    {state.activePlayers.map(p => (
                                        <div key={p.id} className={`flex items-center gap-3 p-3 rounded-xl border ${p.online === false ? 'border-red-300 bg-red-50/70' : p.role === 'IMPOSTOR' ? 'border-purple-300 bg-purple-50' : 'border-gray-200 bg-gray-50'}`}>
                                            <img src={p.avatar} className={`w-10 h-10 rounded-full bg-gray-200 ${p.online === false ? 'opacity-50 grayscale' : ''}`} />
                                            <div>
                                                <p className="text-sm font-bold leading-tight">{p.name}</p>
                                                <div className="flex items-center gap-1.5">
                                                    <p className={`text-xs font-bold uppercase ${p.role === 'IMPOSTOR' ? 'text-purple-600' : 'text-gray-400'}`}>{p.role}</p>
                                                    {p.online === false && (
                                                        <span className="text-[10px] font-bold text-red-600 uppercase">· Desconectado</span>
                                                    )}
                                                </div>
                                            </div>
                                            {p.answer && <span className="material-symbols-outlined text-green-500 text-sm">check_circle</span>}
                                            <button
                                                onClick={() => handleRemovePlayer(p.id, p.name)}
                                                title="Desconectar y eliminar jugador"
                                                className="ml-1 p-1 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-100 transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-base">close</span>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Lobby de Espera */}
                        <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <span className="material-symbols-outlined text-indigo-600">groups</span>
                                Lobby de Espera
                            </h3>
                            <div className="flex flex-wrap gap-4">
                                {state.lobby.length > 0 ? state.lobby.map(p => (
                                    <div key={p.id} className="relative flex flex-col items-center gap-2 group">
                                        <button
                                            onClick={() => handleRemovePlayer(p.id, p.name)}
                                            title="Eliminar del lobby"
                                            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
                                        >
                                            <span className="material-symbols-outlined text-xs">close</span>
                                        </button>
                                        <img src={p.avatar} className={`w-14 h-14 rounded-full bg-gray-200 border-2 ${p.online === false ? 'border-red-400 opacity-50 grayscale' : 'border-gray-300'}`} />
                                        <span className="text-xs font-bold uppercase truncate w-16 text-center text-gray-700">{p.name}</span>
                                    </div>
                                )) : (
                                    <div className="text-gray-400 text-sm italic flex items-center gap-2">
                                        <span className="material-symbols-outlined text-lg">hourglass_empty</span>
                                        Esperando que los invitados escaneen el QR...
                                    </div>
                                )}
                            </div>
                        </section>
                    </div>
                )}

                {/* CONFIG TAB */}
                {activeTab === 'CONFIG' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
                        {/* Left Column: Consignas -> AI Generator -> Global Settings */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Game Configuration */}
                            <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                                    <span className="material-symbols-outlined">psychology</span>
                                    Consignas del Juego
                                </h2>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700">Consigna Civil</label>
                                        <textarea
                                            value={mainPrompt}
                                            onChange={(e) => setMainPrompt(e.target.value)}
                                            className="w-full bg-gray-50 border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-h-[100px]"
                                            placeholder="Ej: Nombrá una canción que hace bailar a toda la fiesta"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-purple-700">Consigna Impostor</label>
                                        <textarea
                                            value={impostorPrompt}
                                            onChange={(e) => setImpostorPrompt(e.target.value)}
                                            className="w-full bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-purple-500 outline-none min-h-[100px]"
                                            placeholder="Ej: Nombrá una canción tranquila para escuchar manejando"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-end justify-between gap-4">
                                    <div className="flex gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Máx. Jugadores</label>
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

                            {/* AI Generator */}
                            <section className="bg-gradient-to-r from-indigo-50 to-purple-50 p-6 rounded-xl shadow-sm border border-indigo-100">
                                <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-indigo-900">
                                    <span className="material-symbols-outlined">auto_awesome</span>
                                    Generar con IA
                                </h2>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        className="flex-1 border border-indigo-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                                        placeholder="Ej: Boda Elegante, Superhéroes, Cumpleaños de 15..."
                                        value={aiTheme}
                                        onChange={(e) => setAiTheme(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleGenerateTasks()}
                                    />
                                    <button
                                        onClick={handleGenerateTasks}
                                        disabled={isGenerating}
                                        className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 font-medium shadow-md shadow-indigo-200"
                                    >
                                        {isGenerating ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                Generando...
                                            </>
                                        ) : (
                                            <>
                                                <span className="material-symbols-outlined text-sm">magic_button</span>
                                                Generar
                                            </>
                                        )}
                                    </button>
                                </div>
                                <p className="text-xs text-indigo-400 mt-2">
                                    <span className="font-bold">Nota:</span> Esto llenará las consignas de arriba. Podrás editarlas antes de guardar.
                                </p>
                            </section>

                            {/* Global Settings (Background Image) */}
                            <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                                    <span className="material-symbols-outlined">settings</span>
                                    Configuración Global
                                </h2>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Imagen del Evento (Personalizada)</label>
                                <div className="flex flex-col gap-3">
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            className="flex-1 bg-gray-50 border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                            placeholder="URL de imagen..."
                                            value={customImage}
                                            onChange={e => setCustomImage(e.target.value)}
                                        />
                                        <label className="bg-white border-2 border-indigo-600 text-indigo-600 px-3 py-2 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors flex items-center justify-center min-w-[50px]">
                                            <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={uploading} />
                                            {uploading ? (
                                                <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                                            ) : (
                                                <span className="material-symbols-outlined">upload</span>
                                            )}
                                        </label>
                                        <button
                                            onClick={() => handleSaveConfigWithImage()}
                                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
                                        >
                                            Guardar
                                        </button>
                                    </div>
                                    {customImage && (
                                        <div className="relative group w-full h-32">
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

                        {/* Right Column: QR Code & Links */}
                        <div className="space-y-6">
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
                                <button
                                    onClick={() => window.open(`#/impostor/${eventId}/guest`, '_blank')}
                                    className="mt-4 w-full bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 text-sm transition-colors"
                                >
                                    <span className="material-symbols-outlined text-sm">open_in_new</span>
                                    Probar como Invitado
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
