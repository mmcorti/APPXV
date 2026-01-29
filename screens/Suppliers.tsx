import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { notionService } from '../services/notion';
import { UpgradePrompt } from '../components/UpgradePrompt';
import { usePlan } from '../hooks/usePlan';

interface Supplier {
    id: string;
    name: string;
    category: string;
    phone: string;
    email: string;
}

interface ExpenseCategory {
    id: string;
    name: string;
    icon: string;
    subtitle: string;
}

const Suppliers: React.FC = () => {
    const { id: eventId } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const { checkLimit } = usePlan();
    const limitCheck = checkLimit('maxSuppliers', suppliers.length);
    const [categories, setCategories] = useState<ExpenseCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({ name: '', category: '', phone: '', email: '' });
    const [editingId, setEditingId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (eventId) {
            loadSuppliers();
            loadCategories();
        }
    }, [eventId]);

    const loadSuppliers = async () => {
        if (!eventId) return;
        setLoading(true);
        try {
            const data = await notionService.getSuppliers(eventId);
            setSuppliers(data);
        } catch (error) {
            console.error('Error loading suppliers:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadCategories = async () => {
        if (!eventId) return;
        try {
            const data = await notionService.getExpenseCategories(eventId);
            setCategories(data);
        } catch (error) {
            console.error('Error loading categories:', error);
        }
    };

    const filteredSuppliers = suppliers.filter(s =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!eventId || !formData.name) return;
        setSaving(true);
        try {
            if (editingId) {
                await notionService.updateSupplier(editingId, formData);
            } else {
                await notionService.createSupplier(eventId, formData);
            }
            setShowForm(false);
            setFormData({ name: '', category: '', phone: '', email: '' });
            setEditingId(null);
            loadSuppliers();
        } catch (error) {
            console.error('Error saving supplier:', error);
            alert('Error al guardar proveedor');
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = (supplier: Supplier) => {
        setFormData({ name: supplier.name, category: supplier.category, phone: supplier.phone, email: supplier.email });
        setEditingId(supplier.id);
        setShowForm(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Eliminar este proveedor?')) return;
        try {
            await notionService.deleteSupplier(id);
            loadSuppliers();
        } catch (error) {
            console.error('Error deleting supplier:', error);
        }
    };

    return (
        <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark text-slate-900 dark:text-white">
            <div className="sticky top-0 z-50 flex items-center bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md p-4 pb-2 justify-between max-w-md mx-auto w-full">
                <button onClick={() => navigate(`/costs/${eventId}`)} className="flex size-12 shrink-0 items-center cursor-pointer">
                    <span className="material-symbols-outlined text-2xl">arrow_back_ios</span>
                </button>
                <h2 className="text-lg font-bold leading-tight flex-1 text-center">Proveedores</h2>
                <div className="flex w-12 items-center justify-end">
                    <button
                        disabled={!limitCheck.allowed}
                        onClick={() => {
                            if (!limitCheck.allowed) alert(`Límite de ${limitCheck.limit} proveedores alcanzado.`);
                            else { setShowForm(true); setEditingId(null); setFormData({ name: '', category: '', phone: '', email: '' }); }
                        }}
                        className={`flex cursor-pointer items-center justify-center rounded-full h-10 w-10 text-background-dark shadow-lg active:scale-95 transition-transform ${limitCheck.allowed ? 'bg-primary' : 'bg-slate-300 cursor-not-allowed'}`}
                    >
                        <span className="material-symbols-outlined text-2xl">add</span>
                    </button>
                </div>
            </div>

            <main className="flex-1 overflow-y-auto max-w-md mx-auto w-full pb-32">
                {/* Search */}
                <div className="px-4 py-3">
                    <label className="flex flex-col min-w-40 h-12 w-full">
                        <div className="flex w-full flex-1 items-stretch rounded-xl h-full shadow-sm">
                            <div className="text-slate-400 dark:text-[#92c9a9] flex border-none bg-white dark:bg-[#193324] items-center justify-center pl-4 rounded-l-xl border-r-0">
                                <span className="material-symbols-outlined">search</span>
                            </div>
                            <input
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="flex w-full min-w-0 flex-1 rounded-r-xl text-slate-900 dark:text-white focus:outline-0 focus:ring-0 border-none bg-white dark:bg-[#193324] h-full placeholder:text-slate-400 dark:placeholder:text-[#92c9a9]/50 px-4 pl-2 text-base"
                                placeholder="Buscar por nombre o categoría"
                            />
                        </div>
                    </label>
                </div>

                {/* Plan Limit Upgrade */}
                <div className="px-4 mb-4">
                    <UpgradePrompt
                        resourceName="proveedores"
                        currentCount={suppliers.length}
                        limit={limitCheck.limit}
                    />
                </div>

                {/* Supplier List */}
                {loading ? (
                    <div className="flex justify-center py-10">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                ) : filteredSuppliers.length === 0 ? (
                    <div className="text-center py-10 text-slate-400">No hay proveedores registrados</div>
                ) : (
                    <div className="flex flex-col gap-4 p-4">
                        {filteredSuppliers.map(s => (
                            <div key={s.id} className="flex flex-col items-stretch justify-start rounded-xl shadow-md bg-white dark:bg-[#193324] border border-slate-100 dark:border-white/5 overflow-hidden">
                                <div className="flex w-full grow flex-col items-stretch justify-center gap-1 p-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-lg font-bold leading-tight">{s.name}</p>
                                            <p className="text-primary text-sm font-semibold mt-0.5">{s.category}</p>
                                        </div>
                                    </div>
                                    <div className="mt-2 space-y-1">
                                        {s.phone && (
                                            <div className="flex items-center gap-2 text-slate-500 dark:text-[#92c9a9] text-sm">
                                                <span className="material-symbols-outlined text-sm">call</span>
                                                <span>{s.phone}</span>
                                            </div>
                                        )}
                                        {s.email && (
                                            <div className="flex items-center gap-2 text-slate-500 dark:text-[#92c9a9] text-sm">
                                                <span className="material-symbols-outlined text-sm">mail</span>
                                                <span>{s.email}</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-white/5">
                                        <button
                                            onClick={() => handleEdit(s)}
                                            className="flex-1 flex items-center justify-center gap-2 h-10 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-lg">edit</span>
                                            <span className="text-sm font-bold">Editar</span>
                                        </button>
                                        <button
                                            onClick={() => handleDelete(s.id)}
                                            className="flex-1 flex items-center justify-center gap-2 h-10 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-500 hover:bg-red-100 transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-lg">delete</span>
                                            <span className="text-sm font-bold">Eliminar</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* Add/Edit Form Modal */}
            {showForm && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
                    <div className="bg-white dark:bg-[#193324] w-full max-w-md rounded-t-3xl p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-bold">{editingId ? 'Editar Proveedor' : 'Nuevo Proveedor'}</h3>
                            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Nombre"
                                className="w-full h-12 bg-slate-100 dark:bg-slate-800 border-none rounded-xl px-4 text-base"
                                required
                            />
                            <select
                                value={formData.category}
                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                className="w-full h-12 bg-slate-100 dark:bg-slate-800 border-none rounded-xl px-4 text-base"
                            >
                                <option value="" disabled>Seleccionar categoría</option>
                                {categories.map(cat => (
                                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                                ))}
                                <option value="Otro">Otro</option>
                            </select>
                            <input
                                type="tel"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                placeholder="Teléfono"
                                className="w-full h-12 bg-slate-100 dark:bg-slate-800 border-none rounded-xl px-4 text-base"
                            />
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                placeholder="Email"
                                className="w-full h-12 bg-slate-100 dark:bg-slate-800 border-none rounded-xl px-4 text-base"
                            />
                            <button
                                type="submit"
                                disabled={saving || !formData.name}
                                className="w-full bg-primary text-background-dark font-bold h-14 rounded-xl disabled:opacity-50"
                            >
                                {saving ? 'Guardando...' : (editingId ? 'Actualizar' : 'Agregar')}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Suppliers;
