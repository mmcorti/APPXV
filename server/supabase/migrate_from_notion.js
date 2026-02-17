/**
 * APPXV — Notion → Supabase Data Migration Script
 * 
 * Usage:
 *   1. Set env vars: NOTION_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY
 *   2. Run: node server/supabase/migrate_from_notion.js
 * 
 * This script reads all data from the 12 Notion databases and inserts
 * it into the optimized Supabase schema (19 tables).
 * 
 * It does NOT modify Notion data — read-only.
 */

import { Client } from '@notionhq/client';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();
dotenv.config({ path: '.env.local', override: true });

// ── Config ────────────────────────────────────────────────
const NOTION_API_KEY = process.env.NOTION_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!NOTION_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Required env vars: NOTION_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY');
    process.exit(1);
}

const notion = new Client({ auth: NOTION_API_KEY });
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
});

// Notion Database IDs
const NOTION_DBS = {
    SUBSCRIBERS: '2ecff613-0900-81f5-8d52-f8bcd4bc0940',
    EVENTS: '8a693908-f427-4002-9902-4ac86b2e21d4',
    GUESTS: 'cc6019a6-dfa0-4582-84d2-814e741019ab',
    TABLES: '3956fff4-80f7-4bf5-81bb-41df10156a48',
    COMPANIONS: '155c66a4-239b-402d-a310-04c533f322b3',
    STAFF_ROSTER: '2edff613-0900-815b-bf07-ca361d92c10a',
    STAFF_ASSIGNMENTS: '2edff613-0900-81db-8777-f40892c9ec9e',
    EXPENSES: '57ee8337f02b4ffb9dc8d3a57d61a3bd',
    SUPPLIERS: '384c7326d2b44e498935e6e63b60c3e0',
    EXPENSE_CATEGORIES: 'edfcf67bffea4556838550590bc16c83',
    PAYMENT_PARTICIPANTS: '24b56421c62b4e6eaac480216407e909',
    PAYMENTS: 'e9c2d7d9d030480481d9a10b797514a2',
};

// ── ID Mapping ────────────────────────────────────────────
// Maps Notion page IDs → Supabase UUIDs
const idMap = {
    subscribers: {},  // notionId → supabaseUserId
    events: {},       // notionId → supabaseEventId
    tables: {},       // notionId → supabaseTableId
    guests: {},       // notionId → supabaseGuestId
    staff_roster: {}, // notionId → supabaseUserId (staff are users too)
    expenses: {},     // notionId → supabaseExpenseId
    suppliers: {},    // notionId → supabaseSuplierId
    expense_categories: {},
    payment_participants: {},
};

// ── Notion Helpers ────────────────────────────────────────
const getText = (prop) => {
    if (!prop) return '';
    if (prop.title) return prop.title.map(t => t.plain_text).join('');
    if (prop.rich_text) return prop.rich_text.map(t => t.plain_text).join('');
    if (prop.select) return prop.select?.name || '';
    if (prop.email) return prop.email || '';
    if (prop.date) return prop.date?.start || '';
    if (prop.url) return prop.url || '';
    if (prop.checkbox !== undefined) return prop.checkbox;
    if (prop.number !== undefined && prop.number !== null) return prop.number;
    if (prop.relation) return prop.relation.map(r => r.id);
    return '';
};

const getNum = (prop) => {
    if (!prop) return null;
    if (prop.number !== undefined && prop.number !== null) return prop.number;
    return null;
};

const getBool = (prop) => {
    if (!prop) return false;
    return prop.checkbox === true;
};

const getRelationIds = (prop) => {
    if (!prop?.relation) return [];
    return prop.relation.map(r => r.id);
};

// Fetch all pages from a Notion database (handles pagination)
async function fetchAllPages(databaseId) {
    const pages = [];
    let cursor = undefined;
    do {
        const response = await notion.databases.query({
            database_id: databaseId,
            start_cursor: cursor,
            page_size: 100,
        });
        pages.push(...response.results);
        cursor = response.has_more ? response.next_cursor : undefined;
    } while (cursor);
    return pages;
}

// ── Stats ─────────────────────────────────────────────────
const stats = {};
const log = (table, count) => {
    stats[table] = count;
    console.log(`  ✅ ${table}: ${count} rows migrated`);
};
const logError = (table, msg) => {
    console.error(`  ❌ ${table}: ${msg}`);
};

