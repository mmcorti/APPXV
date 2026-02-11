
import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { InvitationData, Guest, GuestAllotment, GuestCompanionNames, User } from '../types';
import { UpgradePrompt } from '../components/UpgradePrompt';
import { usePlan } from '../hooks/usePlan';
import * as XLSX from 'xlsx';


interface GuestsScreenProps {
  invitations: InvitationData[];
  onSaveGuest: (eventId: string, guest: Guest) => void;
  onDeleteGuest: (eventId: string, guestId: string) => void;
  user?: User;
}

type GuestFilter = 'all' | 'confirmed' | 'declined' | 'pending';


const GuestsScreen: React.FC<GuestsScreenProps> = ({ invitations, onSaveGuest, onDeleteGuest, user }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { checkLimit } = usePlan();
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
  }, [invitation?.guests]);

  const limitCheck = checkLimit('maxGuestsPerEvent', stats.total);


  const handleSendWhatsApp = (guest: Guest) => {
    const url = `${window.location.origin}${window.location.pathname}#/rsvp/${id}?guest=${encodeURIComponent(guest.name)}`;
    const message = `¡Hola ${guest.name}! Estás invitado a ${invitation.eventName}. Confirma aquí: ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleDownloadExcel = () => {
    const flattenedData: any[] = [];

    (invitation.guests || []).forEach(g => {
      const status = g.status === 'confirmed' ? 'Confirmado' : g.status === 'declined' ? 'No asistirá' : 'Pendiente';
      const confirmed = getEffectiveConfirmed(g);
      const allotted = g.allotted || { adults: 0, teens: 0, kids: 0, infants: 0 };

      const counts = g.status === 'confirmed' ? confirmed : allotted;
      const totalInGroup = counts.adults + counts.teens + counts.kids + counts.infants;

      if (totalInGroup === 0) return;

      const getMainCategory = (allotted: GuestAllotment) => {
        if (allotted.adults > 0) return 'adults';
        if (allotted.teens > 0) return 'teens';
        if (allotted.kids > 0) return 'kids';
        if (allotted.infants > 0) return 'infants';
        return 'adults';
      };

      const mainCatKey = getMainCategory(allotted);
      const categoryLabels: Record<string, string> = { adults: 'Adulto', teens: 'Adolescente', kids: 'Niño', infants: 'Bebé' };

      flattenedData.push({
        'Nombre': g.name,
        'Categoría': categoryLabels[mainCatKey] || 'Adulto',
        'Estado': status,
        'Grupo / Invitado Principal': g.name,
        'Relación': 'Titular'
      });

      const companions = g.companionNames || {};
      const mainGuestName = g.name.toLowerCase().trim();
      const catKeys: (keyof GuestAllotment)[] = ['adults', 'teens', 'kids', 'infants'];

      catKeys.forEach(cat => {
        const count = counts[cat] || 0;
        // Filter out the main guest name with extra robustness against invisible chars/spaces
        const filteredNames = (companions[cat] || []).filter(n => {
          if (!n || n.trim() === "") return false;
          const cleanN = n.replace(/\s+/g, ' ').trim().toLowerCase();
          const cleanMain = g.name.replace(/\s+/g, ' ').trim().toLowerCase();
          return cleanN !== cleanMain;
        });

        const limit = cat === mainCatKey ? Math.max(0, count - 1) : count;

        for (let i = 0; i < limit; i++) {
          flattenedData.push({
            'Nombre': filteredNames[i] || `${categoryLabels[cat]} Acomp.`,
            'Categoría': categoryLabels[cat],
            'Estado': status,
            'Grupo / Invitado Principal': g.name,
            'Relación': 'Acompañante'
          });
        }
      });
    });

    flattenedData.sort((a, b) => {
      const statusPriority: Record<string, number> = { 'Confirmado': 0, 'Pendiente': 1, 'No asistirá': 2 };
      const statusDiff = (statusPriority[a.Estado] || 0) - (statusPriority[b.Estado] || 0);
      if (statusDiff !== 0) return statusDiff;

      const groupDiff = a['Grupo / Invitado Principal'].localeCompare(b['Grupo / Invitado Principal']);
      if (groupDiff !== 0) return groupDiff;

      if (a.Relación === 'Titular' && b.Relación !== 'Titular') return -1;
      if (a.Relación !== 'Titular' && b.Relación === 'Titular') return 1;

      return 0;
    });

    const worksheet = XLSX.utils.json_to_sheet(flattenedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Padrón Total");

    worksheet["!cols"] = [
      { wch: 35 }, { wch: 15 }, { wch: 15 }, { wch: 35 }, { wch: 15 },
    ];

    XLSX.writeFile(workbook, `Padron_Invitados_${invitation.eventName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.xlsx`);
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
        const mainNameMatch = (g.name || "").toLowerCase().includes(query);

        const companions = g.companionNames || {};
        const allCompanionNames = [
          ...(companions.adults || []),
          ...(companions.teens || []),
          ...(companions.kids || []),
          ...(companions.infants || [])
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
        <div key={g.id} className="relative bg-white/5 backdrop-blur-xl rounded-[32px] border border-white/10 overflow-hidden mb-4 transition-all hover:bg-white/[0.08] hover:border-white/20 group">
          <div className="p-6 space-y-4">
            <div className="flex justify-between items-start">
              <div className="flex gap-4">
                <div className={`size-12 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-xl transition-transform group-hover:scale-110 ${g.status === 'confirmed' ? 'bg-gradient-to-br from-emerald-400 to-teal-600' : g.status === 'declined' ? 'bg-gradient-to-br from-red-400 to-rose-600' : 'bg-gradient-to-br from-slate-600 to-slate-800'}`}>{g.name[0]}</div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-black italic text-lg tracking-tight">{g.name}</p>
                    {isSent && <span className="text-[9px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full font-black border border-blue-500/20 uppercase tracking-widest">Enviada</span>}
                  </div>
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Cupos: {gAllottedTotal}</p>
                </div>
              </div>
              <div className="flex gap-1.5">
                <button onClick={() => {
                  setEditingId(g.id);
                  const defaultAllotted = { adults: 0, teens: 0, kids: 0, infants: 0 };
                  const defaultCompanionNames = { adults: [], teens: [], kids: [], infants: [] };

                  setCurrentGuest({
                    ...g,
                    allotted: { ...defaultAllotted, ...(g.allotted || {}) },
                    companionNames: { ...defaultCompanionNames, ...(g.companionNames || {}) }
                  });
                  setShowModal('edit');
                }} className="size-10 flex items-center justify-center rounded-xl bg-white/5 text-slate-400 hover:text-primary hover:bg-white/10 transition-all"><span className="material-symbols-outlined text-lg">edit</span></button>
                <button onClick={() => handleDelete(g.id)} className="size-10 flex items-center justify-center rounded-xl bg-white/5 text-slate-400 hover:text-red-500 hover:bg-white/10 transition-all"><span className="material-symbols-outlined text-lg">delete</span></button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">CUPO ASIGNADO</p>
                  <p className="text-[10px] font-bold text-slate-300">AD {allotted.adults} | TE {allotted.teens} | NI {allotted.kids} | BE {allotted.infants}</p>
                </div>
                {g.status === 'confirmed' ? (
                  <div className="bg-emerald-500/5 p-3 rounded-2xl border border-emerald-500/10">
                    <p className="text-[9px] font-black text-emerald-500/60 uppercase tracking-widest mb-1.5">CONFIRMADOS</p>
                    <p className="text-[10px] font-bold text-emerald-400">AD {confirmed.adults} | TE {confirmed.teens} | NI {confirmed.kids} | BE {confirmed.infants}</p>
                  </div>
                ) : (
                  <div className={`p-3 rounded-2xl border flex items-center justify-center ${g.status === 'declined' ? 'bg-red-500/5 border-red-500/10 text-red-500 font-black italic uppercase text-[10px] tracking-tighter' : 'bg-white/5 border-white/5 text-slate-500 font-bold text-[10px]'}`}>
                    {g.status === 'declined' ? 'NO ASISTIRÁ' : 'PENDIENTE'}
                  </div>
                )}
              </div>

              {/* Ausentes */}
              {((g.status === 'confirmed' && diffTotal > 0) || (g.status === 'declined' && gAllottedTotal > 0)) && (
                <div className="bg-red-500/5 p-3 rounded-2xl border border-red-500/10 flex items-center justify-between">
                  <p className="text-[10px] font-black text-red-500/80 uppercase tracking-tighter flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">person_off</span>
                    {g.status === 'declined' ? 'GRUPO AUSENTE' : `${diffTotal} AUSENTES`}
                  </p>
                  <div className="flex gap-1.5">
                    {allotted.adults - confirmed.adults > 0 && <span className="bg-white/5 px-2 py-0.5 rounded-lg text-[9px] font-black text-red-400">-{allotted.adults - confirmed.adults} AD</span>}
                    {allotted.teens - confirmed.teens > 0 && <span className="bg-white/5 px-2 py-0.5 rounded-lg text-[9px] font-black text-red-400">-{allotted.teens - confirmed.teens} TE</span>}
                  </div>
                </div>
              )}

              {/* Lista invitados que asisten */}
              {g.status === 'confirmed' && gConfirmedTotal > 0 && (
                <div className="pt-3 border-t border-white/5">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3">LISTA DE ASISTENCIA:</p>
                  <div className="flex flex-wrap gap-2">
                    {(() => {
                      const getMainCategory = (allotted: GuestAllotment) => {
                        if (allotted.adults > 0) return 'adults';
                        if (allotted.teens > 0) return 'teens';
                        if (allotted.kids > 0) return 'kids';
                        if (allotted.infants > 0) return 'infants';
                        return 'adults';
                      };
                      const mainCategory = getMainCategory(allotted);
                      const displayName = g.name;

                      return (
                        <span className="bg-white/5 px-3 py-1.5 rounded-xl text-[10px] font-black italic border border-white/5 flex items-center gap-2">
                          <span className="size-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                          {displayName}
                          <span className="text-[8px] text-slate-500 uppercase not-italic">({mainGuestLabel})</span>
                        </span>
                      );
                    })()}

                    {(() => {
                      const getMainCategory = (allotted: GuestAllotment) => {
                        if (allotted.adults > 0) return 'adults';
                        if (allotted.teens > 0) return 'teens';
                        if (allotted.kids > 0) return 'kids';
                        if (allotted.infants > 0) return 'infants';
                        return 'adults';
                      };
                      const mainCategory = getMainCategory(allotted);
                      const mainGuestName = g.name.toLowerCase().trim();

                      return g.companionNames && [
                        { key: 'adults', label: "AD", count: confirmed.adults },
                        { key: 'teens', label: "TE", count: confirmed.teens },
                        { key: 'kids', label: "NI", count: confirmed.kids },
                        { key: 'infants', label: "BE", count: confirmed.infants },
                      ].map(type => {
                        const rawList = g.companionNames![type.key as keyof GuestCompanionNames] || [];

                        // Filter out the main guest name with extra robustness against invisible chars/spaces
                        const filtered = rawList.filter(n => {
                          if (!n || n.trim() === "") return false;
                          const cleanN = n.replace(/\s+/g, ' ').trim().toLowerCase();
                          const cleanMain = g.name.replace(/\s+/g, ' ').trim().toLowerCase();
                          return cleanN !== cleanMain;
                        });

                        // Determine display limit. 
                        // If this is the main category, we subtract 1 because the Main Guest is already shown in the first pill.
                        const limit = (type.key === mainCategory) ? Math.max(0, type.count - 1) : type.count;

                        // Slice to limit
                        const itemsToShow = filtered.slice(0, limit);

                        return itemsToShow.map((name, idx) => (
                          <span key={`${type.label}-${idx}`} className="bg-white/5 px-3 py-1.5 rounded-xl text-[10px] font-black italic border border-white/5 flex items-center gap-2">
                            <span className="size-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                            {name}
                            <span className="text-[8px] text-slate-500 uppercase not-italic">({type.label})</span>
                          </span>
                        ));
                      });
                    })()}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-4 border-t border-white/5">
              <button onClick={() => handleSendWhatsApp(g)} className="flex-1 py-3.5 rounded-2xl bg-primary/10 text-primary font-black italic uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 shadow-sm hover:bg-primary hover:text-white transition-all transform active:scale-95 group/btn">
                <span className="material-symbols-outlined text-base transition-transform group-hover/btn:rotate-12">chat</span> ENVIAR WhatsApp
              </button>
              <button onClick={() => navigate(`/rsvp/${id}?guest=${encodeURIComponent(g.name)}`)} className="px-6 py-3.5 rounded-2xl bg-white/5 font-black italic uppercase tracking-widest text-[10px] text-slate-300 hover:text-white hover:bg-white/10 transition-all flex items-center gap-2 transform active:scale-95">
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
      const currentAllotted = prev.allotted || { adults: 0, teens: 0, kids: 0, infants: 0 };
      const newVal = Math.max(0, (currentAllotted[key] || 0) + delta);
      const newAllotted = { ...currentAllotted, [key]: newVal };

      const defaultCompanionNames = { adults: [], teens: [], kids: [], infants: [] };
      const newCompanionNames = { ...(prev.companionNames || defaultCompanionNames) };
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
      const defaultCompanionNames = { adults: [], teens: [], kids: [], infants: [] };
      const newCompanionNames = { ...(prev.companionNames || defaultCompanionNames) };
      const currentArr = [...(newCompanionNames[key] || [])];
      currentArr[index] = name;
      newCompanionNames[key] = currentArr;
      return { ...prev, companionNames: newCompanionNames };
    });
  };

  return (
    <div className="bg-slate-950 min-h-screen pb-24 max-w-6xl mx-auto text-white font-display relative overflow-x-hidden">
      {/* Visual background accents */}
      <div className="fixed top-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="fixed bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600/5 blur-[100px] rounded-full pointer-events-none"></div>

      <header className="sticky top-0 z-40 bg-slate-950/60 backdrop-blur-xl border-b border-white/5 px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/dashboard')} className="size-10 flex items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-all">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest leading-none mb-1">Evento Activo</p>
            <h1 className="text-lg font-black italic tracking-tight">{invitation.eventName}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadExcel}
            className="hidden md:flex items-center gap-2 px-6 py-2.5 rounded-[18px] text-[11px] font-black uppercase tracking-widest bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all border border-white/5"
            title="Descargar Excel"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            Excel
          </button>

          <button
            onClick={handleDownloadExcel}
            className="md:hidden size-10 flex items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-all"
            title="Descargar Excel"
          >
            <span className="material-symbols-outlined">download</span>
          </button>

          <button
            onClick={() => {
              if (!limitCheck.allowed) return;
              setEditingId(null);
              setCurrentGuest({
                name: '',
                allotted: { adults: 0, teens: 0, kids: 0, infants: 0 },
                companionNames: { adults: [], teens: [], kids: [], infants: [] }
              });
              setShowModal('add');
            }}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-[18px] text-[11px] font-black uppercase tracking-widest transition-all ${limitCheck.allowed
              ? 'bg-primary text-white shadow-[0_10px_20px_rgba(19,91,236,0.2)] hover:scale-105'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'
              }`}
            disabled={!limitCheck.allowed}
          >
            <span className="material-symbols-outlined text-[18px]">person_add</span>
            {limitCheck.allowed ? 'Nuevo Invitado' : 'Límite'}
          </button>
        </div>
      </header>

      {/* Plan Upgrade Banner for Guests */}
      <div className="px-4 pt-2">
        <UpgradePrompt
          resourceName="invitados"
          currentCount={stats.total}
          limit={limitCheck.limit}
          showAlways={true}
        />
      </div>

      <div className="p-6 space-y-8 relative z-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <h2 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter">
              Invitados & <span className="text-primary">Confirmaciones</span>
            </h2>
            <p className="text-slate-500 font-medium">Gestioná el acceso y la distribución de tus invitados.</p>
          </div>

          <div className="grid grid-cols-4 gap-3 md:w-auto">
            <StatBtn label="TOTAL" val={stats.total} active={filter === 'all'} onClick={() => { setFilter('all'); setCatFilter('all'); }} color="primary" />
            <StatBtn label="SÍ" val={stats.si} active={filter === 'confirmed'} onClick={() => { setFilter('confirmed'); setCatFilter('all'); }} color="emerald-500" />
            <StatBtn label="NO" val={stats.no} active={filter === 'declined'} onClick={() => { setFilter('declined'); setCatFilter('all'); }} color="red-500" />
            <StatBtn label="PEND." val={stats.pend} active={filter === 'pending'} onClick={() => { setFilter('pending'); setCatFilter('all'); }} color="slate-400" />
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {invitation.giftDetail && (
            <div className="bg-white/5 border border-white/5 rounded-2xl px-4 py-2 flex items-center gap-3 shrink-0">
              <span className="material-symbols-outlined text-[18px] text-primary">redeem</span>
              <div className="flex flex-col">
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{invitation.giftType === 'alias' ? 'Alias / CBU' : 'Lista'}</span>
                <span className="text-[10px] font-bold text-slate-300">{invitation.giftDetail}</span>
              </div>
              <button
                onClick={() => { navigator.clipboard.writeText(invitation.giftDetail); alert('Copiado!'); }}
                className="ml-2 p-1 hover:bg-white/5 rounded-lg transition-colors"
              >
                <span className="material-symbols-outlined text-[14px] text-slate-500">content_copy</span>
              </button>
            </div>
          )}
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

        <div className="relative group">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors">search</span>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre..."
            className="w-full pl-12 pr-4 py-4 rounded-[20px] bg-white/5 border border-white/10 text-sm font-bold placeholder:text-slate-600 focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all backdrop-blur-md"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xl">
          <div className="bg-slate-900 w-full max-w-lg rounded-[40px] p-8 border border-white/10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] space-y-6 animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center shrink-0">
              <h3 className="text-2xl font-black italic uppercase tracking-tighter">{showModal === 'add' ? 'Nuevo Invitado' : 'Editar Cupos'}</h3>
              <button onClick={() => setShowModal(null)} className="size-10 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-full transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-6 overflow-y-auto no-scrollbar pb-6 px-1">
              <div className="space-y-2">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Información General</p>
                <input
                  required
                  type="text"
                  value={currentGuest.name}
                  onChange={e => setCurrentGuest({ ...currentGuest, name: e.target.value })}
                  className="w-full h-14 rounded-2xl bg-white/5 border border-white/10 px-6 font-bold text-white outline-none focus:ring-4 focus:ring-primary/20 transition-all"
                  placeholder="Nombre completo"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <AllotmentInput label="Adultos (18+)" val={currentGuest.allotted?.adults || 0} onDelta={(d: number) => updateAllotted('adults', d)} />
                <AllotmentInput label="Adolesc. (11-17)" val={currentGuest.allotted?.teens || 0} onDelta={(d: number) => updateAllotted('teens', d)} />
                <AllotmentInput label="Niños (3-11)" val={currentGuest.allotted?.kids || 0} onDelta={(d: number) => updateAllotted('kids', d)} />
                <AllotmentInput label="Bebés (0-3)" val={currentGuest.allotted?.infants || 0} onDelta={(d: number) => updateAllotted('infants', d)} />
              </div>

              {/* Status toggle for editing */}
              {showModal === 'edit' && currentGuest.status && currentGuest.status !== 'pending' && (
                <div className="pt-6 border-t border-white/5">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Estado de Confirmación</p>
                  <div className="flex gap-3">
                    <div className={`flex-1 px-4 py-3 rounded-2xl text-xs font-black uppercase flex items-center gap-3 border ${currentGuest.status === 'confirmed'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-red-500/10 text-red-400 border-red-500/20'
                      }`}>
                      <span className={`size-2.5 rounded-full ${currentGuest.status === 'confirmed' ? 'bg-emerald-500' : 'bg-red-500'} animate-pulse`}></span>
                      {currentGuest.status === 'confirmed' ? 'Confirmado' : 'Cancelado'}
                    </div>
                    <button
                      type="button"
                      onClick={() => setCurrentGuest({ ...currentGuest, status: 'pending' })}
                      className="px-6 py-3 rounded-2xl text-[10px] font-black uppercase bg-white/5 hover:bg-white/10 text-slate-400 transition-all"
                    >
                      Resetear
                    </button>
                  </div>
                </div>
              )}

              {((currentGuest.companionNames?.adults?.length || 0) > 0 ||
                (currentGuest.companionNames?.teens?.length || 0) > 0 ||
                (currentGuest.companionNames?.kids?.length || 0) > 0 ||
                (currentGuest.companionNames?.infants?.length || 0) > 0) && (
                  <div className="space-y-4 pt-6 border-t border-white/5">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Nombres de acompañantes</p>

                    {(currentGuest.allotted?.adults || 0) > 0 && (
                      <div className="relative">
                        <label className="absolute -top-2 left-4 px-1.5 bg-slate-900 text-[8px] font-black text-slate-500 uppercase tracking-widest z-10">Principal</label>
                        <input
                          type="text"
                          value={currentGuest.name}
                          disabled
                          className="w-full h-14 rounded-2xl bg-white/5 border border-white/10 px-6 text-sm font-bold text-slate-400 opacity-50 cursor-not-allowed"
                        />
                      </div>
                    )}
                    {currentGuest.companionNames?.adults?.slice(0, Math.max(0, (currentGuest.allotted?.adults || 0) - 1)).map((name, i) => (
                      <CompanionNameInput key={`a-${i}`} label={`Adulto ${i + 2}`} value={name} onChange={val => updateCompanionName('adults', i, val)} />
                    ))}
                    {currentGuest.companionNames?.teens?.map((name, i) => (
                      <CompanionNameInput key={`t-${i}`} label={`Adolescente ${i + 1}`} value={name} onChange={val => updateCompanionName('teens', i, val)} />
                    ))}
                    {currentGuest.companionNames?.kids?.map((name, i) => (
                      <CompanionNameInput key={`k-${i}`} label={`Niño ${i + 1}`} value={name} onChange={val => updateCompanionName('kids', i, val)} />
                    ))}
                    {currentGuest.companionNames?.infants?.map((name, i) => (
                      <CompanionNameInput key={`i-${i}`} label={`Bebé ${i + 1}`} value={name} onChange={val => updateCompanionName('infants', i, val)} />
                    ))}
                  </div>
                )}
            </div>

            <button
              onClick={handleSaveGuest}
              className="w-full h-16 bg-primary text-white font-black italic uppercase tracking-widest rounded-3xl shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all shrink-0 mt-auto"
            >
              Guardar Cambios
            </button>
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
  <div className="relative group">
    <label className="absolute -top-2 left-4 px-1.5 bg-slate-900 text-[8px] font-black text-slate-500 uppercase tracking-widest z-10 group-focus-within:text-primary transition-colors">{label}</label>
    <input
      type="text"
      value={value || ""}
      onChange={e => onChange(e.target.value)}
      className="w-full h-14 rounded-2xl bg-white/5 border border-white/10 px-6 text-sm font-black italic text-white outline-none focus:ring-4 focus:ring-primary/10 transition-all placeholder:text-slate-700"
      placeholder="Escribir nombre..."
    />
  </div>
);


