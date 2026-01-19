import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { InvitationData, User, StaffPermissions } from '../types';

interface Assignment {
    id: string;
    name: string;
    staffId: string;
    eventId: string;
    permissions: StaffPermissions;
}

interface RosterMember {
    id: string;
    name: string;
    email: string;
    description: string;
}

interface Props {
    user: User;
    invitations: InvitationData[];
}

const EventStaffAssignmentsScreen: React.FC<Props> = ({ user, invitations }) => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const event = invitations.find(i => i.id === id);

    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [roster, setRoster] = useState<RosterMember[]>([]);
    const [loading, setLoading] = useState(true);

    // Assignment form
    const [selectedStaffId, setSelectedStaffId] = useState('');
    const [permissions, setPermissions] = useState<StaffPermissions>({
        access_invitados: false,
        access_mesas: false,
        access_link: false,
        access_fotowall: false
    });

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

    useEffect(() => {
        if (event && user.id) {
            fetchData();
        }
    }, [event, user]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Assignments for this event
            const resAssign = await fetch(`${API_URL}/staff-assignments?eventId=${event?.id}`);
            if (resAssign.ok) {
                setAssignments(await resAssign.json());
            }

            // 2. Fetch Roster to populate dropdown
            // For Admin, we might need to know who the subscriber owner is.
            // For now assume User is the Subscriber.
            const resRoster = await fetch(`${API_URL}/staff-roster?ownerId=${user.id}`);
            if (resRoster.ok) {
                setRoster(await resRoster.json());
            }

        } catch (e) {
            console.error('Error fetching data:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleAssign = async () => {
        if (!selectedStaffId) return;

        // Check if already assigned
        if (assignments.find(a => a.staffId === selectedStaffId)) {
            alert("Este miembro ya está asignado al evento");
            return;
        }

        const staffMember = roster.find(r => r.id === selectedStaffId);

        try {
            const res = await fetch(`${API_URL}/staff-assignments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    eventId: event?.id,
                    staffId: selectedStaffId,
                    name: staffMember?.name || 'Staff',
                    permissions
                })
            });

            if (res.ok) {
                fetchData();
                setSelectedStaffId('');
                // Reset permissions if desired
            } else {
                alert('Error al asignar');
            }
        } catch (e) {
            console.error('Error assigning:', e);
        }
    };

    const handleDelete = async (assignmentId: string) => {
        if (!confirm('¿Quitar acceso a este evento?')) return;
        try {
            await fetch(`${API_URL}/staff-assignments/${assignmentId}`, { method: 'DELETE' });
            setAssignments(prev => prev.filter(a => a.id !== assignmentId));
        } catch (e) {
            console.error('Error unassigning:', e);
        }
    };

    if (!event) return <div>Evento no encontrado</div>;

    return (
        <div className="p-6 max-w-4xl mx-auto pb-24">
            <div className="flex items-center gap-4 mb-6">
                <button
                    onClick={() => navigate('/dashboard')}
                    className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                >
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Asignar Staff</h1>
                    <p className="text-gray-600">Evento: {event.eventName}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left: Assign Form */}
                <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit">
                    <h2 className="font-semibold text-lg mb-4">Nueva Asignación</h2>

                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Seleccionar Miembro</label>
                        <select
                            value={selectedStaffId}
                            onChange={e => setSelectedStaffId(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-lg"
                        >
                            <option value="">-- Seleccionar del Roster --</option>
                            {roster.map(r => (
                                <option key={r.id} value={r.id}>{r.name} ({r.description})</option>
                            ))}
                        </select>
                        {roster.length === 0 && <p className="text-xs text-red-500 mt-1">Tu roster está vacío. Ve a "Mi Staff" para agregar gente.</p>}
                    </div>

                    <div className="mb-6 space-y-3">
                        <p className="font-medium text-sm text-gray-700">Permisos en este evento:</p>
                        <label className="flex items-center gap-2 text-sm text-gray-600">
                            <input type="checkbox" checked={permissions.access_invitados} onChange={e => setPermissions({ ...permissions, access_invitados: e.target.checked })} className="rounded text-black focus:ring-black" />
                            Gestionar Invitados
                        </label>
                        <label className="flex items-center gap-2 text-sm text-gray-600">
                            <input type="checkbox" checked={permissions.access_mesas} onChange={e => setPermissions({ ...permissions, access_mesas: e.target.checked })} className="rounded text-black focus:ring-black" />
                            Gestionar Mesas
                        </label>
                        <label className="flex items-center gap-2 text-sm text-gray-600">
                            <input type="checkbox" checked={permissions.access_link} onChange={e => setPermissions({ ...permissions, access_link: e.target.checked })} className="rounded text-black focus:ring-black" />
                            Compartir Link & RSVP
                        </label>
                        <label className="flex items-center gap-2 text-sm text-gray-600">
                            <input type="checkbox" checked={permissions.access_fotowall} onChange={e => setPermissions({ ...permissions, access_fotowall: e.target.checked })} className="rounded text-black focus:ring-black" />
                            Moderación FotoWall
                        </label>
                    </div>

                    <button
                        onClick={handleAssign}
                        disabled={!selectedStaffId}
                        className="w-full bg-black text-white py-2 rounded-lg hover:bg-gray-900 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                    >
                        Asignar al Evento
                    </button>
                </div>

                {/* Right: Existing Assignments */}
                <div className="lg:col-span-2">
                    <h2 className="font-semibold text-lg mb-4">Staff Asignado ({assignments.length})</h2>
                    {loading ? (
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black mx-auto"></div>
                    ) : assignments.length === 0 ? (
                        <p className="text-gray-500 italic bg-gray-50 p-4 rounded-lg">Nadie asignado aún.</p>
                    ) : (
                        <div className="space-y-3">
                            {assignments.map(assign => (
                                <div key={assign.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-start">
                                    <div>
                                        <h3 className="font-bold text-gray-900">{assign.name}</h3>
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {assign.permissions.access_invitados && <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded">Invitados</span>}
                                            {assign.permissions.access_mesas && <span className="bg-purple-100 text-purple-700 text-xs px-2 py-1 rounded">Mesas</span>}
                                            {assign.permissions.access_link && <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded">Link</span>}
                                            {assign.permissions.access_fotowall && <span className="bg-pink-100 text-pink-700 text-xs px-2 py-1 rounded">FotoWall</span>}
                                        </div>
                                    </div>
                                    <button onClick={() => handleDelete(assign.id)} className="text-red-400 hover:text-red-600">
                                        <span className="material-symbols-outlined">person_remove</span>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default EventStaffAssignmentsScreen;