// ── Migration Functions ───────────────────────────────────

async function migrateSubscribers() {
    console.log('\n📋 1/12 Migrating SUBSCRIBERS → auth.users + public.users...');
    const pages = await fetchAllPages(NOTION_DBS.SUBSCRIBERS);
    let count = 0;

    for (const page of pages) {
        const p = page.properties;
        const email = getText(p['Email']) || '';
        const name = getText(p['Name']) || '';
        const password = getText(p['Password']) || 'changeme123';
        const username = getText(p['Username']) || null;
        const plan = getText(p['Plan']) || 'freemium';
        const googleId = getText(p['GoogleId']) || null;
        const avatarUrl = getText(p['AvatarUrl']) || null;
        const recoveryEmail = getText(p['RecoveryEmail']) || null;

        if (!email) {
            logError('subscribers', `Skipping page ${page.id} — no email`);
            continue;
        }

        try {
            // Hash the password
            const hashedPassword = await bcrypt.hash(password, 10);

            // Create user in Supabase Auth
            const { data: authData, error: authError } = await supabase.auth.admin.createUser({
                email: email,
                password: password, // Supabase handles hashing internally
                email_confirm: true, // Auto-confirm emails
            });

            if (authError) {
                // If user already exists, try to find them
                if (authError.message?.includes('already been registered')) {
                    const { data: users } = await supabase.auth.admin.listUsers();
                    const existing = users?.users?.find(u => u.email === email);
                    if (existing) {
                        idMap.subscribers[page.id] = existing.id;
                        // Update public.users profile
                        await supabase.from('users').upsert({
                            id: existing.id,
                            email,
                            role: 'subscriber',
                            plan: ['freemium', 'premium', 'vip', 'honor'].includes(plan) ? plan : 'freemium',
                            username,
                            avatar_url: avatarUrl,
                            google_id: googleId,
                            recovery_email: recoveryEmail,
                        });
                        count++;
                        continue;
                    }
                }
                logError('subscribers', `Auth error for ${email}: ${authError.message}`);
                continue;
            }

            const userId = authData.user.id;
            idMap.subscribers[page.id] = userId;

            // Update the public.users profile (auto-created by trigger, but update with full data)
            await supabase.from('users').upsert({
                id: userId,
                email,
                role: 'subscriber',
                plan: ['freemium', 'premium', 'vip', 'honor'].includes(plan) ? plan : 'freemium',
                username,
                avatar_url: avatarUrl,
                google_id: googleId,
                recovery_email: recoveryEmail,
            });

            count++;
        } catch (err) {
            logError('subscribers', `Error migrating ${email}: ${err.message}`);
        }
    }
    log('subscribers', count);
}

