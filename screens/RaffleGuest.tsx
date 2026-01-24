
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { raffleService } from '../services/raffleService';

const RaffleGuest: React.FC = () => {
    const { id: eventId } = useParams<{ id: string }>();
    const [name, setName] = useState('');
    const [status, setStatus] = useState<'INPUT' | 'SUBMITTING' | 'SUCCESS'>('INPUT');
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !eventId) return;

        setStatus('SUBMITTING');
        setError('');

        try {
            await raffleService.joinRaffle(eventId, name);
            setStatus('SUCCESS');
        } catch (err: any) {
            setError(err.message || 'Error al unirse.');
            setStatus('INPUT');
        }
    };

    if (status === 'SUCCESS') {
        return (
            <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-green-600/10 z-0"></div>
                <div className="relative z-10 text-center animate-fade-in">
                    <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/50 animate-bounce-small">
                        <span className="material-symbols-outlined text-5xl text-white">check</span>
                    </div>
                    <h1 className="text-4xl font-black mb-2">¡Estás dentro!</h1>
                    <p className="text-xl text-green-200 mb-8 font-medium">Buena suerte, {name}</p>
                    <p className="text-slate-400 text-sm max-w-xs mx-auto">Mira la pantalla gigante para ver si ganas.</p>

                    <button
                        onClick={() => { setStatus('INPUT'); setName(''); }}
                        className="mt-12 text-slate-500 hover:text-white transition-colors flex items-center gap-2 mx-auto"
                    >
                        <span className="material-symbols-outlined">person_add</span>
                        Registrar a otra persona
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col p-6 relative overflow-hidden">
            <div className="absolute top-[-20%] right-[-20%] w-[80%] h-[80%] bg-indigo-600/20 rounded-full blur-[100px] pointer-events-none"></div>

            <header className="flex items-center justify-center py-6 relative z-10">
                <div className="flex items-center gap-2 opacity-80">
                    <span className="material-symbols-outlined text-yellow-400">emoji_events</span>
                    <span className="font-bold tracking-widest uppercase text-sm">Sorteo del Evento</span>
                </div>
            </header>

            <main className="flex-1 flex flex-col justify-center items-center relative z-10 w-full max-w-md mx-auto">
                <div className="w-full text-center mb-10">
                    <h1 className="text-5xl font-black mb-4 tracking-tight leading-none bg-clip-text text-transparent bg-gradient-to-br from-white to-slate-400">
                        ¡Únete al<br /><span className="text-indigo-500">Sorteo!</span>
                    </h1>
                    <p className="text-slate-400 text-lg">Ingresa tu nombre para participar.</p>
                </div>

                <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <span className="material-symbols-outlined text-slate-500 group-focus-within:text-indigo-500 transition-colors">person</span>
                        </div>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-slate-800 border-2 border-slate-700 text-white text-lg font-bold rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 transition-all placeholder:text-slate-600 placeholder:font-normal"
                            placeholder="Tu Nombre"
                            required
                            disabled={status === 'SUBMITTING'}
                        />
                    </div>

                    {error && (
                        <div className="bg-red-500/10 text-red-500 p-3 rounded-xl text-sm font-bold text-center border border-red-500/20">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={status === 'SUBMITTING'}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xl font-bold py-4 rounded-2xl shadow-lg shadow-indigo-600/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                        {status === 'SUBMITTING' ? (
                            <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        ) : (
                            <>
                                <span>PARTICIPAR</span>
                                <span className="material-symbols-outlined">arrow_forward</span>
                            </>
                        )}
                    </button>
                </form>

                <p className="mt-8 text-center text-slate-600 text-xs">
                    Al participar aceptas ser parte de la dinámica del evento.
                </p>
            </main>
        </div>
    );
};

export default RaffleGuest;
