
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { InvitationData } from '../types';

interface FotoWallPlayerProps {
  invitations: InvitationData[];
}

// Mock Data for Demo
const MOCK_PHOTOS = [
  'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80&w=1920', // Party
  'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&q=80&w=1920', // Wedding
  'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&q=80&w=1920', // DJ
  'https://images.unsplash.com/photo-1533174072545-e8d4aa97edf9?auto=format&fit=crop&q=80&w=1920', // Confetti
  'https://images.unsplash.com/photo-1545128485-c400e7702796?auto=format&fit=crop&q=80&w=1920', // Abstract
];

const FotoWallPlayerScreen: React.FC<FotoWallPlayerProps> = ({ invitations }) => {
  const { id } = useParams<{ id: string }>();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const navigate = useNavigate();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const event = invitations.find(i => i.id === id);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [showNewBadge, setShowNewBadge] = useState(false);
  const [photos, setPhotos] = useState(MOCK_PHOTOS);

  // Auto-play Logic
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % photos.length);
      setShowNewBadge(false); // Reset badge for next slide
    }, 5000); // 5s Interval for demo

    return () => clearInterval(interval);
  }, [photos.length]);

  // Mock "Polling" for new photos
  useEffect(() => {
    const pollInterval = setInterval(() => {
      // 20% chance to add a "new" photo (duplicating existing one for demo purpose)
      if (Math.random() > 0.8) {
        const randomPhoto = MOCK_PHOTOS[Math.floor(Math.random() * MOCK_PHOTOS.length)];
        setPhotos(prev => {
          // Insert "new" photo next in queue
          const nextIndex = (currentIndex + 1) % prev.length;
          const newPhotos = [...prev];
          newPhotos.splice(nextIndex, 0, randomPhoto);
          return newPhotos;
        });
        // Trigger badge logic on *next* slide transition (handled in render usually, but simple here)
        // Ideally we flagging the photo object itself as 'new'.
        // For demo visual, let's just show badge occasionally
        if (Math.random() > 0.5) setShowNewBadge(true);
      }
    }, 8000);

    return () => clearInterval(pollInterval);
  }, [currentIndex]);


  // Full Screen Toggle Handler (Double click to exit? or just ESC)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Optional: navigate back. Browsers handle standard exit fullscreen.
        // navigate(-1); 
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const currentPhoto = photos[currentIndex];

  return (
    <div className="bg-black w-screen h-screen overflow-hidden relative flex items-center justify-center">

      {/* Background Blur Layer for Vertical/Aspect Ratio fill */}
      <div
        className="absolute inset-0 opacity-50 blur-3xl scale-110 transition-all duration-1000 ease-in-out"
        style={{
          backgroundImage: `url(${currentPhoto})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      ></div>

      {/* Main Photo Container */}
      <div className="relative z-10 w-full h-full p-4 md:p-10 flex items-center justify-center animate-in fade-in zoom-in duration-700 key={currentIndex}">
        <img
          key={currentPhoto + currentIndex} // Force re-render for animation
          src={currentPhoto}
          alt="Slideshow"
          className="max-h-full max-w-full rounded-lg shadow-2xl object-contain animate-in fade-in duration-1000 slide-in-from-bottom-4"
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
      <div className="absolute bottom-8 left-8 z-30 opacity-80 backdrop-blur-sm bg-black/30 p-4 rounded-xl">
        <h2 className="text-white text-2xl font-bold">{event?.eventName || 'Fiesta'}</h2>
        <p className="text-white/70 text-sm">Escanea el QR para subir tu foto</p>
      </div>

      {/* QR Code Placeholder (Bottom Right) */}
      <div className="absolute bottom-8 right-8 z-30 bg-white p-2 rounded-xl shadow-xl">
        <div className="size-24 bg-slate-200 flex items-center justify-center">
          <span className="material-symbols-outlined text-4xl text-slate-400">qr_code_2</span>
        </div>
      </div>

    </div>
  );
};

export default FotoWallPlayerScreen;
