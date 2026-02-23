import React from 'react';
import { useNavigate } from 'react-router-dom';

const PaymentFailure: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center font-display">
            <div className="bg-white/5 border border-white/10 p-12 rounded-[40px] max-w-md w-full backdrop-blur-3xl shadow-2xl animate-fade-in-up">
                <span className="material-symbols-outlined text-[80px] text-red-500 mb-6 drop-shadow-[0_0_20px_rgba(239,68,68,0.4)] block">error</span>
                <h1 className="text-3xl font-black text-white mb-4 tracking-tight">El pago falló</h1>
                <p className="text-slate-400 mb-8 leading-relaxed">
                    Hubo un problema al procesar tu pago. Por favor intenta de nuevo con otro método.
                </p>
                <div className="flex flex-col gap-4">
                    <button
                        onClick={() => navigate('/login', { replace: true })}
                        className="w-full bg-slate-700 hover:bg-slate-600 text-white font-black py-4 px-8 rounded-full transition-all shadow-xl active:scale-95 uppercase tracking-wide"
                    >
                        Intentar de nuevo
                    </button>
                    <button
                        onClick={() => navigate('/dashboard', { replace: true })}
                        className="w-full bg-transparent border-2 border-slate-700 hover:border-slate-500 text-slate-400 hover:text-white font-bold py-4 px-8 rounded-full transition-all active:scale-95 uppercase tracking-wide"
                    >
                        Volver al Dashboard
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PaymentFailure;
