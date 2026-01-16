
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:10000/api';

const FotoWallAdminScreen: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const location = useLocation();

    // Get URL from state OR localStorage
    const stateUrl = location.state?.url;
    const storageKey = `fotowall_url_${id}`;
    const savedUrl = localStorage.getItem(storageKey);
    const url = stateUrl || savedUrl;

    const [blockedPhotos, setBlockedPhotos] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [showImages, setShowImages] = useState(false); // Toggle to reveal images
    const [expandedPhoto, setExpandedPhoto] = useState<string | null>(null); // For full preview modal

    const loadBlockedPhotos = async () => {
        if (!url) return;
        try {
            const res = await fetch(`${API_URL}/fotowall/blocked`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });
            const data = await res.json();
            setBlockedPhotos(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error("Error loading blocked photos:", e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadBlockedPhotos();
    }, [url]);

    const handleApprove = async (photoId: string) => {
        setActionLoading(photoId);
        try {
            await fetch(`${API_URL}/fotowall/approve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, photoId })
            });
            setBlockedPhotos(prev => prev.filter(p => p.id !== photoId));
            setExpandedPhoto(null);
        } catch (e) {
            console.error("Error approving photo:", e);
        } finally {
            setActionLoading(null);
        }
    };

    const handleBlock = async (photoId: string) => {
        setActionLoading(photoId);
        try {
            await fetch(`${API_URL}/fotowall/block`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, photoId })
            });
            setBlockedPhotos(prev => prev.filter(p => p.id !== photoId));
            setExpandedPhoto(null);
        } catch (e) {
            console.error("Error blocking photo:", e);
        } finally {
            setActionLoading(null);
        }
    };

    if (!url) {
        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white gap-4">
                <span className="material-symbols-outlined text-5xl text-red-500">error</span>
                <p className="text-lg font-bold">URL no proporcionada</p>
                <button
                    onClick={() => navigate(`/fotowall/${id}`)}
                    className="bg-pink-500 text-white px-6 py-2 rounded-xl font-bold"
                >
                    Ir a Configuración
                </button>
            </div>
        );
    }

    return (
        <div className="bg-background-light dark:bg-background-dark min-h-screen text-slate-900 dark:text-white font-display">
            <div className="max-w-[800px] mx-auto min-h-screen flex flex-col relative">
                {/* Header */}
                <div className="px-6 pt-8 pb-4">
                    <button
                        onClick={() => navigate(`/fotowall/${id}`)}
                        className="flex items-center gap-2 text-slate-500 dark:text-slate-400 font-bold text-sm mb-4 hover:text-primary transition-colors"
                    >
                        <span className="material-symbols-outlined text-lg">arrow_back</span>
                        Volver a Configuración
                    </button>

                    <div className="flex items-center gap-3">
                        <div className="size-12 bg-gradient-to-r from-pink-500 to-purple-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
                            <span className="material-symbols-outlined text-2xl">shield</span>
                        </div>
                        <div>
                            <h1 className="text-xl font-bold">Panel de Moderación</h1>
                            <p className="text-slate-500 dark:text-slate-400 text-sm">
                                Revisa y aprueba contenido bloqueado
                            </p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="px-6 flex-1 pb-8">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-20">
                            <span className="material-symbols-outlined text-4xl text-slate-300 animate-spin">refresh</span>
                        </div>
                    ) : blockedPhotos.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700">
                            <span className="material-symbols-outlined text-5xl text-green-500 mb-3">verified_user</span>
                            <h3 className="font-bold text-lg mb-1">Todo limpio</h3>
                            <p className="text-slate-500 dark:text-slate-400 text-sm text-center">
                                No hay fotos bloqueadas pendientes de revisión.
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center justify-between mb-4">
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    <span className="font-bold text-red-500">{blockedPhotos.length}</span> fotos bloqueadas
                                </p>
                                <div className="flex items-center gap-3">
                                    {/* Show/Hide toggle */}
                                    <button
                                        onClick={() => setShowImages(!showImages)}
                                        className={`text-xs font-bold flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors ${showImages
                                                ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                                                : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                                            }`}
                                    >
                                        <span className="material-symbols-outlined text-base">
                                            {showImages ? 'visibility_off' : 'visibility'}
                                        </span>
                                        {showImages ? 'Ocultar' : 'Mostrar'}
                                    </button>
                                    <button
                                        onClick={loadBlockedPhotos}
                                        className="text-xs font-bold text-pink-500 flex items-center gap-1 hover:underline"
                                    >
                                        <span className="material-symbols-outlined text-base">refresh</span>
                                        Actualizar
                                    </button>
                                </div>
                            </div>

                            {!showImages && (
                                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 mb-4 flex items-start gap-3">
                                    <span className="material-symbols-outlined text-amber-500">warning</span>
                                    <p className="text-xs text-amber-700 dark:text-amber-300">
                                        Las imágenes están ocultas por seguridad. Haz clic en "Mostrar" para ver las fotos bloqueadas y poder decidir si aprobarlas.
                                    </p>
                                </div>
                            )}

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                {blockedPhotos.map(photo => (
                                    <div key={photo.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden">
                                        {/* Image preview */}
                                        <div
                                            className="aspect-square relative cursor-pointer"
                                            onClick={() => showImages && setExpandedPhoto(photo.id)}
                                        >
                                            <img
                                                src={photo.src}
                                                alt="Blocked"
                                                className={`w-full h-full object-cover transition-all ${showImages ? '' : 'blur-xl brightness-50'
                                                    }`}
                                            />
                                            {!showImages && (
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <div className="bg-red-500/80 text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-sm">block</span>
                                                        Bloqueado
                                                    </div>
                                                </div>
                                            )}
                                            {showImages && (
                                                <div className="absolute top-2 right-2">
                                                    <span className="bg-red-500 text-white text-[8px] font-bold px-2 py-1 rounded-full">
                                                        Bloqueado
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Labels */}
                                        <div className="p-3 space-y-2">
                                            <div className="flex flex-wrap gap-1">
                                                {photo.moderation?.labels?.map((label: string, idx: number) => (
                                                    <span key={idx} className="text-[8px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded-full">
                                                        {label}
                                                    </span>
                                                ))}
                                            </div>

                                            {/* Actions */}
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleApprove(photo.id)}
                                                    disabled={actionLoading === photo.id}
                                                    className="flex-1 bg-green-500 text-white text-xs font-bold py-2 rounded-xl flex items-center justify-center gap-1 hover:bg-green-600 transition-colors disabled:opacity-50"
                                                >
                                                    {actionLoading === photo.id ? (
                                                        <span className="material-symbols-outlined text-sm animate-spin">refresh</span>
                                                    ) : (
                                                        <>
                                                            <span className="material-symbols-outlined text-sm">check</span>
                                                            Aprobar
                                                        </>
                                                    )}
                                                </button>
                                                <button
                                                    onClick={() => handleBlock(photo.id)}
                                                    disabled={actionLoading === photo.id}
                                                    className="flex-1 bg-red-500 text-white text-xs font-bold py-2 rounded-xl flex items-center justify-center gap-1 hover:bg-red-600 transition-colors disabled:opacity-50"
                                                >
                                                    <span className="material-symbols-outlined text-sm">delete</span>
                                                    Eliminar
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Expanded Photo Modal */}
            {expandedPhoto && (
                <div
                    className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
                    onClick={() => setExpandedPhoto(null)}
                >
                    <div className="max-w-4xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <img
                            src={blockedPhotos.find(p => p.id === expandedPhoto)?.src}
                            alt="Preview"
                            className="w-full h-auto max-h-[70vh] object-contain rounded-2xl"
                        />
                        <div className="flex gap-4 mt-4 justify-center">
                            <button
                                onClick={() => handleApprove(expandedPhoto)}
                                disabled={actionLoading === expandedPhoto}
                                className="bg-green-500 text-white font-bold py-3 px-8 rounded-xl flex items-center gap-2 hover:bg-green-600 transition-colors disabled:opacity-50"
                            >
                                <span className="material-symbols-outlined">check</span>
                                Aprobar
                            </button>
                            <button
                                onClick={() => handleBlock(expandedPhoto)}
                                disabled={actionLoading === expandedPhoto}
                                className="bg-red-500 text-white font-bold py-3 px-8 rounded-xl flex items-center gap-2 hover:bg-red-600 transition-colors disabled:opacity-50"
                            >
                                <span className="material-symbols-outlined">delete</span>
                                Eliminar
                            </button>
                            <button
                                onClick={() => setExpandedPhoto(null)}
                                className="bg-slate-600 text-white font-bold py-3 px-8 rounded-xl flex items-center gap-2 hover:bg-slate-700 transition-colors"
                            >
                                <span className="material-symbols-outlined">close</span>
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FotoWallAdminScreen;

