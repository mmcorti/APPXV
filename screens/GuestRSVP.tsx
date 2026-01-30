import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { InvitationData, Guest, GuestAllotment, GuestCompanionNames } from '../types';
import Countdown from '../components/Countdown';

interface GuestRSVPScreenProps {
  invitations: InvitationData[];
  onRsvpSubmit: (invId: string, guestData: Partial<Guest>) => Promise<void>;
  loading?: boolean;
}

const GuestRSVPScreen: React.FC<GuestRSVPScreenProps> = ({ invitations, onRsvpSubmit, loading: parentLoading }) => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const invitation = invitations.find(inv => inv.id === id);

  const guestNameParam = searchParams.get('guest');
  const [showNameInput, setShowNameInput] = useState(!guestNameParam);
  const [guestNameInput, setGuestNameInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState(guestNameParam || '');
  const [attending, setAttending] = useState<boolean | null>(null);
  const [confirmedAllotment, setConfirmedAllotment] = useState<GuestAllotment>({
    adults: 1, teens: 0, kids: 0, infants: 0
  });
  const [companionNames, setCompanionNames] = useState<GuestCompanionNames>({
    adults: [], teens: [], kids: [], infants: []
  });
  const [originalCompanionNames, setOriginalCompanionNames] = useState<GuestCompanionNames>({
    adults: [], teens: [], kids: [], infants: []
  });
  const [submitted, setSubmitted] = useState(false);

  const foundGuest = invitation?.guests.find(g => g.name.toLowerCase() === name.toLowerCase());

  useEffect(() => {
    if (invitation && name) {
      const existingGuest = invitation.guests.find(g => g.name.toLowerCase() === name.toLowerCase());

      if (existingGuest) {
        if (existingGuest.status !== 'pending') {
          setAttending(existingGuest.status === 'confirmed');
          setConfirmedAllotment(existingGuest.confirmed || { adults: 0, teens: 0, kids: 0, infants: 0 });
          setCompanionNames(existingGuest.companionNames || { adults: [], teens: [], kids: [], infants: [] });
          setSubmitted(true);
        } else {
          const getMainCategory = (allotted: GuestAllotment) => {
            if (allotted.adults > 0) return 'adults';
            if (allotted.teens > 0) return 'teens';
            if (allotted.kids > 0) return 'kids';
            if (allotted.infants > 0) return 'infants';
            return 'adults';
          };

          const mainCategory = getMainCategory(existingGuest.allotted);
          const a = existingGuest.allotted;
          const existingNames = existingGuest.companionNames || { adults: [], teens: [], kids: [], infants: [] };

          const buildNamesWithSlots = (category: 'adults' | 'teens' | 'kids' | 'infants', allottedCount: number) => {
            if (allottedCount <= 0) return [];
            const result: string[] = [];
            const isMainCategory = category === mainCategory;
            const existingCompanions = existingNames[category] || [];

            if (isMainCategory) {
              result.push(existingGuest.name);
              for (let i = 1; i < allottedCount; i++) {
                const companionName = existingCompanions[i] || '';
                result.push(companionName === existingGuest.name ? '' : companionName);
              }
            } else {
              for (let i = 0; i < allottedCount; i++) {
                result.push(existingCompanions[i] || '');
              }
            }
            return result;
          };

          const namesWithSlots = {
            adults: buildNamesWithSlots('adults', a.adults || 0),
            teens: buildNamesWithSlots('teens', a.teens || 0),
            kids: buildNamesWithSlots('kids', a.kids || 0),
            infants: buildNamesWithSlots('infants', a.infants || 0)
          };

          setCompanionNames(namesWithSlots);
          setOriginalCompanionNames(JSON.parse(JSON.stringify(namesWithSlots)));
        }
      } else {
        setConfirmedAllotment({ adults: 1, teens: 0, kids: 0, infants: 0 });
        setCompanionNames({ adults: [name], teens: [], kids: [], infants: [] });
      }
    }
  }, [invitation, name]);

  if (!invitation) {
    return parentLoading ? (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    ) : (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-10 text-center font-black italic text-red-500 uppercase tracking-widest">Invitación no válida o no encontrada.</div>
    );
  }

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (guestNameInput.trim()) {
      setName(guestNameInput.trim());
      setShowNameInput(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (attending === null || submitting) return;

    setSubmitting(true);

    const mainCategory = getMainCategory(foundGuest?.allotted || confirmedAllotment);

    try {
      // FORCE Main Guest Name into the first slot of the main category if attending
      const finalCompanionNames = { ...companionNames };
      if (attending) {
        const currentMainList = [...finalCompanionNames[mainCategory]];
        if (currentMainList.length > 0) {
          currentMainList[0] = name; // Ensure slot 0 is the main guest name
          finalCompanionNames[mainCategory] = currentMainList;
        } else {
          // Should not happen if count > 0, but safety check
          finalCompanionNames[mainCategory] = [name];
        }
      }

      await onRsvpSubmit(invitation.id, {
        name: name,
        status: attending ? 'confirmed' : 'declined',
        confirmed: attending ? confirmedAllotment : { adults: 0, teens: 0, kids: 0, infants: 0 },
        companionNames: attending ? finalCompanionNames : undefined
      });

      setSubmitted(true);
    } catch (error) {
      console.error('Error submitting RSVP:', error);
      alert('Hubo un error al guardar tu respuesta. Por favor intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  const getMainCategory = (allotted: GuestAllotment) => {
    if (allotted.adults > 0) return 'adults';
    if (allotted.teens > 0) return 'teens';
    if (allotted.kids > 0) return 'kids';
    if (allotted.infants > 0) return 'infants';
    return 'adults';
  };

  const updateConfirmed = (key: keyof GuestAllotment, delta: number) => {
    const maxVal = foundGuest?.allotted[key] ?? 10;
    const newVal = Math.min(maxVal, Math.max(0, confirmedAllotment[key] + delta));
    const mainCategory = foundGuest ? getMainCategory(foundGuest.allotted) : 'adults';

    setConfirmedAllotment(prev => ({
      ...prev,
      [key]: newVal
    }));

    setCompanionNames(prev => {
      const currentNames = [...prev[key]];
      const originals = originalCompanionNames[key] || [];

      if (delta > 0) {
        while (currentNames.length < newVal) {
          const idx = currentNames.length;
          // Logic: Slot 0 of Main Category is ALWAYS the current Guest Name
          if (key === mainCategory && idx === 0) {
            currentNames.push(name);
          } else {
            // Otherwise, try to restore original name or empty
            // FIX: If original name was the main guest name (and we are not in slot 0), don't restore it to avoid dupes!
            const originalName = originals[idx] || '';
            currentNames.push(originalName === name ? '' : originalName);
          }
        }
      } else {
        while (currentNames.length > newVal) {
          currentNames.pop();
        }
      }
      return { ...prev, [key]: currentNames };
    });
  };

  const updateName = (key: keyof GuestCompanionNames, index: number, value: string) => {
    setCompanionNames(prev => {
      const newNames = [...prev[key]];
      newNames[index] = value;
      return { ...prev, [key]: newNames };
    });
  };

  if (submitted) {
    return (
      <div className="bg-slate-950 min-h-screen text-white font-display relative overflow-x-hidden">
        {/* Visual background accents */}
        <div className="fixed top-[-10%] right-[-10%] w-[60%] h-[60%] bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none"></div>
        <div className="fixed bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-600/5 blur-[100px] rounded-full pointer-events-none"></div>

        <button onClick={() => navigate(-1)} className="fixed top-6 left-6 z-50 size-12 flex items-center justify-center rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 text-slate-400 hover:text-white transition-all shadow-2xl">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>

        <div className="relative z-10 flex items-center justify-center min-h-screen p-6 text-center max-w-[480px] md:max-w-2xl mx-auto">
          <div className="bg-white/5 backdrop-blur-3xl p-10 rounded-[40px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] border border-white/10 animate-in zoom-in duration-500 w-full overflow-y-auto max-h-[90vh] no-scrollbar space-y-8">
            <div className={`size-20 rounded-3xl flex items-center justify-center text-white mx-auto shadow-2xl ${attending ? 'bg-gradient-to-br from-emerald-400 to-teal-600' : 'bg-gradient-to-br from-red-400 to-rose-600'}`}>
              <span className="material-symbols-outlined text-5xl">{attending ? 'check_circle' : 'cancel'}</span>
            </div>

            <div className="space-y-2">
              <h2 className="text-3xl font-black italic uppercase tracking-tighter">¡Respuesta Guardada!</h2>
              <p className="text-slate-400 text-sm font-medium">Gracias <b className="text-white italic">{name}</b>, esta es la información registrada.</p>
            </div>

            <div className="space-y-4">
              <div className="p-6 bg-white/5 rounded-3xl text-left border border-white/5">
                <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-3">Tu Estado</p>
                <div className="flex items-center gap-3">
                  <div className={`size-3 rounded-full ${attending ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></div>
                  <p className="font-black italic text-lg">{attending ? 'CONFIRMO ASISTENCIA' : 'NO PODRÉ ASISTIR'}</p>
                </div>

                {attending && (
                  <div className="mt-8 space-y-4 border-t border-white/5 pt-6">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Grupo Confirmado:</p>
                    <div className="flex flex-wrap gap-2">
                      {[...companionNames.adults, ...companionNames.teens, ...companionNames.kids, ...companionNames.infants].filter(n => n.trim() !== "").map((n, i) => (
                        <span key={i} className="bg-white/5 px-4 py-2 rounded-xl text-xs font-black italic border border-white/5 text-slate-300">
                          {n}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {attending && invitation.date && (
                <div className="p-6 bg-white/5 rounded-3xl border border-white/5 space-y-4">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Faltan:</p>
                  <Countdown targetDate={invitation.date} targetTime={invitation.time} />
                </div>
              )}

              {attending && invitation.dressCode && (
                <div className="p-6 bg-white/5 rounded-3xl border border-white/5 text-center space-y-4">
                  <p className="text-[10px] font-black text-primary uppercase tracking-[0.4em]">Dress Code</p>
                  <div className="flex justify-center items-end gap-2 my-2 opacity-50 scale-90">
                    <svg viewBox="0 0 24 40" className="w-8 h-12 fill-white"><circle cx="12" cy="4" r="3.5" /><path d="M12 8c-3 0-5.5 2-6 5l-1 8h3l1 18h6l1-18h3l-1-8c-.5-3-3-5-6-5z" /></svg>
                    <svg viewBox="0 0 24 40" className="w-8 h-12 fill-white"><circle cx="12" cy="4" r="3.5" /><path d="M12 8c-2.5 0-4.5 1.5-5 4l-.5 4h2l-1 23h3v-12h3v12h3l-1-23h2l-.5-4c-.5-2.5-2.5-4-5-4z" /><path d="M10 12l2 4 2-4" className="fill-primary" /></svg>
                  </div>
                  <p className="text-2xl font-black italic tracking-tighter uppercase">{invitation.dressCode}</p>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 pt-4">
              {attending && (
                <button onClick={() => navigate('/location/' + invitation.id)} className="w-full h-16 bg-primary text-white font-black italic uppercase tracking-widest rounded-3xl shadow-[0_15px_30px_rgba(19,91,236,0.2)] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined">map</span> Ver Ubicación
                </button>
              )}
              <button
                onClick={() => setSubmitted(false)}
                className="w-full h-16 bg-white/5 text-slate-400 font-black italic uppercase tracking-widest rounded-3xl border border-white/5 hover:bg-white/10 hover:text-white transition-all"
              >
                Modificar Respuesta
              </button>
              <button onClick={() => navigate('/dashboard')} className="text-[10px] font-black text-slate-600 uppercase tracking-widest hover:text-slate-400 py-4 transition-colors">Volver al Inicio</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-950 min-h-screen pb-24 text-white font-display relative overflow-x-hidden">
      {/* Background accents */}
      <div className="fixed top-[-10%] right-[-10%] w-[60%] h-[60%] bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="fixed bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-600/5 blur-[100px] rounded-full pointer-events-none"></div>

      <button onClick={() => navigate(-1)} className="fixed top-6 left-6 z-50 size-12 flex items-center justify-center rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 text-slate-400 hover:text-white transition-all shadow-2xl">
        <span className="material-symbols-outlined">arrow_back</span>
      </button>

      <div className="relative aspect-[3/4] overflow-hidden">
        <img src={invitation.image} alt="Event" className="w-full h-full object-cover scale-110" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent"></div>
        <div className="absolute bottom-12 left-8 right-8 text-center space-y-3">
          <p className="text-primary text-[10px] font-black uppercase tracking-[0.4em] mb-2 drop-shadow-lg">Estás Invitado a</p>
          <h1 className="text-4xl md:text-5xl font-black italic tracking-tighter uppercase drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)]">{invitation.eventName}</h1>
          <div className="flex justify-center"><div className="h-[2px] w-12 bg-primary/50"></div></div>
          <p className="text-sm font-bold italic text-slate-300 drop-shadow-md">{invitation.message}</p>
          {invitation.date && (
            <div className="mt-8">
              <Countdown targetDate={invitation.date} targetTime={invitation.time} />
            </div>
          )}
        </div>
      </div>

      {showNameInput ? (
        <form onSubmit={handleNameSubmit} className="px-6 space-y-6 -mt-8 relative z-10 max-w-lg mx-auto">
          <div className="bg-white/5 backdrop-blur-3xl p-10 rounded-[40px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] border border-white/10 space-y-8 text-center overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50"></div>

            <div className="space-y-2">
              <h2 className="text-3xl font-black italic uppercase tracking-tighter">¡Hola!</h2>
              <p className="text-slate-400 text-sm font-medium">Ingresá el nombre que figura en tu invitación.</p>
            </div>

            <input
              type="text"
              required
              value={guestNameInput}
              onChange={e => setGuestNameInput(e.target.value)}
              placeholder="Tu Nombre Completo"
              className="w-full h-16 rounded-[24px] bg-white/5 border border-white/10 px-6 text-center font-black italic text-xl text-white focus:ring-4 focus:ring-primary/10 outline-none transition-all placeholder:text-slate-700"
            />

            <button
              type="submit"
              disabled={!guestNameInput.trim()}
              className="w-full h-16 bg-primary text-white font-black italic uppercase tracking-widest rounded-[24px] shadow-[0_15px_30px_rgba(19,91,236,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
            >
              Ver Mi Invitación
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleSubmit} className="px-6 space-y-6 -mt-8 relative z-10 max-w-lg mx-auto">
          <div className="bg-white/5 backdrop-blur-3xl p-8 rounded-[40px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] border border-white/10 space-y-8 overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-50"></div>

            <div className="text-center space-y-2">
              <h2 className="text-2xl font-black italic uppercase tracking-tighter leading-tight">¿Confirmás tu <span className="text-primary">Asistencia</span>?</h2>
              <p className="text-slate-400 text-[11px] font-black uppercase tracking-widest">Invitado: {name}</p>
            </div>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setAttending(true)}
                className={`flex-1 py-5 rounded-[24px] font-black italic uppercase tracking-widest text-[11px] border transition-all flex flex-col items-center gap-1 ${attending === true
                  ? 'bg-emerald-500 text-white border-emerald-400 shadow-[0_10px_20px_rgba(16,185,129,0.2)]'
                  : 'bg-white/5 text-slate-500 border-white/5 hover:bg-white/10'
                  }`}
              >
                <span className="material-symbols-outlined text-2xl mb-1">done_all</span>
                Sí, Asisto
              </button>
              <button
                type="button"
                onClick={() => setAttending(false)}
                className={`flex-1 py-5 rounded-[24px] font-black italic uppercase tracking-widest text-[11px] border transition-all flex flex-col items-center gap-1 ${attending === false
                  ? 'bg-rose-500 text-white border-rose-400 shadow-[0_10px_20px_rgba(244,63,94,0.2)]'
                  : 'bg-white/5 text-slate-500 border-white/5 hover:bg-white/10'
                  }`}
              >
                <span className="material-symbols-outlined text-2xl mb-1">close</span>
                No Puedo
              </button>
            </div>

            {attending === true && (
              <div className="space-y-8 animate-in slide-in-from-top-4 duration-500">
                <div className="space-y-4">
                  <p className="text-center text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Confirma tus cupos</p>
                  <div className="grid grid-cols-2 gap-4">
                    <RSVPCount label="Adultos" val={confirmedAllotment.adults} max={foundGuest?.allotted.adults ?? 1} onDelta={(d: number) => updateConfirmed('adults', d)} />
                    <RSVPCount label="Adol." val={confirmedAllotment.teens} max={foundGuest?.allotted.teens ?? 0} onDelta={(d: number) => updateConfirmed('teens', d)} />
                    <RSVPCount label="Niños" val={confirmedAllotment.kids} max={foundGuest?.allotted.kids ?? 0} onDelta={(d: number) => updateConfirmed('kids', d)} />
                    <RSVPCount label="Bebés" val={confirmedAllotment.infants} max={foundGuest?.allotted.infants ?? 0} onDelta={(d: number) => updateConfirmed('infants', d)} />
                  </div>
                </div>

                {(confirmedAllotment.adults > 0 || confirmedAllotment.teens > 0 || confirmedAllotment.kids > 0 || confirmedAllotment.infants > 0) && (
                  <div className="space-y-5 pt-8 border-t border-white/5">
                    <p className="text-[10px] font-black text-slate-500 uppercase text-center tracking-widest">Nombres de acompañantes</p>

                    {(['adults', 'teens', 'kids', 'infants'] as const).map((groupKey) => {
                      const mainCategory = foundGuest ? getMainCategory(foundGuest.allotted) : 'adults';
                      return companionNames[groupKey].map((n, i) => {
                        const isMainGuest = groupKey === mainCategory && i === 0;
                        const labelName = groupKey === 'adults' ? 'Adulto' : groupKey === 'teens' ? 'Adol.' : groupKey === 'kids' ? 'Niño' : 'Bebé';

                        return (
                          <div key={`${groupKey}-${i}`} className="space-y-2 group">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4 group-focus-within:text-primary transition-colors">
                              {labelName} {i + 1} {isMainGuest && '(Tú)'}
                            </label>
                            <input
                              type="text"
                              value={n}
                              onChange={(e) => updateName(groupKey, i, e.target.value)}
                              readOnly={isMainGuest}
                              className={`w-full h-14 rounded-2xl bg-white/5 border border-white/10 px-6 text-sm font-black italic text-white outline-none transition-all ${isMainGuest ? 'opacity-50 cursor-not-allowed border-transparent' : 'focus:ring-4 focus:ring-primary/10 placeholder:text-slate-700'}`}
                              placeholder={isMainGuest ? '' : 'Escribir nombre...'}
                            />
                          </div>
                        );
                      });
                    })}
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={attending === null || submitting}
              className="w-full h-16 bg-primary text-white font-black italic uppercase tracking-widest rounded-3xl shadow-[0_15px_30px_rgba(19,91,236,0.2)] disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              {submitting ? 'Guardando...' : 'Confirmar Respuesta'}
            </button>
          </div>

          <div className="bg-white/5 backdrop-blur-xl p-8 rounded-[40px] border border-white/10 shadow-sm text-center space-y-6">
            <div className="space-y-1">
              <h3 className="text-xs font-black uppercase text-slate-500 tracking-[0.3em]">Mesa de Regalos</h3>
              <div className="flex justify-center"><div className="h-px w-8 bg-white/10"></div></div>
            </div>

            <div className="space-y-4">
              <div className="bg-white/5 p-4 rounded-3xl border border-white/5 inline-block">
                <span className="material-symbols-outlined text-primary text-3xl">redeem</span>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{invitation.giftType === 'alias' ? 'Alias Bancario (CBU)' : 'Lista de Bodas'}</p>
                <p className="text-lg font-black italic text-white break-all leading-tight">{invitation.giftDetail}</p>
              </div>
              <button
                type="button"
                onClick={() => { navigator.clipboard.writeText(invitation.giftDetail); alert('¡Copiado!'); }}
                className="px-6 py-2.5 rounded-full bg-white/5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white hover:bg-white/10 transition-all border border-white/5"
              >
                Copiar Datos
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
};

const RSVPCount = ({ label, val, max, onDelta }: any) => (
  <div className={`p-4 rounded-[24px] border transition-all flex flex-col justify-between h-28 ${max === 0
    ? 'opacity-20 grayscale pointer-events-none'
    : 'bg-white/5 backdrop-blur-md border-white/5'
    }`}>
    <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">{label}</p>
    <div className="flex items-center justify-between">
      <button
        type="button"
        disabled={val <= 0}
        onClick={() => onDelta(-1)}
        className="size-10 rounded-xl bg-white/5 text-slate-400 border border-white/5 disabled:opacity-20 flex items-center justify-center font-black transition-all hover:bg-white/10"
      >
        <span className="material-symbols-outlined text-sm">remove</span>
      </button>
      <div className="flex flex-col items-center">
        <span className="font-black italic text-2xl tracking-tighter text-white leading-none">{val}</span>
        <span className="text-[8px] text-slate-600 font-black mt-1 uppercase tracking-tighter">de {max}</span>
      </div>
      <button
        type="button"
        disabled={val >= max}
        onClick={() => onDelta(1)}
        className="size-10 rounded-xl bg-primary text-white shadow-lg shadow-primary/20 disabled:opacity-20 flex items-center justify-center font-black transition-all hover:scale-110 active:scale-90"
      >
        <span className="material-symbols-outlined text-base">add</span>
      </button>
    </div>
  </div>
);

export default GuestRSVPScreen;
