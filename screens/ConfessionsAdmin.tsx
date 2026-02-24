
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User } from '../types';
import { confessionsService, ConfessionsState } from '../services/confessionsService';
import { apiService } from '../services/apiService';

interface ConfessionsAdminProps {
    user: User | null;
}

const ConfessionsAdmin: React.FC<ConfessionsAdminProps> = ({ user }) => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [state, setState] = useState<ConfessionsState | null>(null);
    const [loading, setLoading] = useState(true);
    const [bgUrl, setBgUrl] = useState('');
    const [activeTab, setActiveTab] = useState<'LIVE' | 'CONFIG'>('LIVE');
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        if (!id) return;
        loadState();

        const unsubscribe = confessionsService.subscribe(id, (newState) => {
            setState(newState);
            setBgUrl(newState.backgroundUrl);
        });

        return () => unsubscribe();
    }, [id]);

    const loadState = async () => {
        if (!id) return;
        try {
            const data = await confessionsService.getState(id);
            setState(data);
            setBgUrl(data.backgroundUrl);
        } catch (e) {
            console.error('Failed to load state', e);
        } finally {
            setLoading(false);
        }
    };

    const toggleStatus = async () => {
        if (!state || !id) return;
        const newStatus = state.status === 'ACTIVE' ? 'STOPPED' : 'ACTIVE';
        await confessionsService.updateConfig(id, { status: newStatus });
    };

    const handleSaveBackground = async (url: string) => {
        if (!id) return;
        await confessionsService.updateConfig(id, { backgroundUrl: url });
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !id) return;

        setUploading(true);
        try {
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64 = reader.result as string;
                // @ts-ignore
                const url = await apiService.uploadImage(base64);
                setBgUrl(url);
                await handleSaveBackground(url);
            };
            reader.readAsDataURL(file);
        } catch (err) {
            console.error("Upload failed:", err);
            alert("Error al subir la imagen");
        } finally {
            setUploading(false);
        }
    };

    const resetGame = async () => {
        if (!id || !confirm('¿Estás seguro de que deseas borrar todos los mensajes?')) return;
        await confessionsService.resetGame(id);
    };

    if (loading) return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
            <div className="w-12 h-12 border-4 border-pink-500/20 border-t-pink-500 rounded-full animate-spin"></div>
            <p className="text-slate-400 font-medium animate-pulse">Cargando Confesiones...</p>
        </div>
    );

    if (!state) return <div className="p-8 text-white">Error al cargar el estado del juego</div>;

    const messageCount = state.messages.length;

    return (
        <div className="min-h-screen bg-[#020617] text-slate-100 font-sans selection:bg-pink-500/30">
            {/* Nav Header */}
            <header className="sticky top-0 z-[60] bg-[#020617]/80 backdrop-blur-xl border-b border-white/5 px-8 py-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <button
                            onClick={() => navigate(`/games/${id}`)}
                            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/5 transition-all active:scale-90"
                        >
                            <span className="material-symbols-outlined text-slate-400">arrow_back</span>
                        </button>
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-xl font-black tracking-tight">Confesiones</h1>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black tracking-widest uppercase ${state.status === 'ACTIVE' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                    {state.status === 'ACTIVE' ? 'En Vivo' : 'Detenido'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => window.open(`#/confessions/${id}/screen`, '_blank')}
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
                        className={`px-6 py-2.5 rounded-xl text-xs font-black tracking-widest uppercase transition-all ${activeTab === 'LIVE' ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/20' : 'text-slate-400 hover:text-white'}`}
                    >
                        Juego en Vivo
                    </button>
                    <button
                        onClick={() => setActiveTab('CONFIG')}
                        className={`px-6 py-2.5 rounded-xl text-xs font-black tracking-widest uppercase transition-all ${activeTab === 'CONFIG' ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/20' : 'text-slate-400 hover:text-white'}`}
                    >
                        Configuración
                    </button>
                </div>
            </div>

            <main className="max-w-4xl mx-auto p-8 pt-6 space-y-8">
                {activeTab === 'LIVE' ? (
                    <div className="space-y-8 animate-fade-in">
                        {/* Stats & Status Block */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-[#0f172a] rounded-[2rem] p-8 border border-white/5 shadow-2xl relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/5 blur-[50px] rounded-full transition-all group-hover:bg-pink-500/10"></div>
                                <div className="relative z-10">
                                    <div className="flex justify-between items-center mb-6">
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Mensajes</span>
                                        <div className="w-10 h-10 bg-pink-500/10 rounded-xl flex items-center justify-center text-pink-500">
                                            <span className="material-symbols-outlined">chat_bubble</span>
                                        </div>
                                    </div>
                                    <p className="text-5xl font-black tracking-tighter">{messageCount}</p>
                                    <p className="text-sm text-slate-400 mt-2 font-medium">Confesiones recibidas</p>
                                </div>
                            </div>

                            <div className="bg-[#0f172a] rounded-[2rem] p-8 border border-white/5 shadow-2xl">
                                <div className="flex justify-between items-center mb-6">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Estado</span>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" checked={state.status === 'ACTIVE'} onChange={toggleStatus} className="sr-only peer" />
                                        <div className="w-14 h-7 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                                    </label>
                                </div>
                                <p className={`text-2xl font-black uppercase tracking-tight ${state.status === 'ACTIVE' ? 'text-green-500' : 'text-slate-400'}`}>
                                    {state.status === 'ACTIVE' ? 'Recibiendo' : 'Detenido'}
                                </p>
                                <p className="text-sm text-slate-400 mt-2 font-medium">Controla si los invitados pueden enviar mensajes</p>
                            </div>
                        </div>

                        {/* Recent Messages */}
                        <div className="bg-[#0f172a] rounded-[2.5rem] p-8 border border-white/5 shadow-2xl overflow-hidden relative">
                            <div className="flex justify-between items-center mb-8">
                                <h3 className="text-2xl font-black tracking-tight flex items-center gap-3">
                                    Recent Confessions
                                    <span className="text-xs bg-white/5 px-3 py-1 rounded-full text-slate-500 font-black tracking-widest">LIVE</span>
                                </h3>
                                <button
                                    onClick={resetGame}
                                    className="p-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-2xl transition-all"
                                    title="Limpiar Mensajes"
                                >
                                    <span className="material-symbols-outlined">delete_sweep</span>
                                </button>
                            </div>

                            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-4 custom-scrollbar">
                                {state.messages.slice().reverse().map((msg) => (
                                    <div
                                        key={msg.id}
                                        className="bg-slate-900/50 p-6 rounded-3xl border border-white/5 flex gap-5 animate-scale-in"
                                    >
                                        <div className="w-1.5 self-stretch rounded-full" style={{ backgroundColor: msg.color }}></div>
                                        <div className="flex-1">
                                            <p className="text-lg font-medium text-slate-200 leading-relaxed italic">"{msg.text}"</p>
                                            <div className="flex items-center justify-between mt-4">
                                                <span className="text-[10px] font-black tracking-wider text-slate-500 uppercase">
                                                    {msg.author || 'Anónimo'}
                                                </span>
                                                <span className="text-[10px] font-black tracking-wider text-slate-600 uppercase">
                                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {state.messages.length === 0 && (
                                    <div className="text-center py-20">
                                        <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-6">
                                            <span className="material-symbols-outlined text-4xl text-slate-700">chat_bubble_outline</span>
                                        </div>
                                        <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">No hay mensajes todavía</p>
                                        <p className="text-slate-600 text-xs mt-2 font-medium">Los mensajes aparecerán aquí cuando los invitados comiencen a enviarlos</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-8 animate-fade-in">
                        {/* Background Configuration */}
                        <div className="bg-[#0f172a] rounded-[2.5rem] p-10 border border-white/5 shadow-2xl">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-12 h-12 bg-pink-500/10 rounded-2xl flex items-center justify-center text-pink-500">
                                    <span className="material-symbols-outlined">image</span>
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black tracking-tight">Imagen del Evento</h3>
                                    <p className="text-slate-500 text-sm font-medium">Personaliza el fondo de la pantalla gigante</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                                <div className="aspect-video bg-slate-950 rounded-[2rem] overflow-hidden border border-white/10 relative group">
                                    <img
                                        src={bgUrl || 'https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&w=800&q=80'}
                                        alt="Fondo"
                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-60"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 to-transparent flex items-end p-6">
                                        <span className="bg-white/10 backdrop-blur-md text-white px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase">Vista Previa</span>
                                    </div>
                                    {uploading && (
                                        <div className="absolute inset-0 bg-[#020617]/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
                                            <div className="w-8 h-8 border-4 border-pink-500/20 border-t-pink-500 rounded-full animate-spin"></div>
                                            <p className="text-xs font-black tracking-widest text-slate-400 uppercase">Subiendo...</p>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-6">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">Cargar Imagen</label>
                                        <label className="flex flex-col items-center justify-center w-full h-32 bg-slate-900/50 border-2 border-dashed border-white/10 rounded-[1.5rem] cursor-pointer hover:bg-slate-800/50 hover:border-pink-500/50 transition-all group">
                                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                                <span className="material-symbols-outlined text-3xl text-slate-500 group-hover:text-pink-500 transition-colors mb-2">cloud_upload</span>
                                                <p className="text-xs font-black tracking-wider text-slate-500 group-hover:text-slate-300">SUBIR ARCHIVO</p>
                                            </div>
                                            <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={uploading} />
                                        </label>
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">O pegar URL directa / Google Photos</label>
                                        <div className="flex gap-3">
                                            <input
                                                value={bgUrl}
                                                onChange={(e) => setBgUrl(e.target.value)}
                                                className="flex-1 bg-slate-950 border border-white/10 rounded-2xl px-5 py-3.5 text-sm font-medium focus:ring-2 focus:ring-pink-500 outline-none transition-all"
                                                placeholder="https://images.unsplash..."
                                            />
                                            <button
                                                onClick={() => handleSaveBackground(bgUrl)}
                                                className="bg-slate-800 hover:bg-slate-700 text-white px-6 rounded-2xl font-black text-[10px] tracking-widest uppercase transition-all"
                                            >
                                                Aplicar
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Guest Simulation Block */}
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
                                        Prueba la experiencia de los invitados. Escanea el código QR para enviar mensajes desde tu celular o usa el botón de abajo.
                                    </p>
                                    <button
                                        onClick={() => window.open(`#/confessions/${id}/guest`, '_blank')}
                                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-xl shadow-indigo-600/20 active:scale-95 text-xs tracking-widest uppercase"
                                    >
                                        <span className="material-symbols-outlined text-sm">open_in_new</span>
                                        Probar como Invitado
                                    </button>
                                </div>

                                <div className="flex flex-col items-center justify-center bg-white p-6 rounded-[2rem] shadow-2xl">
                                    <img
                                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`${window.location.origin}/#/confessions/${id}/guest`)}`}
                                        alt="Guest QR"
                                        className="w-48 h-48"
                                    />
                                    <p className="text-[#020617] font-black text-[10px] tracking-widest uppercase mt-4">Escanea para jugar</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default ConfessionsAdmin;
