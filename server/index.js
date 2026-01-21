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
import { checkLimit, getPlanLimits, isAdmin, getUsageSummary, DEFAULT_PLAN } from './planLimits.js';
import googleAuth from './services/googleAuth.js';
import { uploadImage } from './services/imageUpload.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json({ limit: '10mb' })); // Increased for base64 images

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
    if (!properties || !names || !Array.isArray(names)) return undefined;
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

app.get('/api/debug-mapping', async (req, res) => {
    try {
        await schema.init();
        const info = {
            DS,
            mappings: schema.mappings,
            initialized: schema.initialized
        };
        // Optional: Get actual properties from Notion for EVENTS
        if (DS.EVENTS) {
            const db = await notionClient.databases.retrieve({ database_id: DS.EVENTS });
            info.events_db_actual_properties = Object.keys(db.properties);
        }
        res.json(info);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- IMAGE UPLOAD ---
app.post('/api/upload-image', async (req, res) => {
    try {
        const { image } = req.body;
        if (!image) {
            return res.status(400).json({ error: 'No image provided' });
        }

        console.log('📸 Uploading image to Cloudinary...');
        const result = await uploadImage(image);
        console.log('✅ Image uploaded:', result.url);

        res.json({ success: true, url: result.url, publicId: result.publicId });
    } catch (error) {
        console.error('❌ Image upload failed:', error);
        res.status(500).json({ error: error.message });
    }
});

// --- AI IMAGE GENERATION ---
import { generateImage as geminiGenerateImage, editImage as geminiEditImage } from './services/geminiService.js';

app.post('/api/ai/generate-image', async (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt) {
            return res.status(400).json({ error: 'No prompt provided' });
        }

        console.log('🎨 AI generating image with prompt:', prompt);
        const imageDataUrl = await geminiGenerateImage(prompt);
        console.log('✅ AI image generated successfully');

        // Upload to Cloudinary to get a proper URL (Notion can't handle large base64)
        console.log('📤 Uploading AI image to Cloudinary...');
        const cloudinaryResult = await uploadImage(imageDataUrl, 'appxv-ai-images');
        console.log('✅ AI image uploaded to Cloudinary:', cloudinaryResult.url);

        res.json({ success: true, image: cloudinaryResult.url });
    } catch (error) {
        console.error('❌ AI image generation failed:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/ai/edit-image', async (req, res) => {
    try {
        let { image, prompt } = req.body;
        if (!image || !prompt) {
            return res.status(400).json({ error: 'Image and prompt are required' });
        }

        // If image is a URL, fetch it and convert to base64
        if (image.startsWith('http://') || image.startsWith('https://')) {
            console.log('🔄 Fetching image from URL for editing...');
            const response = await fetch(image);
            const arrayBuffer = await response.arrayBuffer();
            const base64 = Buffer.from(arrayBuffer).toString('base64');
            const contentType = response.headers.get('content-type') || 'image/png';
            image = `data:${contentType};base64,${base64}`;
            console.log('✅ Image fetched and converted to base64');
        }

        console.log('🎨 AI editing image with prompt:', prompt);
        const editedImageDataUrl = await geminiEditImage(image, prompt);
        console.log('✅ AI image edited successfully');

        // Upload to Cloudinary
        console.log('📤 Uploading edited image to Cloudinary...');
        const cloudinaryResult = await uploadImage(editedImageDataUrl, 'appxv-ai-images');
        console.log('✅ Edited image uploaded to Cloudinary:', cloudinaryResult.url);

        res.json({ success: true, image: cloudinaryResult.url });
    } catch (error) {
        console.error('❌ AI image edit failed:', error);
        res.status(500).json({ error: error.message });
    }
});

// --- LOGIN ---
app.post('/api/login', async (req, res) => {
    const email = req.body.email?.trim();
    const password = req.body.password?.trim();
    console.log(`🔐 Intentando login para: ${email}`);

    try {
        // 1. First check Users database (Admins)
        if (DS.USERS) {
            const userResponse = await notionClient.databases.query({
                database_id: DS.USERS,
                filter: {
                    property: "Email",
                    email: { equals: email }
                }
            });

            const userPage = userResponse.results[0];
            if (userPage) {
                const dbPassword = getText(userPage.properties.PasswordHash || userPage.properties.Password);
                if (dbPassword.trim() === password) {
                    console.log(`✅ Admin login successful: ${email}`);
                    return res.json({
                        success: true,
                        user: {
                            id: userPage.id,
                            email: getText(userPage.properties.Email),
                            name: getText(userPage.properties.Name),
                            role: 'admin',
                            permissions: {
                                access_invitados: true,
                                access_mesas: true,
                                access_link: true,
                                access_fotowall: true
                            }
                        }
                    });
                } else {
                    return res.status(401).json({ success: false, message: 'Contraseña incorrecta' });
                }
            }
        }

        // 2. Check Staff database
        // 2. Check Subscribers based on SUBSCRIBERS DB (Formerly Staff)
        if (DS.SUBSCRIBERS) {
            const subResponse = await notionClient.databases.query({
                database_id: DS.SUBSCRIBERS,
                filter: {
                    property: schema.get('SUBSCRIBERS', 'Email'),
                    email: { equals: email }
                }
            });

            const subPage = subResponse.results[0];
            if (subPage) {
                const dbPassword = getText(findProp(subPage.properties, KNOWN_PROPERTIES.SUBSCRIBERS.Password));
                if (dbPassword.trim() === password) {
                    const eventRelation = findProp(subPage.properties, KNOWN_PROPERTIES.SUBSCRIBERS.Event);
                    const eventId = eventRelation?.relation?.[0]?.id || null;

                    // Get plan from database - with debug logging
                    console.log(`🔍 [DEBUG] subPage.properties keys:`, Object.keys(subPage.properties));
                    console.log(`🔍 [DEBUG] Looking for Plan with aliases:`, KNOWN_PROPERTIES.SUBSCRIBERS.Plan);
                    const planProp = findProp(subPage.properties, KNOWN_PROPERTIES.SUBSCRIBERS.Plan);
                    console.log(`🔍 [DEBUG] planProp found:`, planProp);
                    const userPlan = planProp?.select?.name?.toLowerCase() || 'freemium';
                    console.log(`🔍 [DEBUG] Final userPlan:`, userPlan);

                    console.log(`✅ Subscriber login successful: ${email} (plan: ${userPlan})`);
                    return res.json({
                        success: true,
                        user: {
                            id: subPage.id,
                            email: getText(findProp(subPage.properties, KNOWN_PROPERTIES.SUBSCRIBERS.Email)),
                            name: getText(findProp(subPage.properties, KNOWN_PROPERTIES.SUBSCRIBERS.Name)),
                            role: 'subscriber',
                            plan: userPlan,
                            eventId: eventId,
                            permissions: {
                                access_invitados: findProp(subPage.properties, KNOWN_PROPERTIES.SUBSCRIBERS.AccessInvitados)?.checkbox || false,
                                access_mesas: findProp(subPage.properties, KNOWN_PROPERTIES.SUBSCRIBERS.AccessMesas)?.checkbox || false,
                                access_link: findProp(subPage.properties, KNOWN_PROPERTIES.SUBSCRIBERS.AccessLink)?.checkbox || false,
                                access_fotowall: findProp(subPage.properties, KNOWN_PROPERTIES.SUBSCRIBERS.AccessFotowall)?.checkbox || false
                            }
                        }
                    });
                }
            }
        }

        // 3. Check Staff Roster (True Staff / DJs)
        if (DS.STAFF_ROSTER) {
            const rosterResponse = await notionClient.databases.query({
                database_id: DS.STAFF_ROSTER,
                filter: {
                    property: 'Email', // Assuming Email is standard
                    email: { equals: email }
                }
            });

            const rosterPage = rosterResponse.results[0];
            if (rosterPage) {
                // Password is rich_text in Roster
                const dbPassword = getText(rosterPage.properties.Password);
                if (dbPassword && dbPassword.trim() === password) {
                    console.log(`✅ Event Staff login successful: ${email}`);
                    return res.json({
                        success: true,
                        user: {
                            id: rosterPage.id,
                            email: getText(rosterPage.properties.Email),
                            name: getText(rosterPage.properties.Name),
                            role: 'staff',
                            // Assignments must be fetched separately
                            permissions: {}
                        }
                    });
                }
            }
        }

        // 3. User not found in either database
        return res.status(401).json({ success: false, message: 'Usuario no encontrado' });

    } catch (error) {
        console.error("❌ Error en Login:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- GOOGLE OAUTH 2.0 ---

// Step 1: Redirect user to Google login
app.get('/api/auth/google', (req, res) => {
    const state = req.query.state || '';
    const authUrl = googleAuth.getAuthUrl(state);
    console.log('[GOOGLE AUTH] Redirecting to Google:', authUrl);
    res.redirect(authUrl);
});

// Step 2: Handle callback from Google
app.get('/api/auth/google/callback', async (req, res) => {
    try {
        const { code, error } = req.query;

        if (error) {
            console.error('[GOOGLE AUTH] Error from Google:', error);
            return res.redirect('/?error=google_auth_failed');
        }

        if (!code) {
            return res.redirect('/?error=no_code');
        }

        // Exchange code for tokens
        console.log('[GOOGLE AUTH] Exchanging code for tokens...');
        const tokens = await googleAuth.getTokens(code);

        // Get user profile
        console.log('[GOOGLE AUTH] Fetching user profile...');
        const profile = await googleAuth.getUserProfile(tokens.access_token);
        console.log('[GOOGLE AUTH] User profile:', profile.email, profile.name);

        await schema.init();

        // Check if user exists in SUBSCRIBERS by email
        const existingUser = await notionClient.databases.query({
            database_id: DS.SUBSCRIBERS,
            filter: {
                property: schema.get('SUBSCRIBERS', 'Email'),
                email: { equals: profile.email }
            }
        });

        let userId, userName, userPlan;

        if (existingUser.results.length > 0) {
            // User exists - update GoogleId and AvatarUrl
            const userPage = existingUser.results[0];
            userId = userPage.id;
            userName = getText(findProp(userPage.properties, KNOWN_PROPERTIES.SUBSCRIBERS.Name)) || profile.name;
            userPlan = (getText(findProp(userPage.properties, KNOWN_PROPERTIES.SUBSCRIBERS.Plan)) || 'freemium').toLowerCase();

            console.log('[GOOGLE AUTH] Existing user found, updating profile...');
            await notionClient.pages.update({
                page_id: userId,
                properties: {
                    "GoogleId": { rich_text: [{ text: { content: profile.id } }] },
                    "AvatarUrl": { url: profile.picture || null }
                }
            });
        } else {
            // New user - create account
            console.log('[GOOGLE AUTH] Creating new user...');
            const newUser = await notionClient.pages.create({
                parent: { database_id: DS.SUBSCRIBERS },
                properties: {
                    "Name": { title: [{ text: { content: profile.name } }] },
                    "Email": { email: profile.email },
                    "Plan": { select: { name: "freemium" } },
                    "GoogleId": { rich_text: [{ text: { content: profile.id } }] },
                    "AvatarUrl": { url: profile.picture || null },
                    "Password": { rich_text: [{ text: { content: '' } }] } // No password for Google users
                }
            });
            userId = newUser.id;
            userName = profile.name;
            userPlan = 'freemium';
        }

        // Redirect to frontend with user data encoded in URL
        // Use the frontend URL (Vercel) for production, or fallback to root for local
        const FRONTEND_URL = process.env.FRONTEND_URL || '';
        const userData = encodeURIComponent(JSON.stringify({
            id: userId,
            name: userName,
            email: profile.email,
            plan: userPlan,
            role: 'subscriber',
            avatar: profile.picture
        }));

        console.log('[GOOGLE AUTH] Login successful, redirecting to frontend...');
        // Use hash-based query params for HashRouter compatibility
        const redirectUrl = `${FRONTEND_URL}/#/google-callback?googleAuth=success&user=${userData}`;
        console.log('[GOOGLE AUTH] Redirect URL:', redirectUrl);
        res.redirect(redirectUrl);

    } catch (error) {
        console.error('[GOOGLE AUTH] Callback error:', error);
        const FRONTEND_URL = process.env.FRONTEND_URL || '';
        res.redirect(`${FRONTEND_URL}/#/google-callback?error=google_auth_failed&message=` + encodeURIComponent(error.message));
    }
});

// --- EVENTS ---
app.get('/api/events', async (req, res) => {
    try {
        await schema.init();
        const { email, staffId } = req.query;

        let results = [];

        if (staffId && DS.STAFF_ASSIGNMENTS) {
            // 1. Fetch assignments for this staff member
            console.log(`🔍 [DEBUG] Fetching assignments for StaffId: ${staffId}`);
            const assignmentRes = await notionClient.databases.query({
                database_id: DS.STAFF_ASSIGNMENTS,
                filter: {
                    property: 'StaffId',
                    rich_text: { equals: staffId }
                }
            });
            const eventPromises = assignmentRes.results.map(async (r) => {
                const id = getText(r.properties.EventId);
                if (!id) return null;
                try {
                    const page = await notionClient.pages.retrieve({ page_id: id });
                    // Attach permissions to the page object temporarily
                    page._permissions = {
                        access_invitados: findProp(r.properties, KNOWN_PROPERTIES.STAFF_ASSIGNMENTS.AccessInvitados)?.checkbox || false,
                        access_mesas: findProp(r.properties, KNOWN_PROPERTIES.STAFF_ASSIGNMENTS.AccessMesas)?.checkbox || false,
                        access_link: findProp(r.properties, KNOWN_PROPERTIES.STAFF_ASSIGNMENTS.AccessLink)?.checkbox || false,
                        access_fotowall: findProp(r.properties, KNOWN_PROPERTIES.STAFF_ASSIGNMENTS.AccessFotowall)?.checkbox || false,
                    };
                    return page;
                } catch (e) {
                    return null;
                }
            });
            results = (await Promise.all(eventPromises)).filter(p => p);
        } else {
            // Standard filter by Creator Email (or all if undefined?)
            // Existing logic:
            const filter = email ? {
                property: schema.get('EVENTS', 'CreatorEmail'),
                email: { equals: email }
            } : undefined;

            console.log(`🔍 [DEBUG] Querying Events DB: ${DS.EVENTS}`);
            const queryFilterProp = schema.get('EVENTS', 'CreatorEmail');
            console.log(`🔍 [DEBUG] Filter Property: ${queryFilterProp}, Email: ${email}`);

            const response = await notionClient.databases.query({
                database_id: DS.EVENTS,
                filter
            });
            results = response.results;
            console.log(`🔍 [DEBUG] Query returned ${results.length} results`);

            if (results.length === 0 && DS.EVENTS) {
                try {
                    const db = await notionClient.databases.retrieve({ database_id: DS.EVENTS });
                    console.log(`🔍 [DIAGNOSTIC] DB Properties found in Notion:`, Object.keys(db.properties).join(', '));
                    console.log(`🔍 [DIAGNOSTIC] Current Mapping for EVENTS:`, JSON.stringify(schema.mappings.EVENTS, null, 2));
                } catch (err) {
                    console.error("❌ Failed to retrieve DB schema for diagnostic:", err.message);
                }
            } else if (results.length > 0) {
                console.log(`🔍 [DEBUG] First event properties:`, Object.keys(results[0].properties).join(', '));
            }
        }

        const events = results.map((page, index) => {
            const props = page.properties;
            const event = {
                id: page.id,
                eventName: getText(findProp(props, KNOWN_PROPERTIES.EVENTS.Name)),
                hostName: getText(findProp(props, KNOWN_PROPERTIES.EVENTS.Host)),
                date: findProp(props, KNOWN_PROPERTIES.EVENTS.Date)?.date?.start || '',
                time: getText(findProp(props, KNOWN_PROPERTIES.EVENTS.Time)),
                location: getText(findProp(props, KNOWN_PROPERTIES.EVENTS.Location)),
                image: findProp(props, KNOWN_PROPERTIES.EVENTS.Image)?.url || '',
                message: getText(findProp(props, KNOWN_PROPERTIES.EVENTS.Message)),
                giftType: findProp(props, KNOWN_PROPERTIES.EVENTS.GiftType)?.select?.name || 'none',
                giftDetail: getText(findProp(props, KNOWN_PROPERTIES.EVENTS.GiftDetail)),
                capacity: findProp(props, KNOWN_PROPERTIES.EVENTS.Capacity)?.number || 0,
                dressCode: getText(findProp(props, KNOWN_PROPERTIES.EVENTS.DressCode)),
                // FotoWall properties
                fotowall: {
                    albumUrl: findProp(props, KNOWN_PROPERTIES.EVENTS.FW_AlbumUrl)?.url || '',
                    interval: findProp(props, KNOWN_PROPERTIES.EVENTS.FW_Interval)?.number || 5,
                    shuffle: findProp(props, KNOWN_PROPERTIES.EVENTS.FW_Shuffle)?.checkbox || false,
                    overlayTitle: getText(findProp(props, KNOWN_PROPERTIES.EVENTS.FW_OverlayTitle)),
                    mode: findProp(props, KNOWN_PROPERTIES.EVENTS.FW_ModerationMode)?.select?.name || 'manual',
                    filters: (() => {
                        try {
                            return JSON.parse(getText(findProp(props, KNOWN_PROPERTIES.EVENTS.FW_Filters)) || '{}');
                        } catch {
                            return {};
                        }
                    })()
                },
                // Client-side fields
                guests: [],
                tables: [],
                permissions: page._permissions // Pass mapped permissions
            };
            return event;
        });

        res.json(events);
    } catch (error) {
        console.error("❌ Error fetching events:", error);
        res.status(500).json({ error: error.message });
    }
});


app.post('/api/events', async (req, res) => {
    try {
        await schema.init();
        const { eventName, date, location, message, image, userEmail, time, hostName, giftType, giftDetail, userPlan, userRole } = req.body;
        console.log(`📝 [DEBUG] Creating event: ${eventName}`);

        // --- PLAN LIMIT CHECK ---
        // Admins bypass limits
        if (!isAdmin(userRole)) {
            // Count existing events for this user
            const existingEventsRes = await notionClient.databases.query({
                database_id: DS.EVENTS,
                filter: {
                    property: schema.get('EVENTS', 'CreatorEmail'),
                    email: { equals: userEmail }
                }
            });
            const currentEventCount = existingEventsRes.results.length;

            const limitCheck = checkLimit({
                plan: userPlan || DEFAULT_PLAN,
                resource: 'events',
                currentCount: currentEventCount
            });

            if (!limitCheck.allowed) {
                console.log(`⛔ Event limit reached for ${userEmail}: ${currentEventCount}/${limitCheck.limit}`);
                return res.status(403).json({
                    error: limitCheck.reason,
                    limitReached: true,
                    current: currentEventCount,
                    limit: limitCheck.limit
                });
            }
            console.log(`✅ Event limit check passed: ${currentEventCount}/${limitCheck.limit}`);
        }
        // --- END PLAN LIMIT CHECK ---

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

        const { dressCode } = req.body;
        if (dressCode !== undefined) properties[schema.get('EVENTS', 'DressCode')] = { rich_text: [{ text: { content: dressCode || "" } }] };

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

        const { dressCode } = req.body;
        if (dressCode !== undefined) properties[schema.get('EVENTS', 'DressCode')] = { rich_text: [{ text: { content: dressCode || "" } }] };

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
        const { eventId, guest, userPlan, userRole } = req.body;
        console.log("📝 Creating Guest for Event:", eventId);
        console.log("📦 Guest Payload:", JSON.stringify(guest, null, 2));

        // --- PLAN LIMIT CHECK ---
        // Admins bypass limits
        if (!isAdmin(userRole)) {
            // Count existing guests for this event
            const existingGuestsRes = await notionClient.databases.query({
                database_id: DS.GUESTS,
                filter: {
                    property: schema.get('GUESTS', 'Event'),
                    relation: { contains: eventId }
                }
            });
            const currentGuestCount = existingGuestsRes.results.length;

            const limitCheck = checkLimit({
                plan: userPlan || DEFAULT_PLAN,
                resource: 'guests',
                currentCount: currentGuestCount
            });

            if (!limitCheck.allowed) {
                console.log(`⛔ Guest limit reached for event ${eventId}: ${currentGuestCount}/${limitCheck.limit}`);
                return res.status(403).json({
                    error: limitCheck.reason,
                    limitReached: true,
                    current: currentGuestCount,
                    limit: limitCheck.limit
                });
            }
            console.log(`✅ Guest limit check passed: ${currentGuestCount}/${limitCheck.limit}`);
        }
        // --- END PLAN LIMIT CHECK ---

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

// --- SUBSCRIBERS (Formerly Staff) ---
app.get('/api/subscribers', async (req, res) => {
    try {
        await schema.init();
        const { eventId } = req.query;

        // Build filter - if eventId is provided, filter by it
        const queryOptions = {
            database_id: DS.SUBSCRIBERS
        };

        if (eventId) {
            queryOptions.filter = {
                property: schema.get('SUBSCRIBERS', 'Event'),
                relation: { contains: eventId }
            };
        }

        const response = await notionClient.databases.query(queryOptions);

        const staff = response.results.map(page => {
            // Get plan value from select property
            const planProp = findProp(page.properties, KNOWN_PROPERTIES.SUBSCRIBERS.Plan);
            const planValue = planProp?.select?.name || 'freemium';

            return {
                id: page.id,
                name: getText(findProp(page.properties, KNOWN_PROPERTIES.SUBSCRIBERS.Name)),
                email: getText(findProp(page.properties, KNOWN_PROPERTIES.SUBSCRIBERS.Email)),
                plan: planValue,
                permissions: {
                    access_invitados: findProp(page.properties, KNOWN_PROPERTIES.SUBSCRIBERS.AccessInvitados)?.checkbox || false,
                    access_mesas: findProp(page.properties, KNOWN_PROPERTIES.SUBSCRIBERS.AccessMesas)?.checkbox || false,
                    access_link: findProp(page.properties, KNOWN_PROPERTIES.SUBSCRIBERS.AccessLink)?.checkbox || false,
                    access_fotowall: findProp(page.properties, KNOWN_PROPERTIES.SUBSCRIBERS.AccessFotowall)?.checkbox || false
                }
            };
        });

        res.json(staff);
    } catch (error) {
        console.error("❌ Error getting staff:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/subscribers', async (req, res) => {
    try {
        await schema.init();
        const { eventId, name, email, password, permissions, userRole, plan } = req.body;

        // --- ADMIN ONLY CHECK ---
        if (!isAdmin(userRole)) {
            console.log(`⛔ Non-admin attempted to create subscriber: ${userRole}`);
            return res.status(403).json({
                error: 'Solo los administradores pueden crear suscriptores',
                adminRequired: true
            });
        }
        // --- END ADMIN CHECK ---

        if (!eventId || !email || !password) {
            return res.status(400).json({ error: 'eventId, email, and password are required' });
        }

        // Check if staff with this email already exists for this event
        const existing = await notionClient.databases.query({
            database_id: DS.SUBSCRIBERS,
            filter: {
                and: [
                    { property: schema.get('SUBSCRIBERS', 'Email'), email: { equals: email } },
                    { property: schema.get('SUBSCRIBERS', 'Event'), relation: { contains: eventId } }
                ]
            }
        });

        if (existing.results.length > 0) {
            return res.status(409).json({ error: 'Staff member with this email already exists for this event' });
        }

        const properties = {};
        properties[schema.get('SUBSCRIBERS', 'Name')] = { title: [{ text: { content: name || email.split('@')[0] } }] };
        properties[schema.get('SUBSCRIBERS', 'Email')] = { email: email };
        properties[schema.get('SUBSCRIBERS', 'Password')] = { rich_text: [{ text: { content: password } }] };
        properties[schema.get('SUBSCRIBERS', 'Event')] = { relation: [{ id: eventId }] };

        // Save plan - use select type for Plan property
        const planPropName = schema.get('SUBSCRIBERS', 'Plan');
        if (planPropName && plan) {
            properties[planPropName] = { select: { name: plan } };
        }

        properties[schema.get('SUBSCRIBERS', 'AccessInvitados')] = { checkbox: permissions?.access_invitados || false };
        properties[schema.get('SUBSCRIBERS', 'AccessMesas')] = { checkbox: permissions?.access_mesas || false };
        properties[schema.get('SUBSCRIBERS', 'AccessLink')] = { checkbox: permissions?.access_link || false };
        properties[schema.get('SUBSCRIBERS', 'AccessFotowall')] = { checkbox: permissions?.access_fotowall || false };

        const newPage = await notionClient.pages.create({
            parent: { database_id: DS.SUBSCRIBERS },
            properties
        });

        console.log(`✅ Staff created: ${email} for event ${eventId}`);
        res.json({ success: true, id: newPage.id });
    } catch (error) {
        console.error("❌ Error creating staff:", error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/subscribers/:id', async (req, res) => {
    try {
        await schema.init();
        const { id } = req.params;
        const { name, permissions, plan } = req.body;

        const properties = {};
        if (name) properties[schema.get('SUBSCRIBERS', 'Name')] = { title: [{ text: { content: name } }] };

        // Update plan if provided
        const planPropName = schema.get('SUBSCRIBERS', 'Plan');
        if (plan && planPropName) {
            properties[planPropName] = { select: { name: plan } };
        }

        if (permissions) {
            if (permissions.access_invitados !== undefined) properties[schema.get('SUBSCRIBERS', 'AccessInvitados')] = { checkbox: permissions.access_invitados };
            if (permissions.access_mesas !== undefined) properties[schema.get('SUBSCRIBERS', 'AccessMesas')] = { checkbox: permissions.access_mesas };
            if (permissions.access_link !== undefined) properties[schema.get('SUBSCRIBERS', 'AccessLink')] = { checkbox: permissions.access_link };
            if (permissions.access_fotowall !== undefined) properties[schema.get('SUBSCRIBERS', 'AccessFotowall')] = { checkbox: permissions.access_fotowall };
        }

        await notionClient.pages.update({ page_id: id, properties });
        console.log(`✅ Staff updated: ${id}`);
        res.json({ success: true });
    } catch (error) {
        console.error("❌ Error updating staff:", error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/subscribers/:id', async (req, res) => {
    try {
        await notionClient.pages.update({ page_id: req.params.id, archived: true });
        console.log(`✅ Staff deleted: ${req.params.id}`);
        res.json({ success: true });
    } catch (error) {
        console.error("❌ Error deleting staff:", error);
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
        const { url, moderationSettings, plan } = req.body;
        if (!url) return res.status(400).json({ error: "URL requerida" });

        const limits = getPlanLimits(plan);
        const aiFeatures = limits.aiFeatures;
        const photoLimit = limits.maxPhotosPerEvent;

        // Force manual mode if plan doesn't support AI
        let mode = moderationSettings?.mode || 'manual';
        if (mode === 'ai' && !aiFeatures) {
            console.log(`[FOTOWALL] Plan ${plan} does not support AI, forcing manual mode`);
            mode = 'manual';
        }

        console.log(`[FOTOWALL] Getting moderated album: ${url}, mode: ${mode}, plan: ${plan || 'freemium'}, limit: ${photoLimit}`);

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
        let safePhotos = moderatedPhotos.filter(p => p.moderation?.safe === true);
        const blockedCount = moderatedPhotos.filter(p => p.moderation?.safe === false && !p.moderation?.pending).length;
        const pendingCount = moderatedPhotos.filter(p => p.moderation?.pending).length;

        // --- PLAN-BASED PHOTO LIMIT ---
        const totalSafePhotos = safePhotos.length;

        if (safePhotos.length > photoLimit) {
            console.log(`[FOTOWALL] Limiting photos from ${safePhotos.length} to ${photoLimit} (plan: ${plan || 'freemium'})`);
            safePhotos = safePhotos.slice(0, photoLimit);
        }
        // --- END PLAN LIMIT ---

        console.log(`[FOTOWALL] Result: ${safePhotos.length} safe (limit: ${photoLimit}), ${blockedCount} blocked, ${pendingCount} pending`);

        res.json({
            photos: safePhotos,
            stats: {
                total: photos.length,
                safe: totalSafePhotos,
                displayed: safePhotos.length,
                blocked: blockedCount,
                pending: pendingCount,
                limit: photoLimit,
                limitReached: totalSafePhotos > photoLimit
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
        const { url, moderationSettings, plan } = req.body;
        if (!url) return res.status(400).json({ error: "URL requerida" });

        const limits = getPlanLimits(plan);
        const aiFeatures = limits.aiFeatures;
        const photoLimit = limits.maxPhotosPerEvent;

        // Force manual mode if plan doesn't support AI
        let mode = moderationSettings?.mode || 'manual';
        if (mode === 'ai' && !aiFeatures) {
            console.log(`[FOTOWALL] Plan ${plan} does not support AI, forcing manual mode`);
            mode = 'manual';
        }

        console.log(`[FOTOWALL] Getting all photos: ${url}, mode: ${mode}, limit: ${photoLimit}`);

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
            stats: {
                total: photos.length,
                safe: photosWithStatus.filter(p => p.isApproved).length,
                blocked: photosWithStatus.filter(p => p.isBlocked).length,
                pending: photosWithStatus.filter(p => !p.isApproved && !p.isBlocked).length,
                limit: photoLimit,
                plan: plan || 'freemium'
            }
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




// --- STAFF ROSTER ---
app.get('/api/staff-roster', async (req, res) => {
    try {
        await schema.init();
        const { ownerId } = req.query; // Filter by Owner (Subscriber)
        console.log(`🔍 [DEBUG] GET /api/staff-roster: ownerId=${ownerId}, DS.STAFF_ROSTER=${DS.STAFF_ROSTER}`);

        if (!DS.STAFF_ROSTER) {
            console.error("❌ DS.STAFF_ROSTER is UNDEFINED in GET");
            return res.status(500).json({ error: "Configuración de base de datos faltante (STAFF_ROSTER)" });
        }

        const filter = ownerId ? {
            property: 'OwnerId', // Using text field
            rich_text: { equals: ownerId }
        } : undefined;

        const response = await notionClient.databases.query({
            database_id: DS.STAFF_ROSTER,
            filter: filter
        });

        const roster = response.results.map(page => ({
            id: page.id,
            name: getText(page.properties.Name),
            email: getText(page.properties.Email),
            description: getText(page.properties.Description),
            ownerId: getText(page.properties.OwnerId)
        }));

        res.json(roster);
    } catch (error) {
        console.error("❌ Error getting staff roster:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/staff-roster', async (req, res) => {
    try {
        await schema.init();
        const { name, email, password, description, ownerId } = req.body;
        console.log(`📝 [DEBUG] Creating staff roster member: ${email}, Owner: ${ownerId}`);
        console.log(`🔍 [DEBUG] DS.STAFF_ROSTER: ${DS.STAFF_ROSTER}`);

        if (!DS.STAFF_ROSTER) {
            console.error("❌ DS.STAFF_ROSTER is UNDEFINED in POST");
            return res.status(500).json({ error: "Configuración de base de datos faltante (STAFF_ROSTER)" });
        }

        if (!email || !ownerId) {
            return res.status(400).json({ error: 'Email and OwnerId are required' });
        }

        // --- PLAN LIMIT ENFORCEMENT ---
        // 1. Get the user's plan (Subscriber)
        const subPage = await notionClient.pages.retrieve({ page_id: ownerId });
        const plan = (getText(subPage.properties.Plan) || 'freemium').toLowerCase();

        // 2. Get current staff count for this owner
        const currentRoster = await notionClient.databases.query({
            database_id: DS.STAFF_ROSTER,
            filter: {
                property: 'OwnerId',
                rich_text: { equals: ownerId }
            }
        });

        const currentCount = currentRoster.results.length;
        const limits = getPlanLimits(plan);

        if (currentCount >= limits.maxStaffRoster) {
            return res.status(403).json({
                error: `Límite alcanzado: Tu plan ${plan.toUpperCase()} permite hasta ${limits.maxStaffRoster} miembros.`,
                limitReached: true,
                current: currentCount,
                limit: limits.maxStaffRoster
            });
        }
        // --- END PLAN LIMIT ENFORCEMENT ---

        const properties = {
            "Name": { title: [{ text: { content: name || email.split('@')[0] } }] },
            "Email": { email: email },
            "Description": { rich_text: [{ text: { content: description || "" } }] },
            "OwnerId": { rich_text: [{ text: { content: ownerId } }] }
        };
        if (password) {
            properties["Password"] = { rich_text: [{ text: { content: password } }] };
        }

        await notionClient.pages.create({
            parent: { database_id: DS.STAFF_ROSTER },
            properties: properties
        });

        res.json({ success: true });
    } catch (error) {
        console.error("❌ Error creating staff roster:", error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/staff-roster/:id', async (req, res) => {
    try {
        await notionClient.pages.update({
            page_id: req.params.id,
            archived: true
        });
        res.json({ success: true });
    } catch (error) {
        console.error("❌ Error deleting staff roster:", error);
        res.status(500).json({ error: error.message });
    }
});

// --- STAFF ASSIGNMENTS ---
app.get('/api/staff-assignments', async (req, res) => {
    try {
        await schema.init();
        const { eventId, staffId } = req.query;

        const filters = [];
        if (eventId) filters.push({ property: 'EventId', rich_text: { equals: eventId } });
        if (staffId) filters.push({ property: 'StaffId', rich_text: { equals: staffId } });

        const query = {
            database_id: DS.STAFF_ASSIGNMENTS,
        };
        if (filters.length > 0) {
            query.filter = { and: filters };
        }

        const response = await notionClient.databases.query(query);

        const assignments = response.results.map(page => ({
            id: page.id,
            name: getText(page.properties.Name),
            staffId: getText(page.properties.StaffId),
            eventId: getText(page.properties.EventId),
            permissions: {
                access_invitados: page.properties.access_invitados?.checkbox || false,
                access_mesas: page.properties.access_mesas?.checkbox || false,
                access_link: page.properties.access_link?.checkbox || false,
                access_fotowall: page.properties.access_fotowall?.checkbox || false
            }
        }));

        res.json(assignments);
    } catch (error) {
        console.error("❌ Error getting assignments:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/staff-assignments', async (req, res) => {
    try {
        await schema.init();
        const { name, staffId, eventId, permissions } = req.body;

        const properties = {
            "Name": { title: [{ text: { content: name || "Assignment" } }] },
            "StaffId": { rich_text: [{ text: { content: staffId } }] },
            "EventId": { rich_text: [{ text: { content: eventId } }] },
            "access_invitados": { checkbox: permissions?.access_invitados || false },
            "access_mesas": { checkbox: permissions?.access_mesas || false },
            "access_link": { checkbox: permissions?.access_link || false },
            "access_fotowall": { checkbox: permissions?.access_fotowall || false }
        };

        const response = await notionClient.pages.create({
            parent: { database_id: DS.STAFF_ASSIGNMENTS },
            properties: properties
        });

        res.json({ success: true, id: response.id });
    } catch (error) {
        console.error("❌ Error creating assignment:", error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/staff-assignments/:id', async (req, res) => {
    try {
        await notionClient.pages.update({
            page_id: req.params.id,
            archived: true
        });
        res.json({ success: true });
    } catch (error) {
        console.error("❌ Error deleting assignment:", error);
        res.status(500).json({ error: error.message });
    }
});

// --- USAGE SUMMARY ENDPOINT ---
app.get('/api/usage-summary', async (req, res) => {
    try {
        await schema.init();
        let { email, plan } = req.query;

        if (!email) {
            return res.status(400).json({ error: 'email is required' });
        }

        // Always fetch the latest plan from Notion for this user to be sure
        const subPageRes = await notionClient.databases.query({
            database_id: DS.SUBSCRIBERS,
            filter: {
                property: schema.get('SUBSCRIBERS', 'Email'),
                email: { equals: email }
            }
        });

        let detectedPlan = plan || DEFAULT_PLAN;
        if (subPageRes.results.length > 0) {
            const subPage = subPageRes.results[0];
            const planProp = findProp(subPage.properties, KNOWN_PROPERTIES.SUBSCRIBERS.Plan);
            detectedPlan = planProp?.select?.name || detectedPlan;
        }

        // Count events for this user
        const eventsRes = await notionClient.databases.query({
            database_id: DS.EVENTS,
            filter: {
                property: schema.get('EVENTS', 'CreatorEmail'),
                email: { equals: email }
            }
        });
        const eventCount = eventsRes.results.length;

        // Count guests and staff across all events (optional, maybe too expensive?)
        // For now, focus on event count which is the main dashboard blocker

        // Build usage summary
        const summary = getUsageSummary(
            { events: eventCount, guests: 0, staffRoster: 0 },
            detectedPlan.toLowerCase()
        );

        res.json(summary);
    } catch (error) {
        console.error("❌ Error getting usage summary:", error);
        res.status(500).json({ error: error.message });
    }
});

// =============================================
// === EXPENSE CONTROL MODULE ENDPOINTS ===
// =============================================

// --- EXPENSES ---
app.get('/api/events/:eventId/expenses', async (req, res) => {
    try {
        await schema.init();
        const { eventId } = req.params;
        const response = await notionClient.databases.query({
            database_id: DS.EXPENSES,
            filter: {
                property: schema.get('EXPENSES', 'Event'),
                relation: { contains: eventId }
            }
        });
        const expenses = response.results.map(page => {
            const p = page.properties;
            return {
                id: page.id,
                name: getText(findProp(p, schema.getAliases('EXPENSES', 'Name'))),
                category: getText(findProp(p, schema.getAliases('EXPENSES', 'Category'))),
                supplier: getText(findProp(p, schema.getAliases('EXPENSES', 'Supplier'))),
                total: parseFloat(getText(findProp(p, schema.getAliases('EXPENSES', 'Total')))) || 0,
                paid: parseFloat(getText(findProp(p, schema.getAliases('EXPENSES', 'Paid')))) || 0,
                status: getText(findProp(p, schema.getAliases('EXPENSES', 'Status')))
            };
        });
        res.json(expenses);
    } catch (error) {
        console.error("❌ Error fetching expenses:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/events/:eventId/expenses', async (req, res) => {
    try {
        await schema.init();
        const { eventId } = req.params;
        const { name, category, supplier, total, paid, status } = req.body;
        const properties = {};
        properties[schema.get('EXPENSES', 'Name')] = { title: [{ text: { content: name || '' } }] };
        properties[schema.get('EXPENSES', 'Category')] = { rich_text: [{ text: { content: category || '' } }] };
        properties[schema.get('EXPENSES', 'Supplier')] = { rich_text: [{ text: { content: supplier || '' } }] };
        properties[schema.get('EXPENSES', 'Total')] = { number: total || 0 };
        properties[schema.get('EXPENSES', 'Paid')] = { number: paid || 0 };
        if (status) properties[schema.get('EXPENSES', 'Status')] = { select: { name: status } };
        properties[schema.get('EXPENSES', 'Event')] = { relation: [{ id: eventId }] };

        const newPage = await notionClient.pages.create({
            parent: { database_id: DB.EXPENSES },
            properties
        });
        res.json({ success: true, id: newPage.id });
    } catch (error) {
        console.error("❌ Error creating expense:", error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/expenses/:id', async (req, res) => {
    try {
        await schema.init();
        const { id } = req.params;
        const { name, category, supplier, total, paid, status } = req.body;
        const properties = {};
        if (name !== undefined) properties[schema.get('EXPENSES', 'Name')] = { title: [{ text: { content: name } }] };
        if (category !== undefined) properties[schema.get('EXPENSES', 'Category')] = { rich_text: [{ text: { content: category } }] };
        if (supplier !== undefined) properties[schema.get('EXPENSES', 'Supplier')] = { rich_text: [{ text: { content: supplier } }] };
        if (total !== undefined) properties[schema.get('EXPENSES', 'Total')] = { number: total };
        if (paid !== undefined) properties[schema.get('EXPENSES', 'Paid')] = { number: paid };
        if (status !== undefined) properties[schema.get('EXPENSES', 'Status')] = { select: { name: status } };

        await notionClient.pages.update({ page_id: id, properties });
        res.json({ success: true });
    } catch (error) {
        console.error("❌ Error updating expense:", error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/expenses/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await notionClient.pages.update({ page_id: id, archived: true });
        res.json({ success: true });
    } catch (error) {
        console.error("❌ Error deleting expense:", error);
        res.status(500).json({ error: error.message });
    }
});

// --- SUPPLIERS ---
app.get('/api/events/:eventId/suppliers', async (req, res) => {
    try {
        await schema.init();
        const { eventId } = req.params;
        const response = await notionClient.databases.query({
            database_id: DS.SUPPLIERS,
            filter: {
                property: schema.get('SUPPLIERS', 'Event'),
                relation: { contains: eventId }
            }
        });
        const suppliers = response.results.map(page => {
            const p = page.properties;
            return {
                id: page.id,
                name: getText(findProp(p, schema.getAliases('SUPPLIERS', 'Name'))),
                category: getText(findProp(p, schema.getAliases('SUPPLIERS', 'Category'))),
                phone: getText(findProp(p, schema.getAliases('SUPPLIERS', 'Phone'))),
                email: getText(findProp(p, schema.getAliases('SUPPLIERS', 'Email')))
            };
        });
        res.json(suppliers);
    } catch (error) {
        console.error("❌ Error fetching suppliers:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/events/:eventId/suppliers', async (req, res) => {
    try {
        await schema.init();
        const { eventId } = req.params;
        const { name, category, phone, email } = req.body;
        const properties = {};
        properties[schema.get('SUPPLIERS', 'Name')] = { title: [{ text: { content: name || '' } }] };
        properties[schema.get('SUPPLIERS', 'Category')] = { rich_text: [{ text: { content: category || '' } }] };
        properties[schema.get('SUPPLIERS', 'Phone')] = { rich_text: [{ text: { content: phone || '' } }] };
        properties[schema.get('SUPPLIERS', 'Email')] = { email: email || null };
        properties[schema.get('SUPPLIERS', 'Event')] = { relation: [{ id: eventId }] };

        const newPage = await notionClient.pages.create({
            parent: { database_id: DB.SUPPLIERS },
            properties
        });
        res.json({ success: true, id: newPage.id });
    } catch (error) {
        console.error("❌ Error creating supplier:", error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/suppliers/:id', async (req, res) => {
    try {
        await schema.init();
        const { id } = req.params;
        const { name, category, phone, email } = req.body;
        const properties = {};
        if (name !== undefined) properties[schema.get('SUPPLIERS', 'Name')] = { title: [{ text: { content: name } }] };
        if (category !== undefined) properties[schema.get('SUPPLIERS', 'Category')] = { rich_text: [{ text: { content: category } }] };
        if (phone !== undefined) properties[schema.get('SUPPLIERS', 'Phone')] = { rich_text: [{ text: { content: phone } }] };
        if (email !== undefined) properties[schema.get('SUPPLIERS', 'Email')] = { email: email || null };

        await notionClient.pages.update({ page_id: id, properties });
        res.json({ success: true });
    } catch (error) {
        console.error("❌ Error updating supplier:", error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/suppliers/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await notionClient.pages.update({ page_id: id, archived: true });
        res.json({ success: true });
    } catch (error) {
        console.error("❌ Error deleting supplier:", error);
        res.status(500).json({ error: error.message });
    }
});

// --- EXPENSE CATEGORIES ---
app.get('/api/events/:eventId/expense-categories', async (req, res) => {
    try {
        await schema.init();
        const { eventId } = req.params;
        const response = await notionClient.databases.query({
            database_id: DS.EXPENSE_CATEGORIES,
            filter: {
                property: schema.get('EXPENSE_CATEGORIES', 'Event'),
                relation: { contains: eventId }
            }
        });
        const categories = response.results.map(page => {
            const p = page.properties;
            return {
                id: page.id,
                name: getText(findProp(p, schema.getAliases('EXPENSE_CATEGORIES', 'Name'))),
                icon: getText(findProp(p, schema.getAliases('EXPENSE_CATEGORIES', 'Icon'))),
                subtitle: getText(findProp(p, schema.getAliases('EXPENSE_CATEGORIES', 'Subtitle')))
            };
        });
        res.json(categories);
    } catch (error) {
        console.error("❌ Error fetching expense categories:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/events/:eventId/expense-categories', async (req, res) => {
    try {
        await schema.init();
        const { eventId } = req.params;
        const { name, icon, subtitle } = req.body;
        const properties = {};
        properties[schema.get('EXPENSE_CATEGORIES', 'Name')] = { title: [{ text: { content: name || '' } }] };
        properties[schema.get('EXPENSE_CATEGORIES', 'Icon')] = { rich_text: [{ text: { content: icon || 'category' } }] };
        properties[schema.get('EXPENSE_CATEGORIES', 'Subtitle')] = { rich_text: [{ text: { content: subtitle || '' } }] };
        properties[schema.get('EXPENSE_CATEGORIES', 'Event')] = { relation: [{ id: eventId }] };

        const newPage = await notionClient.pages.create({
            parent: { database_id: DB.EXPENSE_CATEGORIES },
            properties
        });
        res.json({ success: true, id: newPage.id });
    } catch (error) {
        console.error("❌ Error creating expense category:", error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/expense-categories/:id', async (req, res) => {
    try {
        await schema.init();
        const { id } = req.params;
        const { name, icon, subtitle } = req.body;
        const properties = {};
        if (name !== undefined) properties[schema.get('EXPENSE_CATEGORIES', 'Name')] = { title: [{ text: { content: name } }] };
        if (icon !== undefined) properties[schema.get('EXPENSE_CATEGORIES', 'Icon')] = { rich_text: [{ text: { content: icon } }] };
        if (subtitle !== undefined) properties[schema.get('EXPENSE_CATEGORIES', 'Subtitle')] = { rich_text: [{ text: { content: subtitle } }] };

        await notionClient.pages.update({ page_id: id, properties });
        res.json({ success: true });
    } catch (error) {
        console.error("❌ Error updating expense category:", error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/expense-categories/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await notionClient.pages.update({ page_id: id, archived: true });
        res.json({ success: true });
    } catch (error) {
        console.error("❌ Error deleting expense category:", error);
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