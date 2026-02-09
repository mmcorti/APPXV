import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { notionService } from '../services/notion';
import { InvitationData } from '../types';
import { UpgradePrompt } from '../components/UpgradePrompt';
import { usePlan } from '../hooks/usePlan';

interface Expense {
    id: string;
    name: string;
    category: string;
    supplier: string;
    total: number;
    paid: number;
    status: string;
    staff?: string;
}

interface CostControlProps {
    invitations: InvitationData[];
}

const CostControl: React.FC<CostControlProps> = ({ invitations }) => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'Pagado' | 'Pendiente' | 'Adelanto'>('all');

    const event = invitations.find(inv => inv.id === id);
    const { checkLimit } = usePlan();
    const limitCheck = checkLimit('maxExpenses', expenses.length);

    useEffect(() => {
        if (id) loadExpenses();
    }, [id]);

    const loadExpenses = async () => {
        if (!id) return;
        setLoading(true);
        try {
            const data = await notionService.getExpenses(id);
            setExpenses(data);
        } catch (error) {
            console.error('Error loading expenses:', error);
        } finally {
            setLoading(false);
        }
    };

    const deleteExpense = async (expenseId: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent navigation to edit
        if (!confirm('¿Estás seguro de que quieres eliminar este gasto?')) return;

        try {
            await notionService.deleteExpense(expenseId);
            setExpenses(prev => prev.filter(exp => exp.id !== expenseId));
        } catch (error) {
            console.error('Error deleting expense:', error);
            alert('Error al eliminar el gasto');
        }
    };

    const filteredExpenses = filter === 'all'
        ? expenses
        : expenses.filter(e => e.status === filter);

    // Budget is the sum of all expense totals
    const budget = expenses.reduce((sum, e) => sum + e.total, 0);
    const totalPaid = expenses.reduce((sum, e) => sum + e.paid, 0);
    const totalPending = expenses.reduce((sum, e) => sum + (e.total - e.paid), 0);
    const percentagePaid = budget > 0 ? Math.round((totalPaid / budget) * 100) : 0;
    const percentagePending = budget > 0 ? Math.round((totalPending / budget) * 100) : 0;

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Pagado': return 'bg-primary/20 text-primary';
            case 'Adelanto': return 'bg-amber-500/20 text-amber-500';
            case 'Pendiente': return 'bg-rose-500/20 text-rose-500';
            default: return 'bg-slate-500/20 text-slate-500';
        }
    };

    const getIcon = (category: string) => {
        const icons: Record<string, string> = {
            'Catering': 'restaurant',
            'Salon': 'apartment',
            'Música': 'library_music',
            'Decoración': 'local_florist',
            'Fotografía': 'photo_camera',
            'Transporte': 'directions_car',
        };
        return icons[category] || 'receipt_long';
    };

    return (
        <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark text-slate-900 dark:text-white">
            <nav className="sticky top-0 z-50 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md border-b border-slate-200 dark:border-white/10">
                <div className="flex items-center p-4 pb-2 justify-between max-w-md mx-auto w-full">
                    <button onClick={() => navigate('/dashboard')} className="size-12 flex items-center justify-start">
                        <span className="material-symbols-outlined">arrow_back_ios</span>
                    </button>
                    <h2 className="text-lg font-bold leading-tight tracking-tight flex-1 text-center">Control de Gastos</h2>
                    <div className="flex w-12 items-center justify-end">
                        <button className="flex items-center justify-center rounded-lg h-12 bg-transparent p-0">
                            <span className="material-symbols-outlined">ios_share</span>
                        </button>
                    </div>
                </div>
            </nav>

            <main className="flex-1 pb-32 overflow-y-auto max-w-md mx-auto w-full">
                <div className="px-4 pt-6 pb-2">
                    <h3 className="tracking-tight text-2xl font-bold leading-tight">Presupuesto General</h3>
                    <p className="text-slate-500 dark:text-[#92c9a9] text-sm font-medium">{event?.eventName || 'Evento'}</p>
                </div>

                {/* Budget Card */}
                <div className="p-4">
                    <div className="flex flex-col items-stretch justify-start rounded-xl shadow-lg bg-white dark:bg-[#193324] overflow-hidden border border-slate-200 dark:border-white/5">
                        <div className="w-full h-32 bg-gradient-to-br from-[#13ec6d]/20 to-[#102218] flex items-center justify-center">
                            <div className="text-center">
                                <p className="text-slate-600 dark:text-[#92c9a9] text-xs font-bold uppercase tracking-wider mb-1">Presupuesto Total</p>
                                <p className="text-3xl font-extrabold leading-tight tracking-tight">${budget.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
                            </div>
                        </div>
                        <div className="flex flex-col gap-4 p-5">
                            <div className="flex flex-col gap-2">
                                <div className="flex gap-6 justify-between items-end">
                                    <p className="text-base font-semibold">Total Pagado</p>
                                    <p className="text-primary text-sm font-bold">${totalPaid.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
                                </div>
                                <div className="rounded-full bg-slate-200 dark:bg-[#326748] h-2.5 overflow-hidden">
                                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(percentagePaid, 100)}%` }}></div>
                                </div>
                                <p className="text-slate-500 dark:text-[#92c9a9] text-xs font-medium">{percentagePaid}% pagado</p>
                            </div>
                            <div className="flex flex-col gap-2">
                                <div className="flex gap-6 justify-between items-end">
                                    <p className="text-base font-semibold">Total Pendiente</p>
                                    <p className="text-rose-500 text-sm font-bold">${totalPending.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
                                </div>
                                <div className="rounded-full bg-slate-200 dark:bg-[#326748] h-2.5 overflow-hidden">
                                    <div className="h-full rounded-full bg-rose-500" style={{ width: `${percentagePending}%` }}></div>
                                </div>
                                <p className="text-slate-500 dark:text-[#92c9a9] text-xs font-medium">{percentagePending}% pendiente de pago</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Plan Limit Upgrade */}
                <div className="px-4 mb-4">
                    <UpgradePrompt
                        resourceName="gastos"
                        currentCount={expenses.length}
                        limit={limitCheck.limit}
                    />
                </div>

                {/* Filter Tabs */}
                <div className="px-4 py-2 flex gap-2 overflow-x-auto hide-scrollbar">
                    {(['all', 'Pagado', 'Pendiente', 'Adelanto'] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${filter === f
                                ? 'bg-primary text-[#102218]'
                                : 'bg-slate-200 dark:bg-[#193324] text-slate-700 dark:text-white border border-transparent dark:border-white/5'
                                }`}
                        >
                            {f === 'all' ? 'Todos' : f}
                        </button>
                    ))}
                </div>

                {/* Expense List */}
                <div className="px-4 mt-6">
                    <h4 className="text-slate-400 dark:text-[#92c9a9] text-xs font-bold uppercase tracking-widest mb-4">Detalle de Proveedores</h4>
                    {loading ? (
                        <div className="flex justify-center py-10">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        </div>
                    ) : filteredExpenses.length === 0 ? (
                        <div className="text-center py-10 text-slate-400">No hay gastos registrados</div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {filteredExpenses.map(expense => (
                                <div
                                    key={expense.id}
                                    onClick={() => navigate(`/costs/${id}/edit/${expense.id}`)}
                                    className="flex items-center p-3 bg-white dark:bg-[#193324] rounded-xl border border-slate-200 dark:border-white/5 cursor-pointer hover:border-primary/50 hover:shadow-md transition-all group"
                                >
                                    <div className="size-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary mr-4">
                                        <span className="material-symbols-outlined">{getIcon(expense.category)}</span>
                                    </div>
                                    <div className="flex-1">
                                        <h5 className="font-bold text-sm">{expense.supplier || expense.name}</h5>
                                        <p className="text-slate-500 dark:text-[#92c9a9] text-xs">{expense.category || expense.name}</p>
                                        <div className="mt-1 flex items-center gap-2">
                                            <span className={`px-2 py-0.5 ${getStatusColor(expense.status)} text-[10px] font-bold rounded uppercase`}>
                                                {expense.status || 'Pendiente'}
                                            </span>
                                            {expense.staff && (
                                                <span className="flex items-center gap-0.5 text-[10px] text-slate-400 dark:text-[#92c9a9] font-medium border border-slate-200 dark:border-white/10 px-1.5 py-0.5 rounded italic">
                                                    <span className="material-symbols-outlined text-[10px]">person</span>
                                                    {expense.staff}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right flex flex-col items-end gap-1 mr-2">
                                        <p className="font-bold text-sm">${expense.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
                                        {expense.paid > 0 && expense.paid < expense.total && (
                                            <p className="text-xs text-primary">Pagado: ${expense.paid.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={(e) => deleteExpense(expense.id, e)}
                                            className="size-9 rounded-lg flex items-center justify-center text-rose-500 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                            title="Eliminar gasto"
                                        >
                                            <span className="material-symbols-outlined text-xl">delete</span>
                                        </button>
                                        <span className="material-symbols-outlined text-slate-400 text-lg">chevron_right</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            {/* FAB Buttons */}
            <div className="fixed bottom-24 right-6 flex flex-col items-end gap-3 z-50">
                <div className="flex items-center gap-3 group">
                    <span className="bg-slate-800/80 backdrop-blur-sm text-white text-[10px] font-bold px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl border border-white/10 uppercase tracking-widest">Cuentas Parejas</span>
                    <button
                        onClick={() => navigate(`/costs/${id}/balances`)}
                        className="size-12 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform"
                        title="Cuentas Parejas"
                    >
                        <span className="material-symbols-outlined">calculate</span>
                    </button>
                </div>

                <div className="flex items-center gap-3 group">
                    <span className="bg-slate-800/80 backdrop-blur-sm text-white text-[10px] font-bold px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl border border-white/10 uppercase tracking-widest">Participantes</span>
                    <button
                        onClick={() => navigate(`/costs/${id}/participants`)}
                        className="size-12 rounded-full bg-white dark:bg-[#193324] text-slate-700 dark:text-white flex items-center justify-center shadow-lg border border-slate-200 dark:border-white/10 active:scale-95 transition-transform"
                        title="Participantes"
                    >
                        <span className="material-symbols-outlined">groups</span>
                    </button>
                </div>

                <div className="flex items-center gap-3 group">
                    <span className="bg-slate-800/80 backdrop-blur-sm text-white text-[10px] font-bold px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl border border-white/10 uppercase tracking-widest">Proveedores</span>
                    <button
                        onClick={() => navigate(`/costs/${id}/suppliers`)}
                        className="size-12 rounded-full bg-white dark:bg-[#193324] text-slate-700 dark:text-white flex items-center justify-center shadow-lg border border-slate-200 dark:border-white/10 active:scale-95 transition-transform"
                        title="Proveedores"
                    >
                        <span className="material-symbols-outlined">group</span>
                    </button>
                </div>

                <div className="flex items-center gap-3 group">
                    <span className="bg-slate-800/80 backdrop-blur-sm text-white text-[10px] font-bold px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl border border-white/10 uppercase tracking-widest">Categorías</span>
                    <button
                        onClick={() => navigate(`/costs/${id}/categories`)}
                        className="size-12 rounded-full bg-white dark:bg-[#193324] text-slate-700 dark:text-white flex items-center justify-center shadow-lg border border-slate-200 dark:border-white/10 active:scale-95 transition-transform"
                        title="Categorías"
                    >
                        <span className="material-symbols-outlined">category</span>
                    </button>
                </div>

                <div className="flex items-center gap-3 group">
                    <span className="bg-slate-800/80 backdrop-blur-sm text-white text-[10px] font-bold px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl border border-white/10 uppercase tracking-widest">Agregar Gasto</span>
                    <button
                        onClick={() => {
                            if (!limitCheck.allowed) alert(`Límite de ${limitCheck.limit} gastos alcanzado. Mejora tu plan.`);
                            else navigate(`/costs/${id}/add`);
                        }}
                        className={`size-16 rounded-full flex items-center justify-center shadow-xl transition-all ${limitCheck.allowed ? 'bg-primary text-[#102218] hover:scale-105 active:scale-95' : 'bg-slate-300 text-slate-500 cursor-not-allowed'}`}
                        title="Agregar Gasto"
                    >
                        <span className="material-symbols-outlined text-3xl font-bold">add</span>
                    </button>
                </div>
            </div>
        </div >
    );
};

export default CostControl;
