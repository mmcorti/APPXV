
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { User, InvitationData } from '../types';
import { UpgradePrompt } from '../components/UpgradePrompt';
import { usePlan, PLANS_FE } from '../hooks/usePlan';

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
  const { currentPlan, limits } = usePlan(); // Use hook for normalized plan

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
    <div className="min-h-screen bg-slate-950 text-white font-display overflow-x-hidden relative">
      {/* Visual background accents */}
      <div className="fixed top-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="fixed bottom-[-10%] left-[-10%] w-[60%] h-[60%] bg-purple-600/5 blur-[140px] rounded-full pointer-events-none"></div>

      {/* HEADER NAVBAR */}
      <header className="sticky top-0 z-40 bg-slate-950/60 backdrop-blur-xl border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative"
          >
            <div className="absolute inset-0 bg-primary/20 blur-lg rounded-full animate-pulse"></div>
            <img src={user.avatar} className="relative z-10 size-12 rounded-full border-2 border-white/10 shadow-xl object-cover" alt={user.name} />
          </motion.div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest leading-none opacity-50">Event Manager</p>
              <div className={`
                px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter border
                ${currentPlan === PLANS_FE.FREE ? 'bg-slate-500/10 text-slate-400 border-slate-500/20' :
                  currentPlan === PLANS_FE.PREMIUM ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                    currentPlan === PLANS_FE.VIP ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                      'bg-purple-500/10 text-purple-400 border-purple-500/20'}
              `}>
                {currentPlan === PLANS_FE.FREE ? 'Free' :
                  currentPlan === PLANS_FE.PREMIUM ? 'Premium' :
                    currentPlan === PLANS_FE.VIP ? 'VIP' : 'Honor'}
              </div>
            </div>
            <h2 className="text-white text-lg font-black italic tracking-tight leading-none truncate max-w-[150px]">{user.name}</h2>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <motion.img
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            src="/logo.png"
            className="h-6 w-auto hidden md:block mr-4 grayscale brightness-200"
            alt="APPXV Watermark"
          />

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onRefresh}
            className="flex items-center justify-center size-10 rounded-2xl bg-white/5 border border-white/10 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <span className="material-symbols-outlined text-xl">refresh</span>
          </motion.button>

          {user.role !== 'admin' && user.role !== 'staff' && user.role !== 'event_staff' && user.plan !== 'vip' && (
            <motion.button
              whileHover={{ scale: 1.05, translateY: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/login')} // Redirect to login to re-evaluate plan if they buy
              className={`hidden sm:flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${currentPlan === PLANS_FE.FREE
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-[0_10px_20px_rgba(139,92,246,0.3)]'
                : 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-[0_10px_20px_rgba(245,158,11,0.3)]'
                }`}
            >
              <span className="material-symbols-outlined text-[16px]">stars</span>
              {currentPlan === PLANS_FE.FREE ? 'Mejorar a Premium' : 'Mejorar a VIP'}
            </motion.button>
          )}

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onLogout}
            className="flex items-center justify-center size-10 rounded-2xl bg-white/5 border border-white/10 text-red-400/70 transition-colors hover:bg-red-500/10 hover:text-red-400"
          >
            <span className="material-symbols-outlined text-xl">logout</span>
          </motion.button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <AnimatePresence>
          {usage && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-8 space-y-4"
            >
              {/* Show prompts for events if limit reached */}
              {usage.events.current >= usage.events.limit && (
                <UpgradePrompt
                  resourceName="eventos"
                  currentCount={usage.events.current}
                  limit={usage.events.limit}
                />
              )}
              {/* General upgrade teaser for free users */}
              {currentPlan === PLANS_FE.FREE && usage && usage.events.current < usage.events.limit && (
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-[40px] p-8 text-white shadow-2xl flex items-center justify-between border border-white/10">
                  <div>
                    <h3 className="font-bold text-xl mb-1 tracking-tight">Mejora tu experiencia</h3>
                    <p className="text-sm text-blue-100/80">Accede a IA, más invitados y herramientas premium.</p>
                  </div>
                  <button onClick={() => navigate('/prices')} className="bg-white text-blue-600 px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-lg hover:shadow-xl transition-all">Ver Planes</button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {limitError && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm flex items-center gap-3 backdrop-blur-md"
          >
            <span className="material-symbols-outlined">warning</span>
            <span className="font-bold tracking-tight">{limitError}</span>
            <button onClick={() => setLimitError(null)} className="ml-auto hover:text-white transition-colors">
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </motion.div>
        )}

        {loading ? (
          <div className="py-32 flex flex-col items-center justify-center gap-6">
            <div className="size-16 rounded-3xl border-4 border-white/5 border-t-primary animate-spin shadow-[0_0_30px_rgba(19,91,236,0.2)]"></div>
            <p className="font-black text-[11px] uppercase tracking-[0.3em] text-slate-500 animate-pulse">Sincronizando eventos...</p>
          </div>
        ) : (
          <div className="space-y-10">
            {/* ACTION CENTER */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-1">
              <div>
                <h1 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter mb-2">Tus <span className="text-primary italic">Eventos</span></h1>
                <p className="text-slate-500 font-medium">Gestioná y personalizá cada detalle de tus celebraciones.</p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {(user.role === 'admin' || user.role === 'subscriber') && (
                  <>
                    {user.role === 'admin' && (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => navigate('/subscribers')}
                        className="bg-white/5 hover:bg-white/10 text-white border border-white/10 px-6 py-3 rounded-2xl flex items-center gap-2 transition-all shadow-xl backdrop-blur-md text-xs font-black uppercase tracking-widest"
                      >
                        <span className="material-symbols-outlined text-[18px] text-purple-400">group_add</span>
                        Suscriptores
                      </motion.button>
                    )}
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => navigate('/staff-roster')}
                      className="bg-white/5 hover:bg-white/10 text-white border border-white/10 px-6 py-3 rounded-2xl flex items-center gap-2 transition-all shadow-xl backdrop-blur-md text-xs font-black uppercase tracking-widest"
                    >
                      <span className="material-symbols-outlined text-[18px] text-emerald-400">groups</span>
                      Mi Staff
                    </motion.button>
                  </>
                )}

                {user.role !== 'staff' && user.role !== 'event_staff' && (
                  <motion.button
                    whileHover={{ scale: 1.05, translateY: -2 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => canCreateEvent ? setShowAddModal(true) : setLimitError(`Límite de eventos alcanzado (${usage?.events.display})`)}
                    className={`flex items-center gap-2 px-8 py-3.5 rounded-[20px] shadow-2xl transition-all text-[11px] font-black uppercase tracking-widest ${canCreateEvent
                      ? 'bg-primary text-white shadow-primary/30 hover:shadow-primary/50'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'}`}
                  >
                    <span className="material-symbols-outlined text-[18px]">add_circle</span>
                    Nuevo Evento
                  </motion.button>
                )}
              </div>
            </div>

            {/* EVENTS GRID */}
            <AnimatePresence mode="popLayout">
              {invitations.length > 0 ? (
                <motion.div
                  initial="hidden"
                  animate="visible"
                  variants={{
                    visible: { transition: { staggerChildren: 0.1 } }
                  }}
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
                >
                  {invitations.map((inv) => (
                    <motion.div
                      variants={{
                        hidden: { opacity: 0, scale: 0.9, y: 20 },
                        visible: { opacity: 1, scale: 1, y: 0 }
                      }}
                      key={inv.id}
                      className="group relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-[40px] overflow-hidden hover:border-white/20 transition-all duration-500 shadow-2xl"
                    >
                      {/* Event Banner Image (Subtle) */}
                      <div className="absolute top-0 left-0 w-full h-32 opacity-20 group-hover:opacity-30 transition-opacity pointer-events-none">
                        <img src={inv.image} className="w-full h-full object-cover" alt="" />
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-900"></div>
                      </div>

                      <div className="relative z-10 p-8 pt-10">
                        <div className="flex justify-between items-start mb-8">
                          <div className="min-w-0">
                            <h3 className="text-2xl font-black italic tracking-tighter uppercase mb-1 drop-shadow-lg text-white group-hover:text-primary transition-colors leading-tight">{inv.eventName}</h3>
                            <div className="flex items-center gap-2 text-slate-400">
                              <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest bg-white/5 px-2 py-1 rounded-lg border border-white/5">
                                <span className="material-symbols-outlined text-[14px]">calendar_month</span>
                                {inv.date}
                              </span>
                              <span className="text-[10px] font-black uppercase tracking-widest opacity-40">{inv.time}</span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {user.role !== 'staff' && user.role !== 'event_staff' && (
                              <motion.button
                                whileHover={{ scale: 1.1, rotate: -5 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => navigate(`/edit/${inv.id}`)}
                                className="p-3 rounded-2xl bg-white/5 border border-white/10 text-primary hover:bg-primary/10 transition-all"
                                title="Editar Evento"
                              >
                                <span className="material-symbols-outlined text-xl italic font-black">edit_note</span>
                              </motion.button>
                            )}
                            {user.role !== 'staff' && user.role !== 'event_staff' && (
                              <motion.button
                                whileHover={{ scale: 1.1, rotate: 5 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => handleDeleteEvent(inv)}
                                disabled={deletingEventId === inv.id}
                                className={`p-3 rounded-2xl bg-white/5 border border-white/10 text-red-400 hover:bg-red-400/10 transition-all ${deletingEventId === inv.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                                title="Eliminar Evento"
                              >
                                <span className={`material-symbols-outlined text-xl ${deletingEventId === inv.id ? 'animate-spin' : ''}`}>
                                  {deletingEventId === inv.id ? 'progress_activity' : 'delete_sweep'}
                                </span>
                              </motion.button>
                            )}
                          </div>
                        </div>

                        {/* ACCESS BUTTONS GRID */}
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            { label: 'Invitados', icon: 'groups', color: 'text-blue-400', bg: 'bg-blue-400/10', path: `/guests/${inv.id}`, perm: inv.permissions?.access_invitados || user.permissions?.access_invitados },
                            { label: 'Mesas', icon: 'table_restaurant', color: 'text-purple-400', bg: 'bg-purple-400/10', path: `/tables/${inv.id}`, perm: inv.permissions?.access_mesas || user.permissions?.access_mesas },
                            { label: 'Link', icon: 'send', color: 'text-indigo-400', bg: 'bg-primary', path: 'share', perm: inv.permissions?.access_link || user.permissions?.access_link },
                            { label: 'FotoWall', icon: 'photo_size_select_actual', color: 'text-pink-400', bg: 'bg-pink-400/10', path: `/fotowall/${inv.id}`, perm: inv.permissions?.access_fotowall || user.permissions?.access_fotowall },
                            { label: 'Juegos', icon: 'videogame_asset', color: 'text-orange-400', bg: 'bg-orange-400/10', path: `/games/${inv.id}`, perm: inv.permissions?.access_games || user.permissions?.access_games },
                            { label: 'Gestión', icon: 'more_horiz', color: 'text-slate-400', bg: 'bg-white/5', path: 'more', perm: !(user.role === 'staff' || user.role === 'event_staff') }
                          ].map((btn, idx) => {
                            const isAction = btn.path === 'share' || btn.path === 'more';
                            const disabled = (user.role === 'staff' || user.role === 'event_staff') && btn.perm === false;

                            return (
                              <motion.button
                                key={idx}
                                whileHover={!disabled ? { scale: 1.05, y: -2 } : {}}
                                whileTap={!disabled ? { scale: 0.95 } : {}}
                                onClick={() => {
                                  if (btn.path === 'share') handleShareGeneralLink(inv);
                                  else if (btn.path === 'more') navigate(`/edit/${inv.id}`);
                                  else navigate(btn.path);
                                }}
                                disabled={disabled}
                                className={`group/btn flex flex-col items-center justify-center gap-2 py-4 rounded-[28px] transition-all relative overflow-hidden active:scale-95 ${disabled
                                  ? 'bg-white/5 text-slate-600 grayscale cursor-not-allowed opacity-50'
                                  : btn.bg === 'bg-primary'
                                    ? 'bg-primary text-white shadow-xl shadow-primary/20 active:bg-primary/80'
                                    : `${btn.bg} ${btn.color} border border-white/5 hover:border-white/10 active:opacity-70`
                                  }`}
                              >
                                {btn.bg === 'bg-primary' && (
                                  <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none"></div>
                                )}
                                <span className="material-symbols-outlined text-[22px] icon-filled">{btn.icon}</span>
                                <span className={`text-[9px] font-black uppercase tracking-widest ${btn.bg === 'bg-primary' ? 'text-white/80' : 'text-slate-500 group-hover/btn:text-white transition-colors'}`}>{btn.label}</span>
                              </motion.button>
                            );
                          })}
                        </div>

                        {/* BOTTOM STAFF/COSTS MINI BUTTONS */}
                        {(user.role === 'admin' || user.role === 'subscriber') && (
                          <div className="grid grid-cols-2 gap-3 mt-3">
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => navigate(`/event-staff/${inv.id}`)}
                              className="flex items-center justify-center gap-2 py-3 bg-white/5 hover:bg-teal-500/10 text-teal-400 border border-white/5 rounded-2xl transition-all font-black text-[10px] uppercase tracking-widest"
                            >
                              <span className="material-symbols-outlined text-lg">badge</span>
                              Equipo Staff
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => navigate(`/costs/${inv.id}`)}
                              className="flex items-center justify-center gap-2 py-3 bg-white/5 hover:bg-amber-500/10 text-amber-400 border border-white/5 rounded-2xl transition-all font-black text-[10px] uppercase tracking-widest"
                            >
                              <span className="material-symbols-outlined text-lg">account_balance_wallet</span>
                              Control Gastos
                            </motion.button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="py-32 text-center bg-white/5 backdrop-blur-md rounded-[50px] border border-white/5 block"
                >
                  <div className="size-28 bg-white/5 border border-white/10 rounded-full flex items-center justify-center text-slate-700 mx-auto mb-8 shadow-2xl relative">
                    <div className="absolute inset-0 bg-primary/10 blur-[40px] rounded-full animate-pulse"></div>
                    <span className="material-symbols-outlined text-6xl relative z-10 text-slate-400 opacity-50">calendar_add_on</span>
                  </div>
                  <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white mb-2">
                    {user.role === 'staff' || user.role === 'event_staff'
                      ? 'No hay eventos asignados'
                      : 'Empezá hoy mismo'}
                  </h3>
                  <p className="text-slate-500 font-medium mb-10 text-lg">
                    {user.role === 'staff' || user.role === 'event_staff'
                      ? 'Contactá al administrador para que te asigne a un evento.'
                      : 'Tu próximo gran evento extraordinario comienza con un click.'}
                  </p>
                  {user.role !== 'staff' && user.role !== 'event_staff' && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setShowAddModal(true)}
                      className="px-10 py-5 bg-primary text-white font-black text-sm uppercase tracking-[0.2em] rounded-full shadow-[0_20px_40px_rgba(19,91,236,0.3)] hover:shadow-primary/50 transition-all border-2 border-white/20"
                    >
                      Crear mi Primer Evento
                    </motion.button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </main>

      {/* FOOTER WATERMARK */}
      <footer className="mt-20 py-16 px-6 relative overflow-hidden flex flex-col items-center">
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
        <img
          src="/Logo Madiba Tech.jpg"
          className="h-10 w-auto opacity-10 grayscale brightness-200 mb-6"
          alt="Madiba Tech"
        />
        <div className="relative z-10 text-center space-y-2">
          <p className="text-white text-[10px] font-black tracking-[0.5em] uppercase opacity-20">Designed by Madiba Tech</p>
          <p className="text-white/10 text-[9px] font-bold">© 2026 APPXV Platform. Ultra Luxury Edition.</p>
        </div>
      </footer>

      {/* ADD MODAL */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            ></motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 40 }}
              className="relative w-full max-w-lg bg-slate-900 border border-white/10 rounded-[50px] overflow-hidden shadow-[0_50px_100px_rgba(0,0,0,0.5)] z-10"
            >
              <div className="absolute top-[-50%] right-[-50%] w-full h-full bg-primary/10 blur-[100px] rounded-full"></div>

              <form onSubmit={handleCreateEvent} className="relative z-10 p-10 md:p-14 space-y-8">
                <div className="flex justify-between items-center">
                  <h3 className="text-3xl font-black italic uppercase tracking-tighter text-white">Nuevo <span className="text-primary">Evento</span></h3>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="size-10 flex items-center justify-center rounded-2xl bg-white/5 hover:bg-white/10 text-slate-400 transition-colors"
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nombre del Evento</label>
                  <input
                    autoFocus
                    required
                    type="text"
                    value={newEventName}
                    onChange={(e) => setNewEventName(e.target.value)}
                    className="w-full bg-white/5 border-2 border-white/5 rounded-3xl p-6 text-white text-lg font-bold placeholder:text-slate-700 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                    placeholder="Ej: Gran Gala Anual 2026"
                  />
                  <p className="text-[10px] text-slate-600 font-medium italic ml-1">Podrás personalizar el diseño y detalles en el siguiente paso.</p>
                </div>

                <motion.button
                  whileHover={{ scale: 1.02, translateY: -2 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={isCreating}
                  className={`w-full h-16 bg-primary text-white font-black uppercase tracking-[0.2em] rounded-full shadow-[0_20px_40px_rgba(19,91,236,0.3)] transition-all ${isCreating ? 'opacity-70 cursor-not-allowed' : ''} border-2 border-white/20`}
                >
                  {isCreating ? 'Procesando...' : 'Crear mi Evento'}
                </motion.button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DashboardScreen;

