import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { notionService } from '../services/notion';

interface Category {
    id: string;
    name: string;
    icon: string;
    subtitle: string;
}

const ExpenseCategories: React.FC = () => {
    const { id: eventId } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [saving, setSaving] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');

    useEffect(() => {
        if (eventId) loadCategories();
    }, [eventId]);

    const loadCategories = async () => {
        if (!eventId) return;
        setLoading(true);
        try {
            const data = await notionService.getExpenseCategories(eventId);
            setCategories(data);
        } catch (error) {
            console.error('Error loading categories:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async () => {
        if (!eventId || !newCategoryName.trim()) return;
        setSaving(true);
        try {
            await notionService.createExpenseCategory(eventId, {
                name: newCategoryName.trim(),
                icon: 'category',
                subtitle: ''
            });
            setNewCategoryName('');
            loadCategories();
        } catch (error) {
            console.error('Error creating category:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = async (id: string) => {
        if (!editName.trim()) return;
        try {
            await notionService.updateExpenseCategory(id, { name: editName.trim() });
            setEditingId(null);
            loadCategories();
        } catch (error) {
            console.error('Error updating category:', error);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Eliminar esta categoría?')) return;
        try {
            await notionService.deleteExpenseCategory(id);
            loadCategories();
        } catch (error) {
            console.error('Error deleting category:', error);
        }
    };

    const getIcon = (name: string) => {
        const icons: Record<string, string> = {
            'Salon': 'storefront',
            'Salón': 'storefront',
            'Decoración': 'format_paint',
            'Música': 'music_note',
            'Catering': 'restaurant',
            'Fotografía': 'photo_camera',
            'Transporte': 'directions_car',
            'Vestimenta': 'checkroom',
            'Invitaciones': 'mail',
        };
        return icons[name] || 'category';
    };

    return (
        <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark text-slate-900 dark:text-white">
            <header className="sticky top-0 z-10 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center p-4 justify-between max-w-md mx-auto w-full">
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate(`/costs/${eventId}`)}>
                        <span className="material-symbols-outlined text-primary">arrow_back_ios</span>
                        <h1 className="text-lg font-bold leading-tight tracking-tight">Categorías de Gasto</h1>
                    </div>
                    <span className="material-symbols-outlined text-slate-400">more_horiz</span>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto px-4 py-6 max-w-md mx-auto w-full pb-52">
                {loading ? (
                    <div className="flex justify-center py-10">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                ) : categories.length === 0 ? (
                    <div className="text-center py-10 text-slate-400">No hay categorías registradas</div>
                ) : (
                    <div className="flex flex-col gap-4">
                        {categories.map(cat => (
                            <div key={cat.id} className="flex items-center gap-4 bg-white dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
                                <div className="text-primary flex items-center justify-center rounded-lg bg-primary/10 shrink-0 size-12">
                                    <span className="material-symbols-outlined text-2xl">{getIcon(cat.name)}</span>
                                </div>
                                <div className="flex-1">
                                    {editingId === cat.id ? (
                                        <input
                                            type="text"
                                            value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                            onBlur={() => handleEdit(cat.id)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleEdit(cat.id)}
                                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-base font-semibold"
                                            autoFocus
                                        />
                                    ) : (
                                        <>
                                            <p className="text-base font-semibold">{cat.name}</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">{cat.subtitle || 'Categoría de gasto'}</p>
                                        </>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => { setEditingId(cat.id); setEditName(cat.name); }}
                                        className="p-2 text-slate-400 hover:text-primary transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-[20px]">edit</span>
                                    </button>
                                    <button
                                        onClick={() => handleDelete(cat.id)}
                                        className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-[20px]">delete</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* Add New Category */}
            <div className="fixed bottom-0 left-0 right-0 px-4 pb-8 pt-4 max-w-md mx-auto w-full z-20 bg-background-light dark:bg-background-dark">
                <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 flex items-center gap-3">
                    <div className="flex-1 relative">
                        <input
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/50 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                            placeholder="Nueva categoría..."
                        />
                    </div>
                    <button
                        onClick={handleAdd}
                        disabled={saving || !newCategoryName.trim()}
                        className="bg-primary text-background-dark font-bold px-4 py-3 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
                    >
                        <span className="material-symbols-outlined">add</span>
                        <span className="hidden sm:inline">Agregar</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ExpenseCategories;
