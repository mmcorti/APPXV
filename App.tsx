
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import WelcomeScreen from './screens/Welcome';
import LoginScreen from './screens/Login';
import RegisterScreen from './screens/Register';
import DashboardScreen from './screens/Dashboard';
import InvitationEditor from './screens/InvitationEditor';
import GuestsScreen from './screens/Guests';
import LocationScreen from './screens/Location';
import GuestRSVPScreen from './screens/GuestRSVP';
import TablesScreen from './screens/Tables';
import FotoWallConfigScreen from './screens/FotoWallConfig';
import FotoWallPlayerScreen from './screens/FotoWallPlayer';
import FotoWallAdminScreen from './screens/FotoWallAdmin';
import FotoWallModerationSettingsScreen from './screens/FotoWallModerationSettings';
import ManageSubscribersScreen from './screens/ManageSubscribers';
import StaffRosterScreen from './screens/StaffRoster';
import EventStaffAssignmentsScreen from './screens/EventStaffAssignments';
import { InvitationData, User, Guest, Table, SeatedGuest, StaffPermissions } from './types';
import { notionService } from './services/notion';

const INITIAL_INVITATION: InvitationData = {
  id: '1',
  eventName: 'Mis 15 Años - Sofía',
  hostName: 'Familia Rodriguez',
  date: '2024-12-15',
  time: '21:00',
  location: 'Salón Bellavista, Av. Libertador 1234',
  image: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80&w=800',
  message: 'Te espero para celebrar una noche inolvidable llena de magia y alegría.',
  giftType: 'alias',
  giftDetail: 'SOFIA.15.MAGIA',
  guests: [
    {
      id: 1,
      name: 'Martina Perez',
      status: 'confirmed',
      allotted: { adults: 2, teens: 1, kids: 0, infants: 0 },
      confirmed: { adults: 2, teens: 0, kids: 0, infants: 0 },
      companionNames: { adults: ['Martina Perez', 'Carlos Perez'], teens: [], kids: [], infants: [] },
      sent: true
    },
    {
      id: 2,
      name: 'Lucas Gomez',
      status: 'pending',
      allotted: { adults: 1, teens: 0, kids: 2, infants: 0 },
      confirmed: { adults: 0, teens: 0, kids: 0, infants: 0 },
      sent: false
    }
  ],
  tables: []
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [invitations, setInvitations] = useState<InvitationData[]>([]);
  const [loading, setLoading] = useState(window.location.hash.includes('#/rsvp/'));

  const loadAllData = async (userEmail: string, staffId?: string) => {
    setLoading(true);
    try {
      const events = await notionService.getEvents(userEmail, staffId);
      const detailedEvents = await Promise.all(events.map(async (event) => {
        const guests = await notionService.getGuests(event.id);
        const tables = await notionService.getTables(event.id);
        return { ...event, guests, tables };
      }));
      setInvitations(detailedEvents);
    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      const staffId = user.role === 'event_staff' ? user.id : undefined;
      loadAllData(user.email, staffId);
    }
  }, [user]);

  const handleUpdateInvitation = (data: InvitationData) => {
    // Optimistic update
    if (invitations.find(i => i.id === data.id)) {
      setInvitations(prev => prev.map(inv => inv.id === data.id ? data : inv));
    } else {
      setInvitations(prev => [...prev, data]);
    }

    // Save to Notion with Creator Email included
    notionService.saveEvent({ ...data, userEmail: user?.email }).catch(e => console.error("Event update failed:", e));
  };

  const updateGuests = (id: string, newGuests: Guest[]) => {
    setInvitations(prev => prev.map(inv => inv.id === id ? { ...inv, guests: newGuests } : inv));
  };

  const refreshEventData = async (eventId: string) => {
    try {
      const [guests, tables] = await Promise.all([
        notionService.getGuests(eventId),
        notionService.getTables(eventId)
      ]);
      setInvitations(prev => prev.map(inv => inv.id === eventId ? { ...inv, guests, tables } : inv));
    } catch (e) {
      console.error("Refresh failed:", e);
    }
  };

  const handleSaveGuest = async (eventId: string, guest: Guest) => {
    const inv = invitations.find(i => i.id === eventId);

    // OPTIMISTIC UPDATE
    setInvitations(prev => prev.map(inv => {
      if (inv.id !== eventId) return inv;
      const exists = inv.guests.some(g => g.id === guest.id);
      const newGuests = exists
        ? inv.guests.map(g => g.id === guest.id ? guest : g)
        : [...inv.guests, guest];
      return { ...inv, guests: newGuests };
    }));

    try {
      await notionService.saveGuest(eventId, guest);

      // SYNC TABLE ASSIGNMENTS after guest edit
      if (inv) {
        const tables = inv.tables || [];
        for (const table of tables) {
          const guestAssignments = table.guests.filter(a => a.guestId === guest.id?.toString());
          if (guestAssignments.length > 0) {
            // Build updated names list from guest's companionNames
            const allNames = guest.companionNames ? [
              ...guest.companionNames.adults,
              ...guest.companionNames.teens,
              ...guest.companionNames.kids,
              ...guest.companionNames.infants
            ] : [];

            const newAssignments = table.guests.map(a => {
              if (a.guestId === guest.id?.toString()) {
                // Find updated name by companion index
                const idx = a.companionIndex ?? -1;
                let updatedName = a.name;

                if (idx === -1) {
                  // Main guest
                  updatedName = guest.name;
                } else if (idx >= 0 && idx < allNames.length) {
                  // Companion - use name if exists, otherwise generate placeholder
                  const catName = allNames[idx] || '';
                  updatedName = catName.trim() ? catName : `Invitado ${idx + 1} - ${guest.name}`;
                }

                return {
                  guestId: a.guestId,
                  companionId: a.companionId,
                  companionIndex: a.companionIndex ?? -1,
                  name: updatedName,
                  companionName: updatedName,
                  status: guest.status || 'pending'
                };
              }
              return {
                guestId: a.guestId,
                companionId: a.companionId,
                companionIndex: a.companionIndex ?? -1,
                name: a.name,
                companionName: a.name,
                status: a.status || 'pending'
              };
            });

            // Update table assignments
            await notionService.updateTableGuests(table.id, newAssignments);
          }
        }
      }

      await refreshEventData(eventId);
    } catch (e) {
      console.error("Guest save failed:", e);
      await refreshEventData(eventId);
    }
  };

  const handleDeleteGuest = async (eventId: string, guestId: string) => {
    const inv = invitations.find(i => i.id === eventId);

    // OPTIMISTIC UPDATE
    setInvitations(prev => prev.map(inv => {
      if (inv.id !== eventId) return inv;
      return { ...inv, guests: inv.guests.filter(g => g.id.toString() !== guestId) };
    }));

    try {
      await notionService.deleteGuest(guestId);

      // SYNC TABLE ASSIGNMENTS - remove deleted guest from all tables
      if (inv) {
        const tables = inv.tables || [];
        for (const table of tables) {
          const guestAssignments = table.guests.filter(a => a.guestId === guestId);
          if (guestAssignments.length > 0) {
            // Remove this guest from the table
            const newAssignments = table.guests
              .filter(a => a.guestId !== guestId)
              .map(a => ({
                guestId: a.guestId,
                companionId: a.companionId,
                companionIndex: a.companionIndex ?? -1,
                name: a.name,
                companionName: a.name,
                status: a.status || 'pending'
              }));

            await notionService.updateTableGuests(table.id, newAssignments);
          }
        }
      }

      await refreshEventData(eventId);
    } catch (e) {
      console.error("Guest delete failed:", e);
      await refreshEventData(eventId);
    }
  };

  const updateTables = (id: string, newTables: Table[]) => {
    setInvitations(prev => prev.map(inv => inv.id === id ? { ...inv, tables: newTables } : inv));
  };

  const handleAddTable = async (eventId: string, tableName: string, capacity: number) => {
    try {
      await notionService.saveTable(eventId, { name: tableName, capacity });
      await refreshEventData(eventId);
    } catch (e) {
      console.error("Table creation failed:", e);
    }
  };

  const handleUpdateTable = async (eventId: string, tableId: string, name: string, capacity: number) => {
    // OPTIMISTIC UPDATE
    setInvitations(prev => prev.map(inv => {
      if (inv.id !== eventId) return inv;
      const updatedTables = (inv.tables || []).map(t =>
        t.id === tableId ? { ...t, name, capacity } : t
      );
      return { ...inv, tables: updatedTables };
    }));

    try {
      await notionService.updateTable(tableId, name, capacity);
      await refreshEventData(eventId);
    } catch (e) {
      console.error("Table update failed:", e);
      refreshEventData(eventId);
    }
  };

  const handleUpdateTableGuests = async (eventId: string, tableId: string, assignments: { guestId: string | number, companionId?: string, companionIndex: number, companionName: string }[]) => {
    // OPTIMISTIC UPDATE
    setInvitations(prev => prev.map(inv => {
      if (inv.id !== eventId) return inv;
      const updatedTables = (inv.tables || []).map(t => {
        if (t.id !== tableId) return t;
        const newSeatedGuests: SeatedGuest[] = assignments.map(a => {
          const guest = inv.guests.find(g => g.id.toString() === a.guestId.toString());
          return {
            guestId: a.guestId,
            companionId: a.companionId,
            companionIndex: a.companionIndex,
            name: a.companionName,
            status: guest ? (guest.status === 'confirmed' ? 'confirmed' : 'pending') : 'pending'
          };
        });
        return { ...t, guests: newSeatedGuests };
      });
      return { ...inv, tables: updatedTables };
    }));

    try {
      await notionService.updateTableGuests(tableId, assignments);
      await refreshEventData(eventId);
    } catch (e) {
      console.error("Table assignment failed:", e);
      refreshEventData(eventId); // Sync back on error
    }
  };

  const handleDeleteTable = async (eventId: string, tableId: string) => {
    try {
      await notionService.deleteTable(tableId);
      await refreshEventData(eventId);
    } catch (e) {
      console.error("Table deletion failed:", e);
    }
  };

  const handleReorderTables = async (eventId: string, orderedTableIds: string[]) => {
    // OPTIMISTIC UPDATE
    setInvitations(prev => prev.map(inv => {
      if (inv.id !== eventId) return inv;
      const reorderedTables = orderedTableIds
        .map(id => inv.tables?.find(t => t.id === id))
        .filter(Boolean) as Table[];
      return { ...inv, tables: reorderedTables };
    }));

    try {
      const orders = orderedTableIds.map((tableId, index) => ({ tableId, order: index }));
      await notionService.reorderTables(orders);
      await refreshEventData(eventId);
    } catch (e) {
      console.error("Table reorder failed:", e);
      refreshEventData(eventId);
    }
  };

  const addInvitation = async (data: InvitationData): Promise<InvitationData> => {
    try {
      // Remove the temporary ID so saving treats it as a new creation (POST)
      const { id, ...dataWithoutId } = data;
      const savedResponse = await notionService.saveEvent({ ...dataWithoutId, userEmail: user?.email });

      if (user?.email) {
        await loadAllData(user.email);
      }

      const newEvent: InvitationData = {
        ...data,
        id: savedResponse.id,
        guests: [],
        tables: []
      };
      return newEvent;
    } catch (e) {
      console.error("Notion sync error:", e);
      throw e;
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    const inv = invitations.find(i => i.id === eventId);
    if (!inv) return;

    // OPTIMISTIC UPDATE - remove from state immediately
    setInvitations(prev => prev.filter(i => i.id !== eventId));

    try {
      // Delete all tables first (continue even if some fail)
      for (const table of inv.tables || []) {
        try {
          await notionService.deleteTable(table.id);
          console.log(`✅ Deleted table: ${table.id}`);
        } catch (tableError) {
          console.warn(`⚠️ Failed to delete table ${table.id}:`, tableError);
        }
      }

      // Delete all guests (continue even if some fail)
      for (const guest of inv.guests || []) {
        try {
          await notionService.deleteGuest(guest.id.toString());
          console.log(`✅ Deleted guest: ${guest.id}`);
        } catch (guestError) {
          console.warn(`⚠️ Failed to delete guest ${guest.id}:`, guestError);
        }
      }

      // Finally delete the event itself
      console.log(`🗑️ Deleting event: ${eventId}`);
      await notionService.deleteEvent(eventId);
      console.log(`✅ Event ${eventId} deleted successfully`);
    } catch (e) {
      console.error("❌ Event deletion failed:", e);
      // Reload data on error to sync state
      if (user?.email) {
        await loadAllData(user.email);
      }
    }
  };

  const handleAuthSuccess = (id: string, name: string, email: string, role?: string, permissions?: StaffPermissions, eventId?: string) => {
    setUser({
      id,
      name,
      email,
      role: (role as 'admin' | 'staff') || 'admin',
      permissions,
      eventId,
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=135bec&color=fff`
    });
  };

  const handleLogout = () => {
    setUser(null);
    setInvitations([]);
  };

  useEffect(() => {
    const path = window.location.hash;
    // Match either /rsvp/ID or /location/ID
    const publicMatch = path.match(/#\/(?:rsvp|location)\/([^?]+)/);

    if (publicMatch && !user && invitations.length === 0) {
      setLoading(true);
      const eventId = publicMatch[1];
      notionService.getEvents()
        .then(async (events) => {
          const event = events.find(e => e.id === eventId);
          if (event) {
            const guests = await notionService.getGuests(event.id);
            const tables = await notionService.getTables(event.id);
            setInvitations([{ ...event, guests, tables }]);
          }
        })
        .catch(err => console.error("Failed to fetch public invitation:", err))
        .finally(() => setLoading(false));
    }
  }, [invitations.length, user]);

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<WelcomeScreen />} />
        <Route path="/login" element={<LoginScreen onLogin={handleAuthSuccess} />} />
        <Route
          path="/register"
          element={user?.role === 'admin' ? <RegisterScreen onRegister={(name, email) => handleAuthSuccess('', name, email)} /> : <Navigate to="/login" />}
        />
        <Route
          path="/dashboard"
          element={user ? <DashboardScreen user={user} invitations={invitations} loading={loading} onAddEvent={addInvitation} onDeleteEvent={handleDeleteEvent} onLogout={handleLogout} onRefresh={() => loadAllData(user.email)} /> : <Navigate to="/login" />}
        />
        <Route
          path="/edit/:id"
          element={user ? <InvitationEditor invitations={invitations} onSave={handleUpdateInvitation} /> : <Navigate to="/login" />}
        />
        <Route
          path="/guests/:id"
          element={user ? <GuestsScreen invitations={invitations} onSaveGuest={handleSaveGuest} onDeleteGuest={handleDeleteGuest} /> : <Navigate to="/login" />}
        />
        <Route
          path="/tables/:id"
          element={user ? <TablesScreen invitations={invitations} onAddTable={handleAddTable} onUpdateTable={handleUpdateTable} onReorderTables={handleReorderTables} onUpdateSeating={handleUpdateTableGuests} onDeleteTable={handleDeleteTable} /> : <Navigate to="/login" />}
        />
        <Route
          path="/fotowall/:id"
          element={user ? <FotoWallConfigScreen invitations={invitations} /> : <Navigate to="/login" />}
        />
        <Route
          path="/fotowall-player/:id"
          element={<FotoWallPlayerScreen invitations={invitations} />}
        />
        <Route
          path="/fotowall-admin/:id"
          element={user ? <FotoWallAdminScreen /> : <Navigate to="/login" />}
        />
        <Route
          path="/fotowall-moderation-settings/:id"
          element={user ? <FotoWallModerationSettingsScreen /> : <Navigate to="/login" />}
        />
        <Route
          path="/subscribers/:id"
          element={user?.role === 'admin' ? <ManageSubscribersScreen event={invitations.find(i => window.location.hash.includes(i.id)) || null} /> : <Navigate to="/dashboard" />}
        />
        <Route
          path="/staff-roster"
          element={user ? <StaffRosterScreen user={user} /> : <Navigate to="/login" />}
        />
        <Route
          path="/event-staff/:id"
          element={user ? <EventStaffAssignmentsScreen user={user} invitations={invitations} /> : <Navigate to="/login" />}
        />
        <Route
          path="/location/:id"
          element={<LocationScreen invitations={invitations} />}
        />
        <Route path="/rsvp/:id" element={<GuestRSVPScreen loading={loading} invitations={invitations} onRsvpSubmit={async (invId, guestData) => {
          const inv = invitations.find(i => i.id === invId);
          if (inv) {
            const guest = inv.guests.find(g => g.name.toLowerCase() === guestData.name?.toLowerCase());

            if (guest) {
              // UPDATE EXISTING GUEST
              await notionService.updateRSVP(
                guest.id as string,
                guestData.status as string,
                guestData.confirmed as any,
                guestData.companionNames as any
              );

              await refreshEventData(invId);

              // SYNC TABLE ASSIGNMENTS after RSVP change
              const tables = inv.tables || [];
              for (const table of tables) {
                const guestAssignments = table.guests.filter(a => a.guestId === guest.id?.toString());
                if (guestAssignments.length > 0) {
                  let newAssignments;

                  if (guestData.status === 'declined') {
                    // Remove declined guest from table
                    newAssignments = table.guests
                      .filter(a => a.guestId !== guest.id?.toString())
                      .map(a => ({
                        guestId: a.guestId,
                        companionId: a.companionId,
                        companionIndex: a.companionIndex ?? -1,
                        name: a.name,
                        companionName: a.name,
                        status: a.status || 'pending'
                      }));
                  } else {
                    // Update names and status for confirmed guest
                    const allNames = guestData.companionNames ? [
                      ...guestData.companionNames.adults,
                      ...guestData.companionNames.teens,
                      ...guestData.companionNames.kids,
                      ...guestData.companionNames.infants
                    ].filter(n => n.trim()) : [];

                    newAssignments = table.guests.map(a => {
                      if (a.guestId === guest.id?.toString()) {
                        // Find updated name by companion index
                        const idx = a.companionIndex ?? -1;
                        const updatedName = idx >= 0 && idx < allNames.length
                          ? allNames[idx]
                          : (idx === -1 && allNames.length > 0 ? allNames[0] : a.name);
                        return {
                          guestId: a.guestId,
                          companionId: a.companionId,
                          companionIndex: a.companionIndex ?? -1,
                          name: updatedName,
                          companionName: updatedName,
                          status: guestData.status || 'confirmed'
                        };
                      }
                      return {
                        guestId: a.guestId,
                        companionId: a.companionId,
                        companionIndex: a.companionIndex ?? -1,
                        name: a.name,
                        companionName: a.name,
                        status: a.status || 'pending'
                      };
                    });
                  }

                  // Update table assignments
                  await notionService.updateTableGuests(table.id, newAssignments);
                }
              }

              const updatedGuests = inv.guests.map(g => g.name === guestData.name ? { ...g, ...guestData as Guest } : g);
              updateGuests(invId, updatedGuests);
            } else {
              // CREATE NEW GUEST (from Public Link)
              const confirmedData = guestData.confirmed || { adults: 1, teens: 0, kids: 0, infants: 0 };

              const newGuest: Guest = {
                id: Date.now(), // Temporary ID
                name: guestData.name || 'Invitado',
                email: '',
                status: guestData.status || 'confirmed',
                // Use confirmed values for allotted since this is a new guest confirming attendance
                allotted: {
                  adults: confirmedData.adults || 0,
                  teens: confirmedData.teens || 0,
                  kids: confirmedData.kids || 0,
                  infants: confirmedData.infants || 0
                },
                confirmed: confirmedData,
                companionNames: guestData.companionNames,
                sent: false
              };

              await notionService.saveGuest(invId, newGuest);
              await refreshEventData(invId);

              updateGuests(invId, [...inv.guests, newGuest]);
            }
          }
        }} />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </HashRouter>
  );
};

export default App;
