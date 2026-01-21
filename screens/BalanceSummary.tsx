import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { notionService } from '../services/notion';

interface Balance {
    participantId: string;
    name: string;
    weight: number;
    fairShare: number;
    totalPaid: number;
    balance: number;
}

interface Settlement {
    from: { id: string; name: string };
    to: { id: string; name: string };
    amount: number;
}

interface BalancesData {
    totalExpenses: number;
    totalWeight: number;
    balances: Balance[];
    settlements: Settlement[];
}

const BalanceSummary: React.FC = () => {
    const { id: eventId } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [data, setData] = useState<BalancesData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (eventId) loadBalances();
    }, [eventId]);

    const loadBalances = async () => {
        if (!eventId) return;
        setLoading(true);
        try {
            const result = await notionService.getBalances(eventId);
            setData(result);
        } catch (error) {
            console.error('Error loading balances:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount: number) => {
        return `$${Math.abs(amount).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    return (
        <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark text-slate-900 dark:text-white">
            <div className="sticky top-0 z-50 flex items-center bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md p-4 pb-2 justify-between max-w-md mx-auto w-full">
                <button onClick={() => navigate(`/costs/${eventId}`)} className="flex size-12 shrink-0 items-center cursor-pointer">
                    <span className="material-symbols-outlined text-2xl">arrow_back_ios</span>
                </button>
                <h2 className="text-lg font-bold leading-tight flex-1 text-center">Cuentas Parejas</h2>
                <div className="w-12"></div>
            </div>

            <main className="flex-1 overflow-y-auto max-w-md mx-auto w-full pb-32 px-4">
                {loading ? (
                    <div className="flex justify-center py-10">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                ) : !data || data.balances.length === 0 ? (
                    <div className="text-center py-10 text-slate-400">
                        <span className="material-symbols-outlined text-4xl mb-2">group_off</span>
                        <p>No hay participantes o gastos registrados</p>
                        <button
                            onClick={() => navigate(`/costs/${eventId}/participants`)}
                            className="mt-4 text-primary font-bold"
                        >
                            Agregar participantes
                        </button>
                    </div>
                ) : (
                    <div className="space-y-6 py-4">
                        {/* Total Summary */}
                        <div className="bg-gradient-to-br from-primary/20 to-[#102218] rounded-2xl p-5 text-center">
                            <p className="text-slate-600 dark:text-[#92c9a9] text-xs font-bold uppercase tracking-wider mb-1">Gasto Total del Evento</p>
                            <p className="text-3xl font-extrabold">{formatCurrency(data.totalExpenses)}</p>
                        </div>

                        {/* Balance per person */}
                        <div>
                            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-[#92c9a9] mb-3">Balance por Persona</h3>
                            <div className="space-y-3">
                                {data.balances.map(b => (
                                    <div key={b.participantId} className="bg-white dark:bg-[#193324] rounded-xl p-4 border border-slate-200 dark:border-white/5">
                                        <div className="flex justify-between items-center mb-2">
                                            <h4 className="font-bold">{b.name}</h4>
                                            <span className={`text-lg font-extrabold ${b.balance >= 0 ? 'text-primary' : 'text-rose-500'}`}>
                                                {b.balance >= 0 ? '+' : '-'}{formatCurrency(b.balance)}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 dark:text-[#92c9a9]">
                                            <div>
                                                <span className="block text-[10px] uppercase">Pagó</span>
                                                <span className="font-bold text-slate-700 dark:text-white">{formatCurrency(b.totalPaid)}</span>
                                            </div>
                                            <div>
                                                <span className="block text-[10px] uppercase">Le correspondía</span>
                                                <span className="font-bold text-slate-700 dark:text-white">{formatCurrency(b.fairShare)}</span>
                                            </div>
                                        </div>
                                        <div className="mt-2 pt-2 border-t border-slate-100 dark:border-white/5 text-xs">
                                            {b.balance >= 0 ? (
                                                <span className="text-primary font-semibold">✓ Le deben dinero</span>
                                            ) : (
                                                <span className="text-rose-500 font-semibold">✗ Debe pagar</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Settlements */}
                        {data.settlements.length > 0 && (
                            <div>
                                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-[#92c9a9] mb-3">Cómo Saldar Cuentas</h3>
                                <div className="space-y-3">
                                    {data.settlements.map((s, i) => (
                                        <div key={i} className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-500/30">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="size-10 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center text-rose-500">
                                                        <span className="material-symbols-outlined text-lg">person</span>
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-rose-600">{s.from.name}</p>
                                                        <p className="text-xs text-slate-500">debe pagar</p>
                                                    </div>
                                                </div>
                                                <span className="material-symbols-outlined text-amber-500">arrow_forward</span>
                                                <div className="flex items-center gap-3">
                                                    <div>
                                                        <p className="font-bold text-primary text-right">{s.to.name}</p>
                                                        <p className="text-xs text-slate-500 text-right">recibe</p>
                                                    </div>
                                                    <div className="size-10 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                                                        <span className="material-symbols-outlined text-lg">person</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="mt-3 text-center">
                                                <span className="text-2xl font-extrabold text-amber-600">{formatCurrency(s.amount)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
};

export default BalanceSummary;
