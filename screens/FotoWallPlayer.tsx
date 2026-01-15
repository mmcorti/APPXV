
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { InvitationData } from '../types';

interface FotoWallPlayerProps {
  invitations: InvitationData[];
}

const FotoWallPlayerScreen: React.FC<FotoWallPlayerProps> = ({ invitations }) => {
  const { id } = useParams<{ id: string }>();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const navigate = useNavigate();
  const location = useLocation();
  const { url: initialUrl, config } = location.state || {}; // Get URL passed from config

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const event = invitations.find(i => i.id === id);

  const [photos, setPhotos] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showNewBadge, setShowNewBadge] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const intervalTime = (config?.interval || 5) * 1000;

  // Fetch photos helper
  const loadPhotos = useCallback(async () => {
    if (!initialUrl) return;
    try {
      const res = await fetch('/api/fotowall/album', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: initialUrl })
      });
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setPhotos(prev => {
          // Naive "New Photo" detection: if length increased
          if (data.length > prev.length && prev.length > 0) {
            setShowNewBadge(true); // Will show on *next* cycle potentially
            // If we want to jump to new photo immediately, logic would be complex with shuffle
            // For now, just updating the list is enough, shuffle/cycle handles it
          }
          return data;
        });
      }
    } catch (e) {
      console.error("Polling error", e);
    } finally {
      setIsLoading(false);
    }
  }, [initialUrl]);


  // Initial load
  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

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
        if (config?.shuffle) {
          // Basic random (can be improved to avoid repeats)
          return Math.floor(Math.random() * photos.length);
        }
        return (prev + 1) % photos.length;
      });
      setShowNewBadge(false); // Reset badge
    }, intervalTime);

    return () => clearInterval(timer);
  }, [photos.length, intervalTime, config?.shuffle]);


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

  return (
    <div className="bg-black w-screen h-screen overflow-hidden relative flex items-center justify-center cursor-none">

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
      <div className="absolute bottom-10 left-10 z-30 opacity-60 backdrop-blur-md bg-black/40 p-6 rounded-3xl border border-white/10">
        <h2 className="text-white text-3xl font-bold mb-1">{event?.eventName || 'Fiesta'}</h2>
        <p className="text-white/70 text-sm font-medium flex items-center gap-2">
          <span className="size-2 bg-green-500 rounded-full animate-pulse"></span>
          En Vivo
        </p>
      </div>

      {/* QR Code Placeholder (Bottom Right) */}
      {/* 
         <div className="absolute bottom-8 right-8 z-30 bg-white p-2 rounded-xl shadow-xl">
             <div className="size-24 bg-slate-200 flex items-center justify-center">
                 <span className="material-symbols-outlined text-4xl text-slate-400">qr_code_2</span>
             </div>
        </div>
        */}

    </div>
  );
};

export default FotoWallPlayerScreen;
