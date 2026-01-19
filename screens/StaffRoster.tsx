import React, { useState, useEffect } from 'react';
import { User } from '../types';

interface StaffRosterProps {
    user: User;
}

interface RosterMember {
    id: string;
    name: string;
    email: string;
    description: string;
    ownerId: string;
    // password is handled only on creation
}

const StaffRosterScreen: React.FC<StaffRosterProps> = ({ user }) => {
    const [roster, setRoster] = useState<RosterMember[]>([]);
    const [loading, setLoading] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

    // New member form
    const [newName, setNewName] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newDescription, setNewDescription] = useState('');

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

    const fetchRoster = async () => {
        if (!user.id) return;
        setLoading(true);
        try {
            // Fetch roster owned by this subscriber
            const res = await fetch(`${API_URL}/staff-roster?ownerId=${user.id}`);
            if (res.ok) {
                const data = await res.json();
                setRoster(data);
            }
        } catch (e) {
            console.error('Error fetching roster:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRoster();
    }, [user]);

    const handleCreate = async () => {
        if (!newName || !newEmail || !newPassword) {
            alert('Nombre, Email y Contraseña son obligatorios');
            return;
        }

        try {
            const res = await fetch(`${API_URL}/staff-roster`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newName,
                    email: newEmail,
                    password: newPassword,
                    description: newDescription,
                    ownerId: user.id
                })
            });

            if (res.ok) {
                alert('Miembro del staff creado');
                setIsCreating(false);
                setNewName('');
                setNewEmail('');
                setNewPassword('');
                setNewDescription('');
                fetchRoster();
            } else {
                const err = await res.json();
                alert('Error: ' + err.error);
            }
        } catch (e) {
            console.error('Error creating member:', e);
            alert('Error al crear miembro');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Eliminar este miembro del staff permanentemente?')) return;
        try {
            const res = await fetch(`${API_URL}/staff-roster/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setRoster(prev => prev.filter(m => m.id !== id));
            } else {
                alert('Error al eliminar');
            }
        } catch (e) {
            console.error('Error deleting:', e);
        }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto pb-24">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Mi Staff (Roster)</h1>
                    <p className="text-gray-600">Gestiona tu equipo permanente (DJs, Fotógrafos, etc.) para asignarlos a eventos.</p>
                </div>
                <button
                    onClick={() => setIsCreating(!isCreating)}
                    className="bg-black text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-800 transition-colors"
                >
                    <span className="material-symbols-outlined">{isCreating ? 'close' : 'add'}</span>
                    {isCreating ? 'Cancelar' : 'Nuevo Miembro'}
                </button>
            </div>

            {isCreating && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8 animate-fade-in">
                    <h2 className="text-lg font-semibold mb-4">Agregar Nuevo Miembro</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                            <input
                                type="text"
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                                placeholder="Ej: Juan Perez"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email (Login)</label>
                            <input
                                type="email"
                                value={newEmail}
                                onChange={e => setNewEmail(e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                                placeholder="juan@ejemplo.com"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
                            <input
                                type="text"
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent font-mono"
                                placeholder="Contraseña inicial"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Rol / Descripción</label>
                            <input
                                type="text"
                                value={newDescription}
                                onChange={e => setNewDescription(e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                                placeholder="Ej: DJ Principal"
                            />
                        </div>
                    </div>
                    <div className="mt-6 flex justify-end">
                        <button
                            onClick={handleCreate}
                            className="bg-black text-white px-6 py-2 rounded-lg hover:bg-gray-900 transition-shadow shadow-md"
                        >
                            Guardar Miembro
                        </button>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {roster.length === 0 ? (
                        <p className="text-gray-500 text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                            No tienes miembros en tu staff aún.
                        </p>
                    ) : (
                        roster.map(member => (
                            <div key={member.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center group hover:shadow-md transition-shadow">
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                                        <span className="material-symbols-outlined">person</span>
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900">{member.name}</h3>
                                        <div className="flex items-center gap-2 text-sm text-gray-500">
                                            <span>{member.email}</span>
                                            {member.description && (
                                                <>
                                                    <span>•</span>
                                                    <span className="bg-gray-100 px-2 py-0.5 rounded text-xs text-gray-700">{member.description}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleDelete(member.id)}
                                    className="text-gray-400 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition-colors"
                                    title="Eliminar del equipo"
                                >
                                    <span className="material-symbols-outlined">delete</span>
                                </button>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export default StaffRosterScreen;
