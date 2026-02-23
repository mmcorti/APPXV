import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '../types';

interface PricesProps {
    user: User;
}

const PricesScreen: React.FC<PricesProps> = ({ user }) => {
    const navigate = useNavigate();
    const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleCheckout = async (planId: string) => {
        setLoadingPlan(planId);
        setError(null);
        try {
            const response = await fetch('/api/payments/create-preference', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    planId,
                    userEmail: user.email,
                    userId: user.id
                })
            });

            const data = await response.json();
            if (data.success && data.init_point) {
                // Redirect user to MercadoPago checkout
                window.location.href = data.init_point;
            } else {
                throw new Error(data.error || 'Failed to initialize payment');
            }
        } catch (err: any) {
            console.error('Checkout error:', err);
            setError(err.message || 'Error de conexión. Inténtalo de nuevo.');
        } finally {
            setLoadingPlan(null);
        }
    };

    const plans = [
        {
            id: 'especial',
            name: 'INVITADO ESPECIAL',
            price: '$25.000',
            features: [
                '5 Eventos', '100 Invitados', 'Mesas Ilimitadas', 'Invitaciones Digitales Ilimitadas',
                '20 Staff', 'Control Hasta 50 Gastos, 20 Proveedores, 10 participantes',
                'FotoWall Pro (200 fotos)', 'Uso de IA en Games Sí'
            ],
            color: 'bg-gradient-to-br from-blue-600 to-indigo-700',
            textColor: 'text-blue-900'
        },
        {
            id: 'vip',
            name: 'INVITADO VIP',
            price: '$75.000',
            features: [
                '20 Eventos', '200 Invitados', 'Mesas Ilimitadas', 'Invitaciones Digitales Ilimitadas',
                '50 Staff', 'Hasta 500 Gastos, 50 Proveedores, 50 participantes',
                'FotoWall Premium (500 fotos)', 'Moderación Automática IA'
            ],
            color: 'bg-gradient-to-br from-amber-400 to-orange-600',
            textColor: 'text-amber-600'
        }
    ];

    return (
        <div className="min-h-screen bg-slate-950 text-white p-6 font-display overflow-x-hidden">
            <div className="max-w-6xl mx-auto py-12">
                <div className="flex items-center gap-4 mb-12">
                    <button onClick={() => navigate(-1)} className="p-3 bg-white/5 rounded-full hover:bg-white/10 transition-colors">
                        <span className="material-symbols-outlined text-white">arrow_back</span>
                    </button>
                    <h1 className="text-4xl font-black text-white italic uppercase tracking-tighter">
                        Mejora tu <span className="text-emerald-400">Plan</span>
                    </h1>
                </div>

                {error && (
                    <div className="mb-8 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center gap-3 text-red-500">
                        <span className="material-symbols-outlined">error</span>
                        <p>{error}</p>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                    {plans.map((plan) => (
                        <div key={plan.id} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[40px] p-8 flex flex-col hover:-translate-y-2 transition-transform duration-300">
                            <h3 className={`text-2xl font-black italic uppercase tracking-tighter mb-2 ${plan.textColor}`}>{plan.name}</h3>
                            <div className="flex items-baseline gap-2 mb-8">
                                <span className="text-5xl font-black">{plan.price}</span>
                                <span className="text-white/40 font-bold uppercase tracking-wider">ARS</span>
                            </div>

                            <ul className="space-y-4 mb-10 flex-1">
                                {plan.features.map((feature, idx) => (
                                    <li key={idx} className="flex items-center gap-3 text-white/80">
                                        <span className="material-symbols-outlined text-emerald-400 text-sm">check_circle</span>
                                        <span className="font-medium text-sm md:text-base">{feature}</span>
                                    </li>
                                ))}
                            </ul>

                            <button
                                onClick={() => handleCheckout(plan.id)}
                                disabled={loadingPlan === plan.id}
                                className={`w-full py-4 px-8 rounded-full ${plan.color} text-white font-black text-lg shadow-[0_15px_30px_rgba(0,0,0,0.3)] hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2`}
                            >
                                {loadingPlan === plan.id ? (
                                    <span className="material-symbols-outlined animate-spin">refresh</span>
                                ) : (
                                    <>
                                        PROCESAR PAGO
                                        <span className="material-symbols-outlined">arrow_forward</span>
                                    </>
                                )}
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default PricesScreen;
