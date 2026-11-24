
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { InvitationData } from '../types';

// Use the same API URL pattern as the rest of the app
const API_URL = import.meta.env.VITE_API_URL || '/api';

interface FotoWallPlayerProps {
  invitations: InvitationData[];
  user: any; // User type from App.tsx
}

const FotoWallPlayerScreen: React.FC<FotoWallPlayerProps> = ({ invitations, user }) => {
  const { id } = useParams<{ id: string }>();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const navigate = useNavigate();
  const location = useLocation();

  const eventFromProps = invitations.find(i => i.id === id);
  const [remoteEvent, setRemoteEvent] = useState<InvitationData | null>(null);
  const [configResolved, setConfigResolved] = useState<boolean>(Boolean(eventFromProps?.fotowall));
  const event = eventFromProps || remoteEvent || undefined;
  const plan = event?.ownerPlan || user?.plan || 'freemium';

  // Helper to get player config from event (DB) with localStorage/navState fallbacks
  const getPlayerConfig = useCallback((sourceEvent?: InvitationData) => {
    const navState = location.state as any;
    const fw = (sourceEvent || event)?.fotowall;

    const configKey = `fotowall_config_${id}`;
    const configSaved = localStorage.getItem(configKey);
    let localConfig: any = {};
    if (configSaved) {
      try { localConfig = JSON.parse(configSaved); } catch (e) { }
    }

    return {
      url: fw?.albumUrl || navState?.url || localConfig.albumUrl || '',
      interval: fw?.interval || navState?.config?.interval || localConfig.interval || 5,
      shuffle: fw?.shuffle ?? navState?.config?.shuffle ?? localConfig.shuffle ?? false,
      prioritizeNew: true,
      overlayTitle: fw?.overlayTitle || localConfig.overlayTitle || ''
    };
  }, [event, id, location.state]);

  // REACTIVE STATE - updates when event loads or localStorage changes
  const [albumUrl, setAlbumUrl] = useState(() => getPlayerConfig(eventFromProps).url);
  const [intervalSeconds, setIntervalSeconds] = useState(() => getPlayerConfig(eventFromProps).interval || 5);
  const [shuffle, setShuffle] = useState(() => getPlayerConfig(eventFromProps).shuffle || false);
  const [overlayTitle, setOverlayTitle] = useState(() => getPlayerConfig(eventFromProps).overlayTitle || '');

  const [photos, setPhotos] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showNewBadge, setShowNewBadge] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [moderationStats, setModerationStats] = useState<{ total: number, safe: number, blocked: number, pending: number } | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  const intervalTime = intervalSeconds * 1000;

  // Hydrate event directly from backend when opened standalone (e.g. TV / incognito without session)
  useEffect(() => {
    if (!id) {
      setConfigResolved(true);
      setIsLoading(false);
      return;
    }

    if (eventFromProps?.fotowall) {
      const cfg = getPlayerConfig(eventFromProps);
      setAlbumUrl(cfg.url);
      setIntervalSeconds(cfg.interval || 5);
      setShuffle(cfg.shuffle || false);
      setOverlayTitle(cfg.overlayTitle || '');
      setConfigResolved(true);
      return;
    }

    let cancelled = false;
    fetch(`${API_URL}/events/${id}`)
      .then(res => (res.ok ? res.json() : null))
      .then((fetched: InvitationData | null) => {
        if (cancelled) return;
        if (fetched) {
          setRemoteEvent(fetched);
          const cfg = getPlayerConfig(fetched);
          if (cfg.url) setAlbumUrl(cfg.url);
          if (cfg.interval) setIntervalSeconds(cfg.interval);
          setShuffle(cfg.shuffle || false);
          if (cfg.overlayTitle) setOverlayTitle(cfg.overlayTitle);
        }
      })
      .catch(err => console.warn('[FotoWallPlayer] Could not fetch event config:', err))
      .finally(() => {
        if (!cancelled) setConfigResolved(true);
      });

    return () => { cancelled = true; };
  }, [id, eventFromProps]);

  // Get moderation settings from event (DB) or localStorage
  const getModerationSettings = useCallback(() => {
    if (event?.fotowall) {
      return {
        mode: event.fotowall.mode,
        filters: event.fotowall.filters
      };
    }

    const key = `fotowall_moderation_settings_${id}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return { mode: 'manual', filters: {} };
      }
    }
    return { mode: 'manual', filters: {} };
  }, [event, id]);

  // Fetch photos helper
  const loadPhotos = useCallback(async () => {
    if (!albumUrl) {
      if (configResolved) setIsLoading(false);
      return;
    }
    try {
      const endpoint = `${API_URL}/fotowall/album/moderated`;
      const currentSettings = getModerationSettings();

      console.log('[FotoWallPlayer] Loading photos with settings:', currentSettings);

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: albumUrl,
          moderationSettings: currentSettings,
          plan: plan
        })
      });
      const data = await res.json();

      console.log('[FotoWallPlayer] API Response:', data);

      const photosArray = data.photos || [];

      if (data.stats) {
        setModerationStats(data.stats);
      }

      if (Array.isArray(photosArray)) {
        setPhotos(prev => {
          if (photosArray.length > prev.length && prev.length > 0) {
            setShowNewBadge(true);
          }
          return photosArray;
        });
      }
    } catch (e) {
      console.error("Polling error", e);
    } finally {
      setIsLoading(false);
    }
  }, [albumUrl, configResolved, getModerationSettings, plan]);


  // Initial load
  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

  // Listen for settings changes from config screen (in another tab)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      // Update reactive state when moderation settings, player config, or general config changes
      if (e.key === `fotowall_moderation_settings_${id}` ||
        e.key === `fotowall_player_${id}` ||
        e.key === `fotowall_config_${id}`) {
        console.log('[FotoWallPlayer] Settings changed, updating config...');

        // Re-read config and update state
        const newConfig = getPlayerConfig();
        if (newConfig.url) setAlbumUrl(newConfig.url);
        if (newConfig.interval) setIntervalSeconds(newConfig.interval);
        if (newConfig.shuffle !== undefined) setShuffle(newConfig.shuffle);
        if (newConfig.overlayTitle !== undefined) setOverlayTitle(newConfig.overlayTitle);

        // Reload photos with new settings
        loadPhotos();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [id, loadPhotos]);

  // Polling for new photos (every 20s)
  useEffect(() => {
    const poll = setInterval(() => {
      loadPhotos();
    }, 20000);
    return () => clearInterval(poll);
  }, [loadPhotos]);

  // Slideshow Logic
  useEffect(() => {
    if (photos.length === 0) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => {
        if (shuffle) {
          // Basic random (can be improved to avoid repeats)
          return Math.floor(Math.random() * photos.length);
        }
        return (prev + 1) % photos.length;
      });
      setShowNewBadge(false); // Reset badge
    }, intervalTime);

    return () => clearInterval(timer);
  }, [photos.length, intervalTime, shuffle]);


  // Full Screen & Controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // navigate(-1); 
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Clock update every minute
  useEffect(() => {
    const clockTimer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute
    return () => clearInterval(clockTimer);
  }, []);

  const currentPhoto = photos[currentIndex];

  if (isLoading) {
    return (
      <div className="bg-black w-screen h-screen flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="size-12 border-4 border-white/20 border-t-pink-500 rounded-full animate-spin"></div>
          <p className="animate-pulse font-bold">Cargando fotos...</p>
        </div>
      </div>
    );
  }

  if (!albumUrl || !currentPhoto) {
    return (
      <div className="bg-black w-screen h-screen flex items-center justify-center text-white p-8 text-center">
        <div className="flex flex-col items-center gap-4 max-w-md">
          <span className="material-symbols-outlined text-6xl text-pink-500/80">photo_library</span>
          <h2 className="text-2xl font-bold">
            {!albumUrl ? 'Álbum de FotoWall no configurado' : 'Esperando fotos del evento'}
          </h2>
          <p className="text-slate-400 text-sm">
            {!albumUrl
              ? 'Configurá el enlace de Google Photos desde el panel de FotoWall para mostrar la proyección en vivo.'
              : 'Todavía no hay fotos aprobadas en este álbum. La pantalla se actualizará automáticamente cada 20 segundos.'}
          </p>
        </div>
      </div>
    );
  }


  return (
    <div
      className="bg-black w-screen h-screen overflow-hidden relative flex items-center justify-center cursor-none"
    >

      {/* Background Blur Layer for Vertical/Aspect Ratio fill */}
      <div
        className="absolute inset-0 opacity-40 blur-3xl scale-110 transition-all duration-1000 ease-in-out"
        style={{
          backgroundImage: `url(${currentPhoto.src})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      ></div>

      {/* Main Photo Container */}
      <div className="relative z-10 w-full h-full p-4 md:p-8 flex items-center justify-center">
        <img
          key={currentPhoto.src + currentIndex} // Key forces re-mount for animation
          src={currentPhoto.src}
          alt="Slideshow"
          className="max-h-full max-w-full rounded-sm shadow-2xl object-contain animate-in fade-in zoom-in-95 duration-1000"
          style={{
            maxHeight: '95vh',
            maxWidth: '95vw'
          }}
        />
      </div>

      {/* "New Photo" Badge Overlay */}
      {showNewBadge && (
        <div className="absolute top-10 right-10 z-50 animate-bounce">
          <div className="bg-pink-600 text-white font-bold px-6 py-2 rounded-full shadow-lg shadow-pink-600/40 flex items-center gap-2 animate-pulse">
            <span className="material-symbols-outlined text-xl">star</span>
            <span>Nueva Foto!</span>
          </div>
        </div>
      )}

      {/* Event Branding Overlay (Bottom Left) */}
      <div className="absolute bottom-6 left-6 z-30 backdrop-blur-xl bg-black/60 px-6 py-5 rounded-3xl border border-white/10">
        {/* Title */}
        <h2 className="text-white text-2xl font-bold mb-0.5">{overlayTitle || event?.eventName || 'Fiesta'}</h2>
        <p className="text-white/70 text-xs font-medium flex items-center gap-2 mb-4">
          <span className="size-2 bg-green-500 rounded-full animate-pulse"></span>
          En Vivo
        </p>

        {/* Photo Count with Plan Limit */}
        {(() => {
          const PHOTO_LIMITS = { freemium: 20, premium: 200, vip: 1000 };
          const limit = PHOTO_LIMITS[plan] || 20;
          const nearLimit = photos.length >= limit * 0.8;
          return (
            <div className="mb-4">
              <p className="text-white text-4xl font-bold">
                {photos.length}
                <span className="text-lg text-white/50">/{limit}</span>
              </p>
              <p className="text-white/60 text-xs">Fotos</p>
              {nearLimit && plan !== 'vip' && (
                <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">warning</span>
                  {photos.length >= limit ? 'Límite alcanzado' : 'Cerca del límite'}
                </p>
              )}
            </div>
          );
        })()}

        {/* QR Code */}
        {albumUrl && (
          <div className="mb-4">
            <div className="bg-white p-2 rounded-lg inline-block">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(albumUrl)}`}
                alt="QR Code"
                className="w-16 h-16"
              />
            </div>
            <p className="text-white/60 text-[10px] mt-1">Scan to Upload</p>
          </div>
        )}

        {/* Time */}
        <p className="text-white text-lg font-bold">
          {currentTime.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: true })}
        </p>
      </div>


    </div>
  );
};

export default FotoWallPlayerScreen;
