import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiService } from '../services/apiService';
import { User } from '../types';

interface AddExpenseProps {
    user: User | null;
}

interface ExpenseCategory {
    id: string;
    name: string;
    icon: string;
    subtitle: string;
}

interface Supplier {
    id: string;
    name: string;
    category: string;
    phone: string;
    email: string;
}

interface Payment {
    id: number;
    amount: number;
    participantId: string;
    description: string;
    date: string;
    receiptUrl: string;
}

interface Participant {
    id: string;
    name: string;
    weight: number;
}

interface StaffAssignment {
    id: string;
    name: string;
    staffId: string;
}

const AddExpense: React.FC<AddExpenseProps> = ({ user }) => {
    const { id: eventId, expenseId } = useParams<{ id: string; expenseId?: string }>();
    const navigate = useNavigate();
    const isEditMode = !!expenseId;

    const [category, setCategory] = useState('');
    const [supplier, setSupplier] = useState('');
    const [staff, setStaff] = useState('');
    const [totalAmount, setTotalAmount] = useState(0);
    const [payments, setPayments] = useState<Payment[]>([{ id: Date.now(), amount: 0, participantId: '', description: '', date: new Date().toISOString().split('T')[0], receiptUrl: '' }]);
    const [categories, setCategories] = useState<ExpenseCategory[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [staffAssignments, setStaffAssignments] = useState<StaffAssignment[]>([]);
    const [hasContract, setHasContract] = useState(false);
    const [hasAdvance, setHasAdvance] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(isEditMode);
    const [isAddingNewSupplier, setIsAddingNewSupplier] = useState(false);

    useEffect(() => {
        if (eventId) {
            loadCategories();
            loadSuppliers();
            loadParticipants();
            loadStaff();
            if (isEditMode && expenseId) {
                loadExpense();
            }
        }
    }, [eventId, expenseId]);

    const loadStaff = async () => {
        try {
            const data = await apiService.getStaffAssignments(eventId!);
            setStaffAssignments(data);
        } catch (error) {
            console.error('Error loading staff:', error);
        }
    };

    const loadExpense = async () => {
        try {
            setLoading(true);
            const expenses = await apiService.getExpenses(eventId!);
            const expense = expenses.find((e: any) => e.id === expenseId);
            if (expense) {
                setCategory(expense.category || '');
                setSupplier(expense.supplier || expense.name || '');
                setStaff(expense.staff || '');
                setTotalAmount(expense.total || 0);
                // Load existing payments from the Payments database
                const existingPayments = await apiService.getPayments(expenseId!);
                if (existingPayments.length > 0) {
                    setPayments(existingPayments.map((p: any) => ({
                        id: Date.now() + Math.random(),
                        amount: p.amount,
                        participantId: p.participantId,
                        description: p.description || '',
                        date: p.date || new Date().toISOString().split('T')[0],
                        receiptUrl: p.receiptUrl || ''
                    })));
                } else {
                    setPayments([{ id: Date.now(), amount: expense.paid || 0, participantId: '', description: '', date: new Date().toISOString().split('T')[0], receiptUrl: '' }]);
                }
            }
        } catch (error) {
            console.error('Error loading expense:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadParticipants = async () => {
        try {
            const data = await apiService.getParticipants(eventId!);
            setParticipants(data);
        } catch (error) {
            console.error('Error loading participants:', error);
        }
    };

    const loadCategories = async () => {
        try {
            const data = await apiService.getExpenseCategories(eventId!);
            setCategories(data);
        } catch (error) {
            console.error('Error loading categories:', error);
        }
    };

    const loadSuppliers = async () => {
        try {
            const data = await apiService.getSuppliers(eventId!);
            setSuppliers(data);
        } catch (error) {
            console.error('Error loading suppliers:', error);
        }
    };

    // Filter suppliers by selected category
    const filteredSuppliers = category && category !== 'Otro'
        ? suppliers.filter(s => s.category?.toLowerCase() === category.toLowerCase())
        : suppliers;

    // Reset supplier when category changes
    const handleCategoryChange = (newCategory: string) => {
        setCategory(newCategory);
        setSupplier(''); // Reset supplier selection
        setIsAddingNewSupplier(false);
    };

    const addPayment = () => {
        setPayments([...payments, { id: Date.now(), amount: 0, participantId: '', description: '', date: new Date().toISOString().split('T')[0], receiptUrl: '' }]);
    };

    const updatePayment = (id: number, field: keyof Payment, value: string) => {
        if (field === 'amount') {
            const numValue = parseFloat(value) || 0;
            setPayments(payments.map(p => p.id === id ? { ...p, amount: numValue } : p));
        } else if (field === 'id') {
            // Skip id updates
        } else {
            setPayments(payments.map(p => p.id === id ? { ...p, [field]: value } : p));
        }
    };

    const removePayment = (id: number) => {
        if (payments.length > 1) {
            setPayments(payments.filter(p => p.id !== id));
        }
    };

    const handlePayTotal = () => {
        setPayments([{ id: Date.now(), amount: totalAmount, participantId: participants[0]?.id || '', description: 'Pago total', date: new Date().toISOString().split('T')[0], receiptUrl: '' }]);
    };

    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const pendingAmount = Math.max(0, totalAmount - totalPaid);

    const getStatus = () => {
        if (totalPaid >= totalAmount && totalAmount > 0) return 'Pagado';
        if (totalPaid > 0) return 'Adelanto';
        return 'Pendiente';
    };


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!eventId || !category || !supplier || totalAmount <= 0) return;

        setSaving(true);
        try {
            const expenseData = {
                name: supplier,
                category,
                supplier,
                total: totalAmount,
                paid: totalPaid,
                status: getStatus(),
                staff: staff,
                userPlan: user?.plan || 'freemium'
            };

            let expenseIdToUse = expenseId;

            if (isEditMode && expenseId) {
                await apiService.updateExpense(expenseId, expenseData);
                // Delete old payments (simpler strategy for now)
                const oldPayments = await apiService.getPayments(expenseId);
                for (const oldP of oldPayments) {
                    await apiService.deletePayment(oldP.id);
                }
            } else {
                const newExpense = await apiService.createExpense(eventId, expenseData);
                expenseIdToUse = newExpense.id;
            }

            // Save payments
            if (expenseIdToUse) {
                const paymentsToSave = payments.filter(p => p.amount > 0 && p.participantId);
                for (const payment of paymentsToSave) {
                    let finalReceiptUrl = payment.receiptUrl;
                    if (payment.receiptUrl && payment.receiptUrl.startsWith('data:image')) {
                        try {
                            finalReceiptUrl = await apiService.uploadImage(payment.receiptUrl);
                        } catch (err) {
                            console.error('Receipt upload failed:', err);
                            finalReceiptUrl = '';
                        }
                    }

                    await apiService.createPayment(expenseIdToUse, {
                        participantId: payment.participantId,
                        amount: payment.amount,
                        date: payment.date,
                        description: payment.description,
                        receiptUrl: finalReceiptUrl
                    });
                }
            }

            navigate(`/costs/${eventId}`);
        } catch (error: any) {
            console.error('Error saving expense:', error);
            const message = error.message || 'Error al guardar el gasto';

            if (error.limitReached) {
                alert(`Límite alcanzado: ${error.message}. Tu plan permite hasta ${error.limit} ${error.resource || 'elementos'}.`);
            } else {
                alert(`Error al guardar el gasto: ${message}`);
            }
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark text-slate-900 dark:text-white">
            <header className="sticky top-0 z-50 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md border-b border-slate-200 dark:border-white/10 px-4 py-4">
                <div className="flex items-center justify-between max-w-md mx-auto w-full">
                    <button onClick={() => navigate(-1)} className="flex items-center justify-center p-2 rounded-full hover:bg-slate-200 dark:hover:bg-white/10 transition-colors">
                        <span className="material-symbols-outlined text-2xl">arrow_back_ios_new</span>
                    </button>
                    <h1 className="text-lg font-bold tracking-tight">{isEditMode ? 'Editar Gasto' : 'Registrar Gasto'}</h1>
                    <div className="w-10"></div>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto pb-48">
                <form onSubmit={handleSubmit} className="max-w-md mx-auto px-4 py-6 space-y-6">
                    {/* Category Select */}
                    <div className="space-y-2">
                        <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 px-1">Categoría</label>
                        <select
                            value={category}
                            onChange={(e) => handleCategoryChange(e.target.value)}
                            className="w-full h-14 bg-white dark:bg-[#193324] border border-slate-200 dark:border-[#326748] rounded-xl px-4 text-base focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all"
                        >
                            <option value="" disabled>Seleccionar categoría</option>
                            {categories.map(cat => (
                                <option key={cat.id} value={cat.name}>{cat.name}</option>
                            ))}
                            <option value="Otro">Otro</option>
                        </select>
                    </div>

                    {/* Supplier Select */}
                    <div className="space-y-2">
                        <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 px-1">Proveedor</label>
                        {!isAddingNewSupplier && filteredSuppliers.length > 0 ? (
                            <select
                                value={supplier}
                                onChange={(e) => {
                                    if (e.target.value === '__new__') {
                                        setIsAddingNewSupplier(true);
                                        setSupplier('');
                                    } else {
                                        setSupplier(e.target.value);
                                    }
                                }}
                                disabled={!category}
                                className="w-full h-14 bg-white dark:bg-[#193324] border border-slate-200 dark:border-[#326748] rounded-xl px-4 text-base focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all disabled:opacity-50"
                            >
                                <option value="" disabled>{category ? 'Seleccionar proveedor' : 'Primero selecciona una categoría'}</option>
                                {filteredSuppliers.map(sup => (
                                    <option key={sup.id} value={sup.name}>{sup.name}</option>
                                ))}
                                <option value="__new__">+ Agregar nuevo proveedor</option>
                            </select>
                        ) : (
                            <div className="space-y-2">
                                <input
                                    type="text"
                                    value={supplier}
                                    onChange={(e) => setSupplier(e.target.value)}
                                    className="w-full h-14 bg-white dark:bg-[#193324] border border-slate-200 dark:border-[#326748] rounded-xl px-4 text-base focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-[#92c9a9]/50"
                                    placeholder={category ? "Ingresa el nombre del proveedor" : "Primero selecciona una categoría"}
                                    disabled={!category}
                                    autoFocus={isAddingNewSupplier}
                                />
                                {isAddingNewSupplier && (
                                    <button
                                        type="button"
                                        onClick={() => setIsAddingNewSupplier(false)}
                                        className="text-xs text-primary font-bold uppercase ml-2"
                                    >
                                        Volver a la lista
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Staff Selector */}
                    <div className="space-y-2">
                        <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 px-1">Staff Responsable</label>
                        <select
                            value={staff}
                            onChange={(e) => setStaff(e.target.value)}
                            className="w-full h-14 bg-white dark:bg-[#193324] border border-slate-200 dark:border-[#326748] rounded-xl px-4 text-base focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all"
                        >
                            <option value="">Ninguno (Opcional)</option>
                            {staffAssignments.map(s => (
                                <option key={s.id} value={s.name}>{s.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Total Amount */}
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 px-1">Monto Total del Gasto</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#92c9a9] font-bold">$</span>
                                <input
                                    type="number"
                                    value={totalAmount || ''}
                                    onChange={(e) => setTotalAmount(parseFloat(e.target.value) || 0)}
                                    className="w-full h-14 bg-white dark:bg-[#193324] border border-slate-200 dark:border-[#326748] rounded-xl pl-8 pr-4 text-base focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all font-bold"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>

                        {/* Payments */}
                        <div className="space-y-3">
                            <div className="flex justify-between items-center px-1">
                                <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400">Pagos Realizados</label>
                                <button type="button" onClick={handlePayTotal} className="text-[10px] font-bold text-primary uppercase tracking-tight">
                                    Pagar Total
                                </button>
                            </div>

                            <div className="space-y-3">
                                {payments.map((payment, index) => (
                                    <div key={payment.id} className="flex flex-col gap-2 p-3 bg-slate-50 dark:bg-[#102218] rounded-xl">
                                        <div className="flex gap-2 items-center">
                                            <div className="relative flex-1">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#92c9a9]">$</span>
                                                <input
                                                    type="number"
                                                    value={payment.amount || ''}
                                                    onChange={(e) => updatePayment(payment.id, 'amount', e.target.value)}
                                                    className="w-full h-12 bg-white dark:bg-[#193324] border border-slate-200 dark:border-[#326748] rounded-xl pl-8 pr-4 text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all"
                                                    placeholder={`Monto pago ${index + 1}`}
                                                />
                                            </div>
                                            <input
                                                type="date"
                                                value={payment.date}
                                                onChange={(e) => updatePayment(payment.id, 'date', e.target.value)}
                                                className="w-32 h-12 bg-white dark:bg-[#193324] border border-slate-200 dark:border-[#326748] rounded-xl px-3 text-sm focus:ring-2 focus:ring-primary/50 outline-none"
                                            />
                                            {payments.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removePayment(payment.id)}
                                                    className="size-10 flex items-center justify-center text-rose-500 bg-rose-500/10 rounded-xl"
                                                >
                                                    <span className="material-symbols-outlined text-xl">remove</span>
                                                </button>
                                            )}
                                        </div>
                                        {/* Description */}
                                        <input
                                            type="text"
                                            value={payment.description}
                                            onChange={(e) => updatePayment(payment.id, 'description', e.target.value)}
                                            className="w-full h-10 bg-white dark:bg-[#193324] border border-slate-200 dark:border-[#326748] rounded-lg px-3 text-sm focus:ring-2 focus:ring-primary/50 outline-none"
                                            placeholder="Descripción (ej: Seña, Cuota 1...)"
                                        />
                                        {/* Participant Selector */}
                                        <select
                                            value={payment.participantId}
                                            onChange={(e) => updatePayment(payment.id, 'participantId', e.target.value)}
                                            className="w-full h-10 bg-white dark:bg-[#193324] border border-slate-200 dark:border-[#326748] rounded-lg px-3 text-sm focus:ring-2 focus:ring-primary/50 outline-none"
                                        >
                                            <option value="" disabled>¿Quién pagó?</option>
                                            {participants.map(p => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                        </select>
                                        {/* Receipt Upload */}
                                        <div className="flex gap-2 items-center">
                                            <label className="flex-1 h-10 border border-dashed border-slate-300 dark:border-[#326748] rounded-lg flex items-center justify-center gap-2 text-slate-400 dark:text-[#92c9a9] cursor-pointer hover:border-primary hover:text-primary transition-all">
                                                <span className="material-symbols-outlined text-base">receipt_long</span>
                                                <span className="text-xs font-medium">
                                                    {payment.receiptUrl ? 'Comprobante cargado ✓' : 'Subir comprobante'}
                                                </span>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) {
                                                            const reader = new FileReader();
                                                            reader.onload = () => {
                                                                updatePayment(payment.id, 'receiptUrl', reader.result as string);
                                                            };
                                                            reader.readAsDataURL(file);
                                                        }
                                                    }}
                                                />
                                            </label>
                                            {payment.receiptUrl && (
                                                <button
                                                    type="button"
                                                    onClick={() => updatePayment(payment.id, 'receiptUrl', '')}
                                                    className="size-10 flex items-center justify-center text-rose-500 bg-rose-500/10 rounded-lg"
                                                >
                                                    <span className="material-symbols-outlined text-sm">delete</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                <button
                                    type="button"
                                    onClick={addPayment}
                                    className="w-full h-12 border-2 border-dashed border-slate-200 dark:border-[#326748] rounded-xl flex items-center justify-center gap-2 text-slate-400 dark:text-[#92c9a9] hover:border-primary hover:text-primary transition-all"
                                >
                                    <span className="material-symbols-outlined">add_circle</span>
                                    <span className="text-sm font-bold">Agregar Pago Parcial</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Toggles */}
                    <div className="bg-white dark:bg-[#193324] rounded-2xl p-4 space-y-4 border border-slate-100 dark:border-white/5 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="material-symbols-outlined text-primary">description</span>
                                <span className="font-medium">Contrato Firmado</span>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" checked={hasContract} onChange={(e) => setHasContract(e.target.checked)} className="sr-only peer" />
                                <div className="w-11 h-6 bg-slate-200 dark:bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                            </label>
                        </div>
                        <div className="h-px bg-slate-100 dark:bg-white/5 w-full"></div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="material-symbols-outlined text-primary">payments</span>
                                <span className="font-medium">Adelanto Realizado</span>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" checked={hasAdvance} onChange={(e) => setHasAdvance(e.target.checked)} className="sr-only peer" />
                                <div className="w-11 h-6 bg-slate-200 dark:bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                            </label>
                        </div>
                    </div>
                </form>
            </main>

            {/* Footer */}
            <footer className="fixed bottom-0 left-0 right-0 bg-white dark:bg-[#112218] border-t border-slate-200 dark:border-white/10 p-4 pb-8 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] z-50">
                <div className="max-w-md mx-auto space-y-4">
                    <div className="flex items-center justify-between px-2">
                        <div>
                            <p className="text-xs uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">Pendiente de Pago</p>
                            <p className={`text-2xl font-extrabold ${pendingAmount > 0 ? 'text-rose-500' : 'text-primary'}`}>
                                ${pendingAmount.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-slate-400">Pagado: ${totalPaid.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Estado: {getStatus()}</p>
                        </div>
                    </div>
                    <button
                        type="submit"
                        onClick={handleSubmit}
                        disabled={saving || !category || !supplier || totalAmount <= 0}
                        className="w-full bg-primary hover:bg-primary/90 text-background-dark font-extrabold text-lg h-16 rounded-2xl transition-all shadow-lg shadow-primary/20 active:scale-[0.98] disabled:opacity-50"
                    >
                        {saving ? 'Guardando...' : 'Registrar Gasto'}
                    </button>
                </div>
            </footer>
        </div>
    );
};

export default AddExpense;