async function migrateEvents() {
    console.log('\n📋 2/12 Migrating EVENTS → events + fotowall_configs...');
    const pages = await fetchAllPages(NOTION_DBS.EVENTS);
    let eventCount = 0;
    let fwCount = 0;

    for (const page of pages) {
        const p = page.properties;
        const name = getText(p['Name']) || 'Sin nombre';
        const creatorEmail = getText(p['Creator Email']) || '';
        const dateStr = getText(p['Date']) || null;
        const time = getText(p['Time']) || null;
        const location = getText(p['Location']) || null;
        const message = getText(p['Message']) || null;
        const hostName = getText(p['Host Name']) || null;
        const imageUrl = getText(p['Image URL']) || null;
        const giftType = getText(p['Gift Type']) || null;
        const giftDetail = getText(p['Gift Detail']) || null;
        const dressCode = getText(p['Dress Code']) || null;
        const venueNotes = getText(p['Venue Notes']) || null;
        const arrivalTips = getText(p['Arrival Tips']) || null;

        // Find creator_id by email
        let creatorId = null;
        for (const [notionId, supaId] of Object.entries(idMap.subscribers)) {
            // We need to look up by email — query the users table
        }
        // More efficient: query by email
        if (creatorEmail) {
            const { data: userRow } = await supabase
                .from('users')
                .select('id')
                .eq('email', creatorEmail)
                .single();
            creatorId = userRow?.id || null;
        }

        if (!creatorId) {
            logError('events', `Skipping event "${name}" — creator "${creatorEmail}" not found in users`);
            continue;
        }

        const { data: eventData, error: eventError } = await supabase
            .from('events')
            .insert({
                creator_id: creatorId,
                name,
                date: dateStr || null,
                time,
                location,
                message,
                host_name: hostName,
                image_url: imageUrl,
                gift_type: ['alias', 'list'].includes(giftType) ? giftType : null,
                gift_detail: giftDetail,
                dress_code: dressCode,
                venue_notes: venueNotes,
                arrival_tips: arrivalTips,
            })
            .select('id')
            .single();

        if (eventError) {
            logError('events', `Error inserting event "${name}": ${eventError.message}`);
            continue;
        }

        idMap.events[page.id] = eventData.id;
        eventCount++;

        // Extract FotoWall config (if any FW fields are present)
        const fwAlbumUrl = getText(p['FotoWall Album URL']) || null;
        const fwInterval = getNum(p['FotoWall Interval']);
        const fwShuffle = getBool(p['FotoWall Shuffle']);
        const fwOverlayTitle = getText(p['FotoWall Overlay Title']) || null;
        const fwModerationMode = getText(p['FotoWall Moderation Mode']) || 'manual';
        const fwFilters = getText(p['FotoWall Filters']) || '{}';

        if (fwAlbumUrl || fwOverlayTitle || fwInterval) {
            let filtersJson = {};
            try { filtersJson = JSON.parse(fwFilters); } catch { filtersJson = {}; }

            const { error: fwError } = await supabase
                .from('fotowall_configs')
                .insert({
                    event_id: eventData.id,
                    album_url: fwAlbumUrl,
                    interval: fwInterval || 5,
                    shuffle: fwShuffle,
                    overlay_title: fwOverlayTitle,
                    moderation_mode: ['ai', 'manual'].includes(fwModerationMode) ? fwModerationMode : 'manual',
                    filters: filtersJson,
                });

            if (!fwError) fwCount++;
        }
    }
    log('events', eventCount);
    log('fotowall_configs', fwCount);
}

async function migrateTables() {
    console.log('\n📋 3/12 Migrating TABLES...');
    const pages = await fetchAllPages(NOTION_DBS.TABLES);
    let count = 0;

    for (const page of pages) {
        const p = page.properties;
        const name = getText(p['Name']) || 'Mesa';
        const capacity = getNum(p['Capacity']);
        const order = getNum(p['Order']) || 0;
        const assignmentsRaw = getText(p['Assignments']) || '[]';
        const eventRelation = getRelationIds(p['Event']);

        let eventId = null;
        if (eventRelation.length > 0) {
            eventId = idMap.events[eventRelation[0]] || null;
        }

        if (!eventId) {
            logError('tables', `Skipping table "${name}" — no event mapped`);
            continue;
        }

        let assignments = [];
        try { assignments = JSON.parse(assignmentsRaw); } catch { assignments = []; }

        const { data, error } = await supabase
            .from('tables')
            .insert({
                event_id: eventId,
                name,
                capacity,
                sort_order: order,
                assignments,
            })
            .select('id')
            .single();

        if (error) {
            logError('tables', `Error inserting table "${name}": ${error.message}`);
            continue;
        }

        idMap.tables[page.id] = data.id;
        count++;
    }
    log('tables', count);
}

