
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { raffleService } from '../services/raffleService';
import { apiService } from '../services/apiService';
import { RaffleState, RaffleMode } from '../game-types/raffleTypes';
import { User } from '../types';

interface RaffleAdminProps {
    user: User;
}

const DEFAULT_BG = 'https://res.cloudinary.com/djetzdm5n/image/upload/v1769432962/appxv-events/jp6fbqmcpg53lfbhtm42.png';

const RaffleAdmin: React.FC<RaffleAdminProps> = ({ user }) => {
    const { id: eventId } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [state, setState] = useState<RaffleState | null>(null);
    const [googlePhotos, setGooglePhotos] = useState('');
    const [customImage, setCustomImage] = useState('');
    const [uploading, setUploading] = useState(false);
    const [activeTab, setActiveTab] = useState<'LIVE' | 'CONFIG'>('LIVE');

    // For local UI state before saving
    const [activeMode, setActiveMode] = useState<RaffleMode>('PHOTO');

    useEffect(() => {
        if (!eventId) return;

        // Sync plan first
        if (user.plan) {
            raffleService.updateConfig(eventId, { hostPlan: user.plan });
        }

        const unsubscribe = raffleService.subscribe(eventId, (newState) => {
            setState(newState);
            if (activeMode !== newState.mode) setActiveMode(newState.mode);
            setGooglePhotos(newState.googlePhotosUrl || '');
            setCustomImage(newState.customImageUrl || '');
        });
        return unsubscribe;
    }, [eventId, user.plan]);

    const handleSaveConfig = async (imageOverride?: string) => {
        if (!eventId) return;
        await raffleService.updateConfig(eventId, {
            googlePhotosUrl: googlePhotos,
            customImageUrl: imageOverride !== undefined ? imageOverride : customImage,
            mode: activeMode,
            hostPlan: user.plan
        });
    };

    const handleModeChange = async (newMode: RaffleMode) => {
        setActiveMode(newMode);
        if (!eventId) return;
        await raffleService.updateConfig(eventId, {
            mode: newMode,
            hostPlan: user.plan
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
            await handleSaveConfig(url);
        } catch (err) {
            console.error("Upload failed:", err);
            alert("Error al subir la imagen");
        } finally {
            setUploading(false);
        }
    };

    const handleStart = async () => {
        if (!eventId) return;
        handleSaveConfig();
        await raffleService.startRaffle(eventId);
    };

    const handleDraw = async () => {
        if (!eventId) return;
        await raffleService.drawWinner(eventId);
    };

    const handleReset = async () => {
        if (!eventId) return;
        if (confirm('¿Reiniciar sorteo?')) {
            await raffleService.resetRaffle(eventId);
        }
    };

    if (!state) return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
            <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
            <p className="text-slate-400 font-medium animate-pulse">Cargando Sorteo...</p>
        </div>
    );

    const participantCount = Object.keys(state.participants || {}).length;
    const currentBg = customImage || DEFAULT_BG;

    return (
        <div className="min-h-screen bg-gray-50 text-gray-900 pb-20">
            {/* Header */}
            <header className="bg-slate-900 text-white p-4 shadow-md sticky top-0 z-50">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate(`/games/${eventId}`)}
                            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                        >
                            <span className="material-symbols-outlined">arrow_back</span>
                        </button>
                        <div>
                            <h1 className="text-xl font-bold flex items-center gap-2">
                                <span className="material-symbols-outlined text-yellow-400">emoji_events</span>
                                Sorteos - Admin
                            </h1>
                            <div className="flex items-center gap-2 text-sm">
                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${state.status === 'IDLE' ? 'bg-gray-600' : state.status === 'WINNER' ? 'bg-purple-500' : 'bg-green-500'}`}>
                                    {state.status === 'IDLE' ? 'EN ESPERA' : state.status === 'WINNER' ? 'GANADOR' : 'EN VIVO'}
                                </span>
                                <span className="text-pink-400">{participantCount} participantes</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => window.open(`#/raffle/${eventId}/screen`, '_blank')}
                            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg font-medium transition-colors"
                        >
                            <span className="material-symbols-outlined text-sm">tv</span>
                            Pantalla Gigante
                        </button>
                    </div>
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

                {activeTab === 'LIVE' ? (
                    <div className="space-y-6 animate-fade-in">
                        {/* Stats */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-blue-500">
                                <div className="text-2xl font-bold">{participantCount}</div>
                                <div className="text-gray-500 text-sm">Participantes</div>
                            </div>
                            <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-indigo-500">
                                <div className="text-2xl font-bold">{activeMode === 'PHOTO' ? 'Por Foto' : 'Por Participante'}</div>
                                <div className="text-gray-500 text-sm">Modo Activo</div>
                            </div>
                            <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-green-500">
                                <div className="text-2xl font-bold">
                                    {state.status === 'IDLE' ? 'En Espera' : state.status === 'WINNER' ? 'Finalizado' : 'En Curso'}
                                </div>
                                <div className="text-gray-500 text-sm">Estado</div>
                            </div>
                        </div>

                        {/* Game Controls */}
                        <div className="flex flex-wrap gap-3">
                            {state.status === 'IDLE' && (
                                <button
                                    onClick={handleStart}
                                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2"
                                >
                                    <span className="material-symbols-outlined">play_arrow</span>
                                    Iniciar Sorteo
                                </button>
                            )}
                            {state.status !== 'IDLE' && state.status !== 'WINNER' && (
                                <button
                                    onClick={handleDraw}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2"
                                >
                                    <span className="material-symbols-outlined">emoji_events</span>
                                    Elegir Ganador
                                </button>
                            )}
                            <button
                                onClick={handleReset}
                                className="bg-red-100 text-red-700 hover:bg-red-200 px-6 py-2 rounded-lg font-bold flex items-center gap-2"
                            >
                                <span className="material-symbols-outlined">restart_alt</span>
                                Reiniciar Juego
                            </button>
                        </div>

                        {/* Status / Winner Banner */}
                        {state.status === 'WINNER' ? (
                            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-8 rounded-2xl text-center">
                                <h2 className="text-3xl font-bold mb-2">🎉 ¡Sorteo Finalizado!</h2>
                                <p className="text-white/90">Ya tenemos un ganador en la Pantalla Gigante. Podés reiniciar cuando quieras hacer otro sorteo.</p>
                            </div>
                        ) : (
                            <section className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 text-center">
                                <span className="material-symbols-outlined text-5xl text-indigo-500 mb-3 block">
                                    {state.status === 'IDLE' ? 'rocket_launch' : 'hourglass_empty'}
                                </span>
                                <h3 className="text-xl font-bold mb-1">
                                    {state.status === 'IDLE' ? 'Sorteo Listo para Comenzar' : 'Sorteo en Curso'}
                                </h3>
                                <p className="text-gray-500 text-sm">
                                    {state.status === 'IDLE'
                                        ? 'Presioná "Iniciar Sorteo" para comenzar en la Pantalla Gigante.'
                                        : 'Cuando estés listo, presioná "Elegir Ganador".'}
                                </p>
                            </section>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
                        {/* Left Column: Mode -> Global Settings */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Raffle Mode */}
                            <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
                                <h2 className="text-lg font-bold flex items-center gap-2">
                                    <span className="material-symbols-outlined">tune</span>
                                    Modo del Sorteo
                                </h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <button
                                        onClick={() => handleModeChange('PHOTO')}
                                        className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${activeMode === 'PHOTO' ? 'border-indigo-600 bg-indigo-50 text-indigo-900' : 'border-gray-200 hover:bg-gray-50 text-gray-500'}`}
                                    >
                                        <span className="material-symbols-outlined text-3xl">perm_media</span>
                                        <span className="font-bold text-sm">Por Foto</span>
                                        <span className="text-xs opacity-75">Sortea entre fotos del álbum</span>
                                    </button>
                                    <button
                                        onClick={() => handleModeChange('PARTICIPANT')}
                                        className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${activeMode === 'PARTICIPANT' ? 'border-indigo-600 bg-indigo-50 text-indigo-900' : 'border-gray-200 hover:bg-gray-50 text-gray-500'}`}
                                    >
                                        <span className="material-symbols-outlined text-3xl">groups</span>
                                        <span className="font-bold text-sm">Por Participantes</span>
                                        <span className="text-xs opacity-75">Sortea entre invitados que escaneen</span>
                                    </button>
                                </div>
                            </section>

                            {/* Global Settings: Event Image & Google Photos */}
                            <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-6">
                                <h2 className="text-lg font-bold flex items-center gap-2">
                                    <span className="material-symbols-outlined">settings</span>
                                    Configuración Global
                                </h2>

                                {/* Branding Image */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Imagen del Evento (Personalizada)</label>
                                    <div className="flex gap-2">
                                        <input
                                            value={customImage}
                                            onChange={(e) => setCustomImage(e.target.value)}
                                            className="flex-1 bg-gray-50 border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                            placeholder="URL de imagen..."
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
                                            onClick={() => handleSaveConfig(customImage)}
                                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
                                        >
                                            Guardar
                                        </button>
                                    </div>
                                    <div className="mt-2 relative group w-full h-32">
                                        <img src={currentBg} className="h-full w-full object-cover rounded-xl border border-gray-200" alt="Preview" />
                                    </div>
                                </div>

                                {activeMode === 'PHOTO' && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Link de Google Photos (Álbum compartido)</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                className="flex-1 border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                                                placeholder="https://photos.app.goo.gl/..."
                                                value={googlePhotos}
                                                onChange={e => setGooglePhotos(e.target.value)}
                                            />
                                            <button
                                                onClick={() => handleSaveConfig()}
                                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
                                            >
                                                Guardar
                                            </button>
                                        </div>
                                    </div>
                                )}
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
                                        src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`${window.location.origin}/#/raffle/${eventId}/guest`)}`}
                                        alt="Guest QR"
                                        className="w-44 h-44 mx-auto"
                                    />
                                </div>
                                <p className="text-xs text-gray-500 mt-3 break-all px-2">
                                    {`${window.location.origin}/#/raffle/${eventId}/guest`}
                                </p>
                                <button
                                    onClick={() => navigator.clipboard.writeText(`${window.location.origin}/#/raffle/${eventId}/guest`)}
                                    className="mt-3 text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1 mx-auto"
                                >
                                    <span className="material-symbols-outlined text-sm">content_copy</span>
                                    Copiar enlace
                                </button>
                                <button
                                    onClick={() => window.open(`#/raffle/${eventId}/guest`, '_blank')}
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

export default RaffleAdmin;
