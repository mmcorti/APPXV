
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { InvitationData } from '../types';

// Use the same API URL pattern as the rest of the app
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:10000/api';

interface FotoWallConfigProps {
  invitations: InvitationData[];
}

const FotoWallConfigScreen: React.FC<FotoWallConfigProps> = ({ invitations }) => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const event = invitations.find(i => i.id === id);

  // Storage key for this event's FotoWall config
  const storageKey = `fotowall_config_${id}`;

  const [albumUrl, setAlbumUrl] = useState('');
  const [interval, setInterval] = useState(5);
  const [shuffle, setShuffle] = useState(false);
  const [prioritizeNew, setPrioritizeNew] = useState(true);
  const [moderationEnabled, setModerationEnabled] = useState(true);

  // Real Data State
  const [isValidating, setIsValidating] = useState(false);
  const [linkStatus, setLinkStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [previewPhotos, setPreviewPhotos] = useState<any[]>([]);
  const [isPaused, setIsPaused] = useState(false);

  // Load saved config on mount
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const config = JSON.parse(saved);
        if (config.albumUrl) {
          setAlbumUrl(config.albumUrl);
          setLinkStatus('valid'); // Assume valid since it was saved before
          // Auto-fetch photos
          fetchPhotos(config.albumUrl);
        }
        if (config.interval) setInterval(config.interval);
        if (config.shuffle !== undefined) setShuffle(config.shuffle);
        if (config.prioritizeNew !== undefined) setPrioritizeNew(config.prioritizeNew);
        if (config.moderationEnabled !== undefined) setModerationEnabled(config.moderationEnabled);
      } catch (e) {
        console.error("Error loading saved config:", e);
      }
    }
    // Also save URL separately for admin panel access
    const urlKey = `fotowall_url_${id}`;
    const savedUrl = localStorage.getItem(urlKey);
    if (savedUrl && !albumUrl) {
      setAlbumUrl(savedUrl);
    }
  }, [id]);

  // Save config whenever it changes
  useEffect(() => {
    if (albumUrl && linkStatus === 'valid') {
      const config = { albumUrl, interval, shuffle, prioritizeNew, moderationEnabled };
      localStorage.setItem(storageKey, JSON.stringify(config));
      // Also save URL separately for admin panel
      localStorage.setItem(`fotowall_url_${id}`, albumUrl);
    }
  }, [albumUrl, interval, shuffle, prioritizeNew, moderationEnabled, linkStatus, id]);

  if (!event) return null;

  const validateLink = async (url: string) => {
    if (!url) return;
    setIsValidating(true);
    setLinkStatus('idle');
    setPreviewPhotos([]);

    try {
      const res = await fetch(`${API_URL}/fotowall/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await res.json();

      if (data.valid) {
        setLinkStatus('valid');
        setStatusMessage(`Link Verificado (${data.count} fotos)`);

        // Should prompt to load preview
        fetchPhotos(url);
      } else {
        setLinkStatus('invalid');
        setStatusMessage(data.message || 'Link inválido');
      }
    } catch (e) {
      setLinkStatus('invalid');
      setStatusMessage('Error de conexión');
    } finally {
      setIsValidating(false);
    }
  };

  const fetchPhotos = async (url: string) => {
    try {
      const res = await fetch(`${API_URL}/fotowall/album`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const photos = await res.json();
      if (Array.isArray(photos)) {
        setPreviewPhotos(photos);
      }
    } catch (e) {
      console.error("Failed to load preview photos");
    }
  }

  // Preview Carousel Logic
  const [currentPreviewIndex, setCurrentPreviewIndex] = useState(0);
  useEffect(() => {
    if (previewPhotos.length === 0 || isPaused) return;

    const timer = setInterval(() => {
      setCurrentPreviewIndex(prev => (prev + 1) % previewPhotos.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [previewPhotos, isPaused]);

  return (
    <div className="bg-background-light dark:bg-background-dark min-h-screen text-slate-900 dark:text-white font-display">
      <div className="max-w-[480px] mx-auto min-h-screen flex flex-col relative">
        {/* Header */}
        <div className="px-6 pt-8 pb-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-slate-500 dark:text-slate-400 font-bold text-sm mb-4 hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            Volver
          </button>

          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-purple-600">
            FotoWall
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Configura la presentación para {event.eventName}
          </p>
        </div>

        {/* Content */}
        <div className="px-6 flex-1 flex flex-col gap-8 pb-32">
          {/* Album Link Section */}
          <section className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Fuente de Fotos</h2>
            <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
              <label className="block text-xs font-bold text-slate-500 mb-2">Google Photos Album Link</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={albumUrl}
                  onChange={(e) => setAlbumUrl(e.target.value)}
                  onBlur={() => validateLink(albumUrl)}
                  placeholder="https://photos.app.goo.gl/..."
                  className={`flex-1 bg-slate-50 dark:bg-slate-900 border-2 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-pink-500 transition-all ${linkStatus === 'valid' ? 'border-green-500' :
                    linkStatus === 'invalid' ? 'border-red-500' : 'border-transparent'
                    }`}
                />
                <button
                  onClick={() => validateLink(albumUrl)}
                  className="bg-pink-100 dark:bg-pink-900/30 text-pink-600 rounded-xl px-4 flex items-center justify-center transition-colors hover:bg-pink-200 dark:hover:bg-pink-900/50"
                >
                  {isValidating ? (
                    <span className="material-symbols-outlined animate-spin">refresh</span>
                  ) : (
                    <span className="material-symbols-outlined">check_circle</span>
                  )}
                </button>
              </div>

              {/* Validation Feedback */}
              <div className="flex items-center gap-2 mt-2 h-5">
                {linkStatus === 'valid' && (
                  <span className="text-[10px] text-green-500 font-bold flex items-center gap-1 animate-in fade-in slide-in-from-top-1">
                    <span className="material-symbols-outlined text-sm">check</span>
                    {statusMessage}
                  </span>
                )}
                {linkStatus === 'invalid' && (
                  <span className="text-[10px] text-red-500 font-bold flex items-center gap-1 animate-in fade-in slide-in-from-top-1">
                    <span className="material-symbols-outlined text-sm">error</span>
                    {statusMessage}
                  </span>
                )}
                {linkStatus === 'idle' && (
                  <p className="text-[10px] text-slate-400">
                    Pega el link público para sincronizar.
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Controls Section */}
          <section className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Configuración</h2>
            <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 space-y-6">

              {/* Interval Control */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-bold">Intervalo</label>
                  <span className="text-xs font-bold text-pink-500 bg-pink-50 dark:bg-pink-900/20 px-2 py-1 rounded-lg">
                    {interval}s
                  </span>
                </div>
                <input
                  type="range"
                  min="3"
                  max="30"
                  step="1"
                  value={interval}
                  onChange={(e) => setInterval(parseInt(e.target.value))}
                  className="w-full accent-pink-500 h-2 bg-slate-100 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Toggles */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold">Orden Aleatorio</span>
                    <span className="text-[10px] text-slate-400">Mostrar fotos al azar</span>
                  </div>
                  <button
                    onClick={() => setShuffle(!shuffle)}
                    className={`w-12 h-7 rounded-full transition-colors relative ${shuffle ? 'bg-pink-500' : 'bg-slate-200 dark:bg-slate-700'}`}
                  >
                    <div className={`absolute top-1 size-5 bg-white rounded-full shadow-md transition-transform ${shuffle ? 'left-6' : 'left-1'}`}></div>
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold">Priorizar Nuevas</span>
                    <span className="text-[10px] text-slate-400">Insertar fotos recientes al instante</span>
                  </div>
                  <button
                    onClick={() => setPrioritizeNew(!prioritizeNew)}
                    className={`w-12 h-7 rounded-full transition-colors relative ${prioritizeNew ? 'bg-pink-500' : 'bg-slate-200 dark:bg-slate-700'}`}
                  >
                    <div className={`absolute top-1 size-5 bg-white rounded-full shadow-md transition-transform ${prioritizeNew ? 'left-6' : 'left-1'}`}></div>
                  </button>
                </div>

                {/* AI Moderation Settings */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                  <button
                    onClick={() => navigate(`/fotowall-moderation-settings/${id}`)}
                    className="w-full flex items-center justify-between py-2 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-colors -mx-2 px-2"
                  >
                    <div className="flex flex-col text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">Moderación de Contenido</span>
                        <span className="text-[8px] font-bold bg-gradient-to-r from-pink-500 to-purple-600 text-white px-1.5 py-0.5 rounded-full">AI</span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {(() => {
                          const saved = localStorage.getItem(`fotowall_moderation_settings_${id}`);
                          if (saved) {
                            const parsed = JSON.parse(saved);
                            if (parsed.mode === 'off') return 'Sin moderación';
                            if (parsed.mode === 'manual') return 'Moderación manual';
                            return 'Moderación IA activada';
                          }
                          return 'Configurar filtros';
                        })()}
                      </span>
                    </div>
                    <span className="material-symbols-outlined text-slate-400">chevron_right</span>
                  </button>
                </div>
              </div>

            </div>
          </section>

          {/* Preview Section */}
          <section className="space-y-3">
            <div className="flex justify-between items-end">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Preview</h2>
              {previewPhotos.length > 0 && (
                <button
                  onClick={() => setIsPaused(!isPaused)}
                  className="text-[10px] text-pink-500 font-bold hover:underline uppercase flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">{isPaused ? 'play_arrow' : 'pause'}</span>
                  {isPaused ? 'Reanudar' : 'Pausar'}
                </button>
              )}
            </div>
            <div className="aspect-video bg-slate-900 rounded-2xl overflow-hidden relative shadow-lg border border-slate-700">
              {previewPhotos.length > 0 ? (
                <>
                  <img
                    src={previewPhotos[currentPreviewIndex]?.src}
                    className="w-full h-full object-contain bg-black transition-opacity duration-300"
                    alt="Preview"
                    key={currentPreviewIndex} // Force fade
                  />
                  {/* Blur BG */}
                  <div
                    className="absolute inset-0 -z-10 blur-xl opacity-50 bg-center bg-cover"
                    style={{ backgroundImage: `url(${previewPhotos[currentPreviewIndex]?.src})` }}
                  />
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2">
                  <span className="material-symbols-outlined text-4xl">image_not_supported</span>
                  <p className="text-xs">Ingresa el link para ver las fotos</p>
                </div>
              )}

              <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent flex justify-between items-end">
                <p className="text-white text-[10px] font-bold">
                  {previewPhotos.length} fotos cargadas
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* Action Button */}
        <div className="sticky bottom-0 p-6 bg-gradient-to-t from-background-light dark:from-background-dark via-background-light dark:via-background-dark to-transparent space-y-3">
          {/* Admin Panel Link (only when moderation enabled and valid) */}
          {moderationEnabled && linkStatus === 'valid' && (
            <button
              onClick={() => navigate(`/fotowall-admin/${id}`, { state: { url: albumUrl } })}
              className="w-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold h-12 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <span className="material-symbols-outlined text-xl">shield</span>
              Panel de Moderación
            </button>
          )}

          <button
            onClick={() => {
              // Save config to localStorage so player can read it
              const playerConfig = { url: albumUrl, interval, shuffle, prioritizeNew, moderationEnabled };
              localStorage.setItem(`fotowall_player_${id}`, JSON.stringify(playerConfig));
              // Open player in new tab
              window.open(`/#/fotowall-player/${id}`, '_blank');
            }}
            disabled={linkStatus !== 'valid'}
            className={`w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold h-14 rounded-2xl shadow-xl shadow-pink-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 ${linkStatus !== 'valid' ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}
          >
            <span className="material-symbols-outlined text-2xl">rocket_launch</span>
            Lanzar Pantalla Completa
            <span className="material-symbols-outlined text-lg">open_in_new</span>
          </button>
        </div>

      </div>
    </div>
  );
};

export default FotoWallConfigScreen;