async function migrateGuests() {
    console.log('\n📋 4/12 Migrating GUESTS (JSONB allotted/confirmed, TEXT[] companions)...');
    const pages = await fetchAllPages(NOTION_DBS.GUESTS);
    let count = 0;

    for (const page of pages) {
        const p = page.properties;
        const name = getText(p['Name']) || 'Invitado';
        const email = getText(p['Email']) || null;
        const status = getText(p['Status']) || 'pending';
        const companionNamesRaw = getText(p['Companion Names']) || '';
        const invitationSent = getBool(p['Invitation Sent']);

        const eventRelation = getRelationIds(p['Event']);
        let eventId = eventRelation.length > 0 ? idMap.events[eventRelation[0]] : null;

        if (!eventId) {
            logError('guests', `Skipping guest "${name}" — no event mapped`);
            continue;
        }

        // Assigned table (optional)
        const tableRelation = getRelationIds(p['Assigned Table']);
        let assignedTableId = tableRelation.length > 0 ? idMap.tables[tableRelation[0]] : null;

        // Build JSONB fields
        const allotted = {
            adults: getNum(p['Adults Allotted']) || 0,
            teens: getNum(p['Teens Allotted']) || 0,
            kids: getNum(p['Kids Allotted']) || 0,
            infants: getNum(p['Infants Allotted']) || 0,
        };
        const confirmed = {
            adults: getNum(p['Adults Confirmed']) || 0,
            teens: getNum(p['Teens Confirmed']) || 0,
            kids: getNum(p['Kids Confirmed']) || 0,
            infants: getNum(p['Infants Confirmed']) || 0,
        };

        // Parse companion names: JSON string in Notion → JSONB in Supabase
        companionNamesRaw = getText(p['Companion Names']) || '{}';
        let companionNames = { adults: [], teens: [], kids: [], infants: [] };
        try {
            const parsed = JSON.parse(companionNamesRaw);
            // Ensure structure
            companionNames = {
                adults: Array.isArray(parsed.adults) ? parsed.adults : [],
                teens: Array.isArray(parsed.teens) ? parsed.teens : [],
                kids: Array.isArray(parsed.kids) ? parsed.kids : [],
                infants: Array.isArray(parsed.infants) ? parsed.infants : []
            };
        } catch (e) {
            // fallback if not valid JSON
            console.warn(`Guest ${name}: Invalid companion names JSON`, companionNamesRaw);
        }

        const { data, error } = await supabase
            .from('guests')
            .insert({
                event_id: eventId,
                name,
                email: email || null,
                status: ['pending', 'confirmed', 'declined'].includes(status) ? status : 'pending',
                allotted,
                confirmed,
                companion_names: companionNames,
                invitation_sent: invitationSent,
                assigned_table_id: assignedTableId,
            })
            .select('id')
            .single();

        if (error) {
            logError('guests', `Error inserting guest "${name}": ${error.message}`);
            continue;
        }

        idMap.guests[page.id] = data.id;
        count++;
    }
    log('guests', count);
}

async function migrateCompanions() {
    // Companions data is absorbed into guests.companion_names[]
    // The COMPANIONS table in Notion has individual companion records
    // We only need this if companion data has extra info not in GUESTS
    console.log('\n📋 5/12 COMPANIONS — Data absorbed into guests.companion_names[] (skipped)');
    log('companions', 0);
}

async function migrateStaffRoster() {
    console.log('\n📋 6/12 Migrating STAFF_ROSTER → auth.users + users + staff_profiles...');
    const pages = await fetchAllPages(NOTION_DBS.STAFF_ROSTER);
    let count = 0;

    for (const page of pages) {
        const p = page.properties;
        const name = getText(p['Name']) || '';
        const email = getText(p['Email']) || '';
        const password = getText(p['Password']) || 'staff123';
        const description = getText(p['Description']) || null;
        const ownerNotionId = getText(p['OwnerId']) || null;

        if (!email) {
            logError('staff_roster', `Skipping staff "${name}" — no email`);
            continue;
        }

        try {
            // Create in Supabase Auth
            const { data: authData, error: authError } = await supabase.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
            });

            let userId;
            if (authError) {
                if (authError.message?.includes('already been registered')) {
                    const { data: users } = await supabase.auth.admin.listUsers();
                    const existing = users?.users?.find(u => u.email === email);
                    if (existing) {
                        userId = existing.id;
                    } else {
                        logError('staff_roster', `Cannot find existing user ${email}`);
                        continue;
                    }
                } else {
                    logError('staff_roster', `Auth error for ${email}: ${authError.message}`);
                    continue;
                }
            } else {
                userId = authData.user.id;
            }

            idMap.staff_roster[page.id] = userId;

            // Update public.users profile
            await supabase.from('users').upsert({
                id: userId,
                email,
                role: 'staff',
            });

            // Find owner UUID
            let ownerId = null;
            if (ownerNotionId && idMap.subscribers[ownerNotionId]) {
                ownerId = idMap.subscribers[ownerNotionId];
            }

            // Create staff_profile
            if (ownerId) {
                await supabase.from('staff_profiles').upsert({
                    id: userId,
                    description,
                    owner_id: ownerId,
                });
            } else {
                logError('staff_roster', `Staff "${name}" has no mapped owner (OwnerId: ${ownerNotionId})`);
            }

            count++;
        } catch (err) {
            logError('staff_roster', `Error migrating staff "${name}": ${err.message}`);
        }
    }
    log('staff_roster', count);
}

