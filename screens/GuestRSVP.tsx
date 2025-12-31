
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { InvitationData, Guest, GuestAllotment, GuestCompanionNames } from '../types';

interface GuestRSVPScreenProps {
  invitations: InvitationData[];
  onRsvpSubmit: (invId: string, guestData: Partial<Guest>) => Promise<void>;
}

const GuestRSVPScreen: React.FC<GuestRSVPScreenProps> = ({ invitations, onRsvpSubmit }) => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const invitation = invitations.find(inv => inv.id === id);

  /* New logic for Public Invitation */
  const guestNameParam = searchParams.get('guest');
  const [showNameInput, setShowNameInput] = useState(!guestNameParam);
  const [guestNameInput, setGuestNameInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Initial loading timer to prevent flash of error
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  const [name, setName] = useState(guestNameParam || '');
  const [attending, setAttending] = useState<boolean | null>(null);
  const [confirmedAllotment, setConfirmedAllotment] = useState<GuestAllotment>({
    adults: 1, teens: 0, kids: 0, infants: 0
  });
  const [companionNames, setCompanionNames] = useState<GuestCompanionNames>({
    adults: [], teens: [], kids: [], infants: []
  });
  const [submitted, setSubmitted] = useState(false);

  const foundGuest = invitation?.guests.find(g => g.name.toLowerCase() === name.toLowerCase());



  useEffect(() => {
    // If we have a name (either from param or input) and invitation is loaded, try to find the guest
    if (invitation && name) {
      const existingGuest = invitation.guests.find(g => g.name.toLowerCase() === name.toLowerCase());

      if (existingGuest) {
        if (existingGuest.status !== 'pending') {
          setAttending(existingGuest.status === 'confirmed');
          setConfirmedAllotment(existingGuest.confirmed);
          setCompanionNames(existingGuest.companionNames || { adults: [], teens: [], kids: [], infants: [] });
          setSubmitted(true);
        } else {
          // Default for pending existing guest
          setConfirmedAllotment({ adults: existingGuest.allotted.adults || 1, teens: existingGuest.allotted.teens, kids: existingGuest.allotted.kids, infants: existingGuest.allotted.infants });
          setCompanionNames({ adults: [existingGuest.name], teens: [], kids: [], infants: [] });
        }
      } else {
        // New guest (not in list) -> Default values
        setConfirmedAllotment({ adults: 1, teens: 0, kids: 0, infants: 0 });
        setCompanionNames({ adults: [name], teens: [], kids: [], infants: [] });
      }
    }
  }, [invitation, name]);

  if (!invitation) {
    return loading ? (
      <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    ) : (
      <div className="p-10 text-center font-bold text-red-500">Invitación no válida o no encontrada.</div>
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
    try {
      await onRsvpSubmit(invitation.id, {
        name: name,
        status: attending ? 'confirmed' : 'declined',
        confirmed: attending ? confirmedAllotment : { adults: 0, teens: 0, kids: 0, infants: 0 },
        companionNames: attending ? companionNames : undefined
      });

      setSubmitted(true);
    } catch (error) {
      console.error('Error submitting RSVP:', error);
      alert('Hubo un error al guardar tu respuesta. Por favor intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  const updateConfirmed = (key: keyof GuestAllotment, delta: number) => {
    // if (!foundGuest) return; // Allow even if new guest
    const maxVal = foundGuest?.allotted[key] ?? 10; // Default max for new guests
    const newVal = Math.min(maxVal, Math.max(0, confirmedAllotment[key] + delta));

    setConfirmedAllotment(prev => ({
      ...prev,
      [key]: newVal
    }));

    setCompanionNames(prev => {
      const currentNames = [...prev[key]];
      if (delta > 0) {
        while (currentNames.length < newVal) currentNames.push("");
      } else {
        while (currentNames.length > newVal) currentNames.pop();
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
      <div className="bg-background-light dark:bg-background-dark min-h-screen flex items-center justify-center p-6 text-center max-w-[480px] mx-auto text-slate-900 dark:text-white font-display">
        <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700 animate-in zoom-in duration-300 w-full overflow-y-auto max-h-[90vh] no-scrollbar">
          <div className={`size-16 rounded-full flex items-center justify-center text-white mx-auto mb-4 ${attending ? 'bg-green-500 shadow-green-500/20 shadow-lg' : 'bg-red-500 shadow-red-500/20 shadow-lg'}`}>
            <span className="material-symbols-outlined text-4xl">{attending ? 'check_circle' : 'cancel'}</span>
          </div>
          <h2 className="text-2xl font-bold mb-2">Respuesta Registrada</h2>
          <p className="text-slate-500 dark:text-slate-400">Gracias <b>{name}</b>, esta es la información guardada.</p>

          <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl text-left border border-slate-100 dark:border-slate-700">
            <h4 className="text-xs font-bold uppercase text-slate-400 mb-2">Estado de Invitación</h4>
            <p className="text-sm font-bold flex items-center gap-2">
              <span className={`size-2 rounded-full ${attending ? 'bg-green-500' : 'bg-red-500'}`}></span>
              {attending ? 'Confirmó asistencia' : 'Informó que no podrá asistir'}
            </p>

            {attending && (
              <div className="mt-4 space-y-3">
                <p className="text-xs font-bold text-slate-400 uppercase">Invitados confirmados:</p>
                <div className="flex flex-col gap-1.5">
                  {[...companionNames.adults, ...companionNames.teens, ...companionNames.kids, ...companionNames.infants].filter(n => n.trim() !== "").map((n, i) => (
                    <div key={i} className="bg-white dark:bg-slate-800 p-3 rounded-xl text-xs font-bold shadow-sm border border-slate-100 dark:border-slate-700 flex items-center gap-3">
                      <span className="material-symbols-outlined text-sm text-primary">person</span>
                      {n}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-col gap-3">
            <button onClick={() => navigate('/location/' + invitation.id)} className="w-full h-12 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all">Ver Ubicación</button>
            <button onClick={() => navigate(-1)} className="w-full h-12 bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white font-bold rounded-xl border border-slate-200 dark:border-slate-600 transition-all">Volver</button>
            <button onClick={() => setSubmitted(false)} className="text-xs font-bold text-slate-400 hover:text-primary transition-colors flex items-center justify-center gap-1">
              <span className="material-symbols-outlined text-sm">edit</span> MODIFICAR RESPUESTA
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background-light dark:bg-background-dark min-h-screen pb-10 max-w-[480px] mx-auto text-slate-900 dark:text-white font-display relative">
      {/* Botón de volver flotante */}
      <button
        onClick={() => navigate(-1)}
        className="absolute top-4 left-4 z-40 size-10 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white shadow-lg active:scale-90 transition-transform"
      >
        <span className="material-symbols-outlined">arrow_back</span>
      </button>

      <div className="relative aspect-[3/4] overflow-hidden">
        <img src={invitation.image} alt="Event" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background-light dark:from-background-dark via-transparent to-transparent"></div>
        <div className="absolute bottom-6 left-6 right-6 text-center">
          <h1 className="text-3xl font-black font-serif mb-2 leading-tight drop-shadow-sm">{invitation.eventName}</h1>
          <p className="text-sm font-medium italic opacity-80">{invitation.message}</p>
        </div>
      </div>

      {showNameInput ? (
        <form onSubmit={handleNameSubmit} className="px-6 space-y-6 -mt-4 relative z-10">
          <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700 space-y-6 text-center">
            <h2 className="text-xl font-bold">¡Bienvenido!</h2>
            <p className="text-slate-500 text-sm">Por favor ingresa tu nombre completo para buscar tu invitación o registrarte.</p>
            <input
              type="text"
              value={guestNameInput}
              onChange={e => setGuestNameInput(e.target.value)}
              placeholder="Tu Nombre Completo"
              className="w-full h-14 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-4 text-center font-bold text-lg focus:ring-2 focus:ring-primary/20 outline-none"
            />
            <button type="submit" disabled={!guestNameInput.trim()} className="w-full h-14 bg-primary text-white font-bold rounded-2xl shadow-lg shadow-primary/20 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50">
              Continuar
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleSubmit} className="px-6 space-y-6 -mt-4 relative z-10">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700 space-y-6">
            <h2 className="text-xl font-bold text-center">Hola {name}, <br />¿Vas a asistir?</h2>

            <div className="flex gap-3">
              <button type="button" onClick={() => setAttending(true)} className={`flex-1 py-4 rounded-2xl font-bold border transition-all ${attending === true ? 'bg-green-500 text-white border-green-500 shadow-lg shadow-green-500/20' : 'bg-slate-50 dark:bg-slate-900 text-slate-400 border-slate-100 dark:border-slate-700'}`}>Sí, asisto</button>
              <button type="button" onClick={() => setAttending(false)} className={`flex-1 py-4 rounded-2xl font-bold border transition-all ${attending === false ? 'bg-red-500 text-white border-red-500 shadow-lg shadow-red-500/20' : 'bg-slate-50 dark:bg-slate-900 text-slate-400 border-slate-100 dark:border-slate-700'}`}>No puedo</button>
            </div>

            {attending === true && (
              <div className="space-y-6 animate-in slide-in-from-top-4 duration-300">
                <p className="text-center text-xs font-bold text-slate-400 uppercase tracking-widest">Confirma los cupos</p>
                <div className="grid grid-cols-2 gap-4">
                  <RSVPCount label="Adultos" val={confirmedAllotment.adults} max={foundGuest?.allotted.adults || 5} onDelta={d => updateConfirmed('adults', d)} />
                  <RSVPCount label="Adol." val={confirmedAllotment.teens} max={foundGuest?.allotted.teens || 5} onDelta={d => updateConfirmed('teens', d)} />
                  <RSVPCount label="Niños" val={confirmedAllotment.kids} max={foundGuest?.allotted.kids || 5} onDelta={d => updateConfirmed('kids', d)} />
                  <RSVPCount label="Bebés" val={confirmedAllotment.infants} max={foundGuest?.allotted.infants || 5} onDelta={d => updateConfirmed('infants', d)} />
                </div>

                {/* Sección de Nombres */}
                {(confirmedAllotment.adults > 0 || confirmedAllotment.teens > 0 || confirmedAllotment.kids > 0 || confirmedAllotment.infants > 0) && (
                  <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                    <p className="text-[10px] font-black text-slate-400 uppercase text-center tracking-widest">Ingresa los nombres de quienes asisten</p>

                    {Object.keys(companionNames).map((key) => {
                      const groupKey = key as keyof GuestCompanionNames;
                      return companionNames[groupKey].map((n, i) => (
                        <div key={`${groupKey}-${i}`} className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase ml-2">{groupKey === 'adults' ? 'Adulto' : groupKey === 'teens' ? 'Adolescente' : groupKey === 'kids' ? 'Niño' : 'Bebé'} {i + 1}</label>
                          <input
                            type="text"
                            value={n}
                            onChange={(e) => updateName(groupKey, i, e.target.value)}
                            className="w-full h-12 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-700 px-4 text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                            placeholder="Nombre (opcional)"
                          />
                        </div>
                      ));
                    })}
                  </div>
                )}
              </div>
            )}

            <button type="submit" disabled={attending === null || submitting} className="w-full h-14 bg-primary text-white font-bold rounded-2xl shadow-lg shadow-primary/20 disabled:opacity-50 hover:scale-[1.01] active:scale-[0.99] transition-all">
              {submitting ? 'Guardando...' : 'Confirmar Respuesta'}
            </button>
          </div>

          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm text-center">
            <h3 className="text-xs font-bold uppercase text-slate-400 mb-3 tracking-widest">Información de Regalos</h3>
            <div className="flex flex-col items-center gap-2">
              <p className="text-[10px] font-bold text-slate-500 uppercase">{invitation.giftType === 'alias' ? 'CBU / Alias Bancario' : 'Lista de Compras'}</p>
              <p className="text-sm font-bold text-primary break-all">{invitation.giftDetail}</p>
              <button type="button" onClick={() => { navigator.clipboard.writeText(invitation.giftDetail); alert('Copiado!'); }} className="text-[10px] font-bold text-slate-400 hover:text-primary mt-1 underline">COPIAR DATOS</button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
};

const RSVPCount = ({ label, val, max, onDelta }: any) => (
  <div className={`p-3 rounded-2xl border transition-all ${max === 0 ? 'opacity-20 grayscale pointer-events-none' : 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-700'}`}>
    <p className="text-[8px] font-black text-slate-400 uppercase mb-2">{label} ({max})</p>
    <div className="flex items-center justify-between">
      <button type="button" disabled={val <= 0} onClick={() => onDelta(-1)} className="size-8 rounded-lg bg-white dark:bg-slate-800 text-slate-500 shadow-sm disabled:opacity-50 flex items-center justify-center font-bold">-</button>
      <span className="font-bold text-base">{val}</span>
      <button type="button" disabled={val >= max} onClick={() => onDelta(1)} className="size-8 rounded-lg bg-primary text-white shadow-sm disabled:opacity-50 flex items-center justify-center font-bold">+</button>
    </div>
  </div>
);

export default GuestRSVPScreen;
