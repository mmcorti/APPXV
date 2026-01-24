
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { raffleService } from '../services/raffleService';
import { RaffleState, RaffleMode } from '../types/raffleTypes';

const RaffleAdmin: React.FC = () => {
    const { id: eventId } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [state, setState] = useState<RaffleState | null>(null);
    const [googlePhotos, setGooglePhotos] = useState('');
    const [customImage, setCustomImage] = useState('');

    // For local UI state before saving
    const [activeMode, setActiveMode] = useState<RaffleMode>('PHOTO');

    useEffect(() => {
        if (!eventId) return;
        const unsubscribe = raffleService.subscribe(eventId, (newState) => {
            setState(newState);
            // Sync local state if not editing (optional, simple approach here)
            if (activeMode !== newState.mode) setActiveMode(newState.mode);
            if (!googlePhotos && newState.googlePhotosUrl) setGooglePhotos(newState.googlePhotosUrl);
            if (!customImage && newState.customImageUrl) setCustomImage(newState.customImageUrl);
        });
        return unsubscribe;
    }, [eventId]);

    const handleSaveConfig = async () => {
        if (!eventId) return;
        await raffleService.updateConfig(eventId, {
            googlePhotosUrl: googlePhotos,
            customImageUrl: customImage,
            mode: activeMode
        });
    };

    const handleStart = async () => {
        if (!eventId) return;
        handleSaveConfig(); // Ensure config is saved
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

    if (!state) return <div className="p-10 text-center">Cargando...</div>;

    const participantCount = Object.keys(state.participants || {}).length;

    return (
        <div className="min-h-screen bg-gray-50 pb-20 font-sans">
            {/* Header */}
            <header className="bg-slate-900 text-white p-4 shadow-md sticky top-0 z-10">
                <div className="flex justify-between items-center max-w-5xl mx-auto">
                    <div className="flex items-center gap-3">
                        <button onClick={() => navigate(`/dashboard`)} className="p-2 hover:bg-slate-800 rounded-lg">
                            <span className="material-symbols-outlined">arrow_back</span>
                        </button>
                        <div>
                            <h1 className="text-xl font-bold">Sorteos - Admin</h1>
                            <div className="flex items-center gap-2 text-sm text-gray-400">
                                <span className={`w-2 h-2 rounded-full ${state.status === 'IDLE' ? 'bg-gray-500' : 'bg-green-500 animate-pulse'}`}></span>
                                {state.status === 'IDLE' ? 'Configuración' : 'En Vivo'}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={() => window.open(`#/raffle/${eventId}/screen`, '_blank')}
                        className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2"
                    >
                        <span className="material-symbols-outlined text-lg">tv</span>
                        Pantalla Gigante
                    </button>
                </div>
            </header>

            <main className="max-w-2xl mx-auto p-4 space-y-6 mt-6">

                {/* CONFIG SECTION */}
                <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800">
                        <span className="material-symbols-outlined text-indigo-600">settings</span>
                        Configuración
                    </h2>

                    <div className="space-y-5">
                        {/* Branding */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Imagen del Evento (Personalizada)</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="URL de la imagen..."
                                    value={customImage}
                                    onChange={e => setCustomImage(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Mode Selector */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-3">Modo de Sorteo</label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setActiveMode('PHOTO')}
                                    className={`p-4 rounded-xl border-2 transition-all flex flex-col gap-2 ${activeMode === 'PHOTO' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 hover:bg-gray-50 text-gray-600'}`}
                                >
                                    <span className="material-symbols-outlined">perm_media</span>
                                    <span className="font-bold">Por Foto</span>
                                </button>
                                <button
                                    onClick={() => setActiveMode('PARTICIPANT')}
                                    className={`p-4 rounded-xl border-2 transition-all flex flex-col gap-2 ${activeMode === 'PARTICIPANT' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 hover:bg-gray-50 text-gray-600'}`}
                                >
                                    <span className="material-symbols-outlined">groups</span>
                                    <span className="font-bold">Por Participantes</span>
                                </button>
                            </div>
                        </div>

                        {/* Photo Link (Conditional) */}
                        {activeMode === 'PHOTO' && (
                            <div className="animate-fade-in">
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Google Photos Link</label>
                                <input
                                    type="text"
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="https://photos.app.goo.gl/..."
                                    value={googlePhotos}
                                    onChange={e => setGooglePhotos(e.target.value)}
                                />
                            </div>
                        )}

                        {/* Participant Info (Conditional) */}
                        {activeMode === 'PARTICIPANT' && (
                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex justify-between items-center animate-fade-in">
                                <div>
                                    <p className="text-blue-800 font-bold text-lg">{participantCount}</p>
                                    <p className="text-blue-600 text-xs uppercase font-bold">Participantes Registrados</p>
                                </div>
                                <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                                    <span className="material-symbols-outlined">person</span>
                                </div>
                            </div>
                        )}

                        <button
                            onClick={handleSaveConfig}
                            className="w-full py-3 bg-slate-100 font-bold text-slate-600 rounded-xl hover:bg-slate-200 transition-colors"
                        >
                            Guardar Configuración
                        </button>
                    </div>
                </section>

                {/* CONTROL SECTION */}
                <section className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 pb-8 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)]">
                    <div className="max-w-2xl mx-auto flex gap-3">
                        {state.status === 'IDLE' ? (
                            <button
                                onClick={handleStart}
                                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined">play_circle</span>
                                Iniciar Sorteo
                            </button>
                        ) : state.status === 'WINNER' ? (
                            <button
                                onClick={handleReset}
                                className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-4 rounded-xl font-bold text-lg shadow-lg transition-all flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined">restart_alt</span>
                                Reiniciar
                            </button>
                        ) : (
                            // WAITING OR COUNTDOWN
                            <>
                                <button
                                    onClick={handleDraw}
                                    className="flex-1 bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-green-200 transition-all flex items-center justify-center gap-2"
                                >
                                    <span className="material-symbols-outlined">emoji_events</span>
                                    Seleccionar Ganador
                                </button>
                                <button
                                    onClick={handleReset}
                                    className="w-16 bg-red-100 text-red-600 rounded-xl flex items-center justify-center hover:bg-red-200"
                                >
                                    <span className="material-symbols-outlined">stop</span>
                                </button>
                            </>
                        )}
                    </div>
                </section>
            </main>
        </div>
    );
};

export default RaffleAdmin;
