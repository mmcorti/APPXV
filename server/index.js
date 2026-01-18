import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local', override: true });
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { notion as notionClient, DS, DB } from './notion.js';
import { schema, KNOWN_PROPERTIES } from './schema_manager.js';
import { googlePhotosService } from './services/googlePhotos.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

// Debug helper (keep existing if needed)
import '../debug_pkg.js';

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../dist')));

// Helper to extract text from rich_text/title/select/etc
const getText = (prop) => {
    if (!prop) return '';
    if (prop.title) return prop.title.map(t => t.plain_text).join('');
    if (prop.rich_text) return prop.rich_text.map(t => t.plain_text).join('');
    if (prop.select) return prop.select.name || '';
    if (prop.email) return prop.email || '';
    if (prop.date) return prop.date.start || '';
    if (prop.number !== undefined && prop.number !== null) return prop.number.toString();
    if (prop.url) return prop.url || '';
    if (prop.checkbox !== undefined) return prop.checkbox;
    if (prop.relation) return prop.relation.map(r => r.id);
    return '';
};

// Robust Property Finder
const findProp = (properties, names) => {
    if (!properties) return undefined;
    const propKeys = Object.keys(properties);
    for (const name of names) {
        const foundKey = propKeys.find(k => k.toLowerCase() === name.toLowerCase());
        if (foundKey) return properties[foundKey];
    }
    return undefined;
};

app.get('/', (req, res) => {
    res.send('Fiesta Planner API is Running');
});