const StatBtn = ({ label, val, active, onClick, color }: any) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center justify-center p-4 rounded-[24px] border transition-all ${active
      ? `${color === 'primary' ? 'bg-primary' : `bg-${color}`} text-white shadow-xl shadow-primary/20 scale-105 z-10 border-white/20`
      : 'bg-white/5 backdrop-blur-md border-white/5 text-slate-400 hover:bg-white/10'
      }`}
  >
    <span className="text-2xl font-black italic leading-none mb-1 tracking-tighter">{val}</span>
    <span className="text-[7px] font-black uppercase tracking-[0.2em]">{label}</span>
  </button>
);

const CategoryBadge = ({ label, val, dotColor, active, onClick }: { label: string, val: number, dotColor: string, active?: boolean, onClick?: () => void }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-3 px-5 py-2.5 rounded-full border transition-all shrink-0 shadow-lg ${active
      ? 'bg-white text-slate-950 border-white font-black italic'
      : 'bg-white/5 backdrop-blur-md border-white/10 text-slate-400 hover:border-white/20'
      }`}
  >
    <span className={`size-1.5 rounded-full ${active ? 'bg-primary animate-pulse' : dotColor}`}></span>
    <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
    <span className={`text-xs ${active ? 'text-slate-950' : 'text-white'}`}>{val}</span>
  </button>
);

const AllotmentInput = ({ label, val, onDelta }: any) => (
  <div className="space-y-2">
    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-3">{label}</p>
    <div className="flex items-center gap-1 bg-white/5 p-1.5 rounded-[24px] border border-white/10 backdrop-blur-md">
      <button
        type="button"
        onClick={() => onDelta(-1)}
        className="size-10 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-black transition-all flex items-center justify-center border border-white/5"
      >
        <span className="material-symbols-outlined text-sm">remove</span>
      </button>
      <span className="flex-1 text-center font-black italic text-lg tracking-tighter">{val}</span>
      <button
        type="button"
        onClick={() => onDelta(1)}
        className="size-10 rounded-2xl bg-primary text-white font-black flex items-center justify-center shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
      >
        <span className="material-symbols-outlined text-sm text-[20px]">add</span>
      </button>
    </div>
  </div>
);

export default GuestsScreen;
