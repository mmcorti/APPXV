
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { InvitationData } from '../types';

interface LocationScreenProps {
  invitations: InvitationData[];
}

const LocationScreen: React.FC<LocationScreenProps> = ({ invitations }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const invitation = invitations.find(inv => inv.id === id);

  if (!invitation) return <div className="p-10 text-center font-bold">No encontrado</div>;

  const openInGoogleMaps = () => {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(invitation.location)}`;
    window.open(url, '_blank');
  };

  const openInWaze = () => {
    // Waze deep link/web link
    const url = `https://waze.com/ul?q=${encodeURIComponent(invitation.location)}&navigate=yes`;
    window.open(url, '_blank');
  };

  return (
    <div className="bg-background-light dark:bg-background-dark min-h-screen pb-24 max-w-[480px] mx-auto overflow-x-hidden relative">
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-4 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <button onClick={() => navigate('/dashboard')} className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-base font-bold">Ubicación del Salón</h1>
        <div className="w-10"></div>
      </header>

      <div className="p-4 space-y-6">
        {/* Map Preview */}
        <div
          onClick={openInGoogleMaps}
          className="relative rounded-3xl overflow-hidden shadow-xl border border-slate-100 dark:border-slate-800 group cursor-pointer"
        >
          <img
            src={`https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?auto=format&fit=crop&q=80&w=800`}
            alt="Mapa Decorativo"
            className="w-full aspect-video object-cover transition-transform duration-700 group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent"></div>
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
            <div className="bg-white text-slate-900 px-4 py-2 rounded-full font-bold text-xs shadow-lg flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">open_in_new</span>
              Ver en el Mapa
            </div>
          </div>
          <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm p-2 rounded-xl shadow-lg border border-white/20 dark:border-slate-700 max-w-[90%]">
            <div className="size-8 bg-primary rounded-lg flex-shrink-0 flex items-center justify-center text-white">
              <span className="material-symbols-outlined text-sm">location_on</span>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Salón del Evento</p>
              <p className="text-xs font-bold truncate">{invitation.location}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-5">
          <div className="flex items-center gap-4">
            <div className="size-12 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-2xl">apartment</span>
            </div>
            <div>
              <h2 className="text-lg font-bold">Detalles del Lugar</h2>
              <p className="text-sm text-slate-500 font-medium">Información útil para tus invitados</p>
            </div>
          </div>

          <div className="space-y-4 pt-2">
            <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] uppercase font-bold text-slate-400">Dirección</p>
                <button
                  onClick={() => navigator.clipboard.writeText(invitation.location)}
                  className="text-[10px] font-bold text-primary hover:underline"
                >
                  COPIAR
                </button>
              </div>
              <p className="text-sm font-semibold">{invitation.location}</p>
            </div>

            {invitation.venueNotes && (
              <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Indicaciones Especiales</p>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400 leading-relaxed">
                  {invitation.venueNotes}
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={openInWaze}
              className="h-14 bg-[#33CCFF] text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-blue-400/20 active:scale-[0.98] transition-all"
            >
              <span className="material-symbols-outlined">explore</span>
              Waze
            </button>
            <button
              onClick={openInGoogleMaps}
              className="h-14 bg-white dark:bg-slate-700 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-600 font-bold rounded-2xl flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-all"
            >
              <span className="material-symbols-outlined">directions</span>
              Maps
            </button>
          </div>
        </div>

        {/* Info Card */}
        {invitation.arrivalTips && (
          <div className="bg-blue-50 dark:bg-blue-900/10 p-5 rounded-3xl border border-blue-100 dark:border-blue-900/30 flex gap-4">
            <div className="text-primary">
              <span className="material-symbols-outlined text-2xl">info</span>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-blue-200">Tips de llegada</p>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mt-1">
                {invitation.arrivalTips}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LocationScreen;
