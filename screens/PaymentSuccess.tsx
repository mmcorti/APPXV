import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
// import { useAuth } from '../hooks/useAuth'; // Note: Adjust import based on the actual path/context

const PaymentSuccess: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [countdown, setCountdown] = useState(5);

    useEffect(() => {
        const timer = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    navigate('/dashboard', { replace: true });
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [navigate]);

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center font-display">
            <div className="bg-white/5 border border-white/10 p-12 rounded-[40px] max-w-md w-full backdrop-blur-3xl shadow-2xl animate-fade-in-up">
                <span className="material-symbols-outlined text-[80px] text-emerald-400 mb-6 drop-shadow-[0_0_20px_rgba(52,211,153,0.4)] block">check_circle</span>
                <h1 className="text-3xl font-black text-white mb-4 tracking-tight">¡Pago Exitoso!</h1>
                <p className="text-slate-400 mb-8 leading-relaxed">
                    Tu suscripción ha sido confirmada. Disfruta de todos los beneficios de tu nuevo plan en APPXV.
                </p>
                <button
                    onClick={() => navigate('/dashboard', { replace: true })}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-4 px-8 rounded-full transition-all shadow-xl active:scale-95 uppercase tracking-wide"
                >
                    Ir al Dashboard ({countdown}s)
                </button>
            </div>
        </div>
    );
};

export default PaymentSuccess;
