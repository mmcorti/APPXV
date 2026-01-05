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
            title: getText(page.properties.Name),
            date: getText(page.properties.Date),
            location: getText(page.properties.Location),
            description: getText(page.properties.Message),
            image: page.properties['Image URL']?.url || '',
            status: 'published' // Default status as not present in DB
        }));
        res.json(events);
    } catch (error) {
        console.error("Fetch Events Error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/events', async (req, res) => {
    try {
        const { title, date, location, description, image, email, time, hosts, giftType, giftDetail } = req.body;

        console.log(`📝 [DEBUG] Creating event: ${title} for ${email}`);

        if (!email) {
            return res.status(400).json({ error: "Email is required to create an event" });
        }

        const newPage = await notionClient.pages.create({
            parent: { database_id: DB.EVENTS },
            properties: {
                "Name": {
                    title: [{ text: { content: title || "Nuevo Evento" } }]
                },
                "Creator Email": {
                    email: email
                },
                "Date": {
                    date: { start: date || new Date().toISOString().split('T')[0] }
                },
                "Location": {
                    rich_text: [{ text: { content: location || "" } }]
                },
                "Message": {
                    rich_text: [{ text: { content: description || "" } }]
                },
                "Image URL": {
                    url: image || null
                },
                "Time": {
                    rich_text: [{ text: { content: time || "" } }]
                },
                "Host Name": {
                    rich_text: [{ text: { content: hosts || "" } }]
                },
                "Gift Type": giftType ? {
                    select: { name: giftType }
                } : undefined,
                "Gift Detail": {
                    rich_text: [{ text: { content: giftDetail || "" } }]
                }
            }
        });

        console.log(`✅ Event Created: ${newPage.id}`);
        res.json({ success: true, id: newPage.id });
    } catch (error) {
        console.error("❌ Error Creating Event:", error);
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

        const guests = response.results.map(page => ({
            id: page.id,
            name: getText(page.properties.Name),
            email: getText(page.properties.Email),
            status: page.properties.Status?.select?.name || 'pending',
            table: getText(page.properties["Assigned Table"])
        }));
        res.json(guests);
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

        const tables = response.results.map(page => ({
            id: page.id,
            name: getText(page.properties.Name),
            capacity: page.properties.Capacity?.number || 0,
            guests: page.properties.Guests?.relation?.map(r => r.id) || []
        }));
        res.json(tables);
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