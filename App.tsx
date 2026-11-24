
import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import WelcomeScreen from './screens/Welcome';
import LoginScreen from './screens/Login';
import DashboardScreen from './screens/Dashboard';
import { InvitationData, User, Guest, Table, SeatedGuest, StaffPermissions } from './types';
import { apiService } from './services/apiService';
import { PlanProvider } from './hooks/usePlan';

const UpdatePasswordScreen = lazy(() => import('./screens/UpdatePassword'));
const RegisterScreen = lazy(() => import('./screens/Register'));
const InvitationEditor = lazy(() => import('./screens/InvitationEditor'));
const GuestsScreen = lazy(() => import('./screens/Guests'));
const LocationScreen = lazy(() => import('./screens/Location'));
const GuestRSVPScreen = lazy(() => import('./screens/GuestRSVP'));
const TablesScreen = lazy(() => import('./screens/Tables'));
const FotoWallConfigScreen = lazy(() => import('./screens/FotoWallConfig'));
const FotoWallPlayerScreen = lazy(() => import('./screens/FotoWallPlayer'));
const FotoWallAdminScreen = lazy(() => import('./screens/FotoWallAdmin'));
const FotoWallModerationSettingsScreen = lazy(() => import('./screens/FotoWallModerationSettings'));
const ManageSubscribersScreen = lazy(() => import('./screens/ManageSubscribers'));
const StaffRosterScreen = lazy(() => import('./screens/StaffRoster'));
const EventStaffAssignmentsScreen = lazy(() => import('./screens/EventStaffAssignments'));
const CostControl = lazy(() => import('./screens/CostControl'));
const AddExpense = lazy(() => import('./screens/AddExpense'));
const Suppliers = lazy(() => import('./screens/Suppliers'));
const ExpenseCategories = lazy(() => import('./screens/ExpenseCategories'));
const Participants = lazy(() => import('./screens/Participants'));
const BalanceSummary = lazy(() => import('./screens/BalanceSummary'));
const GamesDashboard = lazy(() => import('./screens/GamesDashboard'));
const TriviaAdmin = lazy(() => import('./screens/TriviaAdmin'));
const TriviaBigScreen = lazy(() => import('./screens/TriviaBigScreen'));
const TriviaGuest = lazy(() => import('./screens/TriviaGuest'));
const BingoAdmin = lazy(() => import('./screens/BingoAdmin'));
const BingoBigScreen = lazy(() => import('./screens/BingoBigScreen'));
const BingoGuest = lazy(() => import('./screens/BingoGuest'));
const RaffleAdmin = lazy(() => import('./screens/RaffleAdmin'));
const RaffleBigScreen = lazy(() => import('./screens/RaffleBigScreen'));
const RaffleGuest = lazy(() => import('./screens/RaffleGuest'));
const ConfessionsAdmin = lazy(() => import('./screens/ConfessionsAdmin'));
const ConfessionsBigScreen = lazy(() => import('./screens/ConfessionsBigScreen'));
const ConfessionsGuest = lazy(() => import('./screens/ConfessionsGuest'));
const ImpostorAdmin = lazy(() => import('./screens/ImpostorAdmin'));
const ImpostorBigScreen = lazy(() => import('./screens/ImpostorBigScreen'));
const ImpostorGuest = lazy(() => import('./screens/ImpostorGuest'));
const GoogleCallbackScreen = lazy(() => import('./screens/GoogleCallback'));
const PaymentSuccess = lazy(() => import('./screens/PaymentSuccess'));
const PaymentFailure = lazy(() => import('./screens/PaymentFailure'));
const PaymentPending = lazy(() => import('./screens/PaymentPending'));
const PricesScreen = lazy(() => import('./screens/Prices'));

