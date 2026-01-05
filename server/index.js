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
    const { email, password } = req.body;
    console.log(`🔐 Intentando login para: ${email}`);
    try {
        if (!DS.USERS) {
            console.error("❌ DS.USERS no está configurado");
            return res.status(500).json({ success: false, message: 'USERS_DB_ID not configured' });
        }

        console.log(`🔍 Buscando usuario en DB: ${DS.USERS}`);

        if (typeof notionClient.databases?.query !== 'function') {
            console.error("❌ notionClient.databases.query no es una función. Estado del cliente:", Object.keys(notionClient));
            throw new Error("El cliente de Notion no está inicializado correctamente.");
        }

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

        const dbPassword = getText(userPage.properties.Password);
        if (dbPassword !== password) {
            return res.status(401).json({ success: false, message: 'Contraseña incorrecta' });
        }

        res.json({
            success: true,
            user: {
                id: userPage.id,
                email: getText(userPage.properties.Email),
                name: getText(userPage.properties.Name),
                role: userPage.properties.Role?.select?.name || 'admin'
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
        const filter = email ? {
            property: "Creator Email",
            email: { equals: email }
        } : undefined;

        const response = await notionClient.databases.query({
            database_id: DS.EVENTS,
            filter
        });

        const events = response.results.map(page => ({
            id: page.id,
            title: getText(page.properties.Title),
            date: getText(page.properties.Date),
            location: getText(page.properties.Location),
            description: getText(page.properties.Description),
            image: getText(page.properties.Image),
            status: page.properties.Status?.select?.name || 'draft'
        }));
        res.json(events);
    } catch (error) {
        console.error("Fetch Events Error:", error);
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
            table: getText(page.properties["Assigned Table"]),
            plusOne: page.properties["Plus One"]?.checkbox || false
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
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`-----------------------------------------`);
    console.log(`🚀 API Server running on port: ${PORT}`);
    console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔑 Notion API Key: ${process.env.NOTION_API_KEY ? 'Present ✅' : 'NOT FOUND ❌'}`);
    console.log(`-----------------------------------------`);
});