async function migrateStaffAssignments() {
    console.log('\n📋 7/12 Migrating STAFF_ASSIGNMENTS (checkboxes → JSONB permissions)...');
    const pages = await fetchAllPages(NOTION_DBS.STAFF_ASSIGNMENTS);
    let count = 0;

    for (const page of pages) {
        const p = page.properties;
        const name = getText(p['Name']) || null;
        const staffNotionId = getText(p['StaffId']) || '';
        const eventNotionId = getText(p['EventId']) || '';

        const staffId = idMap.staff_roster[staffNotionId] || null;
        const eventId = idMap.events[eventNotionId] || null;

        if (!staffId || !eventId) {
            logError('staff_assignments', `Skipping assignment "${name}" — staff or event not mapped (staffId: ${staffNotionId}, eventId: ${eventNotionId})`);
            continue;
        }

        const permissions = {
            invitados: getBool(p['access_invitados']),
            mesas: getBool(p['access_mesas']),
            link: getBool(p['access_link']),
            games: getBool(p['access_games']),
            fotowall: getBool(p['access_fotowall']),
        };

        const { error } = await supabase
            .from('staff_assignments')
            .insert({
                staff_id: staffId,
                event_id: eventId,
                permissions,
            });

        if (error) {
            logError('staff_assignments', `Error: ${error.message}`);
            continue;
        }
        count++;
    }
    log('staff_assignments', count);
}

async function migrateExpenseCategories() {
    console.log('\n📋 8/12 Migrating EXPENSE_CATEGORIES...');
    const pages = await fetchAllPages(NOTION_DBS.EXPENSE_CATEGORIES);
    let count = 0;

    for (const page of pages) {
        const p = page.properties;
        const name = getText(p['Name']) || 'Categoría';
        const icon = getText(p['Icon']) || null;
        const subtitle = getText(p['Subtitle']) || null;

        const eventRelation = getRelationIds(p['Event']);
        const eventId = eventRelation.length > 0 ? idMap.events[eventRelation[0]] : null;

        if (!eventId) {
            logError('expense_categories', `Skipping category "${name}" — no event mapped`);
            continue;
        }

        const { data, error } = await supabase
            .from('expense_categories')
            .insert({ event_id: eventId, name, icon, subtitle })
            .select('id')
            .single();

        if (error) { logError('expense_categories', error.message); continue; }
        idMap.expense_categories[page.id] = data.id;
        count++;
    }
    log('expense_categories', count);
}

async function migrateSuppliers() {
    console.log('\n📋 9/12 Migrating SUPPLIERS...');
    const pages = await fetchAllPages(NOTION_DBS.SUPPLIERS);
    let count = 0;

    for (const page of pages) {
        const p = page.properties;
        const name = getText(p['Name']) || 'Proveedor';
        const category = getText(p['Category']) || null;
        const phone = getText(p['Phone']) || null;
        const email = getText(p['Email']) || null;

        const eventRelation = getRelationIds(p['Event']);
        const eventId = eventRelation.length > 0 ? idMap.events[eventRelation[0]] : null;

        if (!eventId) {
            logError('suppliers', `Skipping supplier "${name}" — no event mapped`);
            continue;
        }

        const { data, error } = await supabase
            .from('suppliers')
            .insert({ event_id: eventId, name, category, phone, email })
            .select('id')
            .single();

        if (error) { logError('suppliers', error.message); continue; }
        idMap.suppliers[page.id] = data.id;
        count++;
    }
    log('suppliers', count);
}

async function migrateExpenses() {
    console.log('\n📋 10/12 Migrating EXPENSES...');
    const pages = await fetchAllPages(NOTION_DBS.EXPENSES);
    let count = 0;

    for (const page of pages) {
        const p = page.properties;
        const name = getText(p['Name']) || 'Gasto';
        const category = getText(p['Category']) || null;
        const supplier = getText(p['Supplier']) || null;
        const total = getNum(p['Total']) || 0;
        const paid = getNum(p['Paid']) || 0;
        const status = getText(p['Status']) || 'Pendiente';

        const eventRelation = getRelationIds(p['Event']);
        const eventId = eventRelation.length > 0 ? idMap.events[eventRelation[0]] : null;

        if (!eventId) {
            logError('expenses', `Skipping expense "${name}" — no event mapped`);
            continue;
        }

        const { data, error } = await supabase
            .from('expenses')
            .insert({
                event_id: eventId,
                name,
                category,
                supplier: supplier,
                total,
                paid,
                status: ['Pagado', 'Adelanto', 'Pendiente'].includes(status) ? status : 'Pendiente',
            })
            .select('id')
            .single();

        if (error) { logError('expenses', error.message); continue; }
        idMap.expenses[page.id] = data.id;
        count++;
    }
    log('expenses', count);
}