const RouteLoader: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark text-slate-500">
    <div className="size-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
  </div>
);

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
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('appxv_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      localStorage.removeItem('appxv_user');
      return null;
    }
  });
  const [invitations, setInvitations] = useState<InvitationData[]>([]);
  const [loading, setLoading] = useState(window.location.hash.includes('#/rsvp/'));

  const loadAllData = async (userEmail: string, staffId?: string) => {
    setLoading(true);
    try {
      const events = await apiService.getEvents(userEmail, staffId);

      const detailedEvents = await Promise.all(events.map(async (event) => {
        try {
          const [guests, tables] = await Promise.all([
            apiService.getGuests(event.id).catch(e => {
              console.warn(`Failed to fetch guests for event ${event.id}`, e);
              return [];
            }),
            apiService.getTables(event.id).catch(e => {
              console.warn(`Failed to fetch tables for event ${event.id}`, e);
              return [];
            })
          ]);
          return { ...event, guests, tables };
        } catch (err) {
          console.error(`Error enriching event ${event.id}:`, err);
          return { ...event, guests: [], tables: [] };
        }
      }));

      setInvitations(detailedEvents);
    } catch (err) {
      console.error("Failed to fetch data:", err);
      // Even if getEvents fails, we should ensure the UI doesn't hang in loading
    } finally {
      setLoading(false);
    }
  };

  const refreshUserProfile = useCallback(async () => {
    const fresh = await apiService.getCurrentUser();
    if (!fresh) return;
    setUser(prev => {
      if (!prev) return prev;
      const nextRole = (fresh.role as User['role']) || prev.role;
      const rawPlan = ((fresh.plan || prev.plan || 'freemium') as string).toLowerCase() as User['plan'];
      const nextPlan: User['plan'] = nextRole === 'admin'
        ? (rawPlan === 'vip' ? 'vip' : 'honor')
        : rawPlan;
      const nextName = fresh.name || prev.name;

      if (prev.role === nextRole && prev.plan === nextPlan && prev.name === nextName) {
        return prev;
      }

      const updated: User = {
        ...prev,
        name: nextName,
        role: nextRole,
        plan: nextPlan,
        permissions: fresh.permissions || prev.permissions,
      };
      localStorage.setItem('appxv_user', JSON.stringify(updated));
      return updated;
    });
  }, []);

  useEffect(() => {
    if (user?.token) {
      refreshUserProfile().catch(() => {});
    }
  }, [user?.token, refreshUserProfile]);

  useEffect(() => {
    if (user) {
      const staffId = (user.role === 'event_staff' || user.role === 'staff') ? user.id : undefined;
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
    apiService.saveEvent({ ...data, userEmail: user?.email }).catch(e => console.error("Event update failed:", e));
  };

  const updateGuests = (id: string, newGuests: Guest[]) => {
    setInvitations(prev => prev.map(inv => inv.id === id ? { ...inv, guests: newGuests } : inv));
  };

  const refreshEventData = async (eventId: string) => {
    try {
      const [guestsResult, tablesResult] = await Promise.allSettled([
        apiService.getGuests(eventId),
        apiService.getTables(eventId)
      ]);
      const guests = guestsResult.status === 'fulfilled' ? guestsResult.value : undefined;
      const tables = tablesResult.status === 'fulfilled' ? tablesResult.value : undefined;

      if (guestsResult.status === 'rejected') console.error("❌ Failed to refresh guests:", guestsResult.reason);
      if (tablesResult.status === 'rejected') console.error("❌ Failed to refresh tables:", tablesResult.reason);

      setInvitations(prev => prev.map(inv => {
        if (inv.id !== eventId) return inv;
        return {
          ...inv,
          ...(guests !== undefined && { guests }),
          ...(tables !== undefined && { tables })
        };
      }));
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
      await apiService.saveGuest(eventId, guest, {
        userPlan: user?.plan || 'freemium',
        userRole: user?.role || 'subscriber'
      });

      // SYNC TABLE ASSIGNMENTS after guest edit
      if (inv) {
        const tables = inv.tables || [];
        for (const table of tables) {
          const guestAssignments = table.guests.filter(a => a.guestId === guest.id?.toString());
          if (guestAssignments.length > 0) {
            // Build updated names list from guest's companionNames
            const allNames = guest.companionNames ? [
              ...(guest.companionNames.adults || []),
              ...(guest.companionNames.teens || []),
              ...(guest.companionNames.kids || []),
              ...(guest.companionNames.infants || [])
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
            await apiService.updateTableGuests(table.id, newAssignments);
          }
        }
      }

      await refreshEventData(eventId);
    } catch (e: any) {
      console.error("Guest save failed:", e);
      if (e.limitReached) {
        alert(e.message || `Has alcanzado el límite de ${e.limit} invitados para tu plan.`);
      } else {
        alert("Error al guardar invitado. Intenta de nuevo.");
      }
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
      await apiService.deleteGuest(guestId);

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

            await apiService.updateTableGuests(table.id, newAssignments);
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
      await apiService.saveTable(eventId, { name: tableName, capacity });
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
      await apiService.updateTable(tableId, name, capacity);
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
      await apiService.updateTableGuests(tableId, assignments);
      await refreshEventData(eventId);
    } catch (e) {
      console.error("Table assignment failed:", e);
      refreshEventData(eventId); // Sync back on error
    }
  };

  const handleDeleteTable = async (eventId: string, tableId: string) => {
    try {
      await apiService.deleteTable(tableId);
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
      await apiService.reorderTables(orders);
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
      const savedResponse = await apiService.saveEvent({
        ...dataWithoutId,
        userEmail: user?.email,
        userPlan: user?.plan || 'freemium',
        userRole: user?.role || 'subscriber'
      });

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
          await apiService.deleteTable(table.id);
          console.log(`✅ Deleted table: ${table.id}`);
        } catch (tableError) {
          console.warn(`⚠️ Failed to delete table ${table.id}:`, tableError);
        }
      }

      // Delete all guests (continue even if some fail)
      for (const guest of inv.guests || []) {
        try {
          await apiService.deleteGuest(guest.id.toString());
          console.log(`✅ Deleted guest: ${guest.id}`);
        } catch (guestError) {
          console.warn(`⚠️ Failed to delete guest ${guest.id}:`, guestError);
        }
      }

      // Finally delete the event itself
      console.log(`🗑️ Deleting event: ${eventId}`);
      await apiService.deleteEvent(eventId);
      console.log(`✅ Event ${eventId} deleted successfully`);
    } catch (e) {
      console.error("❌ Event deletion failed:", e);
      // Reload data on error to sync state
      if (user?.email) {
        await loadAllData(user.email);
      }
    }
  };

  const handleAuthSuccess = (id: string, name: string, email: string, role?: string, permissions?: StaffPermissions, eventId?: string, plan?: string, token?: string) => {
    const userRole = (role as 'admin' | 'subscriber' | 'event_staff' | 'staff') || 'subscriber';
    const normalizedPlan = ((plan || 'freemium') as string).toLowerCase() as 'freemium' | 'premium' | 'vip' | 'honor';
    const userPlan = userRole === 'admin' ? (normalizedPlan === 'vip' ? 'vip' : 'honor') : normalizedPlan;

    const userObj: User = {
      id,
      name,
      email,
      role: userRole,
      plan: userPlan,
      token,
      permissions,
      eventId,
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=135bec&color=fff`
    };

    setUser(userObj);
    localStorage.setItem('appxv_user', JSON.stringify(userObj));
  };

  const handleLogout = () => {
    setUser(null);
    setInvitations([]);
    localStorage.removeItem('appxv_user');
  };

  useEffect(() => {
    const path = window.location.hash;
    // Match either /rsvp/ID or /location/ID
    const publicMatch = path.match(/#\/(?:rsvp|location)\/([^?]+)/);

    if (publicMatch && !user && invitations.length === 0) {
      setLoading(true);
      const eventId = publicMatch[1];
      apiService.getEvent(eventId)
        .then(async (event) => {
          if (event) {
            const guests = await apiService.getGuests(event.id);
            const tables = await apiService.getTables(event.id);
            setInvitations([{ ...event, guests, tables }]);
          }
        })
        .catch(err => console.error("Failed to fetch public invitation:", err))
        .finally(() => setLoading(false));
    }
  }, [invitations.length, user]);

  const isOwnerOrAdmin = !!user && user.role !== 'staff' && user.role !== 'event_staff';
  const requireOwner = (el: React.ReactElement) => {
    if (!user) return <Navigate to="/login" />;
    return isOwnerOrAdmin ? el : <Navigate to="/dashboard" />;
  };

  return (
    <PlanProvider userPlan={
      (user?.role === 'staff' || user?.role === 'event_staff')
        ? (invitations[0]?.ownerPlan || user?.plan)
        : user?.plan
    }>
      <HashRouter>
        <Suspense fallback={<RouteLoader />}>
        <Routes>
          <Route path="/" element={<WelcomeScreen />} />
          <Route path="/login" element={<LoginScreen onLogin={handleAuthSuccess} />} />
          <Route path="/google-callback" element={<GoogleCallbackScreen onLogin={handleAuthSuccess} />} />
          <Route path="/payment/success" element={<PaymentSuccess onRefreshUser={refreshUserProfile} />} />
          <Route path="/payment/failure" element={<PaymentFailure />} />
          <Route path="/payment/pending" element={<PaymentPending />} />
          <Route
            path="/register"
            element={<RegisterScreen onAuthSuccess={handleAuthSuccess} />}
          />
          <Route path="/update-password" element={<UpdatePasswordScreen />} />
          <Route
            path="/dashboard"
            element={user ? <DashboardScreen user={user} invitations={invitations} loading={loading} onAddEvent={addInvitation} onDeleteEvent={handleDeleteEvent} onLogout={handleLogout} onRefresh={() => loadAllData(user.email, (user.role === 'event_staff' || user.role === 'staff') ? user.id : undefined)} /> : <Navigate to="/login" />}
          />
          <Route
            path="/edit/:id"
            element={requireOwner(<InvitationEditor invitations={invitations} onSave={handleUpdateInvitation} user={user!} />)}
          />
          <Route
            path="/guests/:id"
            element={user ? <GuestsScreen invitations={invitations} onSaveGuest={handleSaveGuest} onDeleteGuest={handleDeleteGuest} user={user} /> : <Navigate to="/login" />}
          />
          <Route
            path="/tables/:id"
            element={user ? <TablesScreen invitations={invitations} onAddTable={handleAddTable} onUpdateTable={handleUpdateTable} onReorderTables={handleReorderTables} onUpdateSeating={handleUpdateTableGuests} onDeleteTable={handleDeleteTable} /> : <Navigate to="/login" />}
          />
          <Route
            path="/fotowall/:id"
            element={user ? (
              <FotoWallConfigScreen
                invitations={invitations}
                user={user}
                onSaveSuccess={(eventId, fotowall) =>
                  setInvitations(prev => prev.map(inv => inv.id === eventId ? { ...inv, fotowall } : inv))
                }
              />
            ) : <Navigate to="/login" />}
          />
          <Route
            path="/fotowall-player/:id"
            element={<FotoWallPlayerScreen invitations={invitations} user={user} />}
          />
          <Route
            path="/fotowall-admin/:id"
            element={user ? <FotoWallAdminScreen /> : <Navigate to="/login" />}
          />
          <Route
            path="/fotowall-moderation-settings/:id"
            element={user ? <FotoWallModerationSettingsScreen user={user} /> : <Navigate to="/login" />}
          />
          <Route
            path="/subscribers"
            element={user?.role === 'admin' ? <ManageSubscribersScreen /> : <Navigate to="/dashboard" />}
          />
          <Route
            path="/staff-roster"
            element={requireOwner(<StaffRosterScreen user={user!} />)}
          />
          <Route
            path="/event-staff/:id"
            element={requireOwner(<EventStaffAssignmentsScreen user={user!} invitations={invitations} />)}
          />
          <Route
            path="/prices"
            element={requireOwner(<PricesScreen user={user!} />)}
          />
          <Route
            path="/costs/:id"
            element={requireOwner(<CostControl invitations={invitations} />)}
          />
          <Route
            path="/costs/:id/add"
            element={requireOwner(<AddExpense user={user} />)}
          />
          <Route
            path="/costs/:id/edit/:expenseId"
            element={requireOwner(<AddExpense user={user} />)}
          />
          <Route
            path="/costs/:id/suppliers"
            element={requireOwner(<Suppliers user={user} />)}
          />
          <Route
            path="/costs/:id/categories"
            element={requireOwner(<ExpenseCategories />)}
          />
          <Route
            path="/costs/:id/participants"
            element={requireOwner(<Participants user={user} />)}
          />
          <Route
            path="/costs/:id/balances"
            element={requireOwner(<BalanceSummary />)}
          />
          <Route
            path="/games/:id"
            element={user ? <GamesDashboard invitations={invitations} user={user} /> : <Navigate to="/login" />}
          />
          <Route
            path="/trivia/:id/admin"
            element={user ? <TriviaAdmin user={user} /> : <Navigate to="/login" />}
          />
          <Route
            path="/trivia/:id/screen"
            element={<TriviaBigScreen />}
          />
          <Route
            path="/trivia/:id/play"
            element={<TriviaGuest />}
          />
          <Route
            path="/bingo/:id/admin"
            element={user ? <BingoAdmin user={user} /> : <Navigate to="/login" />}
          />
          <Route
            path="/bingo/:id/screen"
            element={<BingoBigScreen />}
          />
          <Route
            path="/bingo/:id/play"
            element={<BingoGuest />}
          />
          <Route
            path="/raffle/:id/admin"
            element={user ? <RaffleAdmin user={user} /> : <Navigate to="/login" />}
          />
          <Route
            path="/raffle/:id/screen"
            element={<RaffleBigScreen />}
          />
          <Route
            path="/raffle/:id/guest"
            element={<RaffleGuest />}
          />
          <Route
            path="/confessions/:id/admin"
            element={user ? <ConfessionsAdmin user={user} /> : <Navigate to="/login" />}
          />
          <Route
            path="/confessions/:id/screen"
            element={<ConfessionsBigScreen />}
          />
          <Route
            path="/confessions/:id/guest"
            element={<ConfessionsGuest />}
          />
          <Route
            path="/impostor/:id/admin"
            element={user ? <ImpostorAdmin user={user} /> : <Navigate to="/login" />}
          />
          <Route
            path="/impostor/:id/screen"
            element={<ImpostorBigScreen />}
          />
          <Route
            path="/impostor/:id/guest"
            element={<ImpostorGuest user={user} />}
          />
          <Route
            path="/location/:id"
            element={<LocationScreen invitations={invitations} />}
          />
          <Route path="/rsvp/:id" element={<GuestRSVPScreen loading={loading} invitations={invitations} onRsvpSubmit={async (invId, guestData) => {
            const normalizeName = (val?: string) =>
              (val || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

            const inv = invitations.find(i => i.id === invId);
            if (inv) {
              const targetName = normalizeName(guestData.name);
              const guest = inv.guests.find(g => normalizeName(g.name) === targetName);

              if (guest) {
                // UPDATE EXISTING GUEST
                await apiService.updateRSVP(
                  guest.id as string,
                  guestData.status as string,
                  guestData.confirmed as any,
                  guestData.companionNames as any
                );

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
                        ...(guestData.companionNames.adults || []),
                        ...(guestData.companionNames.teens || []),
                        ...(guestData.companionNames.kids || []),
                        ...(guestData.companionNames.infants || [])
                      ].filter(n => n?.trim()) : [];

                      newAssignments = table.guests.map(a => {
                        if (a.guestId === guest.id?.toString()) {
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

                    await apiService.updateTableGuests(table.id, newAssignments);
                  }
                }

                // Refresh authoritative guests & tables from DB (never overwrite with stale closures)
                await refreshEventData(invId);
              } else {
                // CREATE NEW GUEST (from Public Link)
                const confirmedData = guestData.confirmed || { adults: 1, teens: 0, kids: 0, infants: 0 };

                const newGuest: Guest = {
                  id: Date.now(),
                  name: guestData.name || 'Invitado',
                  email: '',
                  status: guestData.status || 'confirmed',
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

                await apiService.saveGuest(invId, newGuest, {
                  userPlan: inv.ownerPlan || user?.plan,
                  userRole: user?.role
                });
                await refreshEventData(invId);
              }
            }
          }} />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
        </Suspense>
      </HashRouter>
    </PlanProvider>
  );
};

export default App;
