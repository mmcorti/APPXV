
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { InvitationData } from '../types';

// Use the same API URL pattern as the rest of the app
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:10000/api';

interface FotoWallPlayerProps {
  invitations: InvitationData[];
}

const FotoWallPlayerScreen: React.FC<FotoWallPlayerProps> = ({ invitations }) => {
  const { id } = useParams<{ id: string }>();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const navigate = useNavigate();
  const location = useLocation();

  // Helper to get player config from localStorage
  const getPlayerConfig = () => {
    // First try player-specific key
    const playerKey = `fotowall_player_${id}`;
    const playerSaved = localStorage.getItem(playerKey);
    let playerConfig: any = {};
    if (playerSaved) {
      try {
        playerConfig = JSON.parse(playerSaved);
      } catch (e) {
        console.error("Error parsing saved player config:", e);
      }
    }

    // Also check config key for overlayTitle and other settings
    const configKey = `fotowall_config_${id}`;
    const configSaved = localStorage.getItem(configKey);
    let fullConfig: any = {};
    if (configSaved) {
      try {
        fullConfig = JSON.parse(configSaved);
      } catch (e) {
        console.error("Error parsing config:", e);
      }
    }

    // Merge both, with config taking precedence for shared keys
    const navState = location.state as any;
    return {
      url: playerConfig.url || fullConfig.albumUrl || navState?.url,
      interval: playerConfig.interval || fullConfig.interval || navState?.config?.interval || 5,
      shuffle: playerConfig.shuffle ?? fullConfig.shuffle ?? navState?.config?.shuffle ?? false,
      prioritizeNew: playerConfig.prioritizeNew ?? navState?.config?.prioritizeNew ?? true,
      moderationEnabled: playerConfig.moderationEnabled ?? navState?.config?.moderationEnabled ?? false,
      overlayTitle: fullConfig.overlayTitle || playerConfig.overlayTitle || ''
    };
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const event = invitations.find(i => i.id === id);

  // REACTIVE STATE - updates when localStorage changes
  const [albumUrl, setAlbumUrl] = useState(() => getPlayerConfig().url);
  const [intervalSeconds, setIntervalSeconds] = useState(() => getPlayerConfig().interval || 5);
  const [shuffle, setShuffle] = useState(() => getPlayerConfig().shuffle || false);
  const [overlayTitle, setOverlayTitle] = useState(() => getPlayerConfig().overlayTitle || '');

  const [photos, setPhotos] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showNewBadge, setShowNewBadge] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [moderationStats, setModerationStats] = useState<{ total: number, safe: number, blocked: number, pending: number } | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showControls, setShowControls] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);

  const intervalTime = intervalSeconds * 1000;

  // Get moderation settings from localStorage
  const getModerationSettings = () => {
    const key = `fotowall_moderation_settings_${id}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return { mode: 'ai', filters: {} };
      }
    }
    return { mode: 'ai', filters: {} }; // Default to AI mode
  };

  // Fetch photos helper
  const loadPhotos = useCallback(async () => {
    if (!albumUrl) return;
    try {
      // Always use moderated endpoint, it handles mode internally
      const endpoint = `${API_URL}/fotowall/album/moderated`;
      const currentSettings = getModerationSettings();

      console.log('[FotoWallPlayer] Loading photos with settings:', currentSettings);

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: albumUrl,
          moderationSettings: currentSettings
        })
      });
      const data = await res.json();

      console.log('[FotoWallPlayer] API Response:', data);

      // The moderated endpoint ALWAYS returns { photos: [], stats: {} }
      const photosArray = data.photos || [];

      if (data.stats) {
        setModerationStats(data.stats);
      }

      if (Array.isArray(photosArray)) {
        setPhotos(prev => {
          // Naive "New Photo" detection: if length increased
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
  }, [albumUrl, id]);


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

  if (isLoading || !currentPhoto) {
    return (
      <div className="bg-black w-screen h-screen flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="size-12 border-4 border-white/20 border-t-pink-500 rounded-full animate-spin"></div>
          <p className="animate-pulse font-bold">Cargando fotos...</p>
        </div>
      </div>
    )
  }

  // Block current photo
  const handleBlockPhoto = async () => {
    if (!currentPhoto || !albumUrl || isBlocking) return;
    setIsBlocking(true);
    try {
      await fetch(`${API_URL}/fotowall/block`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: albumUrl, photoId: currentPhoto.id })
      });
      // Remove from local list and advance
      setPhotos(prev => prev.filter(p => p.id !== currentPhoto.id));
      setCurrentIndex(prev => Math.min(prev, photos.length - 2));
    } catch (e) {
      console.error('Error blocking photo:', e);
    } finally {
      setIsBlocking(false);
      setShowControls(false);
    }
  };

  return (
    <div
      className="bg-black w-screen h-screen overflow-hidden relative flex items-center justify-center cursor-none"
      onMouseMove={() => { setShowControls(true); setTimeout(() => setShowControls(false), 3000); }}
      onClick={() => setShowControls(!showControls)}
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

        {/* Photo Count */}
        <div className="mb-4">
          <p className="text-white text-4xl font-bold">{photos.length}</p>
          <p className="text-white/60 text-xs">Fotos</p>
        </div>

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

      {/* Block Button (appears on mouse move/click) */}
      {showControls && (
        <div className="absolute top-6 right-6 z-50 animate-in fade-in slide-in-from-top-2 duration-300">
          <button
            onClick={(e) => { e.stopPropagation(); handleBlockPhoto(); }}
            disabled={isBlocking}
            className="bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-3 rounded-2xl shadow-lg shadow-red-600/40 flex items-center gap-2 transition-all active:scale-95"
          >
            {isBlocking ? (
              <span className="material-symbols-outlined text-xl animate-spin">refresh</span>
            ) : (
              <span className="material-symbols-outlined text-xl">block</span>
            )}
            <span>Bloquear Foto</span>
          </button>
        </div>
      )}

    </div>
  );
};

export default FotoWallPlayerScreen;
