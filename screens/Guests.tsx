
import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { InvitationData, Guest, GuestAllotment, GuestCompanionNames, User } from '../types';
import PlanUpgradeBanner from '../components/PlanUpgradeBanner';

interface GuestsScreenProps {
  invitations: InvitationData[];
  onSaveGuest: (eventId: string, guest: Guest) => void;
  onDeleteGuest: (eventId: string, guestId: string) => void;
  user?: User;
}

type GuestFilter = 'all' | 'confirmed' | 'declined' | 'pending';

// Plan limits for guests
const GUEST_LIMITS = {
  freemium: 50,
  premium: 200,
  vip: Infinity
};

const GuestsScreen: React.FC<GuestsScreenProps> = ({ invitations, onSaveGuest, onDeleteGuest, user }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const invitation = invitations.find(inv => inv.id === id);

  const [filter, setFilter] = useState<GuestFilter>('all');
  const [catFilter, setCatFilter] = useState<keyof GuestAllotment | 'all'>('all');
  const [showModal, setShowModal] = useState<'add' | 'edit' | null>(null);
  const [currentGuest, setCurrentGuest] = useState<Partial<Guest>>({
    name: '',
    allotted: { adults: 0, teens: 0, kids: 0, infants: 0 },
    companionNames: { adults: [], teens: [], kids: [], infants: [] }
  });
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [searchQuery, setSearchQuery] = useState(''); // Search filter

  if (!invitation) return <div className="p-10 text-center font-bold">Evento no encontrado</div>;

  /* Helper to get effective confirmed counts mainly for legacy data or errors */
  const getEffectiveConfirmed = (g: Guest) => {
    const allotted = g.allotted || { adults: 0, teens: 0, kids: 0, infants: 0 };
    const confirmed = g.confirmed || { adults: 0, teens: 0, kids: 0, infants: 0 };

    // If status is confirmed but total confirmed is 0, fallback to allotted to avoid '0 attendance' error
    if (g.status === 'confirmed') {
      const totalConf = confirmed.adults + confirmed.teens + confirmed.kids + confirmed.infants;
      if (totalConf === 0) {
        return { ...allotted };
      }
    }
    return confirmed;
  };

  const stats = useMemo(() => {
    const catTotal = { adults: 0, teens: 0, kids: 0, infants: 0 };
    const catSi = { adults: 0, teens: 0, kids: 0, infants: 0 };
    const catNo = { adults: 0, teens: 0, kids: 0, infants: 0 };
    const catPend = { adults: 0, teens: 0, kids: 0, infants: 0 };

    (invitation.guests || []).forEach(g => {
      const allotted = g.allotted || { adults: 0, teens: 0, kids: 0, infants: 0 };
      const confirmed = getEffectiveConfirmed(g);

      // category totals (always based on allotted)
      catTotal.adults += (allotted.adults || 0);
      catTotal.teens += (allotted.teens || 0);
      catTotal.kids += (allotted.kids || 0);
      catTotal.infants += (allotted.infants || 0);

      if (g.status === 'confirmed') {
        catSi.adults += (confirmed.adults || 0);
        catSi.teens += (confirmed.teens || 0);
        catSi.kids += (confirmed.kids || 0);
        catSi.infants += (confirmed.infants || 0);

        // Absence calculation (allotted - confirmed) capped at 0 minimum
        catNo.adults += Math.max(0, (allotted.adults || 0) - (confirmed.adults || 0));
        catNo.teens += Math.max(0, (allotted.teens || 0) - (confirmed.teens || 0));
        catNo.kids += Math.max(0, (allotted.kids || 0) - (confirmed.kids || 0));
        catNo.infants += Math.max(0, (allotted.infants || 0) - (confirmed.infants || 0));
      } else if (g.status === 'declined') {
        catNo.adults += (allotted.adults || 0);
        catNo.teens += (allotted.teens || 0);
        catNo.kids += (allotted.kids || 0);
        catNo.infants += (allotted.infants || 0);
      } else {
        catPend.adults += (allotted.adults || 0);
        catPend.teens += (allotted.teens || 0);
        catPend.kids += (allotted.kids || 0);
        catPend.infants += (allotted.infants || 0);
      }
    });

    // Main buttons derive their values from the sum of their category details
    const si = catSi.adults + catSi.teens + catSi.kids + catSi.infants;
    const no = catNo.adults + catNo.teens + catNo.kids + catNo.infants;
    const pend = catPend.adults + catPend.teens + catPend.kids + catPend.infants;

    // Total is simply the sum of the parts to ensure they match visually
    const total = si + no + pend;

    return { total, si, no, pend, catTotal, catSi, catNo, catPend };
  }, [invitation.guests]);


  const handleSendWhatsApp = (guest: Guest) => {
    const url = `${window.location.origin}${window.location.pathname}#/rsvp/${id}?guest=${encodeURIComponent(guest.name)}`;
    const message = `¡Hola ${guest.name}! Estás invitado a ${invitation.eventName}. Confirma aquí: ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleSaveGuest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentGuest.name) return;

    if (showModal === 'add') {
      const newGuest: Guest = {
        id: Date.now(),
        name: currentGuest.name,
        status: 'pending',
        allotted: currentGuest.allotted as GuestAllotment,
        confirmed: { adults: 0, teens: 0, kids: 0, infants: 0 },
        companionNames: currentGuest.companionNames as GuestCompanionNames,
        sent: false
      };
      onSaveGuest(invitation.id, newGuest);
    } else {
      // For editing existing guests, sync confirmed counts with allotted if status is confirmed
      let syncedConfirmed = currentGuest.confirmed || { adults: 0, teens: 0, kids: 0, infants: 0 };

      if (currentGuest.status === 'confirmed') {
        // Use allotted counts when confirmed - names can be empty but slots still count
        const allotted = currentGuest.allotted || { adults: 0, teens: 0, kids: 0, infants: 0 };
        syncedConfirmed = {
          adults: allotted.adults || 0,
          teens: allotted.teens || 0,
          kids: allotted.kids || 0,
          infants: allotted.infants || 0
        };
      }

      onSaveGuest(invitation.id, { ...currentGuest, id: editingId, confirmed: syncedConfirmed } as Guest);
    }
    setShowModal(null);
  };

  const handleDelete = (guestId: string | number) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este invitado?')) {
      onDeleteGuest(invitation.id, guestId.toString());
    }
  };

  const renderList = () => {
    return (invitation.guests || []).filter(g => {
      // 1. Filter by Status
      let statusMatch = true;
      const allotted = g.allotted || { adults: 0, teens: 0, kids: 0, infants: 0 };
      const confirmed = getEffectiveConfirmed(g);

      if (filter !== 'all') {
        if (filter === 'declined') {
          const hasAbsences = (allotted.adults + allotted.teens + allotted.kids + allotted.infants) >
            (confirmed.adults + confirmed.teens + confirmed.kids + confirmed.infants);
          statusMatch = g.status === 'declined' || (g.status === 'confirmed' && hasAbsences);
        } else {
          statusMatch = g.status === filter;
        }
      }
      if (!statusMatch) return false;

      // 2.5 Filter by Search Query (search main guest name AND companion names)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const mainNameMatch = g.name.toLowerCase().includes(query);
        const companionNames = g.companionNames || { adults: [], teens: [], kids: [], infants: [] };
        const allCompanionNames = [
          ...companionNames.adults,
          ...companionNames.teens,
          ...companionNames.kids,
          ...companionNames.infants
        ];
        const companionMatch = allCompanionNames.some(n => n && n.toLowerCase().includes(query));

        if (!mainNameMatch && !companionMatch) {
          return false;
        }
      }

      // 2. Filter by Category
      if (catFilter === 'all') return true;

      if (filter === 'confirmed') {
        return (confirmed[catFilter] || 0) > 0;
      } else if (filter === 'declined') {
        if (g.status === 'declined') return (allotted[catFilter] || 0) > 0;
        return (allotted[catFilter] || 0) - (confirmed[catFilter] || 0) > 0;
      } else {
        // 'all' or 'pending' fallback to allotted count
        return (allotted[catFilter] || 0) > 0;
      }
    }).map(g => {
      const isSent = g.sent || g.status === 'confirmed' || g.status === 'declined';
      const allotted = g.allotted || { adults: 0, teens: 0, kids: 0, infants: 0 };
      const confirmed = getEffectiveConfirmed(g);

      const gAllottedTotal = allotted.adults + allotted.teens + allotted.kids + allotted.infants;
      const gConfirmedTotal = confirmed.adults + confirmed.teens + confirmed.kids + confirmed.infants;
      const diffTotal = gAllottedTotal - gConfirmedTotal;

      // Determine main guest category label for display
      let mainGuestLabel = "Sin Cupo";
      const countSource = g.status === 'confirmed' ? confirmed : allotted;

      if (countSource.adults > 0) mainGuestLabel = "Adulto";
      else if (countSource.teens > 0) mainGuestLabel = "Adolescente";
      else if (countSource.kids > 0) mainGuestLabel = "Niño";
      else if (countSource.infants > 0) mainGuestLabel = "Bebé";

      return (
        <div key={g.id} className="relative bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden mb-4 animate-in slide-in-from-bottom-2 duration-300">
          <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${g.status === 'confirmed' ? 'bg-green-500' : g.status === 'declined' ? 'bg-red-500' : 'bg-slate-300'}`}></div>
          <div className="p-4 space-y-3">
            <div className="flex justify-between items-start">
              <div className="flex gap-3">
                <div className={`size-10 rounded-full flex items-center justify-center text-white font-black shadow-inner ${g.status === 'confirmed' ? 'bg-green-500' : g.status === 'declined' ? 'bg-red-500' : 'bg-slate-400'}`}>{g.name[0]}</div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-sm">{g.name}</p>
                    {isSent && <span className="text-[8px] bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded font-black border border-blue-100 uppercase">Enviada</span>}
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Cupo total: {gAllottedTotal}</p>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => {
                  setEditingId(g.id);
                  setCurrentGuest({
                    ...g,
                    companionNames: g.companionNames || { adults: [], teens: [], kids: [], infants: [] }
                  });
                  setShowModal('edit');
                }} className="p-1.5 text-slate-300 hover:text-primary transition-colors"><span className="material-symbols-outlined text-lg">edit</span></button>
                <button onClick={() => handleDelete(g.id)} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"><span className="material-symbols-outlined text-lg">delete</span></button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2 text-[10px] font-bold">
                <div className="bg-slate-50 dark:bg-slate-900 p-2 rounded-xl border border-slate-100 dark:border-slate-700">
                  <p className="text-slate-400 uppercase mb-1">Cupo Asignado</p>
                  <p>Ad: {allotted.adults} | Adol: {allotted.teens} | Ni: {allotted.kids} | Be: {allotted.infants}</p>
                </div>
                {g.status === 'confirmed' ? (
                  <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded-xl border border-green-100 dark:border-green-800/50">
                    <p className="text-green-600 dark:text-green-400 uppercase mb-1">Confirmados</p>
                    <p>Ad: {confirmed.adults} | Adol: {confirmed.teens} | Ni: {confirmed.kids} | Be: {confirmed.infants}</p>
                  </div>
                ) : (
                  <div className={`bg-slate-50 dark:bg-slate-900 p-2 rounded-xl border border-slate-100 dark:border-slate-700 italic flex items-center justify-center ${g.status === 'declined' ? 'text-red-500 font-bold bg-red-50/50 border-red-100' : 'text-slate-400'}`}>
                    {g.status === 'declined' ? 'Informó que NO asiste' : 'Pendiente'}
                  </div>
                )}
              </div>

              {/* Ausentes dentro del mismo cuadrante */}
              {(g.status === 'confirmed' && diffTotal > 0) || (g.status === 'declined' && gAllottedTotal > 0) ? (
                <div className="p-2.5 bg-red-50/30 dark:bg-red-900/10 rounded-xl border border-red-50 dark:border-red-900/20">
                  <p className="text-[9px] font-black text-red-500 uppercase flex items-center gap-1.5 mb-1">
                    <span className="material-symbols-outlined text-[14px]">person_off</span>
                    {g.status === 'declined' ? `Todo el grupo ausente: ${gAllottedTotal}` : `Ausencias en el grupo: ${diffTotal}`}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {allotted.adults - confirmed.adults > 0 && <span className="text-[8px] font-bold bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-red-100/50 text-red-400">-{allotted.adults - confirmed.adults} Adultos</span>}
                    {allotted.teens - confirmed.teens > 0 && <span className="text-[8px] font-bold bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-red-100/50 text-red-400">-{allotted.teens - confirmed.teens} Adol.</span>}
                    {allotted.kids - confirmed.kids > 0 && <span className="text-[8px] font-bold bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-red-100/50 text-red-400">-{allotted.kids - confirmed.kids} Niños</span>}
                    {allotted.infants - confirmed.infants > 0 && <span className="text-[8px] font-bold bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-red-100/50 text-red-400">-{allotted.infants - confirmed.infants} Bebés</span>}
                  </div>
                </div>
              ) : null}

              {/* Lista de invitados que asisten - Solo si hay confirmados reales */}
              {g.status === 'confirmed' && gConfirmedTotal > 0 && (
                <div className="pt-2 border-t border-slate-50 dark:border-slate-700">
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-1.5 font-sans">Invitados que asisten:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {/* Invitado Principal - con etiqueta de categoría */}
                    <span className="bg-white dark:bg-slate-800 px-2.5 py-1 rounded-lg text-[10px] font-bold border border-slate-100 dark:border-slate-700 shadow-sm flex items-center gap-1.5">
                      <span className="size-1.5 bg-green-500 rounded-full"></span>
                      {g.name}
                      <span className="text-[8px] text-slate-400 uppercase ml-0.5">({mainGuestLabel})</span>
                    </span>

                    {/* Acompañantes */}
                    {g.companionNames && [
                      { list: g.companionNames.adults, label: "Adulto" },
                      { list: g.companionNames.teens, label: "Adol." },
                      { list: g.companionNames.kids, label: "Niño" },
                      { list: g.companionNames.infants, label: "Bebé" },
                    ].map(type =>
                      type.list?.filter(n => n.trim() !== "" && n.toLowerCase() !== g.name.toLowerCase()).map((name, idx) => (
                        <span key={`${type.label}-${idx}`} className="bg-white dark:bg-slate-800 px-2.5 py-1 rounded-lg text-[10px] font-bold border border-slate-100 dark:border-slate-700 shadow-sm flex items-center gap-1.5">
                          <span className="size-1.5 bg-green-500 rounded-full"></span>
                          {name}
                          <span className="text-[8px] text-slate-400 uppercase ml-0.5">({type.label})</span>
                        </span>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-50 dark:border-slate-700">
              <button onClick={() => handleSendWhatsApp(g)} className="flex-1 py-3 rounded-xl bg-green-50 text-green-600 font-bold text-[10px] flex items-center justify-center gap-1.5 shadow-sm hover:bg-green-100 transition-colors">
                <span className="material-symbols-outlined text-base">chat</span> ENVIAR INVITACIÓN
              </button>
              <button onClick={() => navigate(`/rsvp/${id}?guest=${encodeURIComponent(g.name)}`)} className="px-5 py-3 rounded-xl bg-slate-100 dark:bg-slate-700 font-bold text-[10px] shadow-sm hover:bg-slate-200 transition-colors flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base">visibility</span> VISTA
              </button>
            </div>
          </div>
        </div>
      );
    });
  };

  const updateAllotted = (key: keyof GuestAllotment, delta: number) => {
    setCurrentGuest(prev => {
      const newVal = Math.max(0, (prev.allotted![key] || 0) + delta);
      const newAllotted = { ...prev.allotted!, [key]: newVal };

      const newCompanionNames = { ...(prev.companionNames || { adults: [], teens: [], kids: [], infants: [] }) };
      const targetLen = key === 'adults' ? Math.max(0, newVal - 1) : newVal;

      const currentArr = [...(newCompanionNames[key] || [])];
      if (currentArr.length < targetLen) {
        while (currentArr.length < targetLen) currentArr.push('');
      } else if (currentArr.length > targetLen) {
        currentArr.splice(targetLen);
      }
      newCompanionNames[key] = currentArr;

      return {
        ...prev,
        allotted: newAllotted,
        companionNames: newCompanionNames
      };
    });
  };

  const updateCompanionName = (key: keyof GuestCompanionNames, index: number, name: string) => {
    setCurrentGuest(prev => {
      const newCompanionNames = { ...prev.companionNames! };
      const currentArr = [...(newCompanionNames[key] || [])];
      currentArr[index] = name;
      newCompanionNames[key] = currentArr;
      return { ...prev, companionNames: newCompanionNames };
    });
  };

  return (
    <div className="bg-background-light dark:bg-background-dark min-h-screen pb-24 max-w-[480px] md:max-w-6xl mx-auto text-slate-900 dark:text-white font-display">
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-4 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <button onClick={() => navigate('/dashboard')} className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-base font-bold">Invitados & Confirmaciones</h1>
        <button onClick={() => {
          setEditingId(null);
          setCurrentGuest({
            name: '',
            allotted: { adults: 0, teens: 0, kids: 0, infants: 0 },
            companionNames: { adults: [], teens: [], kids: [], infants: [] }
          });
          setShowModal('add');
        }} className="text-primary font-bold text-xs uppercase bg-primary/5 px-3 py-1.5 rounded-lg border border-primary/10">NUEVO</button>
      </header>

      {/* Plan Upgrade Banner for Guests */}
      {user && user.role !== 'admin' && user.plan !== 'vip' && (
        <div className="px-4 pt-2">
          <PlanUpgradeBanner
            currentPlan={user.plan as 'freemium' | 'premium' | 'vip'}
            resourceType="guests"
            current={stats.total}
            limit={GUEST_LIMITS[user.plan as keyof typeof GUEST_LIMITS] || 50}
          />
        </div>
      )}

      <div className="p-4 space-y-6">
        <div className="grid grid-cols-4 gap-2">
          <StatBtn label="TOTAL" val={stats.total} active={filter === 'all'} onClick={() => { setFilter('all'); setCatFilter('all'); }} color="primary" />
          <StatBtn label="SI" val={stats.si} active={filter === 'confirmed'} onClick={() => { setFilter('confirmed'); setCatFilter('all'); }} color="green-500" />
          <StatBtn label="NO" val={stats.no} active={filter === 'declined'} onClick={() => { setFilter('declined'); setCatFilter('all'); }} color="red-500" />
          <StatBtn label="PEND." val={stats.pend} active={filter === 'pending'} onClick={() => { setFilter('pending'); setCatFilter('all'); }} color="slate-400" />
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {(() => {
            const currentCatStats = filter === 'all' ? stats.catTotal :
              filter === 'confirmed' ? stats.catSi :
                filter === 'declined' ? stats.catNo :
                  stats.catPend;
            return (
              <>
                <CategoryBadge label="Adultos" val={currentCatStats.adults} dotColor="bg-slate-400" active={catFilter === 'adults'} onClick={() => setCatFilter(catFilter === 'adults' ? 'all' : 'adults')} />
                <CategoryBadge label="Adol" val={currentCatStats.teens} dotColor="bg-sky-400" active={catFilter === 'teens'} onClick={() => setCatFilter(catFilter === 'teens' ? 'all' : 'teens')} />
                <CategoryBadge label="Niños" val={currentCatStats.kids} dotColor="bg-blue-600" active={catFilter === 'kids'} onClick={() => setCatFilter(catFilter === 'kids' ? 'all' : 'kids')} />
                <CategoryBadge label="Bebés" val={currentCatStats.infants} dotColor="bg-pink-400" active={catFilter === 'infants'} onClick={() => setCatFilter(catFilter === 'infants' ? 'all' : 'infants')} />
              </>
            );
          })()}
        </div>

        {/* Search Input */}
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar invitado..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-1">
          {renderList().length > 0 ? renderList() : (
            <div className="col-span-full py-20 text-center space-y-3 opacity-50">
              <span className="material-symbols-outlined text-5xl">group_off</span>
              <p className="text-sm font-bold uppercase tracking-widest">No hay invitados en esta lista</p>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-5 animate-in zoom-in duration-200 max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center shrink-0">
              <h3 className="text-lg font-bold">{showModal === 'add' ? 'Nuevo Invitado' : 'Editar Cupos'}</h3>
              <button onClick={() => setShowModal(null)} className="size-10 flex items-center justify-center bg-slate-50 dark:bg-slate-900 rounded-full"><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className="space-y-4 overflow-y-auto no-scrollbar pb-2">
              <input required type="text" value={currentGuest.name} onChange={e => setCurrentGuest({ ...currentGuest, name: e.target.value })} className="w-full h-14 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-900 px-4 font-bold outline-none focus:ring-2 focus:ring-primary/20" placeholder="Nombre del invitado principal" />

              <div className="grid grid-cols-2 gap-4">
                <AllotmentInput label="Adultos (18+)" val={currentGuest.allotted!.adults} onDelta={d => updateAllotted('adults', d)} />
                <AllotmentInput label="Adolesc. (11-17)" val={currentGuest.allotted!.teens} onDelta={d => updateAllotted('teens', d)} />
                <AllotmentInput label="Niños (3-11)" val={currentGuest.allotted!.kids} onDelta={d => updateAllotted('kids', d)} />
                <AllotmentInput label="Bebés (0-3)" val={currentGuest.allotted!.infants} onDelta={d => updateAllotted('infants', d)} />
              </div>

              {/* Status toggle for editing */}
              {showModal === 'edit' && currentGuest.status && currentGuest.status !== 'pending' && (
                <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Estado de Confirmación</p>
                  <div className="flex gap-2">
                    <div className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 ${currentGuest.status === 'confirmed' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                      }`}>
                      <span className={`size-2 rounded-full ${currentGuest.status === 'confirmed' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                      {currentGuest.status === 'confirmed' ? 'Confirmado' : 'No asiste'}
                    </div>
                    <button
                      type="button"
                      onClick={() => setCurrentGuest({ ...currentGuest, status: 'pending' })}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                    >
                      Quitar estado
                    </button>
                  </div>
                </div>
              )}

              {(currentGuest.companionNames?.adults.length! > 0 ||
                currentGuest.companionNames?.teens.length! > 0 ||
                currentGuest.companionNames?.kids.length! > 0 ||
                currentGuest.companionNames?.infants.length! > 0) && (
                  <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-700">
                    <p className="text-[10px] font-black text-slate-400 uppercase">Nombres de acompañantes (opcional)</p>

                    {/* Adults - First adult is the main guest (read-only), rest are companions */}
                    {currentGuest.allotted!.adults > 0 && (
                      <div className="relative">
                        <label className="absolute -top-2 left-3 px-1 bg-white dark:bg-slate-800 text-[9px] font-black text-slate-400 uppercase">Adulto 1 (Principal)</label>
                        <input
                          type="text"
                          value={currentGuest.name}
                          disabled
                          className="w-full h-12 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900 px-4 text-sm bg-slate-50 cursor-not-allowed opacity-60"
                        />
                      </div>
                    )}
                    {currentGuest.companionNames?.adults.slice(0, currentGuest.allotted!.adults - 1).map((name, i) => (
                      <CompanionNameInput key={`a-${i}`} label={`Adulto ${i + 2}`} value={name} onChange={val => updateCompanionName('adults', i, val)} />
                    ))}
                    {currentGuest.companionNames?.teens.map((name, i) => (
                      <CompanionNameInput key={`t-${i}`} label={`Adolescente ${i + 1}`} value={name} onChange={val => updateCompanionName('teens', i, val)} />
                    ))}
                    {currentGuest.companionNames?.kids.map((name, i) => (
                      <CompanionNameInput key={`k-${i}`} label={`Niño ${i + 1}`} value={name} onChange={val => updateCompanionName('kids', i, val)} />
                    ))}
                    {currentGuest.companionNames?.infants.map((name, i) => (
                      <CompanionNameInput key={`i-${i}`} label={`Bebé ${i + 1}`} value={name} onChange={val => updateCompanionName('infants', i, val)} />
                    ))}
                  </div>
                )}
            </div>
            <button onClick={handleSaveGuest} className="w-full h-14 bg-primary text-white font-bold rounded-2xl shadow-lg shadow-primary/20 active:scale-[0.98] transition-all shrink-0">Guardar Cambios</button>
          </div>
        </div>
      )}
    </div>
  );
};

interface CompanionNameInputProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  key?: string;
}

const CompanionNameInput = ({ label, value, onChange }: CompanionNameInputProps) => (
  <div className="relative">
    <label className="absolute -top-2 left-3 px-1 bg-white dark:bg-slate-800 text-[9px] font-black text-slate-400 uppercase">{label}</label>
    <input
      type="text"
      value={value || ""}
      onChange={e => onChange(e.target.value)}
      className="w-full h-12 rounded-xl border border-slate-100 dark:border-slate-700 dark:bg-slate-900 px-4 text-sm font-bold outline-none focus:border-primary/50"
      placeholder="Ingrese nombre..."
    />
  </div>
);


const StatBtn = ({ label, val, active, onClick, color }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all ${active ? (color === 'primary' ? 'bg-primary text-white shadow-lg' : `bg-${color} text-white shadow-lg`) : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-800'}`}>
    <span className="text-xl font-black leading-none mb-1">{val}</span>
    <span className="text-[8px] font-bold uppercase tracking-widest">{label}</span>
  </button>
);

const CategoryBadge = ({ label, val, dotColor, active, onClick }: { label: string, val: number, dotColor: string, active?: boolean, onClick?: () => void }) => (
  <button onClick={onClick} className={`flex items-center gap-2 px-3 py-2 rounded-full border transition-all shrink-0 shadow-sm ${active ? 'bg-primary border-primary text-white' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-800'}`}>
    <span className={`size-2 rounded-full ${active ? 'bg-white' : dotColor}`}></span>
    <span className={`text-[10px] font-bold ${active ? 'text-white' : 'text-slate-600 dark:text-slate-400'}`}>{label}: <span className={active ? 'text-white' : 'text-slate-900 dark:text-white'}>{val}</span></span>
  </button>
);

const AllotmentInput = ({ label, val, onDelta }: any) => (
  <div className="space-y-1">
    <p className="text-[9px] font-black text-slate-400 uppercase ml-2">{label}</p>
    <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-100 dark:border-slate-700">
      <button type="button" onClick={() => onDelta(-1)} className="size-9 rounded-xl bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center text-slate-500">-</button>
      <span className="flex-1 text-center font-bold">{val}</span>
      <button type="button" onClick={() => onDelta(1)} className="size-9 rounded-xl bg-primary text-white flex items-center justify-center shadow-sm">+</button>
    </div>
  </div>
);

export default GuestsScreen;
