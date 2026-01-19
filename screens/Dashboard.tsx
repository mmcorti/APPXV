
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, InvitationData } from '../types';

interface UsageSummary {
  events: { current: number; limit: number; display: string };
  guests: { current: number; limit: number; display: string };
  staffRoster: { current: number; limit: number; display: string };
  plan: string;
  aiFeatures: boolean;
}

interface DashboardProps {
  user: User;
  invitations: InvitationData[];
  onAddEvent: (event: InvitationData) => Promise<InvitationData>;
  onDeleteEvent: (eventId: string) => Promise<void>;
  onLogout: () => void;
  onRefresh: () => void;
  loading?: boolean;
}

const DashboardScreen: React.FC<DashboardProps> = ({ user, invitations, onAddEvent, onDeleteEvent, onLogout, onRefresh, loading }) => {
  const navigate = useNavigate();
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEventName, setNewEventName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [limitError, setLimitError] = useState<string | null>(null);

  // Fetch usage summary
  useEffect(() => {
    const fetchUsage = async () => {
      try {
        const res = await fetch(`/api/usage-summary?email=${encodeURIComponent(user.email)}&plan=${user.plan || 'freemium'}`);
        if (res.ok) {
          const data = await res.json();
          setUsage(data);
        }
      } catch (err) {
        console.error('Error fetching usage:', err);
      }
    };
    if (user.email) fetchUsage();
  }, [user.email, user.plan, invitations.length]);

  const canCreateEvent = !usage || usage.events.current < usage.events.limit;


  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventName.trim() || isCreating) return;

    // Check limits
    if (!canCreateEvent) {
      setLimitError(`Has alcanzado el límite de ${usage?.events.limit} eventos para tu plan ${usage?.plan}`);
      return;
    }

    setIsCreating(true);
    setLimitError(null);
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
    } catch (err: any) {
      if (err?.limitReached) {
        setLimitError(err.error || 'Límite de eventos alcanzado');
      } else {
        alert("Error al crear el evento. Intenta de nuevo.");
      }
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

  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);

  const handleDeleteEvent = async (inv: InvitationData) => {
    const guestCount = inv.guests?.length || 0;
    const tableCount = inv.tables?.length || 0;

    const confirmMessage = guestCount > 0 || tableCount > 0
      ? `¿Estás seguro de que quieres eliminar "${inv.eventName}"?\n\nEsto también eliminará:\n• ${guestCount} invitado(s)\n• ${tableCount} mesa(s)\n\nEsta acción no se puede deshacer.`
      : `¿Estás seguro de que quieres eliminar "${inv.eventName}"?\n\nEsta acción no se puede deshacer.`;

    if (!window.confirm(confirmMessage)) return;

    setDeletingEventId(inv.id);
    try {
      await onDeleteEvent(inv.id);
    } finally {
      setDeletingEventId(null);
    }
  };

  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-white pb-24 min-h-screen relative max-w-[480px] md:max-w-7xl mx-auto overflow-x-hidden">
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
            <button onClick={onRefresh} className="flex items-center justify-center size-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 transition-colors hover:bg-blue-50 hover:text-blue-500">
              <span className="material-symbols-outlined">refresh</span>
            </button>
            <button onClick={onLogout} className="flex items-center justify-center size-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-500">
              <span className="material-symbols-outlined">logout</span>
            </button>
            <button
              onClick={() => canCreateEvent ? setShowAddModal(true) : setLimitError(`Límite de eventos alcanzado (${usage?.events.display})`)}
              className={`flex items-center justify-center size-10 rounded-full shadow-lg transition-transform active:scale-90 ${canCreateEvent ? 'bg-primary text-white shadow-primary/20' : 'bg-slate-300 dark:bg-slate-600 text-slate-500 cursor-not-allowed'}`}
            >
              <span className="material-symbols-outlined">add</span>
            </button>
          </div>
        </div>
        {/* Usage Indicator */}
        {usage && user.role !== 'admin' && (
          <div className="mt-3 flex items-center gap-4 text-xs font-medium">
            <div className={`flex items-center gap-1 px-3 py-1.5 rounded-full ${usage.events.current >= usage.events.limit ? 'bg-red-100 dark:bg-red-900/30 text-red-600' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600'}`}>
              <span className="material-symbols-outlined text-sm">event</span>
              Eventos: {usage.events.display}
            </div>
            <div className="px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 capitalize">
              Plan: {usage.plan}
            </div>
          </div>
        )}
        {limitError && (
          <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 text-sm flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">warning</span>
            {limitError}
            <button onClick={() => setLimitError(null)} className="ml-auto">
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-6 px-4 mt-4">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-4 text-slate-400">
            <div className="size-12 rounded-full border-4 border-slate-200 border-t-primary animate-spin"></div>
            <p className="font-bold text-xs uppercase tracking-widest">Cargando eventos...</p>
          </div>
        ) : invitations.length > 0 ? (
          <div>
            {(user.role === 'admin' || user.role === 'subscriber') && (
              <div className="flex justify-end mb-4 gap-2">
                {user.role === 'admin' && (
                  <button
                    onClick={() => navigate('/subscribers')}
                    className="bg-white dark:bg-slate-800 text-slate-700 dark:text-gray-200 border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:border-purple-300 hover:text-purple-600 transition-colors shadow-sm text-sm font-semibold"
                  >
                    <span className="material-symbols-outlined text-lg">group_add</span>
                    Suscriptores
                  </button>
                )}
                <button
                  onClick={() => navigate('/staff-roster')}
                  className="bg-white dark:bg-slate-800 text-slate-700 dark:text-gray-200 border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm text-sm font-semibold"
                >
                  <span className="material-symbols-outlined text-lg">groups</span>
                  Mi Staff
                </button>
              </div>
            )}
            <h2 className="text-slate-900 dark:text-white text-lg font-bold mb-4 px-1">Tus Eventos</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                      <div className="flex gap-1">
                        <button
                          onClick={() => navigate(`/edit/${inv.id}`)}
                          className="p-2 rounded-xl bg-slate-50 dark:bg-slate-700 text-primary hover:bg-blue-50 transition-colors"
                        >
                          <span className="material-symbols-outlined text-xl">edit</span>
                        </button>
                        <button
                          onClick={() => handleDeleteEvent(inv)}
                          disabled={deletingEventId === inv.id}
                          className={`p-2 rounded-xl bg-slate-50 dark:bg-slate-700 text-red-500 hover:bg-red-50 transition-colors ${deletingEventId === inv.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <span className={`material-symbols-outlined text-xl ${deletingEventId === inv.id ? 'animate-spin' : ''}`}>
                            {deletingEventId === inv.id ? 'progress_activity' : 'delete'}
                          </span>
                        </button>
                      </div>
                    </div>

                    <div className={`grid gap-2 ${user.role === 'admin' ? 'grid-cols-5' : 'grid-cols-4'}`}>
                      <button
                        onClick={() => navigate(`/guests/${inv.id}`)}
                        disabled={(user.role === 'staff' || user.role === 'event_staff') && !(inv.permissions?.access_invitados || user.permissions?.access_invitados)}
                        className={`flex flex-col items-center justify-center gap-1 py-3 font-bold text-[10px] rounded-xl transition-all ${(user.role === 'staff' || user.role === 'event_staff') && !(inv.permissions?.access_invitados || user.permissions?.access_invitados)
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                          : 'bg-blue-50 dark:bg-blue-900/20 text-primary hover:scale-[0.98]'
                          }`}
                      >
                        <span className="material-symbols-outlined text-lg">groups</span>
                        Invitados
                      </button>
                      <button
                        onClick={() => navigate(`/tables/${inv.id}`)}
                        disabled={(user.role === 'staff' || user.role === 'event_staff') && !(inv.permissions?.access_mesas || user.permissions?.access_mesas)}
                        className={`flex flex-col items-center justify-center gap-1 py-3 font-bold text-[10px] rounded-xl transition-all ${(user.role === 'staff' || user.role === 'event_staff') && !(inv.permissions?.access_mesas || user.permissions?.access_mesas)
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                          : 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 hover:scale-[0.98]'
                          }`}
                      >
                        <span className="material-symbols-outlined text-lg">table_restaurant</span>
                        Mesas
                      </button>
                      <button
                        onClick={() => handleShareGeneralLink(inv)}
                        disabled={(user.role === 'staff' || user.role === 'event_staff') && !(inv.permissions?.access_link || user.permissions?.access_link)}
                        className={`flex flex-col items-center justify-center gap-1 py-3 font-bold text-[10px] rounded-xl transition-all ${(user.role === 'staff' || user.role === 'event_staff') && !(inv.permissions?.access_link || user.permissions?.access_link)
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                          : 'bg-primary text-white shadow-lg shadow-primary/20 active:scale-[0.98]'
                          }`}
                      >
                        <span className="material-symbols-outlined text-lg">share</span>
                        Link
                      </button>
                      <button
                        onClick={() => navigate(`/fotowall/${inv.id}`)}
                        disabled={(user.role === 'staff' || user.role === 'event_staff') && !(inv.permissions?.access_fotowall || user.permissions?.access_fotowall)}
                        className={`flex flex-col items-center justify-center gap-1 py-3 font-bold text-[10px] rounded-xl transition-all ${(user.role === 'staff' || user.role === 'event_staff') && !(inv.permissions?.access_fotowall || user.permissions?.access_fotowall)
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                          : 'bg-pink-50 dark:bg-pink-900/20 text-pink-600 hover:scale-[0.98]'
                          }`}
                      >
                        <span className="material-symbols-outlined text-lg">photo_library</span>
                        FotoWall
                      </button>
                      {(user.role === 'admin' || user.role === 'subscriber') && (
                        <button
                          onClick={() => navigate(`/event-staff/${inv.id}`)}
                          className="flex flex-col items-center justify-center gap-1 py-3 bg-teal-50 dark:bg-teal-900/20 text-teal-600 font-bold text-[10px] rounded-xl hover:scale-[0.98] transition-all"
                        >
                          <span className="material-symbols-outlined text-lg">badge</span>
                          Staff
                        </button>
                      )}
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
