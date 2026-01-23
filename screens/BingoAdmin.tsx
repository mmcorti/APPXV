import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { bingoService, BingoGameState, BingoPrompt, BingoSubmission } from '../services/bingoService';
import { User } from '../types';

interface BingoAdminProps {
    user: User;
}

const BingoAdmin: React.FC<BingoAdminProps> = ({ user }) => {
    const { id: eventId } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [state, setState] = useState<BingoGameState | null>(null);
    const [activeTab, setActiveTab] = useState<'CONFIG' | 'LIVE'>('CONFIG');
    const [editingPrompts, setEditingPrompts] = useState<BingoPrompt[]>([]);
    const [googlePhotosLink, setGooglePhotosLink] = useState('');

    useEffect(() => {
        if (!eventId) return;

        // Subscribe to real-time updates
        const unsubscribe = bingoService.subscribe(eventId, (newState) => {
            setState(newState);
            if (editingPrompts.length === 0) {
                setEditingPrompts(newState.prompts);
            }
            if (!googlePhotosLink) {
                setGooglePhotosLink(newState.googlePhotosLink);
            }
        });

        return unsubscribe;
    }, [eventId]);

    const handlePromptChange = (id: number, text: string) => {
        setEditingPrompts(prev => prev.map(p => p.id === id ? { ...p, text } : p));
    };

    const handleSavePrompts = async () => {
        if (!eventId) return;
        await bingoService.updatePrompts(eventId, editingPrompts);
    };

    const handleSaveSettings = async () => {
        if (!eventId) return;
        await bingoService.setGooglePhotosLink(eventId, googlePhotosLink);
    };

    const handleStart = async () => {
        if (!eventId) return;
        if (!googlePhotosLink) {
            const proceed = confirm("⚠️ No configuraste el link de Google Photos.\n\nLos invitados no podrán ver las fotos del evento.\n\n¿Deseas iniciar el juego de todas formas?");
            if (!proceed) return;
        }
        await bingoService.startGame(eventId);
        setActiveTab('LIVE');
    };

    const handleStop = async () => {
        if (!eventId) return;
        await bingoService.stopGame(eventId);
    };

    const handleFinish = async () => {
        if (!eventId) return;
        if (confirm('¿Estás seguro de finalizar el juego? Esto declarará a los ganadores actuales como definitivos.')) {
            await bingoService.finishGame(eventId);
        }
    };

    const handleReset = async () => {
        if (!eventId) return;
        if (confirm('¿Estás seguro? Esto reiniciará todo el juego.')) {
            await bingoService.resetGame(eventId);
            setActiveTab('CONFIG');
        }
    };

    const handleApprove = async (submissionId: string) => {
        if (!eventId) return;
        await bingoService.approveSubmission(eventId, submissionId);
    };

    const handleReject = async (submissionId: string) => {
        if (!eventId) return;
        await bingoService.rejectSubmission(eventId, submissionId);
    };

    if (!state) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    const pendingSubmissions = state.submissions.filter(s => s.status === 'PENDING');
    const playerCount = Object.keys(state.players).length;

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
                            <span className="material-symbols-outlined text-yellow-400">photo_camera</span>
                            Photo Bingo - Admin
                        </h1>
                        <div className="flex items-center gap-2 text-sm">
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${state.status === 'PLAYING' ? 'bg-green-500' :
                                state.status === 'REVIEW' ? 'bg-yellow-500' :
                                    state.status === 'WINNER' ? 'bg-purple-500' :
                                        'bg-gray-600'
                                }`}>
                                {state.status === 'WAITING' ? 'EN ESPERA' :
                                    state.status === 'PLAYING' ? 'EN VIVO' :
                                        state.status === 'REVIEW' ? 'REVISIÓN' :
                                            state.status === 'WINNER' ? 'GANADOR' : state.status}
                            </span>
                            <span className="text-pink-400">{playerCount} jugadores</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => window.open(`#/bingo/${eventId}/screen`, '_blank')}
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
                        onClick={() => setActiveTab('CONFIG')}
                        className={`pb-2 px-4 font-semibold ${activeTab === 'CONFIG' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500'}`}
                    >
                        Configuración
                    </button>
                    <button
                        onClick={() => setActiveTab('LIVE')}
                        className={`pb-2 px-4 font-semibold ${activeTab === 'LIVE' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500'}`}
                    >
                        Juego en Vivo
                    </button>
                </div>

                {activeTab === 'CONFIG' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
                        {/* Left Column: Settings & Controls */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Global Settings */}
                            <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                                    <span className="material-symbols-outlined">settings</span>
                                    Configuración Global
                                </h2>
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Link de Google Photos</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            className="flex-1 border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                                            placeholder="https://photos.app.goo.gl/..."
                                            value={googlePhotosLink}
                                            onChange={(e) => setGooglePhotosLink(e.target.value)}
                                        />
                                        <button
                                            onClick={handleSaveSettings}
                                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                                        >
                                            Guardar
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">Las fotos se mostrarán aquí (backup simulado).</p>
                                </div>
                                <div className="flex gap-4">
                                    <button
                                        onClick={handleStart}
                                        disabled={state.status === 'PLAYING'}
                                        className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                    >
                                        <span className="material-symbols-outlined">play_arrow</span>
                                        Iniciar Juego
                                    </button>
                                    <button
                                        onClick={handleReset}
                                        className="bg-red-100 text-red-700 hover:bg-red-200 px-6 py-2 rounded-lg font-bold flex items-center gap-2"
                                    >
                                        <span className="material-symbols-outlined">restart_alt</span>
                                        Reiniciar Juego
                                    </button>
                                </div>
                            </section>

                            {/* Prompt Grid Editor */}
                            <section>
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="text-lg font-bold flex items-center gap-2">
                                        <span className="material-symbols-outlined">grid_on</span>
                                        Tablero de Bingo (9 Consignas)
                                    </h2>
                                    <button
                                        onClick={handleSavePrompts}
                                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
                                    >
                                        <span className="material-symbols-outlined">save</span>
                                        Guardar Cambios
                                    </button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {editingPrompts.map((prompt, idx) => (
                                        <div key={prompt.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm relative group">
                                            <div className="absolute top-2 right-2 text-gray-300 font-mono text-xs">#{idx + 1}</div>
                                            <div className="flex items-start gap-3">
                                                <div className="bg-indigo-50 p-2 rounded-lg text-indigo-600">
                                                    <span className="material-symbols-outlined">{prompt.icon}</span>
                                                </div>
                                                <div className="w-full">
                                                    <label className="text-xs font-bold text-gray-500 uppercase">Consigna</label>
                                                    <textarea
                                                        className="w-full text-sm border-gray-300 border-b focus:border-indigo-500 outline-none py-1 resize-none bg-transparent"
                                                        rows={2}
                                                        value={prompt.text}
                                                        onChange={(e) => handlePromptChange(prompt.id, e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        </div>

                        {/* Right Column: QR Code & Links */}
                        <div className="space-y-6">
                            {/* QR Code for Players */}
                            <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 text-center">
                                <h2 className="text-lg font-bold mb-3 flex items-center justify-center gap-2">
                                    <span className="material-symbols-outlined">qr_code_2</span>
                                    Enlace para Jugadores
                                </h2>
                                <div className="bg-gray-50 p-4 rounded-lg inline-block">
                                    <img
                                        src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`${window.location.origin}/#/bingo/${eventId}/play`)}`}
                                        alt="QR Code para jugar"
                                        className="w-44 h-44 mx-auto"
                                    />
                                </div>
                                <p className="text-xs text-gray-500 mt-3 break-all px-2">
                                    {`${window.location.origin}/#/bingo/${eventId}/play`}
                                </p>
                                <button
                                    onClick={() => navigator.clipboard.writeText(`${window.location.origin}/#/bingo/${eventId}/play`)}
                                    className="mt-3 text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1 mx-auto"
                                >
                                    <span className="material-symbols-outlined text-sm">content_copy</span>
                                    Copiar enlace
                                </button>
                            </section>

                            {/* Big Screen Link */}
                            <section className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                                <h3 className="font-bold text-indigo-900 mb-2 flex items-center gap-2">
                                    <span className="material-symbols-outlined">tv</span>
                                    Pantalla Gigante
                                </h3>
                                <p className="text-sm text-indigo-700 mb-3">
                                    Abre esta pantalla en un proyector o TV grande para que todos vean el juego.
                                </p>
                                <button
                                    onClick={() => window.open(`#/bingo/${eventId}/screen`, '_blank')}
                                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                                >
                                    <span className="material-symbols-outlined text-sm">open_in_new</span>
                                    Abrir Pantalla Gigante
                                </button>
                            </section>
                        </div>
                    </div>
                )}

                {activeTab === 'LIVE' && (
                    <div className="space-y-6 animate-fade-in">
                        {/* Stats */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-blue-500">
                                <div className="text-2xl font-bold">{playerCount}</div>
                                <div className="text-gray-500 text-sm">Jugadores</div>
                            </div>
                            <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-yellow-500">
                                <div className="text-2xl font-bold">{pendingSubmissions.length}</div>
                                <div className="text-gray-500 text-sm">Pendientes</div>
                            </div>
                            <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-green-500">
                                <div className="text-2xl font-bold">{state.submissions.filter(s => s.status === 'APPROVED').length}</div>
                                <div className="text-gray-500 text-sm">Ganadores</div>
                            </div>
                        </div>

                        {/* Game Controls */}
                        <div className="flex gap-4">
                            {state.status === 'PLAYING' && (
                                <button
                                    onClick={handleStop}
                                    className="bg-yellow-500 hover:bg-yellow-600 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2"
                                >
                                    <span className="material-symbols-outlined">pause</span>
                                    Pausar / Revisar
                                </button>
                            )}
                            {(state.status === 'PLAYING' || state.status === 'REVIEW') && (
                                <button
                                    onClick={handleFinish}
                                    className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2"
                                >
                                    <span className="material-symbols-outlined">flag</span>
                                    Finalizar Juego
                                </button>
                            )}
                            {state.status !== 'PLAYING' && state.status !== 'WINNER' && (
                                <button
                                    onClick={handleStart}
                                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2"
                                >
                                    <span className="material-symbols-outlined">play_arrow</span>
                                    {state.status === 'REVIEW' ? 'Reanudar Juego' : 'Iniciar Juego'}
                                </button>
                            )}
                        </div>

                        {/* Winner Display */}
                        {state.status === 'WINNER' && state.winner && (
                            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-8 rounded-2xl text-center">
                                <h2 className="text-3xl font-bold mb-2">🎉 ¡Tenemos Ganador!</h2>
                                <p className="text-5xl font-black">{state.winner.player.name}</p>
                                <span className="inline-block mt-4 bg-white/20 px-4 py-2 rounded-full text-lg">
                                    {state.winner.type === 'BINGO' ? '¡BINGO COMPLETO!' : 'LÍNEA COMPLETADA'}
                                </span>
                            </div>
                        )}

                        {/* Review Queue */}
                        <section>
                            <h2 className="text-xl font-bold mb-4">Cola de Revisión</h2>
                            {pendingSubmissions.length === 0 ? (
                                <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300 text-gray-400">
                                    <span className="material-symbols-outlined text-4xl mb-2">inbox</span>
                                    <p>No hay envíos pendientes de revisión.</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {pendingSubmissions.map(sub => (
                                        <div key={sub.id} className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                                            <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                                                <div>
                                                    <h3 className="font-bold text-lg">{sub.player.name}</h3>
                                                    <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-medium">
                                                        {sub.card.isFullHouse ? '¡BINGO COMPLETO!' : 'LÍNEA COMPLETADA'}
                                                    </span>
                                                </div>
                                                <div className="text-sm text-gray-500">
                                                    {new Date(sub.submittedAt).toLocaleTimeString()}
                                                </div>
                                            </div>

                                            {/* Photos Grid */}
                                            <div className="p-4">
                                                <p className="text-sm text-gray-600 mb-3">Verifica las fotos:</p>
                                                <div className="grid grid-cols-3 gap-2">
                                                    {state.prompts.map(prompt => {
                                                        const cell = sub.card.cells[prompt.id];
                                                        return (
                                                            <div key={prompt.id} className={`relative aspect-square rounded-lg overflow-hidden ${cell?.photoUrl ? 'bg-gray-100' : 'bg-gray-50 border border-dashed border-gray-300'}`}>
                                                                {cell?.photoUrl ? (
                                                                    <>
                                                                        <img src={cell.photoUrl} className="w-full h-full object-cover" alt="Foto" />
                                                                        <div className="absolute bottom-0 left-0 w-full bg-black/60 text-white text-[10px] p-1 truncate">
                                                                            {prompt.text}
                                                                        </div>
                                                                    </>
                                                                ) : (
                                                                    <div className="flex items-center justify-center h-full text-gray-300">
                                                                        <span className="material-symbols-outlined">{prompt.icon}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                                                <button
                                                    onClick={() => handleReject(sub.id)}
                                                    className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg font-medium transition-colors"
                                                >
                                                    Rechazar
                                                </button>
                                                <button
                                                    onClick={() => handleApprove(sub.id)}
                                                    className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold shadow-md transform active:scale-95 transition-all flex items-center gap-2"
                                                >
                                                    <span className="material-symbols-outlined">check_circle</span>
                                                    Confirmar Ganador
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>
                    </div>
                )}
            </main>
        </div>
    );
};

export default BingoAdmin;
