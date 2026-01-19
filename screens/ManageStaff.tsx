import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { StaffMember, StaffPermissions, InvitationData } from '../types';

const API_URL = import.meta.env.VITE_API_URL || '';

interface ManageStaffProps {
    event: InvitationData | null;
    onBack?: () => void;
}

const ManageStaffScreen: React.FC<ManageStaffProps> = ({ event, onBack }) => {
    const navigate = useNavigate();
    const { id: eventId } = useParams<{ id: string }>();
    const [staff, setStaff] = useState<StaffMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [inviteEmail, setInviteEmail] = useState('');
    const [invitePassword, setInvitePassword] = useState('');
    const [inviteName, setInviteName] = useState('');
    const [invitePermissions, setInvitePermissions] = useState<StaffPermissions>({
        access_invitados: false,
        access_mesas: false,
        access_link: false,
        access_fotowall: false
    });
    const [inviting, setInviting] = useState(false);
    const [savingId, setSavingId] = useState<string | null>(null);

    const fetchStaff = async () => {
        if (!eventId) return;
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/staff?eventId=${eventId}`);
            if (res.ok) {
                const data = await res.json();
                setStaff(data);
            }
        } catch (e) {
            console.error('Error fetching staff:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStaff();
    }, [eventId]);

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inviteEmail.trim() || !invitePassword.trim()) return;

        setInviting(true);
        try {
            const res = await fetch(`${API_URL}/staff`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    eventId,
                    name: inviteName || inviteEmail.split('@')[0],
                    email: inviteEmail,
                    password: invitePassword,
                    permissions: invitePermissions
                })
            });

            if (res.ok) {
                setInviteEmail('');
                setInvitePassword('');
                setInviteName('');
                setInvitePermissions({
                    access_invitados: false,
                    access_mesas: false,
                    access_link: false,
                    access_fotowall: false
                });
                fetchStaff();
            } else {
                const error = await res.json();
                alert(error.error || 'Error al invitar');
            }
        } catch (e) {
            console.error('Error inviting:', e);
            alert('Error de conexión');
        } finally {
            setInviting(false);
        }
    };

    const updatePermissions = async (staffId: string, permissions: StaffPermissions) => {
        setSavingId(staffId);
        try {
            await fetch(`${API_URL}/staff/${staffId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ permissions })
            });
            setStaff(prev => prev.map(s => s.id === staffId ? { ...s, permissions } : s));
        } catch (e) {
            console.error('Error updating:', e);
        } finally {
            setSavingId(null);
        }
    };

    const togglePermission = (staffMember: StaffMember, permKey: keyof StaffPermissions) => {
        const newPerms = { ...staffMember.permissions, [permKey]: !staffMember.permissions[permKey] };
        updatePermissions(staffMember.id, newPerms);
    };

    const toggleInvitePermission = (permKey: keyof StaffPermissions) => {
        setInvitePermissions(prev => ({ ...prev, [permKey]: !prev[permKey] }));
    };

    const deleteStaff = async (staffId: string) => {
        if (!confirm('¿Eliminar este colaborador?')) return;
        try {
            await fetch(`${API_URL}/staff/${staffId}`, { method: 'DELETE' });
            setStaff(prev => prev.filter(s => s.id !== staffId));
        } catch (e) {
            console.error('Error deleting:', e);
        }
    };

    const permissionLabels: Record<keyof StaffPermissions, { label: string; color: string }> = {
        access_invitados: { label: 'Invitados', color: 'blue' },
        access_mesas: { label: 'Mesas', color: 'purple' },
        access_link: { label: 'Link', color: 'green' },
        access_fotowall: { label: 'FotoWall', color: 'pink' }
    };

    return (
        <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-white min-h-screen max-w-[480px] mx-auto">
            {/* Header */}
            <div className="sticky top-0 z-40 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md px-4 pt-6 pb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => onBack ? onBack() : navigate(-1)}
                        className="size-10 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <h1 className="text-xl font-bold">Gestionar Staff</h1>
                </div>
            </div>

            <div className="px-4 pb-8">
                {/* Event Info */}
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Permisos para el evento:</p>
                <p className="font-semibold text-lg mb-6">{event?.eventName || 'Evento'}</p>

                {/* Invite Form */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 mb-6 shadow-sm">
                    <h2 className="font-semibold flex items-center gap-2 mb-4">
                        <span className="text-lg">👤</span> Invitar Nuevo Staff
                    </h2>
                    <form onSubmit={handleInvite} className="space-y-3">
                        <input
                            type="text"
                            placeholder="Nombre (opcional)"
                            value={inviteName}
                            onChange={e => setInviteName(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        <input
                            type="email"
                            placeholder="Email del colaborador"
                            value={inviteEmail}
                            onChange={e => setInviteEmail(e.target.value)}
                            required
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        <input
                            type="password"
                            placeholder="Contraseña"
                            value={invitePassword}
                            onChange={e => setInvitePassword(e.target.value)}
                            required
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
                        />

                        {/* Permission toggles for invite */}
                        <div className="pt-2">
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">Permisos a asignar:</p>
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

                        <button
                            type="submit"
                            disabled={inviting || !inviteEmail.trim() || !invitePassword.trim()}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {inviting ? 'Invitando...' : 'Enviar Invitación'}
                        </button>
                    </form>
                </div>

                {/* Staff List */}
                <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold text-lg">Staff Actual</h2>
                    <span className="text-sm text-blue-600 font-medium">{staff.length} Activo{staff.length !== 1 ? 's' : ''}</span>
                </div>

                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                ) : staff.length === 0 ? (
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 text-center">
                        <p className="text-slate-500 dark:text-slate-400">No hay colaboradores aún</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {staff.map(s => (
                            <div key={s.id} className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm">
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
                                    <button
                                        onClick={() => deleteStaff(s.id)}
                                        className="text-red-500 hover:text-red-600 p-1"
                                        title="Eliminar"
                                    >
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
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

export default ManageStaffScreen;