// --- LOGIN ---
app.post('/api/login', async (req, res) => {
    const email = req.body.email?.trim();
    const password = req.body.password?.trim();
    console.log(`🔐 Intentando login para: ${email}`);

    try {
        if (!DS.USERS) throw new Error("USERS_DB_ID not configured");

        const response = await notionClient.databases.query({
            database_id: DS.USERS,
            filter: {
                property: "Email",
                email: { equals: email }
            }
        });

        const userPage = response.results[0];
        if (!userPage) {
            return res.status(401).json({ success: false, message: 'Usuario no encontrado' });
        }

        const dbEmail = getText(userPage.properties.Email);
        const dbPassword = getText(userPage.properties.PasswordHash || userPage.properties.Password);

        if (dbPassword.trim() !== password) {
            return res.status(401).json({ success: false, message: 'Contraseña incorrecta' });
        }

        res.json({
            success: true,
            user: {
                id: userPage.id,
                email: getText(userPage.properties.Email),
                name: getText(userPage.properties.Name),
                role: userPage.properties.Role?.multi_select?.[0]?.name || userPage.properties.Role?.select?.name || 'admin'
            }
        });

    } catch (error) {
        console.error("❌ Error en Login:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- EVENTS ---
app.get('/api/events', async (req, res) => {
    try {
        const { email } = req.query;
        // Use dynamic property name
        const filter = email ? {
            property: schema.get('EVENTS', 'CreatorEmail'),
            email: { equals: email }
        } : undefined;

        console.log(`🔍 [DEBUG] Using Event Filter Key: ${schema.get('EVENTS', 'CreatorEmail')}`);

        const response = await notionClient.databases.query({
            database_id: DS.EVENTS,
            filter
        });

        const events = response.results.map((page, index) => {
            const props = page.properties;
            const event = {
                id: page.id,
                eventName: getText(findProp(props, KNOWN_PROPERTIES.EVENTS.Name)),
                date: getText(findProp(props, KNOWN_PROPERTIES.EVENTS.Date)),
                location: getText(findProp(props, KNOWN_PROPERTIES.EVENTS.Location)),
                message: getText(findProp(props, KNOWN_PROPERTIES.EVENTS.Message)),
                image: findProp(props, KNOWN_PROPERTIES.EVENTS.Image)?.url || '',
                time: getText(findProp(props, KNOWN_PROPERTIES.EVENTS.Time)),
                hostName: getText(findProp(props, KNOWN_PROPERTIES.EVENTS.Host)),
                giftType: getText(findProp(props, KNOWN_PROPERTIES.EVENTS.GiftType)),
                giftDetail: getText(findProp(props, KNOWN_PROPERTIES.EVENTS.GiftDetail)),
                status: 'published',
                fotowall: {
                    albumUrl: getText(findProp(props, KNOWN_PROPERTIES.EVENTS.FW_AlbumUrl)),
                    interval: Number(getText(findProp(props, KNOWN_PROPERTIES.EVENTS.FW_Interval))) || 5,
                    shuffle: findProp(props, KNOWN_PROPERTIES.EVENTS.FW_Shuffle)?.checkbox || false,
                    overlayTitle: getText(findProp(props, KNOWN_PROPERTIES.EVENTS.FW_OverlayTitle)),
                    mode: findProp(props, KNOWN_PROPERTIES.EVENTS.FW_ModerationMode)?.select?.name || 'manual',
                    filters: (() => {
                        try {
                            const f = getText(findProp(props, KNOWN_PROPERTIES.EVENTS.FW_Filters));
                            return f ? JSON.parse(f) : null;
                        } catch (e) { return null; }
                    })()
                }
            };

            if (index === 0) {
                console.log("🔍 [DIAGNOSTIC] First Event Mapped:", JSON.stringify(event, null, 2));
                console.log("🔍 [DIAGNOSTIC] Actual Mapped Keys:", JSON.stringify(schema.mappings.EVENTS, null, 2));
                const dump = {
                    event_mapped: event,
                    raw_keys: Object.keys(props),
                    raw_properties: props
                };
                try { fs.writeFileSync(path.join(__dirname, 'diagnostic_dump_event.json'), JSON.stringify(dump, null, 2)); } catch (e) { }
            }
            return event;
        });
        res.json(events);
    } catch (error) {
        console.error("Fetch Events Error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/events', async (req, res) => {
    try {
        const { eventName, date, location, message, image, userEmail, time, hostName, giftType, giftDetail } = req.body;
        console.log(`📝 [DEBUG] Creating event: ${eventName}`);

        const properties = {};
        properties[schema.get('EVENTS', 'Name')] = { title: [{ text: { content: eventName || "Nuevo Evento" } }] };
        properties[schema.get('EVENTS', 'CreatorEmail')] = { email: userEmail };
        properties[schema.get('EVENTS', 'Date')] = { date: { start: date || new Date().toISOString().split('T')[0] } };
        properties[schema.get('EVENTS', 'Location')] = { rich_text: [{ text: { content: location || "" } }] };
        properties[schema.get('EVENTS', 'Message')] = { rich_text: [{ text: { content: message || "" } }] };
        properties[schema.get('EVENTS', 'Image')] = { url: image || null };
        properties[schema.get('EVENTS', 'Time')] = { rich_text: [{ text: { content: time || "" } }] };
        properties[schema.get('EVENTS', 'Host')] = { rich_text: [{ text: { content: hostName || "" } }] };
        if (giftType) properties[schema.get('EVENTS', 'GiftType')] = { select: { name: giftType } };
        properties[schema.get('EVENTS', 'GiftDetail')] = { rich_text: [{ text: { content: giftDetail || "" } }] };

        // FotoWall initial config (optional)
        const { fotowall } = req.body;
        if (fotowall) {
            properties[schema.get('EVENTS', 'FW_AlbumUrl')] = { url: fotowall.albumUrl || null };
            properties[schema.get('EVENTS', 'FW_Interval')] = { number: Number(fotowall.interval) || 5 };
            properties[schema.get('EVENTS', 'FW_Shuffle')] = { checkbox: !!fotowall.shuffle };
            properties[schema.get('EVENTS', 'FW_OverlayTitle')] = { rich_text: [{ text: { content: fotowall.overlayTitle || "" } }] };
            properties[schema.get('EVENTS', 'FW_ModerationMode')] = { select: { name: fotowall.mode || 'manual' } };
            properties[schema.get('EVENTS', 'FW_Filters')] = { rich_text: [{ text: { content: JSON.stringify(fotowall.filters || {}) } }] };
        }

        const newPage = await notionClient.pages.create({
            parent: { database_id: DB.EVENTS },
            properties
        });

        res.json({ success: true, id: newPage.id });
    } catch (error) {
        console.error("❌ Error Creating Event:", error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/events/:id', async (req, res) => {
    try {
        await schema.init();
        const { id } = req.params;
        const { eventName, date, location, message, image, time, hostName, giftType, giftDetail, fotowall } = req.body;

        console.log(`📝 Updating event ${id}. Request body keys:`, Object.keys(req.body));

        const properties = {};
        if (eventName !== undefined) properties[schema.get('EVENTS', 'Name')] = { title: [{ text: { content: eventName } }] };
        if (date !== undefined) properties[schema.get('EVENTS', 'Date')] = { date: { start: date } };
        if (location !== undefined) properties[schema.get('EVENTS', 'Location')] = { rich_text: [{ text: { content: location || "" } }] };
        if (message !== undefined) properties[schema.get('EVENTS', 'Message')] = { rich_text: [{ text: { content: message || "" } }] };
        if (image !== undefined) properties[schema.get('EVENTS', 'Image')] = { url: image || null };
        if (time !== undefined) properties[schema.get('EVENTS', 'Time')] = { rich_text: [{ text: { content: time || "" } }] };
        if (hostName !== undefined) properties[schema.get('EVENTS', 'Host')] = { rich_text: [{ text: { content: hostName || "" } }] };
        if (giftType !== undefined) properties[schema.get('EVENTS', 'GiftType')] = { select: { name: giftType } };
        if (giftDetail !== undefined) properties[schema.get('EVENTS', 'GiftDetail')] = { rich_text: [{ text: { content: giftDetail || "" } }] };

        // FotoWall update
        if (fotowall) {
            console.log("📸 Updating FotoWall settings:", JSON.stringify(fotowall));
            properties[schema.get('EVENTS', 'FW_AlbumUrl')] = { url: fotowall.albumUrl || null };
            properties[schema.get('EVENTS', 'FW_Interval')] = { number: Number(fotowall.interval) || 5 };
            properties[schema.get('EVENTS', 'FW_Shuffle')] = { checkbox: !!fotowall.shuffle };
            properties[schema.get('EVENTS', 'FW_OverlayTitle')] = { rich_text: [{ text: { content: fotowall.overlayTitle || "" } }] };
            properties[schema.get('EVENTS', 'FW_ModerationMode')] = { select: { name: fotowall.mode || 'manual' } };
            properties[schema.get('EVENTS', 'FW_Filters')] = { rich_text: [{ text: { content: JSON.stringify(fotowall.filters || {}) } }] };

            console.log("🛠️ Mapped Properties for FotoWall:", {
                albumUrl: schema.get('EVENTS', 'FW_AlbumUrl'),
                interval: schema.get('EVENTS', 'FW_Interval'),
                mode: schema.get('EVENTS', 'FW_ModerationMode')
            });
        }

        console.log("📤 Sending update to Notion for page:", id);
        await notionClient.pages.update({ page_id: id, properties });
        console.log("✅ Notion update successful");
        res.json({ success: true });
    } catch (error) {
        console.error("❌ Error updating event:", error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/events/:id', async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`🗑️ Deleting event: ${id}`);

        // Archive the event page in Notion
        await notionClient.pages.update({ page_id: id, archived: true });

        console.log(`✅ Event ${id} deleted successfully`);
        res.json({ success: true });
    } catch (error) {
        console.error("❌ Error deleting event:", error);
        res.status(500).json({ error: error.message });
    }
});

// --- GUESTS ---
app.get('/api/guests', async (req, res) => {
    try {
        const { eventId } = req.query;
        const filter = eventId ? {
            property: schema.get('GUESTS', 'Event'),
            relation: { contains: eventId }
        } : undefined;

        const response = await notionClient.databases.query({
            database_id: DS.GUESTS,
            filter
        });

        const guests = response.results.map((page, index) => {
            const props = page.properties;
            const companionNamesStr = getText(findProp(props, KNOWN_PROPERTIES.GUESTS.CompanionNames));
            let companionNames = { adults: [], teens: [], kids: [], infants: [] };
            try {
                if (companionNamesStr) companionNames = JSON.parse(companionNamesStr);
            } catch (e) { }

            const guest = {
                id: page.id,
                name: getText(findProp(props, KNOWN_PROPERTIES.GUESTS.Name)),
                email: getText(findProp(props, KNOWN_PROPERTIES.GUESTS.Email)),
                status: findProp(props, KNOWN_PROPERTIES.GUESTS.Status)?.select?.name || 'pending',
                allotted: {
                    adults: findProp(props, KNOWN_PROPERTIES.GUESTS.AllottedAdults)?.number ?? 0,
                    teens: findProp(props, KNOWN_PROPERTIES.GUESTS.AllottedTeens)?.number ?? 0,
                    kids: findProp(props, KNOWN_PROPERTIES.GUESTS.AllottedKids)?.number ?? 0,
                    infants: findProp(props, KNOWN_PROPERTIES.GUESTS.AllottedInfants)?.number ?? 0
                },
                confirmed: {
                    adults: findProp(props, KNOWN_PROPERTIES.GUESTS.ConfirmedAdults)?.number || 0,
                    teens: findProp(props, KNOWN_PROPERTIES.GUESTS.ConfirmedTeens)?.number || 0,
                    kids: findProp(props, KNOWN_PROPERTIES.GUESTS.ConfirmedKids)?.number || 0,
                    infants: findProp(props, KNOWN_PROPERTIES.GUESTS.ConfirmedInfants)?.number || 0
                },
                companionNames,
                sent: findProp(props, KNOWN_PROPERTIES.GUESTS.Sent)?.checkbox || false
            };

            if (index === 0) {
                console.log("🔍 [DIAGNOSTIC] First Guest Mapped:", JSON.stringify(guest, null, 2));
                console.log("🔍 [DIAGNOSTIC] Actual Mapped Keys GUEST:", JSON.stringify(schema.mappings.GUESTS, null, 2));
                const dump = {
                    guest_mapped: guest,
                    raw_keys: Object.keys(props),
                    raw_properties: props
                };
                try { fs.writeFileSync(path.join(__dirname, 'diagnostic_dump_guest.json'), JSON.stringify(dump, null, 2)); } catch (e) { }
            }
            return guest;
        });
        res.json(guests);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/guests', async (req, res) => {
    try {
        await schema.init(); // Ensure schema is ready
        const { eventId, guest } = req.body;
        console.log("📝 Creating Guest for Event:", eventId);
        console.log("📦 Guest Payload:", JSON.stringify(guest, null, 2));

        const properties = {};

        // Helper to safely set property
        const setProp = (key, value) => {
            const propName = schema.get('GUESTS', key);
            if (propName) properties[propName] = value;
            else console.warn(`⚠️ Warning: Property mapping for '${key}' not found.`);
        };

        setProp('Name', { title: [{ text: { content: guest.name } }] });
        setProp('Email', { email: guest.email || null });
        setProp('Status', { select: { name: guest.status || 'pending' } });

        setProp('AllottedAdults', { number: Number(guest.allotted?.adults) || 0 });
        setProp('AllottedTeens', { number: Number(guest.allotted?.teens) || 0 });
        setProp('AllottedKids', { number: Number(guest.allotted?.kids) || 0 });
        setProp('AllottedInfants', { number: Number(guest.allotted?.infants) || 0 });

        setProp('Event', { relation: [{ id: eventId }] });
        setProp('CompanionNames', { rich_text: [{ text: { content: JSON.stringify(guest.companionNames || {}) } }] });

        console.log("📤 Notion Properties:", JSON.stringify(properties, null, 2));

        const newPage = await notionClient.pages.create({
            parent: { database_id: DB.GUESTS },
            properties
        });

        console.log("✅ Guest Created:", newPage.id);
        res.json({ success: true, id: newPage.id });
    } catch (error) {
        console.error("❌ Error creating guest:", error.message);
        console.error("Stack:", error.stack);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/guests/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { guest } = req.body;
        const properties = {};
        if (guest.name) properties[schema.get('GUESTS', 'Name')] = { title: [{ text: { content: guest.name } }] };
        properties[schema.get('GUESTS', 'Email')] = { email: guest.email || null };
        if (guest.status) properties[schema.get('GUESTS', 'Status')] = { select: { name: guest.status } };

        properties[schema.get('GUESTS', 'AllottedAdults')] = { number: guest.allotted?.adults || 0 };
        properties[schema.get('GUESTS', 'AllottedTeens')] = { number: guest.allotted?.teens || 0 };
        properties[schema.get('GUESTS', 'AllottedKids')] = { number: guest.allotted?.kids || 0 };
        properties[schema.get('GUESTS', 'AllottedInfants')] = { number: guest.allotted?.infants || 0 };

        properties[schema.get('GUESTS', 'ConfirmedAdults')] = { number: guest.confirmed?.adults || 0 };
        properties[schema.get('GUESTS', 'ConfirmedTeens')] = { number: guest.confirmed?.teens || 0 };
        properties[schema.get('GUESTS', 'ConfirmedKids')] = { number: guest.confirmed?.kids || 0 };
        properties[schema.get('GUESTS', 'ConfirmedInfants')] = { number: guest.confirmed?.infants || 0 };

        properties[schema.get('GUESTS', 'CompanionNames')] = { rich_text: [{ text: { content: JSON.stringify(guest.companionNames || {}) } }] };
        properties[schema.get('GUESTS', 'Sent')] = { checkbox: guest.sent || false };

        await notionClient.pages.update({ page_id: id, properties });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.patch('/api/guests/:id/rsvp', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, confirmed, companionNames } = req.body;

        const properties = {};
        if (status) properties[schema.get('GUESTS', 'Status')] = { select: { name: status } };

        properties[schema.get('GUESTS', 'ConfirmedAdults')] = { number: confirmed?.adults || 0 };
        properties[schema.get('GUESTS', 'ConfirmedTeens')] = { number: confirmed?.teens || 0 };
        properties[schema.get('GUESTS', 'ConfirmedKids')] = { number: confirmed?.kids || 0 };
        properties[schema.get('GUESTS', 'ConfirmedInfants')] = { number: confirmed?.infants || 0 };

        properties[schema.get('GUESTS', 'CompanionNames')] = { rich_text: [{ text: { content: JSON.stringify(companionNames || {}) } }] };

        console.log("📝 [DEBUG] Updating RSVP:", JSON.stringify(properties));

        await notionClient.pages.update({ page_id: id, properties });
        res.json({ success: true });
    } catch (error) {
        console.error("❌ RSVP Error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/guests/:id', async (req, res) => {
    try {
        await notionClient.pages.update({ page_id: req.params.id, archived: true });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- TABLES ---
app.get('/api/tables', async (req, res) => {
    try {
        const { eventId } = req.query;
        await schema.init();

        const filter = eventId ? {
            property: schema.get('TABLES', 'Event'),
            relation: { contains: eventId }
        } : undefined;

        const response = await notionClient.databases.query({
            database_id: DS.TABLES,
            filter
        });

        const tables = response.results.map(page => {
            const assignmentJson = getText(findProp(page.properties, KNOWN_PROPERTIES.TABLES.Assignments));
            let parsedGuests = [];

            if (assignmentJson) {
                try {
                    // Map companionName to name for frontend compatibility
                    parsedGuests = JSON.parse(assignmentJson).map(g => ({
                        ...g,
                        name: g.companionName || g.name || "Sin nombre"
                    }));
                } catch (e) { console.error("Error parsing table assignments", e); }
            } else {
                // Fallback: use relation if no JSON (legacy behavior)
                const relationIds = findProp(page.properties, KNOWN_PROPERTIES.TABLES.Guests)?.relation?.map(r => r.id) || [];
                parsedGuests = relationIds.map(id => ({ guestId: id, name: "Invitado (Legacy)", companionIndex: -1 }));
            }

            return {
                id: page.id,
                name: getText(findProp(page.properties, KNOWN_PROPERTIES.TABLES.Name)),
                capacity: findProp(page.properties, KNOWN_PROPERTIES.TABLES.Capacity)?.number || 0,
                order: findProp(page.properties, KNOWN_PROPERTIES.TABLES.Order)?.number ?? 999,
                guests: parsedGuests
            };
        });

        // Sort tables by order before sending
        tables.sort((a, b) => a.order - b.order);
        res.json(tables);
    } catch (error) {
        console.error("Error fetching tables:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/tables', async (req, res) => {
    try {
        await schema.init();
        let { eventId, name, capacity, table } = req.body;

        console.log("\n=== POST /api/tables ===");
        console.log("Request body:", JSON.stringify(req.body, null, 2));

        // Handle payload variation { eventId, table: { name, capacity } }
        if (table) {
            name = table.name;
            capacity = table.capacity;
            console.log("Using table object - name:", name, "capacity:", capacity);
        }

        if (!name || !eventId) {
            console.error("❌ Missing required fields - name:", name, "eventId:", eventId);
            return res.status(400).json({ error: "Missing required fields: name, eventId" });
        }

        const properties = {};
        const setProp = (key, value) => {
            const propName = schema.get('TABLES', key);
            if (propName) {
                properties[propName] = value;
                console.log(`Set property ${key} (${propName})`);
            } else {
                console.warn(`⚠️  Property ${key} not found in schema`);
            }
        };

        setProp('Name', { title: [{ text: { content: name } }] });
        setProp('Capacity', { number: Number(capacity) || 10 });
        setProp('Event', { relation: [{ id: eventId }] });
        setProp('Assignments', { rich_text: [{ text: { content: "[]" } }] });

        console.log("Properties to create:", Object.keys(properties));
        console.log("Database ID:", DB.TABLES);

        const newPage = await notionClient.pages.create({
            parent: { database_id: DB.TABLES },
            properties
        });

        console.log("✅ Table created successfully:", newPage.id);
        res.json({ success: true, id: newPage.id });
    } catch (error) {
        console.error("❌ Error creating table:", error.body || error.message);
        console.error("Stack:", error.stack);
        res.status(500).json({ error: error.message, details: error.body });
    }
});

app.patch('/api/tables/:id/guests', async (req, res) => {
    try {
        const { id } = req.params;
        const { assignments } = req.body;
        await schema.init();

        console.log(`\n=== PATCH /api/tables/${id}/guests ===`);
        console.log("Assignments received:", JSON.stringify(assignments, null, 2));

        const properties = {};
        const setProp = (key, value) => {
            const propName = schema.get('TABLES', key);
            if (propName) {
                properties[propName] = value;
                console.log(`Set property ${key} (${propName})`);
            } else {
                console.warn(`⚠️  Property ${key} not found in schema`);
            }
        };

        // 1. Save detailed assignments as JSON text
        const assignmentsJson = JSON.stringify(assignments);
        console.log("Assignments JSON length:", assignmentsJson.length);
        setProp('Assignments', { rich_text: [{ text: { content: assignmentsJson } }] });

        console.log("Properties to update:", Object.keys(properties));

        const result = await notionClient.pages.update({ page_id: id, properties });
        console.log("✅ Table updated successfully");

        res.json({ success: true, updated: result.id });
    } catch (error) {
        console.error("❌ Error updating table guests:", error.body || error.message);
        console.error("Stack:", error.stack);
        res.status(500).json({ error: error.message, details: error.body });
    }
});


app.put('/api/tables/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, capacity, order } = req.body;
        await schema.init();

        console.log(`\n=== PUT /api/tables/${id} ===`);
        console.log("Update data:", { name, capacity, order });

        const properties = {};
        const setProp = (key, value) => {
            const propName = schema.get('TABLES', key);
            if (propName) {
                properties[propName] = value;
            }
        };

        if (name) setProp('Name', { title: [{ text: { content: name } }] });
        if (capacity !== undefined) setProp('Capacity', { number: Number(capacity) });
        if (order !== undefined) setProp('Order', { number: Number(order) });

        const result = await notionClient.pages.update({ page_id: id, properties });
        console.log("✅ Table updated successfully");

        res.json({ success: true, updated: result.id });
    } catch (error) {
        console.error("❌ Error updating table:", error.body || error.message);
        res.status(500).json({ error: error.message });
    }
});

// Batch update table orders
app.patch('/api/tables/reorder', async (req, res) => {
    try {
        const { orders } = req.body; // Array of { tableId, order }
        await schema.init();

        console.log(`\n=== PATCH /api/tables/reorder ===`);
        console.log("Orders to update:", orders);

        const orderPropName = schema.get('TABLES', 'Order');
        if (!orderPropName) {
            // Property doesn't exist yet, just return success
            console.log("Order property not found in schema, skipping order update");
            return res.json({ success: true, message: "Order property not found" });
        }

        // Update each table's order
        for (const { tableId, order } of orders) {
            await notionClient.pages.update({
                page_id: tableId,
                properties: {
                    [orderPropName]: { number: order }
                }
            });
        }

        console.log("✅ Table orders updated successfully");
        res.json({ success: true });
    } catch (error) {
        console.error("❌ Error updating table orders:", error.body || error.message);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/tables/:id', async (req, res) => {
    try {
        await notionClient.pages.update({ page_id: req.params.id, archived: true });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- FOTOWALL ---
app.post('/api/fotowall/validate', async (req, res) => {
    try {
        const { url } = req.body;
        console.log(`[FOTOWALL] Validate request for: ${url}`);

        if (!url) return res.status(400).json({ valid: false, message: "URL requerida" });

        // Basic check
        const isValid = url.includes('photos.app.goo.gl') || url.includes('photos.google.com');
        if (!isValid) return res.json({ valid: false, message: "No es un link de Google Photos" });

        // Try to fetch to see if it exists
        const photos = await googlePhotosService.getAlbumPhotos(url);
        console.log(`[FOTOWALL] Photos found: ${photos.length}`);

        if (photos.length > 0) {
            res.json({ valid: true, count: photos.length, preview: photos[0].src });
        } else {
            res.json({ valid: false, message: "Álbum vacío o inaccesible" });
        }
    } catch (error) {
        console.error(`[FOTOWALL] Validate error:`, error.message);
        res.status(500).json({ valid: false, message: `Error: ${error.message}` });
    }
});

app.post('/api/fotowall/album', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: "URL requerida" });

        const photos = await googlePhotosService.getAlbumPhotos(url);
        res.json(photos);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- FOTOWALL MODERATION ---
import { moderationService } from './services/moderationService.js';

// In-memory cache for moderation results (per album URL)
const moderationCache = new Map();

app.post('/api/fotowall/album/moderated', async (req, res) => {
    try {
        const { url, moderationSettings } = req.body;
        if (!url) return res.status(400).json({ error: "URL requerida" });

        const mode = moderationSettings?.mode || 'manual';
        console.log(`[FOTOWALL] Getting moderated album: ${url}, mode: ${mode}`);

        // Get photos from album
        const photos = await googlePhotosService.getAlbumPhotos(url);

        // Use mode-specific cache key
        const cacheKey = `${url}_${mode}`;
        let cachedResults = moderationCache.get(cacheKey) || {};

        const moderatedPhotos = [];
        const newPhotosToAnalyze = [];

        // Separate cached vs new photos (retry errors)
        for (const photo of photos) {
            const cached = cachedResults[photo.id];
            const hasError = cached?.labels?.includes('error') || cached?.labels?.includes('api_error');

            if (cached && !hasError) {
                moderatedPhotos.push({ ...photo, moderation: cached });
            } else {
                newPhotosToAnalyze.push(photo);
            }
        }

        // If AI mode, analyze new photos
        if (mode === 'ai' && newPhotosToAnalyze.length > 0) {
            const batchSize = 5;
            for (let i = 0; i < Math.min(newPhotosToAnalyze.length, batchSize); i++) {
                const photo = newPhotosToAnalyze[i];
                try {
                    const result = await moderationService.analyzeImage(photo.src, moderationSettings);
                    cachedResults[photo.id] = result;
                    moderatedPhotos.push({ ...photo, moderation: result });
                } catch (error) {
                    console.error(`[FOTOWALL] Moderation error for ${photo.id}:`, error.message);
                    const errorResult = { safe: false, confidence: 0, labels: ['error'], error: error.message };
                    cachedResults[photo.id] = errorResult;
                    moderatedPhotos.push({ ...photo, moderation: errorResult });
                }
            }

            // Add remaining unanalyzed photos as pending
            for (let i = batchSize; i < newPhotosToAnalyze.length; i++) {
                moderatedPhotos.push({
                    ...newPhotosToAnalyze[i],
                    moderation: { safe: false, confidence: 0, labels: ['pending'], pending: true }
                });
            }

            // Update cache
            moderationCache.set(cacheKey, cachedResults);
        } else if (mode === 'manual') {
            // Manual mode: new photos default to blocked (safe: false, need manual approval)
            for (const photo of newPhotosToAnalyze) {
                const result = { safe: false, confidence: 1, labels: ['manual_review'] };
                cachedResults[photo.id] = result;
                moderatedPhotos.push({ ...photo, moderation: result });
            }
            moderationCache.set(cacheKey, cachedResults);
        }

        // Return only safe photos
        const safePhotos = moderatedPhotos.filter(p => p.moderation?.safe === true);
        const blockedCount = moderatedPhotos.filter(p => p.moderation?.safe === false && !p.moderation?.pending).length;
        const pendingCount = moderatedPhotos.filter(p => p.moderation?.pending).length;

        console.log(`[FOTOWALL] Result: ${safePhotos.length} safe, ${blockedCount} blocked, ${pendingCount} pending`);

        res.json({
            photos: safePhotos,
            stats: {
                total: photos.length,
                safe: safePhotos.length,
                blocked: blockedCount,
                pending: pendingCount
            }
        });
    } catch (error) {
        console.error(`[FOTOWALL] Moderated album error:`, error.message);
        res.status(500).json({ error: error.message });
    }
});

// Get blocked photos for admin review
app.post('/api/fotowall/blocked', async (req, res) => {
    try {
        const { url, mode } = req.body;
        if (!url) return res.status(400).json({ error: "URL requerida" });

        const photos = await googlePhotosService.getAlbumPhotos(url);

        // Only check cache for the CURRENT mode (or default to 'ai')
        const currentMode = mode || 'ai';
        const cacheKey = `${url}_${currentMode}`;
        const cachedResults = moderationCache.get(cacheKey) || {};

        console.log(`[FOTOWALL] Getting blocked photos for mode: ${currentMode}, cache key: ${cacheKey}`);

        const blockedPhotos = photos
            .filter(p => cachedResults[p.id] && cachedResults[p.id].safe === false)
            .map(p => ({ ...p, moderation: cachedResults[p.id] }));

        // Return with total count
        res.json({
            photos: blockedPhotos,
            total: photos.length,
            blocked: blockedPhotos.length
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Manually approve a blocked photo
app.post('/api/fotowall/approve', async (req, res) => {
    try {
        const { url, photoId } = req.body;
        if (!url || !photoId) return res.status(400).json({ error: "URL y photoId requeridos" });

        // Apply approval to ALL modes so it persists across mode switches
        const modes = ['manual', 'ai'];

        for (const mode of modes) {
            const cacheKey = `${url}_${mode}`;
            const cachedResults = moderationCache.get(cacheKey) || {};

            cachedResults[photoId] = {
                safe: true,
                confidence: 1,
                labels: ['manually_approved'],
                manuallyApproved: true
            };

            moderationCache.set(cacheKey, cachedResults);
        }

        console.log(`[FOTOWALL] Approved photo ${photoId} for all modes`);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Permanently block a photo
app.post('/api/fotowall/block', async (req, res) => {
    try {
        const { url, photoId } = req.body;
        if (!url || !photoId) return res.status(400).json({ error: "URL y photoId requeridos" });

        // Apply block to ALL modes
        const modes = ['manual', 'ai'];

        for (const mode of modes) {
            const cacheKey = `${url}_${mode}`;
            const cachedResults = moderationCache.get(cacheKey) || {};

            cachedResults[photoId] = {
                safe: false,
                confidence: 1,
                labels: ['manually_blocked'],
                manuallyBlocked: true
            };

            moderationCache.set(cacheKey, cachedResults);
        }

        console.log(`[FOTOWALL] Blocked photo ${photoId} for all modes`);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Clear moderation cache for an album (force re-analysis)
app.post('/api/fotowall/clear-cache', async (req, res) => {
    try {
        const { url } = req.body;
        if (url) {
            // Clear all mode-specific cache keys for this URL
            const modes = ['ai', 'manual', 'off', ''];
            for (const mode of modes) {
                const cacheKey = mode ? `${url}_${mode}` : url;
                moderationCache.delete(cacheKey);
            }
            console.log(`[FOTOWALL] Cleared cache for URL: ${url}`);
        } else {
            moderationCache.clear();
            console.log(`[FOTOWALL] Cleared entire cache`);
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get ALL photos with their moderation status
app.post('/api/fotowall/all-photos', async (req, res) => {
    try {
        const { url, moderationSettings } = req.body;
        if (!url) return res.status(400).json({ error: "URL requerida" });

        const mode = moderationSettings?.mode || 'manual';
        console.log(`[FOTOWALL] Getting all photos: ${url}, mode: ${mode}`);

        const photos = await googlePhotosService.getAlbumPhotos(url);

        // Get cached moderation results for the selected mode
        const cacheKey = `${url}_${mode}`;
        let cachedResults = moderationCache.get(cacheKey) || {};

        // If AI mode, analyze any photos not in cache or with errors
        if (mode === 'ai') {
            const newPhotos = photos.filter(p => {
                const cached = cachedResults[p.id];
                const hasError = cached?.labels?.includes('error') || cached?.labels?.includes('api_error');
                return !cached || hasError;
            });

            if (newPhotos.length > 0) {
                const batchSize = 5;
                for (let i = 0; i < Math.min(newPhotos.length, batchSize); i++) {
                    const photo = newPhotos[i];
                    try {
                        const result = await moderationService.analyzeImage(photo.src, moderationSettings);
                        cachedResults[photo.id] = result;
                    } catch (error) {
                        console.error(`[FOTOWALL] Analysis error for ${photo.id}:`, error.message);
                        cachedResults[photo.id] = { safe: false, confidence: 0, labels: ['error'], error: error.message };
                    }
                }
                moderationCache.set(cacheKey, cachedResults);
            }
        }

        // Map photos with their moderation status
        const photosWithStatus = photos.map(photo => {
            const cached = cachedResults[photo.id];
            return {
                ...photo,
                moderation: cached || { safe: true, labels: [] },
                isBlocked: cached?.safe === false,
                isApproved: cached?.safe === true || !cached
            };
        });

        res.json({
            photos: photosWithStatus,
            total: photos.length,
            blocked: photosWithStatus.filter(p => p.isBlocked).length,
            approved: photosWithStatus.filter(p => p.isApproved).length
        });
    } catch (error) {
        console.error('[FOTOWALL] Error getting all photos:', error);
        res.status(500).json({ error: error.message });
    }
});

// Approve ALL photos (No Moderar)
app.post('/api/fotowall/approve-all', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: "URL requerida" });

        const photos = await googlePhotosService.getAlbumPhotos(url);
        const cacheKey = `${url}_manual`;
        const cachedResults = {};

        // Mark all photos as safe/approved
        for (const photo of photos) {
            cachedResults[photo.id] = {
                safe: true,
                confidence: 1,
                labels: ['approved_all'],
                manuallyApproved: true
            };
        }

        moderationCache.set(cacheKey, cachedResults);
        console.log(`[FOTOWALL] Approved all ${photos.length} photos for ${url}`);

        res.json({ success: true, count: photos.length });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Block ALL photos (Bloquear Todo)
app.post('/api/fotowall/block-all', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: "URL requerida" });

        const photos = await googlePhotosService.getAlbumPhotos(url);
        const cacheKey = `${url}_manual`;
        const cachedResults = {};

        // Mark all photos as blocked
        for (const photo of photos) {
            cachedResults[photo.id] = {
                safe: false,
                confidence: 1,
                labels: ['blocked_all'],
                manuallyBlocked: true
            };
        }

        moderationCache.set(cacheKey, cachedResults);
        console.log(`[FOTOWALL] Blocked all ${photos.length} photos for ${url}`);

        res.json({ success: true, count: photos.length });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});



// Catch-all for frontend
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, '../dist', 'index.html'));
});

// Start server
const start = async () => {
    await schema.init(); // Initialize dynamic schema mapping
    app.listen(PORT, () => {
        console.log(`-----------------------------------------`);
        console.log(`🚀 API Server running on port: ${PORT}`);
        console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`🔑 Notion API Key: ${process.env.NOTION_API_KEY ? 'Present ✅' : 'NOT FOUND ❌'}`);
        console.log(`-----------------------------------------`);
    });
};

start();