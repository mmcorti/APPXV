import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '../types';
import { UpgradePrompt } from '../components/UpgradePrompt';
import { usePlan } from '../hooks/usePlan';

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
    const navigate = useNavigate();
    const { checkLimit } = usePlan();
    const [roster, setRoster] = useState<RosterMember[]>([]);
    const [loading, setLoading] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

    // New member form
    const [newName, setNewName] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newDescription, setNewDescription] = useState('');

    const API_URL = import.meta.env.VITE_API_URL || '/api';

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
        if (!user.id) {
            alert('Error: Sesión incompleta. Por favor, cierra sesión y vuelve a ingresar para activar todas las funciones.');
            return;
        }
        if (!newName || !newEmail || !newPassword) {
            alert('Nombre, Nombre de Usuario y Contraseña son obligatorios');
            return;
        }

        const formattedEmail = `${newEmail.trim().toLowerCase()}.${user.email}`;

        // Limit Enforcement
        const limitCheck = checkLimit('maxStaffRoster', roster.length);
        if (!limitCheck.allowed) {
            alert(`Has alcanzado el límite de ${limitCheck.limit} miembros. Por favor, sube de nivel tu plan.`);
            return;
        }

        try {
            const res = await fetch(`${API_URL}/staff-roster`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newName,
                    email: formattedEmail,
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
                const err = await res.json().catch(() => ({}));
                alert('Error al crear Miembro: ' + (err.error || 'Error del servidor (' + res.status + ')'));
            }
        } catch (e: any) {
            console.error('Error creating member:', e);
            alert('Error al crear miembro: ' + (e.message || 'Error de conexión'));
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
            <div className="flex items-center gap-4 mb-6">
                <button
                    onClick={() => navigate('/dashboard')}
                    className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                >
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-gray-800">Mi Staff (Roster)</h1>
                    <p className="text-gray-600">Gestiona tu equipo permanente (DJs, Fotógrafos, etc.) para asignarlos a eventos.</p>
                </div>
                <button
                    onClick={() => setIsCreating(!isCreating)}
                    className="bg-black text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-800 transition-colors"
                >
                    <span className="material-symbols-outlined text-sm">{isCreating ? 'close' : 'add'}</span>
                    {isCreating ? 'Cancelar' : 'Nuevo Miembro'}
                </button>
            </div>

            <div className="mb-6">
                <UpgradePrompt
                    resourceName="miembros del staff"
                    currentCount={roster.length}
                    limit={checkLimit('maxStaffRoster', roster.length).limit}
                    showAlways={true}
                />
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
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de Usuario</label>
                            <div className="flex border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-black focus-within:border-transparent">
                                <input
                                    type="text"
                                    value={newEmail}
                                    onChange={e => setNewEmail(e.target.value.replace(/[^a-z0-9_-]/gi, '').toLowerCase())}
                                    className="w-full p-2 outline-none text-right font-mono text-sm"
                                    placeholder="ej: juan"
                                />
                                <div className="bg-gray-100 p-2 text-gray-500 font-mono text-sm flex items-center border-l border-gray-300 pointer-events-none whitespace-nowrap">
                                    .{user?.email || 'email'}
                                </div>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                El email de acceso será: <span className="font-semibold text-gray-800">{newEmail ? `${newEmail.toLowerCase()}.${user?.email}` : `...`}</span>
                            </p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
                            <input
                                type="password"
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
