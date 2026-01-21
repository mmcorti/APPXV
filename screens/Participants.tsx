import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { notionService } from '../services/notion';

interface Participant {
    id: string;
    name: string;
    eventId: string;
    weight: number;
}

const Participants: React.FC = () => {
    const { id: eventId } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({ name: '', weight: 1 });
    const [editingId, setEditingId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (eventId) loadParticipants();
    }, [eventId]);

    const loadParticipants = async () => {
        if (!eventId) return;
        setLoading(true);
        try {
            const data = await notionService.getParticipants(eventId);
            setParticipants(data);
        } catch (error) {
            console.error('Error loading participants:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!eventId || !formData.name) return;
        setSaving(true);
        try {
            if (editingId) {
                await notionService.updateParticipant(editingId, formData);
            } else {
                await notionService.createParticipant(eventId, formData);
            }
            setShowForm(false);
            setFormData({ name: '', weight: 1 });
            setEditingId(null);
            loadParticipants();
        } catch (error) {
            console.error('Error saving participant:', error);
            alert('Error al guardar participante');
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = (participant: Participant) => {
        setFormData({ name: participant.name, weight: participant.weight });
        setEditingId(participant.id);
        setShowForm(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Eliminar este participante?')) return;
        try {
            await notionService.deleteParticipant(id);
            loadParticipants();
        } catch (error) {
            console.error('Error deleting participant:', error);
        }
    };

    return (
        <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark text-slate-900 dark:text-white">
            <div className="sticky top-0 z-50 flex items-center bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md p-4 pb-2 justify-between max-w-md mx-auto w-full">
                <button onClick={() => navigate(`/costs/${eventId}`)} className="flex size-12 shrink-0 items-center cursor-pointer">
                    <span className="material-symbols-outlined text-2xl">arrow_back_ios</span>
                </button>
                <h2 className="text-lg font-bold leading-tight flex-1 text-center">Participantes</h2>
                <div className="flex w-12 items-center justify-end">
                    <button
                        onClick={() => { setShowForm(true); setEditingId(null); setFormData({ name: '', weight: 1 }); }}
                        className="flex cursor-pointer items-center justify-center rounded-full h-10 w-10 bg-primary text-background-dark shadow-lg active:scale-95 transition-transform"
                    >
                        <span className="material-symbols-outlined text-2xl">add</span>
                    </button>
                </div>
            </div>

            <main className="flex-1 overflow-y-auto max-w-md mx-auto w-full pb-32">
                <div className="px-4 py-3">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Agrega a las personas que participan del reparto de gastos.
                    </p>
                </div>

                {loading ? (
                    <div className="flex justify-center py-10">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                ) : participants.length === 0 ? (
                    <div className="text-center py-10 text-slate-400">
                        <span className="material-symbols-outlined text-4xl mb-2">group_add</span>
                        <p>No hay participantes registrados</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3 p-4">
                        {participants.map(p => (
                            <div key={p.id} className="flex items-center p-4 bg-white dark:bg-[#193324] rounded-xl border border-slate-200 dark:border-white/5">
                                <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mr-4">
                                    <span className="material-symbols-outlined">person</span>
                                </div>
                                <div className="flex-1">
                                    <h5 className="font-bold text-base">{p.name}</h5>
                                    <p className="text-slate-500 dark:text-[#92c9a9] text-xs">Peso: {p.weight}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleEdit(p)}
                                        className="p-2 rounded-lg bg-primary/10 text-primary"
                                    >
                                        <span className="material-symbols-outlined text-lg">edit</span>
                                    </button>
                                    <button
                                        onClick={() => handleDelete(p.id)}
                                        className="p-2 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-500"
                                    >
                                        <span className="material-symbols-outlined text-lg">delete</span>
                                    </button>
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
                            <h3 className="text-lg font-bold">{editingId ? 'Editar Participante' : 'Nuevo Participante'}</h3>
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
                            <div>
                                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">
                                    Peso en el reparto (ej: 1 = parte igual, 2 = paga doble)
                                </label>
                                <input
                                    type="number"
                                    value={formData.weight}
                                    onChange={(e) => setFormData({ ...formData, weight: parseFloat(e.target.value) || 1 })}
                                    min="0.1"
                                    step="0.1"
                                    className="w-full h-12 bg-slate-100 dark:bg-slate-800 border-none rounded-xl px-4 text-base"
                                />
                            </div>
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

export default Participants;
