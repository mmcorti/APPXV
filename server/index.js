import dotenv from 'dotenv';
dotenv.config(); // Carga .env si existe
dotenv.config({ path: '.env.local', override: true }); // Carga .env.local si existe y sobreescribe
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { notion as notionClient, DS, DB } from './notion.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

import '../debug_pkg.js';


// Servir archivos estáticos del Frontend (Vite build)
app.use(express.static(path.join(__dirname, '../dist')));

const getText = (prop) => {
    if (!prop) return '';
    if (prop.title) return prop.title.map(t => t.plain_text).join('');
    if (prop.rich_text) return prop.rich_text.map(t => t.plain_text).join('');
    if (prop.select) return prop.select.name;
    if (prop.email) return prop.email;
    if (prop.date) return prop.date.start;
    if (prop.number) return prop.number;
    if (prop.url) return prop.url;
    if (prop.checkbox) return prop.checkbox;
    if (prop.relation) return prop.relation.map(r => r.id);
    return '';
};

// --- AUTH / LOGIN ---
app.post('/api/login', async (req, res) => {
    const email = req.body.email?.trim();
    const password = req.body.password?.trim();
    console.log(`🔐 Intentando login para: ${email}`);
    try {
        if (!DS.USERS) {
            console.error("❌ DS.USERS no está configurado");
            return res.status(500).json({ success: false, message: 'USERS_DB_ID not configured' });
        }

        console.log(`🔍 Buscando usuario en DB: ${DS.USERS}`);

        if (typeof notionClient.databases?.query !== 'function') {
            console.error("❌ notionClient.databases.query no es una función.");
            console.error("Notion Client Keys:", Object.keys(notionClient));
            if (notionClient.databases) {
                console.error("Type of databases:", typeof notionClient.databases);
                console.error("Databases Keys:", Object.keys(notionClient.databases));
                const proto = Object.getPrototypeOf(notionClient.databases);
                console.error("Databases Proto Keys:", Object.getOwnPropertyNames(proto));
                console.error("Type of query:", typeof notionClient.databases.query);
            }
            throw new Error("El cliente de Notion no está inicializado correctamente.");
        }

        const response = await notionClient.databases.query({
            database_id: DS.USERS,
            filter: {
                property: "Email",
                rich_text: { equals: email }
            }
        });

        const userPage = response.results[0];
        if (!userPage) {
            return res.status(401).json({ success: false, message: 'Usuario no encontrado' });
        }

        const dbEmail = getText(userPage.properties.Email);
        const dbPassword = getText(userPage.properties.PasswordHash || userPage.properties.Password);

        console.log(`🔍 [DEBUG] User Found: ${dbEmail} (ID: ${userPage.id})`);
        console.log(`🔍 [DEBUG] Password Check:`);
        console.log(`   Input: '${password}' (Length: ${password.length})`);
        console.log(`   DB:    '${dbPassword}' (Length: ${dbPassword.length})`);
        console.log(`   Match: ${dbPassword === password}`);

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
        console.log(`🔍 [DEBUG] Fetching events for email: ${email}`);
        const filter = email ? {
            property: "Creator Email",
            email: { equals: email }
        } : undefined;

        console.log(`🔍 [DEBUG] Using Filter:`, JSON.stringify(filter));

        const response = await notionClient.databases.query({
            database_id: DS.EVENTS,
            filter
        });

        console.log(`🔍 [DEBUG] Events found: ${response.results.length}`);

        const events = response.results.map(page => ({
            id: page.id,
            eventName: getText(page.properties.Name),
            date: getText(page.properties.Date),
            location: getText(page.properties.Location),
            message: getText(page.properties.Message),
            image: page.properties['Image URL']?.url || '',
            time: getText(page.properties.Time),
            hostName: getText(page.properties['Host Name']),
            giftType: getText(page.properties['Gift Type']),
            giftDetail: getText(page.properties['Gift Detail']),
            status: 'published'
        }));
        res.json(events);
    } catch (error) {
        console.error("Fetch Events Error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/events', async (req, res) => {
    try {
        const { eventName, date, location, message, image, userEmail, time, hostName, giftType, giftDetail } = req.body;
        console.log(`📝 [DEBUG] Creating event: ${eventName} for ${userEmail}`);

        if (!userEmail) {
            return res.status(400).json({ error: "Email is required to create an event" });
        }

        const newPage = await notionClient.pages.create({
            parent: { database_id: DB.EVENTS },
            properties: {
                "Name": { title: [{ text: { content: eventName || "Nuevo Evento" } }] },
                "Creator Email": { email: userEmail },
                "Date": { date: { start: date || new Date().toISOString().split('T')[0] } },
                "Location": { rich_text: [{ text: { content: location || "" } }] },
                "Message": { rich_text: [{ text: { content: message || "" } }] },
                "Image URL": { url: image || null },
                "Time": { rich_text: [{ text: { content: time || "" } }] },
                "Host Name": { rich_text: [{ text: { content: hostName || "" } }] },
                "Gift Type": giftType ? { select: { name: giftType } } : undefined,
                "Gift Detail": { rich_text: [{ text: { content: giftDetail || "" } }] }
            }
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

        await notionClient.pages.update({
            page_id: id,
            properties: {
                "Name": { title: [{ text: { content: eventName } }] },
                "Date": { date: { start: date } },
                "Location": { rich_text: [{ text: { content: location || "" } }] },
                "Message": { rich_text: [{ text: { content: message || "" } }] },
                "Image URL": { url: image || null },
                "Time": { rich_text: [{ text: { content: time || "" } }] },
                "Host Name": { rich_text: [{ text: { content: hostName || "" } }] },
                "Gift Type": giftType ? { select: { name: giftType } } : undefined,
                "Gift Detail": { rich_text: [{ text: { content: giftDetail || "" } }] }
            }
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- GUESTS ---
app.get('/api/guests', async (req, res) => {
    try {
        const { eventId } = req.query;
        const response = await notionClient.databases.query({
            database_id: DS.GUESTS,
            filter: eventId ? {
                property: "Event",
                relation: { contains: eventId }
            } : undefined
        });

        const guests = response.results.map(page => {
            const props = page.properties;
            const companionNamesStr = getText(props["Companion Names"]);
            let companionNames = { adults: [], teens: [], kids: [], infants: [] };
            try {
                if (companionNamesStr) companionNames = JSON.parse(companionNamesStr);
            } catch (e) { }

            return {
                id: page.id,
                name: getText(props.Name),
                email: getText(props.Email),
                status: props.Status?.select?.name || 'pending',
                allotted: {
                    adults: props["Allotted Adults"]?.number || 1,
                    teens: props["Allotted Teens"]?.number || 0,
                    kids: props["Allotted Kids"]?.number || 0,
                    infants: props["Allotted Infants"]?.number || 0
                },
                confirmed: {
                    adults: props["Confirmed Adults"]?.number || 0,
                    teens: props["Confirmed Teens"]?.number || 0,
                    kids: props["Confirmed Kids"]?.number || 0,
                    infants: props["Confirmed Infants"]?.number || 0
                },
                companionNames,
                sent: props.Sent?.checkbox || false
            };
        });
        res.json(guests);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/guests', async (req, res) => {
    try {
        const { eventId, guest } = req.body;
        const newPage = await notionClient.pages.create({
            parent: { database_id: DB.GUESTS },
            properties: {
                "Name": { title: [{ text: { content: guest.name } }] },
                "Email": { email: guest.email || null },
                "Status": { select: { name: guest.status || 'pending' } },
                "Allotted Adults": { number: guest.allotted?.adults || 0 },
                "Allotted Teens": { number: guest.allotted?.teens || 0 },
                "Allotted Kids": { number: guest.allotted?.kids || 0 },
                "Allotted Infants": { number: guest.allotted?.infants || 0 },
                "Event": { relation: [{ id: eventId }] },
                "Companion Names": { rich_text: [{ text: { content: JSON.stringify(guest.companionNames || {}) } }] }
            }
        });
        res.json({ success: true, id: newPage.id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/guests/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { guest } = req.body;
        await notionClient.pages.update({
            page_id: id,
            properties: {
                "Name": { title: [{ text: { content: guest.name } }] },
                "Email": { email: guest.email || null },
                "Status": { select: { name: guest.status } },
                "Allotted Adults": { number: guest.allotted?.adults || 0 },
                "Allotted Teens": { number: guest.allotted?.teens || 0 },
                "Allotted Kids": { number: guest.allotted?.kids || 0 },
                "Allotted Infants": { number: guest.allotted?.infants || 0 },
                "Confirmed Adults": { number: guest.confirmed?.adults || 0 },
                "Confirmed Teens": { number: guest.confirmed?.teens || 0 },
                "Confirmed Kids": { number: guest.confirmed?.kids || 0 },
                "Confirmed Infants": { number: guest.confirmed?.infants || 0 },
                "Companion Names": { rich_text: [{ text: { content: JSON.stringify(guest.companionNames || {}) } }] },
                "Sent": { checkbox: guest.sent || false }
            }
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.patch('/api/guests/:id/rsvp', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, confirmed, companionNames } = req.body;
        await notionClient.pages.update({
            page_id: id,
            properties: {
                "Status": { select: { name: status } },
                "Confirmed Adults": { number: confirmed?.adults || 0 },
                "Confirmed Teens": { number: confirmed?.teens || 0 },
                "Confirmed Kids": { number: confirmed?.kids || 0 },
                "Confirmed Infants": { number: confirmed?.infants || 0 },
                "Companion Names": { rich_text: [{ text: { content: JSON.stringify(companionNames || {}) } }] }
            }
        });
        res.json({ success: true });
    } catch (error) {
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
        const response = await notionClient.databases.query({
            database_id: DS.TABLES,
            filter: eventId ? {
                property: "Event",
                relation: { contains: eventId }
            } : undefined
        });

        const tables = response.results.map(page => {
            const assignmentsStr = getText(page.properties.Assignments);
            let guests = [];
            try {
                if (assignmentsStr) guests = JSON.parse(assignmentsStr);
            } catch (e) { }

            return {
                id: page.id,
                name: getText(page.properties.Name),
                capacity: page.properties.Capacity?.number || 0,
                guests: guests
            };
        });
        res.json(tables);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/tables', async (req, res) => {
    try {
        const { eventId, table } = req.body;
        const newPage = await notionClient.pages.create({
            parent: { database_id: DB.TABLES },
            properties: {
                "Name": { title: [{ text: { content: table.name } }] },
                "Capacity": { number: table.capacity || 10 },
                "Event": { relation: [{ id: eventId }] }
            }
        });
        res.json({ success: true, id: newPage.id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.patch('/api/tables/:id/guests', async (req, res) => {
    try {
        const { id } = req.params;
        const { assignments } = req.body;
        await notionClient.pages.update({
            page_id: id,
            properties: {
                "Assignments": { rich_text: [{ text: { content: JSON.stringify(assignments) } }] }
            }
        });
        res.json({ success: true });
    } catch (error) {
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

// Redirigir cualquier otra ruta al Frontend
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, '../dist', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`-----------------------------------------`);
    console.log(`🚀 API Server running on port: ${PORT}`);
    console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔑 Notion API Key: ${process.env.NOTION_API_KEY ? 'Present ✅' : 'NOT FOUND ❌'}`);
    console.log(`-----------------------------------------`);
});