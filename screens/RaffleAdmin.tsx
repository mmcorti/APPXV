
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { raffleService } from '../services/raffleService';
import { notionService } from '../services/notion';
import { RaffleState, RaffleMode } from '../types/raffleTypes';
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
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64 = reader.result as string;
                const url = await notionService.uploadImage(base64);
                setCustomImage(url);
                await handleSaveConfig(url);
            };
            reader.readAsDataURL(file);
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
        <div className="min-h-screen bg-[#020617] text-slate-100 font-sans selection:bg-indigo-500/30">
            {/* Nav Header */}
            <header className="sticky top-0 z-[60] bg-[#020617]/80 backdrop-blur-xl border-b border-white/5 px-8 py-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <button
                            onClick={() => navigate(`/games/${eventId}`)}
                            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/5 transition-all active:scale-90"
                        >
                            <span className="material-symbols-outlined text-slate-400">arrow_back</span>
                        </button>
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-xl font-black tracking-tight">Sorteos</h1>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black tracking-widest uppercase ${state.status === 'IDLE' ? 'bg-slate-500/20 text-slate-400' : 'bg-green-500/20 text-green-400'}`}>
                                    {state.status === 'IDLE' ? 'Configuración' : 'En Vivo'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => window.open(`#/raffle/${eventId}/screen`, '_blank')}
                            className="flex items-center gap-2 bg-slate-900 border border-white/10 hover:bg-white/10 px-5 py-2.5 rounded-xl font-black text-xs transition-all uppercase tracking-widest"
                        >
                            <span className="material-symbols-outlined text-sm">tv</span>
                            Pantalla Gigante
                        </button>
                    </div>
                </div>
            </header>

            {/* Tab Navigation */}
            <div className="max-w-4xl mx-auto px-8 mt-8">
                <div className="flex gap-2 p-1.5 bg-slate-900/50 rounded-2xl border border-white/5 w-fit">
                    <button
                        onClick={() => setActiveTab('LIVE')}
                        className={`px-6 py-2.5 rounded-xl text-xs font-black tracking-widest uppercase transition-all ${activeTab === 'LIVE' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-400 hover:text-white'}`}
                    >
                        Juego en Vivo
                    </button>
                    <button
                        onClick={() => setActiveTab('CONFIG')}
                        className={`px-6 py-2.5 rounded-xl text-xs font-black tracking-widest uppercase transition-all ${activeTab === 'CONFIG' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-400 hover:text-white'}`}
                    >
                        Configuración
                    </button>
                </div>
            </div>

            <main className="max-w-4xl mx-auto p-8 pt-6 space-y-8">
                {activeTab === 'LIVE' ? (
                    <div className="space-y-8 animate-fade-in">
                        {/* Status Blocks */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-[#0f172a] rounded-[2rem] p-8 border border-white/5 shadow-2xl relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-[50px] rounded-full"></div>
                                <div className="relative z-10">
                                    <div className="flex justify-between items-center mb-6">
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Participantes</span>
                                        <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-500">
                                            <span className="material-symbols-outlined">groups</span>
                                        </div>
                                    </div>
                                    <p className="text-5xl font-black tracking-tighter">{participantCount}</p>
                                    <p className="text-sm text-slate-400 mt-2 font-medium">Registrados para el sorteo</p>
                                </div>
                            </div>

                            <div className="bg-[#0f172a] rounded-[2rem] p-8 border border-white/5 shadow-2xl">
                                <div className="flex justify-between items-center mb-6">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Modo Activo</span>
                                    <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-slate-400">
                                        <span className="material-symbols-outlined">{activeMode === 'PHOTO' ? 'perm_media' : 'person'}</span>
                                    </div>
                                </div>
                                <p className="text-2xl font-black uppercase tracking-tight text-white">
                                    {activeMode === 'PHOTO' ? 'Por Foto' : 'Por Participante'}
                                </p>
                                <p className="text-sm text-slate-400 mt-2 font-medium">Cámbialo en la solapa de configuración</p>
                            </div>
                        </div>

                        {/* Main Controls */}
                        <div className="bg-[#0f172a] rounded-[2.5rem] p-10 border border-white/5 shadow-2xl flex flex-col items-center justify-center text-center space-y-8">
                            {state.status === 'IDLE' ? (
                                <>
                                    <div className="w-24 h-24 bg-indigo-500/10 rounded-full flex items-center justify-center text-indigo-500 mb-2">
                                        <span className="material-symbols-outlined text-5xl">rocket_launch</span>
                                    </div>
                                    <div>
                                        <h3 className="text-3xl font-black tracking-tight mb-2 uppercase">Preparado</h3>
                                        <p className="text-slate-400 font-medium max-w-sm">Haz clic abajo para iniciar el sorteo en la pantalla gigante.</p>
                                    </div>
                                    <button
                                        onClick={handleStart}
                                        className="w-full max-w-md bg-indigo-600 hover:bg-indigo-500 text-white font-black py-5 rounded-[1.5rem] text-lg tracking-widest uppercase transition-all shadow-2xl shadow-indigo-600/30 active:scale-95 flex items-center justify-center gap-3"
                                    >
                                        <span className="material-symbols-outlined">play_circle</span>
                                        Iniciar Sorteo
                                    </button>
                                </>
                            ) : state.status === 'WINNER' ? (
                                <>
                                    <div className="w-24 h-24 bg-yellow-500/10 rounded-full flex items-center justify-center text-yellow-500 mb-2">
                                        <span className="material-symbols-outlined text-5xl animate-bounce">emoji_events</span>
                                    </div>
                                    <div>
                                        <h3 className="text-3xl font-black tracking-tight mb-2 uppercase text-yellow-500">¡Sorteo Finalizado!</h3>
                                        <p className="text-slate-400 font-medium">Ya tenemos un ganador en pantalla.</p>
                                    </div>
                                    <button
                                        onClick={handleReset}
                                        className="w-full max-w-md bg-slate-800 hover:bg-slate-700 text-white font-black py-5 rounded-[1.5rem] text-lg tracking-widest uppercase transition-all active:scale-95 flex items-center justify-center gap-3"
                                    >
                                        <span className="material-symbols-outlined">restart_alt</span>
                                        Nuevo Sorteo
                                    </button>
                                </>
                            ) : (
                                <>
                                    <div className="w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center text-green-500 mb-2">
                                        <span className="material-symbols-outlined text-5xl animate-pulse">hourglass_empty</span>
                                    </div>
                                    <div>
                                        <h3 className="text-3xl font-black tracking-tight mb-2 uppercase">En Proceso</h3>
                                        <p className="text-slate-400 font-medium">El sorteo está corriendo. ¡Selecciona al ganador cuando estés listo!</p>
                                    </div>
                                    <div className="flex gap-4 w-full max-w-md">
                                        <button
                                            onClick={handleDraw}
                                            className="flex-1 bg-green-600 hover:bg-green-500 text-white font-black py-5 rounded-[1.5rem] text-lg tracking-widest uppercase transition-all shadow-2xl shadow-green-600/30 active:scale-95 flex items-center justify-center gap-3"
                                        >
                                            <span className="material-symbols-outlined">emoji_events</span>
                                            Ganador
                                        </button>
                                        <button
                                            onClick={handleReset}
                                            className="w-20 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-[1.5rem] transition-all flex items-center justify-center"
                                            title="Detener"
                                        >
                                            <span className="material-symbols-outlined">stop</span>
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-8 animate-fade-in">
                        {/* Background Configuration */}
                        <div className="bg-[#0f172a] rounded-[2.5rem] p-10 border border-white/5 shadow-2xl">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-500">
                                    <span className="material-symbols-outlined">image</span>
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black tracking-tight">Imagen del Evento</h3>
                                    <p className="text-slate-500 text-sm font-medium">Imagen de fondo para el sorteo</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                                <div className="aspect-video bg-slate-950 rounded-[2rem] overflow-hidden border border-white/10 relative group">
                                    <img
                                        src={currentBg}
                                        alt="Fondo"
                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-60"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 to-transparent flex items-end p-6">
                                        <span className="bg-white/10 backdrop-blur-md text-white px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase">Vista Previa</span>
                                    </div>
                                    {uploading && (
                                        <div className="absolute inset-0 bg-[#020617]/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
                                            <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                                            <p className="text-xs font-black tracking-widest text-slate-400 uppercase">Subiendo...</p>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-6">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">Cargar Imagen</label>
                                        <label className="flex flex-col items-center justify-center w-full h-32 bg-slate-900/50 border-2 border-dashed border-white/10 rounded-[1.5rem] cursor-pointer hover:bg-slate-800/50 hover:border-indigo-500/50 transition-all group">
                                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                                <span className="material-symbols-outlined text-3xl text-slate-500 group-hover:text-indigo-500 transition-colors mb-2">cloud_upload</span>
                                                <p className="text-xs font-black tracking-wider text-slate-500 group-hover:text-slate-300">SUBIR ARCHIVO</p>
                                            </div>
                                            <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={uploading} />
                                        </label>
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">O pegar URL directa</label>
                                        <div className="flex gap-3">
                                            <input
                                                value={customImage}
                                                onChange={(e) => setCustomImage(e.target.value)}
                                                className="flex-1 bg-slate-950 border border-white/10 rounded-2xl px-5 py-3.5 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                                placeholder="https://..."
                                            />
                                            <button
                                                onClick={() => handleSaveConfig(customImage)}
                                                className="bg-slate-800 hover:bg-slate-700 text-white px-6 rounded-2xl font-black text-[10px] tracking-widest uppercase transition-all"
                                            >
                                                Aplicar
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Mode & Google Photos */}
                        <div className="bg-[#0f172a] rounded-[2.5rem] p-10 border border-white/5 shadow-2xl space-y-8">
                            <div>
                                <h3 className="text-2xl font-black tracking-tight mb-6 flex items-center gap-3">
                                    <span className="material-symbols-outlined text-indigo-500">tune</span>
                                    Modo del Sorteo
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <button
                                        onClick={() => handleModeChange('PHOTO')}
                                        className={`p-6 rounded-[2rem] border-2 flex flex-col items-center gap-4 transition-all ${activeMode === 'PHOTO' ? 'border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/5' : 'border-white/5 hover:bg-white/5 text-slate-500'}`}
                                    >
                                        <span className={`material-symbols-outlined text-4xl ${activeMode === 'PHOTO' ? 'text-indigo-400' : ''}`}>perm_media</span>
                                        <div className="text-center">
                                            <span className={`block font-black tracking-widest uppercase text-xs ${activeMode === 'PHOTO' ? 'text-white' : ''}`}>Por Foto</span>
                                            <span className="text-[10px] opacity-60 mt-1">Sortea entre fotos del álbum</span>
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => handleModeChange('PARTICIPANT')}
                                        className={`p-6 rounded-[2rem] border-2 flex flex-col items-center gap-4 transition-all ${activeMode === 'PARTICIPANT' ? 'border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/5' : 'border-white/5 hover:bg-white/5 text-slate-500'}`}
                                    >
                                        <span className={`material-symbols-outlined text-4xl ${activeMode === 'PARTICIPANT' ? 'text-indigo-400' : ''}`}>groups</span>
                                        <div className="text-center">
                                            <span className={`block font-black tracking-widest uppercase text-xs ${activeMode === 'PARTICIPANT' ? 'text-white' : ''}`}>Por Participantes</span>
                                            <span className="text-[10px] opacity-60 mt-1">Sortea entre invitados que escaneen</span>
                                        </div>
                                    </button>
                                </div>
                            </div>

                            {activeMode === 'PHOTO' && (
                                <div className="animate-fade-in pt-6 border-t border-white/5">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block text-center">Google Fotos Link (Álbum compartido)</label>
                                    <div className="flex gap-3">
                                        <input
                                            type="text"
                                            className="w-full bg-slate-950 border border-white/10 rounded-2xl px-5 py-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                            placeholder="https://photos.app.goo.gl/..."
                                            value={googlePhotos}
                                            onChange={e => setGooglePhotos(e.target.value)}
                                        />
                                        <button
                                            onClick={() => handleSaveConfig()}
                                            className="bg-indigo-600 hover:bg-indigo-500 text-white px-10 rounded-2xl font-black text-[10px] tracking-widest uppercase shadow-xl shadow-indigo-600/20"
                                        >
                                            Guardar
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Guest Simulation (QR) */}
                        <div className="bg-[#0f172a] rounded-[2.5rem] p-10 border border-white/5 shadow-2xl overflow-hidden relative group">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[80px] rounded-full"></div>

                            <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
                                <div>
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-400">
                                            <span className="material-symbols-outlined">qr_code_2</span>
                                        </div>
                                        <h3 className="text-2xl font-black tracking-tight uppercase">Simulación</h3>
                                    </div>
                                    <p className="text-slate-400 font-medium leading-relaxed mb-8">
                                        Escanea este código para participar en el sorteo (Modo Participante) o para ver cómo los invitados interactúan.
                                    </p>
                                    <button
                                        onClick={() => window.open(`#/raffle/${eventId}/guest`, '_blank')}
                                        className="w-full bg-slate-800 hover:bg-white/10 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 text-xs tracking-widest uppercase border border-white/5"
                                    >
                                        <span className="material-symbols-outlined text-sm">open_in_new</span>
                                        Probar como Invitado
                                    </button>
                                </div>

                                <div className="flex flex-col items-center justify-center bg-white p-6 rounded-[2rem] shadow-2xl">
                                    <img
                                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`${window.location.origin}/#/raffle/${eventId}/guest`)}`}
                                        alt="Guest QR"
                                        className="w-48 h-48"
                                    />
                                    <p className="text-[#020617] font-black text-[10px] tracking-widest uppercase mt-4">Escanea para unirte</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default RaffleAdmin;
