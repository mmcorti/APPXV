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
    if (prop.select) return prop.select.name;
    if (prop.email) return prop.email;
    if (prop.date) return prop.date.start;
    if (prop.number !== undefined) return prop.number.toString();
    if (prop.url) return prop.url;
    if (prop.checkbox) return prop.checkbox;
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
                status: 'published'
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
        const { id } = req.params;
        const { eventName, date, location, message, image, time, hostName, giftType, giftDetail } = req.body;

        const properties = {};
        if (eventName) properties[schema.get('EVENTS', 'Name')] = { title: [{ text: { content: eventName } }] };
        if (date) properties[schema.get('EVENTS', 'Date')] = { date: { start: date } };

        // Always try update optional fields
        properties[schema.get('EVENTS', 'Location')] = { rich_text: [{ text: { content: location || "" } }] };
        properties[schema.get('EVENTS', 'Message')] = { rich_text: [{ text: { content: message || "" } }] };
        properties[schema.get('EVENTS', 'Image')] = { url: image || null };
        properties[schema.get('EVENTS', 'Time')] = { rich_text: [{ text: { content: time || "" } }] };
        properties[schema.get('EVENTS', 'Host')] = { rich_text: [{ text: { content: hostName || "" } }] };
        if (giftType) properties[schema.get('EVENTS', 'GiftType')] = { select: { name: giftType } };
        properties[schema.get('EVENTS', 'GiftDetail')] = { rich_text: [{ text: { content: giftDetail || "" } }] };

        await notionClient.pages.update({ page_id: id, properties });
        res.json({ success: true });
    } catch (error) {
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
                guests: parsedGuests
            };
        });
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


app.delete('/api/tables/:id', async (req, res) => {
    try {
        await notionClient.pages.update({ page_id: req.params.id, archived: true });
        res.json({ success: true });
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