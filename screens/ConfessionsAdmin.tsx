
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
            const base64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
                reader.readAsDataURL(file);
            });
            const url = await apiService.uploadImage(base64);
            setBgUrl(url);
            await handleSaveBackground(url);
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
        <div className="min-h-screen bg-gray-50 text-gray-900 pb-20">
            {/* Header */}
            <header className="bg-slate-900 text-white p-4 shadow-md sticky top-0 z-50">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate(`/games/${id}`)}
                            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                        >
                            <span className="material-symbols-outlined">arrow_back</span>
                        </button>
                        <div>
                            <h1 className="text-xl font-bold flex items-center gap-2">
                                <span className="material-symbols-outlined text-pink-400">chat_bubble</span>
                                Confesiones - Admin
                            </h1>
                            <div className="flex items-center gap-2 text-sm">
                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${state.status === 'ACTIVE' ? 'bg-green-500' : 'bg-gray-600'}`}>
                                    {state.status === 'ACTIVE' ? 'EN VIVO' : 'DETENIDO'}
                                </span>
                                <span className="text-pink-400">{messageCount} mensajes</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => window.open(`#/confessions/${id}/screen`, '_blank')}
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
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-blue-500">
                                <div className="text-2xl font-bold">{messageCount}</div>
                                <div className="text-gray-500 text-sm">Mensajes Recibidos</div>
                            </div>
                            <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-green-500">
                                <div className="text-2xl font-bold">{state.status === 'ACTIVE' ? 'Recibiendo' : 'Detenido'}</div>
                                <div className="text-gray-500 text-sm">Estado</div>
                            </div>
                        </div>

                        {/* Game Controls */}
                        <div className="flex flex-wrap gap-3">
                            <button
                                onClick={toggleStatus}
                                className={`px-6 py-2 rounded-lg font-bold flex items-center gap-2 text-white ${state.status === 'ACTIVE' ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-green-600 hover:bg-green-700'}`}
                            >
                                <span className="material-symbols-outlined">{state.status === 'ACTIVE' ? 'pause' : 'play_arrow'}</span>
                                {state.status === 'ACTIVE' ? 'Pausar Recepción' : 'Activar Recepción'}
                            </button>
                            <button
                                onClick={resetGame}
                                className="bg-red-100 text-red-700 hover:bg-red-200 px-6 py-2 rounded-lg font-bold flex items-center gap-2"
                            >
                                <span className="material-symbols-outlined">restart_alt</span>
                                Reiniciar Juego
                            </button>
                        </div>

                        {/* Recent Messages */}
                        <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <h2 className="text-lg font-bold mb-4">Mensajes Recientes</h2>
                            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                                {state.messages.slice().reverse().map((msg) => (
                                    <div
                                        key={msg.id}
                                        className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex gap-4"
                                    >
                                        <div className="w-1.5 self-stretch rounded-full" style={{ backgroundColor: msg.color }}></div>
                                        <div className="flex-1">
                                            <p className="text-base font-medium text-gray-800 italic">"{msg.text}"</p>
                                            <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                                                <span className="font-semibold uppercase">{msg.author || 'Anónimo'}</span>
                                                <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {state.messages.length === 0 && (
                                    <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300 text-gray-400">
                                        <span className="material-symbols-outlined text-4xl mb-2 block">chat_bubble_outline</span>
                                        <p>No hay mensajes todavía.</p>
                                    </div>
                                )}
                            </div>
                        </section>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
                        {/* Left Column: Global Settings */}
                        <div className="lg:col-span-2 space-y-6">
                            <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
                                <h2 className="text-lg font-bold flex items-center gap-2">
                                    <span className="material-symbols-outlined">settings</span>
                                    Configuración Global
                                </h2>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Imagen del Evento (Fondo Pantalla Gigante)</label>
                                    <div className="flex gap-2">
                                        <input
                                            value={bgUrl}
                                            onChange={(e) => setBgUrl(e.target.value)}
                                            className="flex-1 bg-gray-50 border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                            placeholder="https://..."
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
                                            onClick={() => handleSaveBackground(bgUrl)}
                                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
                                        >
                                            Guardar
                                        </button>
                                    </div>
                                    <div className="mt-3 relative group w-full h-40">
                                        <img
                                            src={bgUrl || 'https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&w=800&q=80'}
                                            alt="Fondo"
                                            className="h-full w-full object-cover rounded-xl border border-gray-200"
                                        />
                                    </div>
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
                                        src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`${window.location.origin}/#/confessions/${id}/guest`)}`}
                                        alt="Guest QR"
                                        className="w-44 h-44 mx-auto"
                                    />
                                </div>
                                <p className="text-xs text-gray-500 mt-3 break-all px-2">
                                    {`${window.location.origin}/#/confessions/${id}/guest`}
                                </p>
                                <button
                                    onClick={() => navigator.clipboard.writeText(`${window.location.origin}/#/confessions/${id}/guest`)}
                                    className="mt-3 text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1 mx-auto"
                                >
                                    <span className="material-symbols-outlined text-sm">content_copy</span>
                                    Copiar enlace
                                </button>
                                <button
                                    onClick={() => window.open(`#/confessions/${id}/guest`, '_blank')}
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

export default ConfessionsAdmin;
