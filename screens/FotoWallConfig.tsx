
import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { InvitationData } from '../types';

interface FotoWallConfigProps {
  invitations: InvitationData[];
}

const FotoWallConfigScreen: React.FC<FotoWallConfigProps> = ({ invitations }) => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const event = invitations.find(i => i.id === id);

  const [albumUrl, setAlbumUrl] = useState('');
  const [interval, setInterval] = useState(5);
  const [shuffle, setShuffle] = useState(false);
  const [prioritizeNew, setPrioritizeNew] = useState(true);

  if (!event) return null;

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
        <div className="px-6 flex-1 flex flex-col gap-8">
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
                  placeholder="https://photos.app.goo.gl/..."
                  className="flex-1 bg-slate-50 dark:bg-slate-900 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-pink-500 transition-all"
                />
                <button className="bg-pink-100 dark:bg-pink-900/30 text-pink-600 rounded-xl px-4 flex items-center justify-center">
                  <span className="material-symbols-outlined">link</span>
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-2">
                Pega el link de un álbum compartido para sincronizar fotos en tiempo real.
              </p>
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
                <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-medium">
                  <span>Rápido (3s)</span>
                  <span>Lento (30s)</span>
                </div>
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
              </div>

            </div>
          </section>

          {/* Preview Section (Mock) */}
          <section className="space-y-3">
            <div className="flex justify-between items-end">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Preview</h2>
              <span className="text-[10px] text-green-500 font-bold flex items-center gap-1">
                <span className="size-2 bg-green-500 rounded-full animate-pulse"></span>
                Link Verificado
              </span>
            </div>
            <div className="aspect-video bg-slate-900 rounded-2xl overflow-hidden relative shadow-lg group cursor-pointer border-2 border-transparent hover:border-pink-500/50 transition-all">
              <img
                src="https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80"
                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-700 group-hover:scale-105"
                alt="Preview"
              />

              {/* Mock UI Overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="size-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white">
                  <span className="material-symbols-outlined text-3xl">play_arrow</span>
                </div>
              </div>

              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                <p className="text-white text-xs font-bold text-center">Vista Previa del Proyector</p>
              </div>
            </div>
          </section>
        </div>

        {/* Action Button */}
        <div className="sticky bottom-0 p-6 bg-gradient-to-t from-background-light dark:from-background-dark via-background-light dark:via-background-dark to-transparent">
          <button
            onClick={() => navigate(`/fotowall-player/${id}`)}
            className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold h-14 rounded-2xl shadow-xl shadow-pink-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-2xl">rocket_launch</span>
            Lanzar Pantalla Completa
          </button>
        </div>

      </div>
    </div>
  );
};

export default FotoWallConfigScreen;