async function migratePaymentParticipants() {
    console.log('\n📋 11/12 Migrating PAYMENT_PARTICIPANTS...');
    const pages = await fetchAllPages(NOTION_DBS.PAYMENT_PARTICIPANTS);
    let count = 0;

    for (const page of pages) {
        const p = page.properties;
        const name = getText(p['Name']) || 'Participante';
        const eventNotionId = getText(p['EventId']) || '';
        const weight = getNum(p['Weight']) || 1;

        // EventId in Notion is stored as rich_text (the Notion page ID)
        const eventId = idMap.events[eventNotionId] || null;

        if (!eventId) {
            logError('payment_participants', `Skipping participant "${name}" — event "${eventNotionId}" not mapped`);
            continue;
        }

        const { data, error } = await supabase
            .from('payment_participants')
            .insert({ event_id: eventId, name, weight })
            .select('id')
            .single();

        if (error) { logError('payment_participants', error.message); continue; }
        idMap.payment_participants[page.id] = data.id;
        count++;
    }
    log('payment_participants', count);
}

async function migratePayments() {
    console.log('\n📋 12/12 Migrating PAYMENTS...');
    const pages = await fetchAllPages(NOTION_DBS.PAYMENTS);
    let count = 0;

    for (const page of pages) {
        const p = page.properties;
        const name = getText(p['Name']) || null;
        const expenseNotionId = getText(p['ExpenseId']) || '';
        const participantNotionId = getText(p['ParticipantId']) || '';
        const amount = getNum(p['Amount']) || 0;
        const date = getText(p['Date']) || null;
        const receiptUrl = getText(p['ReceiptURL']) || null;

        const expenseId = idMap.expenses[expenseNotionId] || null;
        const participantId = idMap.payment_participants[participantNotionId] || null;

        if (!expenseId || !participantId) {
            logError('payments', `Skipping payment "${name}" — expense or participant not mapped`);
            continue;
        }

        const { error } = await supabase
            .from('payments')
            .insert({
                name,
                expense_id: expenseId,
                participant_id: participantId,
                amount,
                date: date || null,
                receipt_url: receiptUrl,
            });

        if (error) { logError('payments', error.message); continue; }
        count++;
    }
    log('payments', count);
}

// ── Main ──────────────────────────────────────────────────

async function main() {
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║  APPXV — Notion → Supabase Migration            ║');
    console.log('╚══════════════════════════════════════════════════╝');
    console.log(`\nNotion API Key: ${NOTION_API_KEY ? '✅ Present' : '❌ Missing'}`);
    console.log(`Supabase URL: ${SUPABASE_URL}`);
    console.log(`Supabase Key: ${SUPABASE_SERVICE_KEY ? '✅ Present' : '❌ Missing'}`);

    const startTime = Date.now();

    try {
        // Order matters — respects FK dependencies
        await migrateSubscribers();
        await migrateEvents();
        await migrateTables();
        await migrateGuests();
        await migrateCompanions(); // skipped — absorbed into guests
        await migrateStaffRoster();
        await migrateStaffAssignments();
        await migrateExpenseCategories();
        await migrateSuppliers();
        await migrateExpenses();
        await migratePaymentParticipants();
        await migratePayments();
    } catch (err) {
        console.error('\n💥 Fatal error during migration:', err);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n╔══════════════════════════════════════════════════╗');
    console.log('║  Migration Summary                               ║');
    console.log('╚══════════════════════════════════════════════════╝');
    console.log(`  Time: ${elapsed}s`);
    for (const [table, count] of Object.entries(stats)) {
        console.log(`  ${table}: ${count} rows`);
    }
    console.log('\n✅ Migration complete. Verify data in Supabase dashboard.');
}

main().catch(console.error);
