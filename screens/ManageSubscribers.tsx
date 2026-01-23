import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { StaffMember, StaffPermissions } from '../types';

const API_URL = import.meta.env.VITE_API_URL || '';

interface Subscriber extends StaffMember {
    plan?: 'freemium' | 'premium' | 'vip';
}

const ManageSubscribersScreen: React.FC = () => {
    const navigate = useNavigate();
    const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
    const [loading, setLoading] = useState(true);

    // Form state
    const [inviteEmail, setInviteEmail] = useState('');
    const [invitePassword, setInvitePassword] = useState('');
    const [inviteName, setInviteName] = useState('');
    const [invitePlan, setInvitePlan] = useState<'freemium' | 'premium' | 'vip'>('freemium');
    const [invitePermissions, setInvitePermissions] = useState<StaffPermissions>({
        access_invitados: false,
        access_mesas: false,
        access_link: false,
        access_fotowall: false,
        access_games: false
    });
    const [inviting, setInviting] = useState(false);
    const [savingId, setSavingId] = useState<string | null>(null);

    // Edit mode
    const [editingId, setEditingId] = useState<string | null>(null);

    const fetchSubscribers = async () => {
        setLoading(true);
        try {
            // Fetch ALL subscribers (no eventId filter)
            const res = await fetch(`${API_URL}/subscribers`);
            if (res.ok) {
                const data = await res.json();
                setSubscribers(data);
            }
        } catch (e) {
            console.error('Error fetching subscribers:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSubscribers();
    }, []);

    const resetForm = () => {
        setInviteEmail('');
        setInvitePassword('');
        setInviteName('');
        setInvitePlan('freemium');
        setInvitePermissions({
            access_invitados: false,
            access_mesas: false,
            access_link: false,
            access_fotowall: false,
            access_games: false
        });
        setEditingId(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inviteEmail.trim()) return;
        if (!editingId && !invitePassword.trim()) return;

        setInviting(true);
        try {
            if (editingId) {
                // UPDATE existing subscriber
                const res = await fetch(`${API_URL}/subscribers/${editingId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: inviteName || inviteEmail.split('@')[0],
                        permissions: invitePermissions,
                        plan: invitePlan
                    })
                });

                if (res.ok) {
                    resetForm();
                    fetchSubscribers();
                } else {
                    const error = await res.json();
                    alert(error.error || 'Error al actualizar');
                }
            } else {
                // CREATE new subscriber
                const res = await fetch(`${API_URL}/subscribers`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: inviteName || inviteEmail.split('@')[0],
                        email: inviteEmail,
                        password: invitePassword,
                        permissions: invitePermissions,
                        plan: invitePlan,
                        userRole: 'admin'
                    })
                });

                if (res.ok) {
                    resetForm();
                    fetchSubscribers();
                } else {
                    const error = await res.json();
                    alert(error.error || 'Error al crear');
                }
            }
        } catch (e) {
            console.error('Error:', e);
            alert('Error de conexión');
        } finally {
            setInviting(false);
        }
    };

    const handleEdit = (subscriber: Subscriber) => {
        setEditingId(subscriber.id);
        setInviteName(subscriber.name);
        setInviteEmail(subscriber.email);
        setInvitePassword(''); // Don't show password
        setInvitePlan(subscriber.plan || 'freemium');
        setInvitePermissions(subscriber.permissions);

        // Scroll to top of form
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const updatePermissions = async (staffId: string, permissions: StaffPermissions) => {
        setSavingId(staffId);
        try {
            await fetch(`${API_URL}/subscribers/${staffId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ permissions })
            });
            setSubscribers(prev => prev.map(s => s.id === staffId ? { ...s, permissions } : s));
        } catch (e) {
            console.error('Error updating:', e);
        } finally {
            setSavingId(null);
        }
    };

    const togglePermission = (staffMember: Subscriber, permKey: keyof StaffPermissions) => {
        const newPerms = { ...staffMember.permissions, [permKey]: !staffMember.permissions[permKey] };
        updatePermissions(staffMember.id, newPerms);
    };

    const toggleInvitePermission = (permKey: keyof StaffPermissions) => {
        setInvitePermissions(prev => ({ ...prev, [permKey]: !prev[permKey] }));
    };

    const deleteSubscriber = async (subscriberId: string) => {
        if (!confirm('¿Eliminar este suscriptor?')) return;
        try {
            await fetch(`${API_URL}/subscribers/${subscriberId}`, { method: 'DELETE' });
            setSubscribers(prev => prev.filter(s => s.id !== subscriberId));
        } catch (e) {
            console.error('Error deleting:', e);
        }
    };

    const permissionLabels: Record<keyof StaffPermissions, { label: string; color: string }> = {
        access_invitados: { label: 'Invitados', color: 'blue' },
        access_mesas: { label: 'Mesas', color: 'purple' },
        access_link: { label: 'Link', color: 'green' },
        access_fotowall: { label: 'FotoWall', color: 'pink' },
        access_games: { label: 'Games', color: 'orange' }
    };

    const planColors = {
        freemium: 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600',
        premium: 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-600',
        vip: 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-600'
    };

    return (
        <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-white min-h-screen max-w-[480px] mx-auto">
            {/* Header */}
            <div className="sticky top-0 z-40 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md px-4 pt-6 pb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="size-10 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <h1 className="text-xl font-bold">Gestionar Suscriptores</h1>
                </div>
            </div>

            <div className="px-4 pb-8">
                {/* Form */}
                <div className={`rounded-2xl p-4 mb-6 shadow-sm ${editingId ? 'bg-purple-50 dark:bg-purple-900/10 border-2 border-purple-400' : 'bg-white dark:bg-slate-800'}`}>
                    <h2 className="font-semibold flex items-center gap-2 mb-4">
                        <span className="text-lg">{editingId ? '✏️' : '👤'}</span>
                        {editingId ? 'Editar Suscriptor' : 'Nuevo Suscriptor'}
                    </h2>
                    <form onSubmit={handleSubmit} className="space-y-3">
                        <input
                            type="text"
                            placeholder="Nombre (opcional)"
                            value={inviteName}
                            onChange={e => setInviteName(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        <input
                            type="email"
                            placeholder="Email del suscriptor"
                            value={inviteEmail}
                            onChange={e => setInviteEmail(e.target.value)}
                            required
                            disabled={!!editingId}
                            className={`w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 focus:ring-2 focus:ring-blue-500 outline-none ${editingId ? 'opacity-50 cursor-not-allowed' : ''}`}
                        />
                        {!editingId && (
                            <input
                                type="password"
                                placeholder="Contraseña"
                                value={invitePassword}
                                onChange={e => setInvitePassword(e.target.value)}
                                required
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        )}

                        {/* Plan Selector */}
                        <div className="pt-2">
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">Plan de suscripción:</p>
                            <div className="grid grid-cols-3 gap-2">
                                {(['freemium', 'premium', 'vip'] as const).map(planOption => (
                                    <button
                                        key={planOption}
                                        type="button"
                                        onClick={() => setInvitePlan(planOption)}
                                        className={`px-3 py-2.5 rounded-xl border-2 font-semibold text-sm capitalize transition-all ${invitePlan === planOption ? planColors[planOption] : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400'
                                            }`}
                                    >
                                        {planOption === 'vip' ? 'VIP' : planOption}
                                    </button>
                                ))}
                            </div>
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                                {invitePlan === 'freemium' && '1 evento, 50 invitados, 20 fotos'}
                                {invitePlan === 'premium' && '5 eventos, 200 invitados, 200 fotos'}
                                {invitePlan === 'vip' && 'Eventos ilimitados, invitados y fotos ilimitados'}
                            </p>
                        </div>

                        {/* Permission toggles */}
                        <div className="pt-2">
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">Módulos habilitados:</p>
                            <div className="grid grid-cols-2 gap-2">
                                {(Object.keys(permissionLabels) as Array<keyof StaffPermissions>).map(permKey => (
                                    <button
                                        key={permKey}
                                        type="button"
                                        onClick={() => toggleInvitePermission(permKey)}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all ${invitePermissions[permKey]
                                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                            : 'border-slate-200 dark:border-slate-600'
                                            }`}
                                    >
                                        <div className={`size-5 rounded border-2 flex items-center justify-center ${invitePermissions[permKey]
                                            ? 'border-blue-500 bg-blue-500'
                                            : 'border-slate-300 dark:border-slate-500'
                                            }`}>
                                            {invitePermissions[permKey] && (
                                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                            )}
                                        </div>
                                        <span className={`text-sm font-medium ${invitePermissions[permKey] ? 'text-blue-600' : 'text-slate-600 dark:text-slate-400'
                                            }`}>
                                            {permissionLabels[permKey].label}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-2 pt-2">
                            {editingId && (
                                <button
                                    type="button"
                                    onClick={resetForm}
                                    className="flex-1 py-3 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-xl transition-colors"
                                >
                                    Cancelar
                                </button>
                            )}
                            <button
                                type="submit"
                                disabled={inviting || !inviteEmail.trim() || (!editingId && !invitePassword.trim())}
                                className={`flex-1 py-3 font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${editingId
                                    ? 'bg-purple-600 hover:bg-purple-700 text-white'
                                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                                    }`}
                            >
                                {inviting ? 'Guardando...' : editingId ? 'Guardar Cambios' : 'Crear Suscriptor'}
                            </button>
                        </div>
                    </form>
                </div>

                {/* Subscribers List */}
                <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold text-lg">Suscriptores Actuales</h2>
                    <span className="text-sm text-blue-600 font-medium">{subscribers.length} Activo{subscribers.length !== 1 ? 's' : ''}</span>
                </div>

                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                ) : subscribers.length === 0 ? (
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 text-center">
                        <p className="text-slate-500 dark:text-slate-400">No hay suscriptores aún</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {subscribers.map(s => (
                            <div key={s.id} className={`bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm ${editingId === s.id ? 'ring-2 ring-purple-500' : ''}`}>
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="size-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
                                            {s.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-semibold">{s.name}</p>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">{s.email}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {/* Plan Badge */}
                                        <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${planColors[s.plan || 'freemium']}`}>
                                            {s.plan === 'vip' ? 'VIP' : s.plan || 'freemium'}
                                        </span>
                                        {/* Edit Button */}
                                        <button
                                            onClick={() => handleEdit(s)}
                                            className="text-blue-500 hover:text-blue-600 p-1"
                                            title="Editar"
                                        >
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                            </svg>
                                        </button>
                                        {/* Delete Button */}
                                        <button
                                            onClick={() => deleteSubscriber(s.id)}
                                            className="text-red-500 hover:text-red-600 p-1"
                                            title="Eliminar"
                                        >
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>

                                {/* Permission toggles */}
                                <div className="grid grid-cols-2 gap-2">
                                    {(Object.keys(permissionLabels) as Array<keyof StaffPermissions>).map(permKey => (
                                        <button
                                            key={permKey}
                                            onClick={() => togglePermission(s, permKey)}
                                            disabled={savingId === s.id}
                                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all ${s.permissions[permKey]
                                                ? `border-${permissionLabels[permKey].color}-500 bg-${permissionLabels[permKey].color}-50 dark:bg-${permissionLabels[permKey].color}-900/20`
                                                : 'border-slate-200 dark:border-slate-600'
                                                }`}
                                        >
                                            <div className={`size-5 rounded border-2 flex items-center justify-center ${s.permissions[permKey]
                                                ? `border-${permissionLabels[permKey].color}-500 bg-${permissionLabels[permKey].color}-500`
                                                : 'border-slate-300 dark:border-slate-500'
                                                }`}>
                                                {s.permissions[permKey] && (
                                                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                    </svg>
                                                )}
                                            </div>
                                            <span className={`text-sm font-medium ${s.permissions[permKey] ? `text-${permissionLabels[permKey].color}-600` : 'text-slate-600 dark:text-slate-400'
                                                }`}>
                                                {permissionLabels[permKey].label}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ManageSubscribersScreen;
