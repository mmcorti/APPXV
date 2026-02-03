
import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { InvitationData, Table, SeatedGuest, Guest } from '../types';

interface TablesScreenProps {
  invitations: InvitationData[];
  onAddTable: (eventId: string, name: string, capacity: number) => void;
  onUpdateTable: (eventId: string, tableId: string, name: string, capacity: number) => void;
  onReorderTables: (eventId: string, orderedTableIds: string[]) => void;
  onUpdateSeating: (eventId: string, tableId: string, assignments: { guestId: string | number, companionId?: string, companionIndex: number, companionName: string }[]) => void;
  onDeleteTable: (eventId: string, tableId: string) => void;
}

const TablesScreen: React.FC<TablesScreenProps> = ({ invitations, onAddTable, onUpdateTable, onReorderTables, onUpdateSeating, onDeleteTable }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const invitation = invitations.find(inv => inv.id === id);

  const [showAddTableModal, setShowAddTableModal] = useState(false);
  const [newTableName, setNewTableName] = useState('');
  const [newTableCapacity, setNewTableCapacity] = useState(10);
  const [showAssignModal, setShowAssignModal] = useState<string | null>(null); // Table ID
  const [searchQuery, setSearchQuery] = useState(''); // Search filter for guest list

  // Edit Modal State
  const [showEditModal, setShowEditModal] = useState<string | null>(null); // Table ID being edited
  const [editTableName, setEditTableName] = useState('');
  const [editTableCapacity, setEditTableCapacity] = useState(10);


  // Drag and drop state
  const [draggedId, setDraggedId] = useState<string | null>(null);

  if (!invitation) return <div className="p-10 text-center font-bold">Evento no encontrado</div>;

  const tables = invitation.tables || [];

  const openEditModal = (table: Table) => {
    setEditTableName(table.name);
    setEditTableCapacity(table.capacity);
    setShowEditModal(table.id);
  };

  const handleEditTable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEditModal || !editTableName.trim()) return;
    onUpdateTable(invitation.id, showEditModal, editTableName, editTableCapacity);
    setShowEditModal(null);
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, tableId: string) => {
    setDraggedId(tableId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', tableId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetTableId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetTableId) {
      setDraggedId(null);
      return;
    }

    const currentOrder = tables.map(t => t.id);
    const draggedIdx = currentOrder.indexOf(draggedId);
    const targetIdx = currentOrder.indexOf(targetTableId);

    if (draggedIdx === -1 || targetIdx === -1) {
      setDraggedId(null);
      return;
    }

    // Reorder array
    currentOrder.splice(draggedIdx, 1);
    currentOrder.splice(targetIdx, 0, draggedId);

    // Call parent to persist order
    onReorderTables(invitation.id, currentOrder);
    setDraggedId(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
  };

  // Move table with arrow buttons
  const moveTable = (tableId: string, direction: 'up' | 'down') => {
    const currentOrder = tables.map(t => t.id);
    const idx = currentOrder.indexOf(tableId);
    if (idx === -1) return;

    if (direction === 'up' && idx > 0) {
      [currentOrder[idx], currentOrder[idx - 1]] = [currentOrder[idx - 1], currentOrder[idx]];
    } else if (direction === 'down' && idx < currentOrder.length - 1) {
      [currentOrder[idx], currentOrder[idx + 1]] = [currentOrder[idx + 1], currentOrder[idx]];
    } else {
      return; // No change needed
    }

    onReorderTables(invitation.id, currentOrder);
  };


  // Lista de invitados disponibles (no declinados y que no estén ya sentados)
  const availablePool = useMemo(() => {
    const tableList = invitation.tables || [];
    const guestList = invitation.guests || [];

    // Generate a set of unique keys for already seated guests/companions
    // KEY: guestId-companionIndex (without name, since names can change)
    const seatedSet = new Set(tableList.flatMap(t => (t.guests || []).map(sg => `${sg.guestId}-${sg.companionIndex ?? -1}`)));

    const getCategoryLabel = (key: string) => {
      switch (key) {
        case 'adults': return 'Adulto';
        case 'teens': return 'Adolescente';
        case 'kids': return 'Niño';
        case 'infants': return 'Bebé';
        default: return 'Invitado';
      }
    };

    // Use a Map to track unique pool entries and prevent overall duplication
    const poolMap = new Map<string, any>();
    const pool: { guestId: string | number; companionId?: string; name: string; status: 'confirmed' | 'pending'; companionIndex?: number }[] = [];

    guestList.forEach(g => {
      // Allow confirmed AND pending, but skip declined
      if (g.status === 'declined') return;

      // Determine the source of counts and names
      const isConfirmed = g.status === 'confirmed';
      const counts = isConfirmed ? g.confirmed : g.allotted;
      const namesObj = g.companionNames || { adults: [], teens: [], kids: [], infants: [] };

      // 1. ADD MAIN GUEST
      // Main guest always has companionIndex = -1
      const mainGuestName = g.name;
      const mainKey = `${g.id}--1`;  // Key without name

      if (!seatedSet.has(mainKey) && !poolMap.has(mainKey)) {
        poolMap.set(mainKey, true);
        pool.push({
          guestId: g.id,
          name: mainGuestName,
          status: isConfirmed ? 'confirmed' : 'pending',
          companionIndex: -1
        });
      }

      // 2. ADD COMPANIONS BASED ON COUNTS (Numeric Iteration)
      const categories = ['adults', 'teens', 'kids', 'infants'] as const;

      // Determine Main Guest Category to deduct 1 slot (since Main Guest is already added)
      // Priority: Adults > Teens > Kids > Infants
      let mainCategory: typeof categories[number] = 'adults';
      if ((counts?.adults || 0) > 0) mainCategory = 'adults';
      else if ((counts?.teens || 0) > 0) mainCategory = 'teens';
      else if ((counts?.kids || 0) > 0) mainCategory = 'kids';
      else if ((counts?.infants || 0) > 0) mainCategory = 'infants';

      let flatIndex = 0;

      categories.forEach(cat => {
        const count = counts?.[cat] || 0;
        // Deduct Main Guest from their category count because they are already in the pool
        const effectiveCount = (cat === mainCategory) ? Math.max(0, count - 1) : count;

        const catNames = namesObj[cat] || [];
        // Filter out the Main Guest Name from the list of potential companions
        const validNames = catNames.filter(n => n && n.trim().toLowerCase() !== g.name.trim().toLowerCase());

        for (let i = 0; i < effectiveCount; i++) {
          const suppliedName = validNames[i] || "";

          // Determine display Name
          const categoryLabel = getCategoryLabel(cat);
          let displayName = suppliedName.trim() ? suppliedName : `${categoryLabel} ${i + 1} - ${g.name}`;

          // Generate uniqueness key using flatIndex as the companionIndex
          // KEY: guestId-companionIndex (without name)
          const compKey = `${g.id}-${flatIndex}`;

          if (!seatedSet.has(compKey) && !poolMap.has(compKey)) {
            poolMap.set(compKey, true);
            pool.push({
              guestId: g.id,
              companionId: undefined, // Explicit
              name: displayName,
              status: isConfirmed ? 'confirmed' : 'pending',
              companionIndex: flatIndex
            });
          }
          flatIndex++;
        }
      });
    });

    // Sort by Guest ID to group main guest and companions together, then by index
    return pool.sort((a, b) => {
      if (a.guestId !== b.guestId) return a.guestId.toString().localeCompare(b.guestId.toString());
      // Main guest has index -1, companions 0+
      return (a.companionIndex || -1) - (b.companionIndex || -1);
    });
  }, [invitation?.guests, invitation?.tables]);

  const handleAddTable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableName.trim()) return;

    onAddTable(invitation.id, newTableName, newTableCapacity);
    setNewTableName('');
    setShowAddTableModal(false);
  };

  const handleRemoveTable = (tableId: string) => {
    if (window.confirm('¿Eliminar esta mesa permanentemente?')) {
      onDeleteTable(invitation.id, tableId);
    }
  };

  const assignToTable = (tableId: string, guest: typeof availablePool[0]) => {
    const table = tables.find(t => t.id === tableId);
    if (!table) return;

    if (table.guests.length >= table.capacity) {
      alert('Esta mesa ya está completa.');
      return;
    }

    console.log("Assigning guest to table:", {
      tableId,
      guestName: guest.name,
      guestId: guest.guestId,
      companionIndex: guest.companionIndex
    });

    const currentAssignments = table.guests.map(g => ({
      guestId: g.guestId,
      companionId: g.companionId,
      companionIndex: g.companionIndex ?? -1,
      name: g.name,
      companionName: g.name,  // Also save as companionName for Notion storage
      status: g.status || 'pending'  // Preserve confirmation status
    }));

    const newAssignments = [
      ...currentAssignments,
      {
        guestId: guest.guestId,
        companionId: guest.companionId,
        companionIndex: guest.companionIndex ?? -1,
        name: guest.name,
        companionName: guest.name,
        status: guest.status || 'pending'  // Save confirmation status
      }
    ];

    onUpdateSeating(invitation.id, tableId, newAssignments);
  };

  const removeFromTable = (tableId: string, guestId: string | number, name: string, companionIndex: number = -1) => {
    const table = tables.find(t => t.id === tableId);
    if (!table) return;

    const newAssignments = table.guests
      .filter(g => {
        const isSameGuest = g.guestId.toString() === guestId.toString();
        const isSameName = g.name === name;
        const isSameIndex = (g.companionIndex ?? -1) === companionIndex;
        return !(isSameGuest && isSameName && isSameIndex);
      })
      .map(g => ({
        guestId: g.guestId,
        companionId: g.companionId,
        companionIndex: g.companionIndex ?? -1,
        name: g.name,
        companionName: g.name,
        status: g.status || 'pending'  // Preserve status
      }));

    onUpdateSeating(invitation.id, tableId, newAssignments);
  };

  return (
    <div className="bg-background-light dark:bg-background-dark min-h-screen pb-24 max-w-[480px] md:max-w-6xl mx-auto text-slate-900 dark:text-white font-display">
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-4 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <button onClick={() => navigate('/dashboard')} className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-base font-bold">Armado de Mesas</h1>
        <button onClick={() => setShowAddTableModal(true)} className="flex items-center gap-1 text-primary font-bold text-xs uppercase bg-primary/5 px-3 py-1.5 rounded-lg border border-primary/10">
          <span className="material-symbols-outlined text-sm">add_circle</span> MESA
        </button>
      </header>

      <div className="p-4 space-y-6">
        <div className="bg-primary/5 border border-primary/10 p-4 rounded-3xl flex items-center gap-4">
          <div className="size-12 bg-primary rounded-2xl flex items-center justify-center text-white shadow-lg">
            <span className="material-symbols-outlined text-2xl">table_restaurant</span>
          </div>
          <div>
            <p className="text-xs font-bold text-primary uppercase tracking-widest">Plan de Salón</p>
            <p className="text-sm text-slate-500 font-medium">{tables.length} mesas configuradas</p>
          </div>
        </div>

        {/* Mesa Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {tables.length > 0 ? (
            tables.map((table) => (
              <div
                key={table.id}
                draggable
                onDragStart={(e) => handleDragStart(e, table.id)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, table.id)}
                onDragEnd={handleDragEnd}
                className={`bg-white dark:bg-slate-800 rounded-3xl border shadow-sm overflow-hidden transition-all cursor-grab active:cursor-grabbing ${draggedId === table.id
                  ? 'border-primary shadow-lg scale-[1.02] opacity-75'
                  : 'border-slate-100 dark:border-slate-700'
                  }`}
              >
                <div className="p-4 border-b border-slate-50 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/30">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-slate-300 cursor-grab">drag_indicator</span>
                    <div>
                      <h3 className="font-bold text-sm">{table.name}</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Capacidad: {table.guests.length}/{table.capacity}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {/* Reorder buttons */}
                    <button
                      onClick={(e) => { e.stopPropagation(); moveTable(table.id, 'up'); }}
                      disabled={tables.indexOf(table) === 0}
                      className={`p-2 rounded-xl ${tables.indexOf(table) === 0 ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                    >
                      <span className="material-symbols-outlined text-lg">arrow_upward</span>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); moveTable(table.id, 'down'); }}
                      disabled={tables.indexOf(table) === tables.length - 1}
                      className={`p-2 rounded-xl ${tables.indexOf(table) === tables.length - 1 ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                    >
                      <span className="material-symbols-outlined text-lg">arrow_downward</span>
                    </button>
                    <div className="w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>
                    {/* Edit button */}
                    <button onClick={() => openEditModal(table)} className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl"><span className="material-symbols-outlined text-lg">edit</span></button>
                    <button onClick={() => setShowAssignModal(table.id)} className="p-2 text-primary bg-primary/5 rounded-xl"><span className="material-symbols-outlined text-lg">person_add</span></button>
                    <button onClick={() => handleRemoveTable(table.id)} className="p-2 text-slate-300 hover:text-red-500"><span className="material-symbols-outlined text-lg">delete</span></button>
                  </div>
                </div>

                <div className="p-4">
                  {table.guests.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {table.guests.map((g, idx) => (
                        <div key={`${g.guestId}-${idx}`} className="group relative bg-slate-50 dark:bg-slate-900 pl-2 pr-8 py-1.5 rounded-xl border border-slate-100 dark:border-slate-700 flex items-center gap-2">
                          <div className={`size-2 rounded-full ${g.status === 'confirmed' ? 'bg-green-500 shadow-green-500/30 shadow' : 'bg-slate-300'}`}></div>
                          <span className="text-[10px] font-bold truncate max-w-[80px]">{g.name}</span>
                          <button
                            onClick={() => removeFromTable(table.id, g.guestId, g.name, g.companionIndex)}
                            className="absolute right-1 size-5 flex items-center justify-center text-slate-300 hover:text-red-500 transition-colors"
                          >
                            <span className="material-symbols-outlined text-sm">close</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-4 text-center border-2 border-dashed border-slate-50 dark:border-slate-700 rounded-2xl">
                      <p className="text-[10px] font-bold text-slate-300 uppercase">Mesa Vacía</p>
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="py-12 text-center bg-white dark:bg-slate-800 rounded-3xl border-2 border-dashed border-slate-100 dark:border-slate-700">
              <span className="material-symbols-outlined text-4xl text-slate-200 mb-2">grid_view</span>
              <p className="text-slate-400 text-sm font-medium">No has creado mesas todavía</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal Añadir Mesa */}
      {showAddTableModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-3xl p-6 shadow-2xl animate-in zoom-in duration-200 space-y-5">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold">Añadir Mesa</h3>
              <button onClick={() => setShowAddTableModal(false)}><span className="material-symbols-outlined">close</span></button>
            </div>
            <form onSubmit={handleAddTable} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre o Número</label>
                {/* Fixed comment: changed value={newEventName} to value={newTableName} as per the error fix */}
                <input required autoFocus value={newTableName} onChange={e => setNewTableName(e.target.value)} className="w-full rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-900 p-4" placeholder="Ej: Mesa 1, Mesa de Amigos..." />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Capacidad Máxima</label>
                <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-900 p-2 rounded-2xl border border-slate-100 dark:border-slate-700">
                  <button type="button" onClick={() => setNewTableCapacity(Math.max(1, newTableCapacity - 1))} className="size-10 bg-white dark:bg-slate-800 rounded-xl shadow-sm flex items-center justify-center">-</button>
                  <span className="flex-1 text-center font-black text-lg">{newTableCapacity}</span>
                  <button type="button" onClick={() => setNewTableCapacity(newTableCapacity + 1)} className="size-10 bg-primary text-white rounded-xl shadow-lg flex items-center justify-center">+</button>
                </div>
              </div>
              <button type="submit" className="w-full h-14 bg-primary text-white font-bold rounded-2xl shadow-lg">Crear Mesa</button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Mesa */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-3xl p-6 shadow-2xl animate-in zoom-in duration-200 space-y-5">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold">Editar Mesa</h3>
              <button onClick={() => setShowEditModal(null)}><span className="material-symbols-outlined">close</span></button>
            </div>
            <form onSubmit={handleEditTable} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre o Número</label>
                <input required autoFocus value={editTableName} onChange={e => setEditTableName(e.target.value)} className="w-full rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-900 p-4" placeholder="Ej: Mesa 1, Mesa de Amigos..." />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Capacidad Máxima</label>
                <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-900 p-2 rounded-2xl border border-slate-100 dark:border-slate-700">
                  <button type="button" onClick={() => setEditTableCapacity(Math.max(1, editTableCapacity - 1))} className="size-10 bg-white dark:bg-slate-800 rounded-xl shadow-sm flex items-center justify-center">-</button>
                  <span className="flex-1 text-center font-black text-lg">{editTableCapacity}</span>
                  <button type="button" onClick={() => setEditTableCapacity(editTableCapacity + 1)} className="size-10 bg-primary text-white rounded-xl shadow-lg flex items-center justify-center">+</button>
                </div>
              </div>
              <button type="submit" className="w-full h-14 bg-blue-500 text-white font-bold rounded-2xl shadow-lg">Guardar Cambios</button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Asignar Invitados */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom duration-300 max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-bold">Asignar a {tables.find(t => t.id === showAssignModal)?.name}</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Invitados Disponibles</p>
              </div>
              <button onClick={() => { setShowAssignModal(null); setSearchQuery(''); }} className="size-10 flex items-center justify-center bg-slate-100 dark:bg-slate-700 rounded-full"><span className="material-symbols-outlined">close</span></button>
            </div>

            {/* Search Input */}
            <div className="mb-3 relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar invitado..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 pr-1">
              {availablePool.filter(g => g.name.toLowerCase().includes(searchQuery.toLowerCase())).length > 0 ? (
                availablePool.filter(g => g.name.toLowerCase().includes(searchQuery.toLowerCase())).map((guest, idx) => (
                  <button
                    key={`${guest.guestId}-${guest.name}-${idx}`}
                    onClick={() => assignToTable(showAssignModal, guest)}
                    className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 hover:border-primary/30 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`size-8 rounded-full flex items-center justify-center text-white font-bold text-xs ${guest.status === 'confirmed' ? 'bg-green-500' : 'bg-slate-400'}`}>
                        {guest.name[0]}
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-bold">{guest.name}</p>
                        <p className={`text-[9px] font-bold uppercase ${guest.status === 'confirmed' ? 'text-green-500' : 'text-slate-400'}`}>
                          {guest.status === 'confirmed' ? 'Asistencia Confirmada' : 'Respuesta Pendiente'}
                        </p>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-slate-300 group-hover:text-primary group-hover:translate-x-1 transition-all">chevron_right</span>
                  </button>
                ))
              ) : (
                <div className="py-10 text-center text-slate-400">
                  <span className="material-symbols-outlined text-4xl mb-2">person_check</span>
                  <p className="text-xs font-bold uppercase">Todos los invitados están sentados</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TablesScreen;
