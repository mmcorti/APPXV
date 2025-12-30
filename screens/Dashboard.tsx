
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, InvitationData } from '../types';

interface DashboardProps {
  user: User;
  invitations: InvitationData[];
  onAddEvent: (event: InvitationData) => Promise<InvitationData>;
  onLogout: () => void;
}

const DashboardScreen: React.FC<DashboardProps> = ({ user, invitations, onAddEvent, onLogout }) => {
  const navigate = useNavigate();
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEventName, setNewEventName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventName.trim() || isCreating) return;

    setIsCreating(true);
    const tempEvent: InvitationData = {
      id: Date.now().toString(),
      eventName: newEventName,
      hostName: user.name,
      date: new Date().toISOString().split('T')[0],
      time: '20:00',
      location: '',
      image: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&q=80&w=800',
      message: '¡Estás invitado a mi evento!',
      giftType: 'alias',
      giftDetail: '',
      guests: [],
      tables: []
    };

    try {
      const createdEvent = await onAddEvent(tempEvent);
      setNewEventName('');
      setShowAddModal(false);
      navigate(`/edit/${createdEvent.id}`);
    } catch (err) {
      alert("Error al crear el evento. Intenta de nuevo.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleShareGeneralLink = async (inv: InvitationData) => {
    const url = `${window.location.origin}${window.location.pathname}#/rsvp/${inv.id}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: inv.eventName,
          text: `¡Estás invitado a ${inv.eventName}!`,
          url: url
        });
      } catch (err) {
        console.log('Error sharing:', err);
      }
    } else {
      navigator.clipboard.writeText(url);
      alert('¡Link de invitación copiado!');
    }
  };

  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-white pb-24 min-h-screen relative max-w-[480px] mx-auto overflow-x-hidden">
      <div className="sticky top-0 z-40 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md px-4 pt-6 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="bg-center bg-no-repeat bg-cover rounded-full size-12 border-2 border-white dark:border-slate-700 shadow-sm" style={{ backgroundImage: `url(${user.avatar})` }}></div>
              <div className="absolute bottom-0 right-0 size-3 bg-green-500 border-2 border-white dark:border-background-dark rounded-full"></div>
            </div>
            <div>
              <p className="text-slate-500 dark:text-slate-400 text-xs font-medium leading-none mb-1">¡Hola,</p>
              <h2 className="text-slate-900 dark:text-white text-lg font-bold leading-none">{user.name}!</h2>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={onLogout} className="flex items-center justify-center size-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-500">
              <span className="material-symbols-outlined">logout</span>
            </button>
            <button onClick={() => setShowAddModal(true)} className="flex items-center justify-center size-10 rounded-full bg-primary text-white shadow-lg shadow-primary/20 transition-transform active:scale-90">
              <span className="material-symbols-outlined">add</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6 px-4 mt-4">
        {invitations.length > 0 ? (
          <div>
            <h2 className="text-slate-900 dark:text-white text-lg font-bold mb-4 px-1">Tus Eventos</h2>
            <div className="flex flex-col gap-4">
              {invitations.map((inv) => (
                <div
                  key={inv.id}
                  className="relative overflow-hidden rounded-3xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm"
                >
                  <div className="p-5">
                    <div className="flex justify-between items-start mb-4">
                      <div className="min-w-0">
                        <h3 className="text-xl font-bold tracking-tight truncate">{inv.eventName}</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm flex items-center gap-1">
                          <span className="material-symbols-outlined text-base">calendar_month</span>
                          {inv.date}
                        </p>
                      </div>
                      <button
                        onClick={() => navigate(`/edit/${inv.id}`)}
                        className="p-2 rounded-xl bg-slate-50 dark:bg-slate-700 text-primary"
                      >
                        <span className="material-symbols-outlined text-xl">edit</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => navigate(`/guests/${inv.id}`)}
                        className="flex flex-col items-center justify-center gap-1 py-3 bg-blue-50 dark:bg-blue-900/20 text-primary font-bold text-[10px] rounded-xl"
                      >
                        <span className="material-symbols-outlined text-lg">groups</span>
                        Invitados
                      </button>
                      <button
                        onClick={() => navigate(`/tables/${inv.id}`)}
                        className="flex flex-col items-center justify-center gap-1 py-3 bg-purple-50 dark:bg-purple-900/20 text-purple-600 font-bold text-[10px] rounded-xl"
                      >
                        <span className="material-symbols-outlined text-lg">table_restaurant</span>
                        Mesas
                      </button>
                      <button
                        onClick={() => handleShareGeneralLink(inv)}
                        className="flex flex-col items-center justify-center gap-1 py-3 bg-primary text-white font-bold text-[10px] rounded-xl shadow-lg shadow-primary/20 active:scale-[0.98] transition-all"
                      >
                        <span className="material-symbols-outlined text-lg">share</span>
                        Link
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="py-12 text-center">
            <div className="size-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-400 mx-auto mb-4">
              <span className="material-symbols-outlined text-4xl">event_busy</span>
            </div>
            <p className="text-slate-500 font-medium">No tienes eventos creados</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-4 text-primary font-bold hover:underline"
            >
              Crea tu primer evento ahora
            </button>
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-300">
            <form onSubmit={handleCreateEvent} className="p-6 space-y-5">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-bold">Nuevo Evento</h3>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="size-8 flex items-center justify-center rounded-full bg-slate-50 dark:bg-slate-900 text-slate-400"
                >
                  <span className="material-symbols-outlined text-xl">close</span>
                </button>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre del Evento</label>
                <input
                  autoFocus
                  required
                  type="text"
                  value={newEventName}
                  onChange={(e) => setNewEventName(e.target.value)}
                  className="w-full rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white focus:ring-primary focus:border-primary p-4"
                  placeholder="Ej: Boda de Elena & Marco"
                />
              </div>
              <button
                type="submit"
                disabled={isCreating}
                className={`w-full h-14 bg-primary text-white font-bold rounded-2xl shadow-lg shadow-primary/20 active:scale-[0.98] transition-all ${isCreating ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {isCreating ? 'Creando...' : 'Crear y Personalizar'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardScreen;
