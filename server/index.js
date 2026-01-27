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
import { raffleGameService } from './services/raffleGameService.js';
import { confessionsGameService } from './services/confessionsGameService.js';
import { impostorGameService } from './services/impostorGameService.js';

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
import {
    generateImage as geminiGenerateImage,
    editImage as geminiEditImage,
    generateTriviaQuestions
} from './services/geminiService.js';

app.post('/api/trivia/generate-questions', async (req, res) => {
    try {
        const { theme, count } = req.body;
        if (!theme) {
            return res.status(400).json({ error: 'Theme is required' });
        }

        console.log(`🤖 AI generating ${count || 5} trivia questions for theme: ${theme}`);
        const questions = await generateTriviaQuestions(theme, count || 5);
        console.log(`✅ AI generated ${questions.length} questions`);

        res.json({ success: true, questions });
    } catch (error) {
        console.error('❌ AI trivia generation failed:', error);
        res.status(500).json({ error: error.message });
    }
});

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
                                access_fotowall: true,
                                access_games: true
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
                                access_fotowall: findProp(subPage.properties, KNOWN_PROPERTIES.SUBSCRIBERS.AccessFotowall)?.checkbox || false,
                                access_games: findProp(subPage.properties, KNOWN_PROPERTIES.SUBSCRIBERS.AccessGames)?.checkbox || false
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
        const { code, error, state } = req.query;

        if (error) {
            console.error('[GOOGLE AUTH] Error from Google:', error);
            return res.redirect(`${state || ''}/?error=google_auth_failed`);
        }

        if (!code) {
            return res.redirect(`${state || ''}/?error=no_code`);
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
        // Use state (origin) if provided, otherwise fallback to configured FRONTEND_URL
        const FRONTEND_URL = state || process.env.FRONTEND_URL || '';
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
        const FRONTEND_URL = state || process.env.FRONTEND_URL || '';
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
                    page._permissions = {
                        access_invitados: findProp(r.properties, KNOWN_PROPERTIES.STAFF_ASSIGNMENTS.AccessInvitados)?.checkbox || false,
                        access_mesas: findProp(r.properties, KNOWN_PROPERTIES.STAFF_ASSIGNMENTS.AccessMesas)?.checkbox || false,
                        access_link: findProp(r.properties, KNOWN_PROPERTIES.STAFF_ASSIGNMENTS.AccessLink)?.checkbox || false,
                        access_fotowall: findProp(r.properties, KNOWN_PROPERTIES.STAFF_ASSIGNMENTS.AccessFotowall)?.checkbox || false,
                        access_games: findProp(r.properties, KNOWN_PROPERTIES.STAFF_ASSIGNMENTS.AccessGames)?.checkbox || false,
                    };

                    // Fetch owner's plan from CreatorEmail
                    const creatorEmail = getText(findProp(page.properties, KNOWN_PROPERTIES.EVENTS.CreatorEmail));

                    // Check if the creator is an admin (exists in DS.USERS) - if so, staff inherits VIP
                    let isCreatorAdmin = false;
                    if (creatorEmail && DS.USERS) {
                        try {
                            const adminCheck = await notionClient.databases.query({
                                database_id: DS.USERS,
                                filter: {
                                    property: schema.get('USERS', 'Email'),
                                    email: { equals: creatorEmail }
                                }
                            });
                            isCreatorAdmin = adminCheck.results.length > 0;
                        } catch (e) {
                            console.warn('Could not check admin status:', e.message);
                        }
                    }

                    if (isCreatorAdmin) {
                        page._ownerPlan = 'vip';
                        console.log(`📋 [Staff] Event owner ${creatorEmail} is ADMIN - staff gets VIP plan`);
                    } else if (creatorEmail && DS.SUBSCRIBERS) {
                        try {
                            const subscriberRes = await notionClient.databases.query({
                                database_id: DS.SUBSCRIBERS,
                                filter: {
                                    property: schema.get('SUBSCRIBERS', 'Email'),
                                    email: { equals: creatorEmail }
                                }
                            });
                            if (subscriberRes.results.length > 0) {
                                const subPage = subscriberRes.results[0];
                                const planProp = findProp(subPage.properties, KNOWN_PROPERTIES.SUBSCRIBERS.Plan);
                                page._ownerPlan = planProp?.select?.name?.toLowerCase() || 'freemium';
                                console.log(`📋 [Staff] Event owner ${creatorEmail} has plan: ${page._ownerPlan}`);
                            } else {
                                page._ownerPlan = 'freemium';
                            }
                        } catch (e) {
                            console.warn('Could not fetch owner plan:', e.message);
                            page._ownerPlan = 'freemium';
                        }
                    } else {
                        page._ownerPlan = 'freemium';
                    }

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
                permissions: page._permissions, // Pass mapped permissions
                ownerPlan: page._ownerPlan // Pass owner's plan for staff permission inheritance
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
                access_fotowall: page.properties.access_fotowall?.checkbox || false,
                access_games: page.properties.access_games?.checkbox || false
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
            "access_fotowall": { checkbox: permissions?.access_fotowall || false },
            "access_games": { checkbox: permissions?.access_games || false }
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
                status: getText(findProp(p, schema.getAliases('EXPENSES', 'Status'))),
                staff: getText(findProp(p, schema.getAliases('EXPENSES', 'Staff')))
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
        const { name, category, supplier, total, paid, status, staff } = req.body;
        const properties = {};
        properties[schema.get('EXPENSES', 'Name')] = { title: [{ text: { content: name || '' } }] };
        properties[schema.get('EXPENSES', 'Category')] = { rich_text: [{ text: { content: category || '' } }] };
        properties[schema.get('EXPENSES', 'Supplier')] = { rich_text: [{ text: { content: supplier || '' } }] };
        properties[schema.get('EXPENSES', 'Total')] = { number: total || 0 };
        properties[schema.get('EXPENSES', 'Paid')] = { number: paid || 0 };
        if (status) properties[schema.get('EXPENSES', 'Status')] = { select: { name: status } };
        if (staff) properties[schema.get('EXPENSES', 'Staff')] = { rich_text: [{ text: { content: staff } }] };
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
        const { name, category, supplier, total, paid, status, staff } = req.body;
        const properties = {};
        if (name !== undefined) properties[schema.get('EXPENSES', 'Name')] = { title: [{ text: { content: name } }] };
        if (category !== undefined) properties[schema.get('EXPENSES', 'Category')] = { rich_text: [{ text: { content: category } }] };
        if (supplier !== undefined) properties[schema.get('EXPENSES', 'Supplier')] = { rich_text: [{ text: { content: supplier } }] };
        if (total !== undefined) properties[schema.get('EXPENSES', 'Total')] = { number: total };
        if (paid !== undefined) properties[schema.get('EXPENSES', 'Paid')] = { number: paid };
        if (status !== undefined) properties[schema.get('EXPENSES', 'Status')] = { select: { name: status } };
        if (staff !== undefined) properties[schema.get('EXPENSES', 'Staff')] = { rich_text: [{ text: { content: staff } }] };

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

// ========================================
// PAYMENT PARTICIPANTS ENDPOINTS
// ========================================
app.get('/api/events/:eventId/participants', async (req, res) => {
    try {
        await schema.init();
        const { eventId } = req.params;
        const response = await notionClient.databases.query({
            database_id: DS.PAYMENT_PARTICIPANTS,
            filter: { property: schema.get('PAYMENT_PARTICIPANTS', 'EventId'), rich_text: { equals: eventId } }
        });
        const participants = response.results.map(p => ({
            id: p.id,
            name: p.properties[schema.get('PAYMENT_PARTICIPANTS', 'Name')]?.title?.[0]?.text?.content || '',
            eventId: p.properties[schema.get('PAYMENT_PARTICIPANTS', 'EventId')]?.rich_text?.[0]?.text?.content || '',
            weight: p.properties[schema.get('PAYMENT_PARTICIPANTS', 'Weight')]?.number || 1
        }));
        res.json(participants);
    } catch (error) {
        console.error("❌ Error fetching participants:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/events/:eventId/participants', async (req, res) => {
    try {
        await schema.init();
        const { eventId } = req.params;
        const { name, weight = 1 } = req.body;
        const response = await notionClient.pages.create({
            parent: { database_id: DB.PAYMENT_PARTICIPANTS },
            properties: {
                [schema.get('PAYMENT_PARTICIPANTS', 'Name')]: { title: [{ text: { content: name } }] },
                [schema.get('PAYMENT_PARTICIPANTS', 'EventId')]: { rich_text: [{ text: { content: eventId } }] },
                [schema.get('PAYMENT_PARTICIPANTS', 'Weight')]: { number: weight }
            }
        });
        res.json({
            id: response.id,
            name,
            eventId,
            weight
        });
    } catch (error) {
        console.error("❌ Error creating participant:", error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/participants/:id', async (req, res) => {
    try {
        await schema.init();
        const { id } = req.params;
        const { name, weight } = req.body;
        const properties = {};
        if (name !== undefined) properties[schema.get('PAYMENT_PARTICIPANTS', 'Name')] = { title: [{ text: { content: name } }] };
        if (weight !== undefined) properties[schema.get('PAYMENT_PARTICIPANTS', 'Weight')] = { number: weight };
        await notionClient.pages.update({ page_id: id, properties });
        res.json({ success: true });
    } catch (error) {
        console.error("❌ Error updating participant:", error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/participants/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await notionClient.pages.update({ page_id: id, archived: true });
        res.json({ success: true });
    } catch (error) {
        console.error("❌ Error deleting participant:", error);
        res.status(500).json({ error: error.message });
    }
});

// ========================================
// PAYMENTS ENDPOINTS
// ========================================
app.get('/api/expenses/:expenseId/payments', async (req, res) => {
    try {
        await schema.init();
        const { expenseId } = req.params;
        const response = await notionClient.databases.query({
            database_id: DS.PAYMENTS,
            filter: { property: schema.get('PAYMENTS', 'ExpenseId'), rich_text: { equals: expenseId } }
        });
        const payments = response.results.map(p => ({
            id: p.id,
            expenseId: p.properties[schema.get('PAYMENTS', 'ExpenseId')]?.rich_text?.[0]?.text?.content || '',
            participantId: p.properties[schema.get('PAYMENTS', 'ParticipantId')]?.rich_text?.[0]?.text?.content || '',
            amount: p.properties[schema.get('PAYMENTS', 'Amount')]?.number || 0,
            date: p.properties[schema.get('PAYMENTS', 'Date')]?.date?.start || null,
            description: p.properties[schema.get('PAYMENTS', 'Description')]?.title?.[0]?.text?.content || '',
            receiptUrl: p.properties[schema.get('PAYMENTS', 'ReceiptURL')]?.url || ''
        }));
        res.json(payments);
    } catch (error) {
        console.error("❌ Error fetching payments:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/expenses/:expenseId/payments', async (req, res) => {
    try {
        await schema.init();
        const { expenseId } = req.params;
        const { participantId, amount, date, description, receiptUrl } = req.body;

        const properties = {
            [schema.get('PAYMENTS', 'ExpenseId')]: { rich_text: [{ text: { content: expenseId } }] },
            [schema.get('PAYMENTS', 'ParticipantId')]: { rich_text: [{ text: { content: participantId } }] },
            [schema.get('PAYMENTS', 'Amount')]: { number: amount }
        };

        if (date) properties[schema.get('PAYMENTS', 'Date')] = { date: { start: date } };
        if (description) properties[schema.get('PAYMENTS', 'Description')] = { title: [{ text: { content: description } }] };
        if (receiptUrl) properties[schema.get('PAYMENTS', 'ReceiptURL')] = { url: receiptUrl };

        const response = await notionClient.pages.create({
            parent: { database_id: DB.PAYMENTS },
            properties
        });
        res.json({
            id: response.id,
            expenseId,
            participantId,
            amount,
            date,
            description,
            receiptUrl
        });
    } catch (error) {
        console.error("❌ Error creating payment:", error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/payments/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await notionClient.pages.update({ page_id: id, archived: true });
        res.json({ success: true });
    } catch (error) {
        console.error("❌ Error deleting payment:", error);
        res.status(500).json({ error: error.message });
    }
});

// ========================================
// BALANCES ENDPOINT (calculate who owes whom)
// ========================================
app.get('/api/events/:eventId/balances', async (req, res) => {
    try {
        await schema.init();
        const { eventId } = req.params;

        console.log('📊 Calculating balances for event:', eventId);

        // Get all participants
        const participantsRes = await notionClient.databases.query({
            database_id: DS.PAYMENT_PARTICIPANTS,
            filter: { property: schema.get('PAYMENT_PARTICIPANTS', 'EventId'), rich_text: { equals: eventId } }
        });
        const participants = participantsRes.results.map(p => ({
            id: p.id,
            name: p.properties[schema.get('PAYMENT_PARTICIPANTS', 'Name')]?.title?.[0]?.text?.content || '',
            weight: p.properties[schema.get('PAYMENT_PARTICIPANTS', 'Weight')]?.number || 1
        }));
        console.log('   Found participants:', participants.length, participants.map(p => p.name));

        // Get all expenses for event
        const expensesRes = await notionClient.databases.query({
            database_id: DS.EXPENSES,
            filter: { property: schema.get('EXPENSES', 'Event'), relation: { contains: eventId } }
        });
        const expenses = expensesRes.results;
        const expenseIds = expenses.map(e => e.id);
        console.log('   Found expenses:', expenses.length);

        // Get all payments
        let allPayments = [];
        for (const expenseId of expenseIds) {
            const paymentsRes = await notionClient.databases.query({
                database_id: DS.PAYMENTS,
                filter: { property: schema.get('PAYMENTS', 'ExpenseId'), rich_text: { equals: expenseId } }
            });
            allPayments = allPayments.concat(paymentsRes.results.map(p => ({
                expenseId: p.properties[schema.get('PAYMENTS', 'ExpenseId')]?.rich_text?.[0]?.text?.content || '',
                participantId: p.properties[schema.get('PAYMENTS', 'ParticipantId')]?.rich_text?.[0]?.text?.content || '',
                amount: p.properties[schema.get('PAYMENTS', 'Amount')]?.number || 0
            })));
        }

        // Calculate totals
        const totalExpenses = expenses.reduce((sum, e) => {
            return sum + (e.properties[schema.get('EXPENSES', 'Total')]?.number || 0);
        }, 0);

        // Calculate weighted shares
        const totalWeight = participants.reduce((sum, p) => sum + p.weight, 0);

        // Calculate balance per participant
        const balances = participants.map(p => {
            const fairShare = totalWeight > 0 ? (totalExpenses * p.weight) / totalWeight : 0;
            const totalPaid = allPayments
                .filter(pay => pay.participantId === p.id)
                .reduce((sum, pay) => sum + pay.amount, 0);
            return {
                participantId: p.id,
                name: p.name,
                weight: p.weight,
                fairShare,
                totalPaid,
                balance: totalPaid - fairShare // positive = owed money, negative = owes money
            };
        });

        // Calculate settlements (who pays whom)
        const debtors = balances.filter(b => b.balance < 0).map(b => ({ ...b, owes: Math.abs(b.balance) }));
        const creditors = balances.filter(b => b.balance > 0).map(b => ({ ...b, owed: b.balance }));

        const settlements = [];
        let i = 0, j = 0;
        while (i < debtors.length && j < creditors.length) {
            const debtor = debtors[i];
            const creditor = creditors[j];
            const amount = Math.min(debtor.owes, creditor.owed);
            if (amount > 0.01) { // ignore tiny amounts
                settlements.push({
                    from: { id: debtor.participantId, name: debtor.name },
                    to: { id: creditor.participantId, name: creditor.name },
                    amount: Math.round(amount * 100) / 100
                });
            }
            debtor.owes -= amount;
            creditor.owed -= amount;
            if (debtor.owes < 0.01) i++;
            if (creditor.owed < 0.01) j++;
        }

        res.json({
            totalExpenses,
            totalWeight,
            balances,
            settlements
        });
    } catch (error) {
        console.error("❌ Error calculating balances:", error);
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// TRIVIA GAME API - Real-time Cross-Device Sync via SSE
// =====================================================

// In-memory trivia game state (per event)
const triviaGames = {};

// SSE clients (per event)
const triviaClients = {};

// Helper to get or create game state
const getTriviaState = (eventId) => {
    if (!triviaGames[eventId]) {
        triviaGames[eventId] = {
            eventId,
            status: 'WAITING',
            hostPlan: 'freemium', // Default
            questions: [],
            currentQuestionIndex: -1,
            questionStartTime: null,
            isAnswerRevealed: false,
            backgroundUrl: 'https://res.cloudinary.com/djetzdm5n/image/upload/v1769432962/appxv-events/jp6fbqmcpg53lfbhtm42.png',
            players: {}
        };
    }
    return triviaGames[eventId];
};

// Broadcast state to all SSE clients for an event
const broadcastTriviaState = (eventId) => {
    const state = getTriviaState(eventId);
    const clients = triviaClients[eventId] || [];
    const data = JSON.stringify(state);

    clients.forEach((res) => {
        try {
            res.write(`data: ${data}\n\n`);
        } catch (e) {
            console.error('SSE write error:', e);
        }
    });
    console.log(`📡 [TRIVIA] Broadcast to ${clients.length} clients for event ${eventId.substring(0, 8)}...`);
};

// SSE endpoint for real-time updates
app.get('/api/trivia/:eventId/stream', (req, res) => {
    const { eventId } = req.params;
    const { clientId } = req.query; // Track who is connecting
    console.log(`📡 [TRIVIA SSE] Client ${clientId || 'unknown'} connected for event ${eventId.substring(0, 8)}...`);

    // SSE headers
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        'Access-Control-Allow-Origin': '*'
    });
    res.write(': ok\n\n');

    // Add client to list
    if (!triviaClients[eventId]) {
        triviaClients[eventId] = [];
    }
    triviaClients[eventId].push(res);

    // Send current state immediately
    const state = getTriviaState(eventId);
    res.write(`data: ${JSON.stringify(state)}\n\n`);

    // Keep-alive ping every 30 seconds
    const keepAlive = setInterval(() => {
        res.write(': ping\n\n');
    }, 30000);

    // Remove client on disconnect
    req.on('close', () => {
        console.log(`📡 [TRIVIA SSE] Client ${clientId || 'unknown'} disconnected from event ${eventId.substring(0, 8)}...`);
        clearInterval(keepAlive);
        triviaClients[eventId] = triviaClients[eventId].filter(c => c !== res);

        // Remove player if they were a participant
        if (clientId && state.players[clientId]) {
            console.log(`👋 [TRIVIA] Removing player ${state.players[clientId].name} due to disconnect`);
            delete state.players[clientId];
            broadcastTriviaState(eventId);
        }
    });
});

// Get current game state
app.get('/api/trivia/:eventId', (req, res) => {
    const { eventId } = req.params;
    const state = getTriviaState(eventId);
    res.json(state);
});

// Add question
app.post('/api/trivia/:eventId/questions', (req, res) => {
    const { eventId } = req.params;
    const { text, options, correctOption, durationSeconds, userPlan, userRole } = req.body;

    const state = getTriviaState(eventId);
    if (userPlan) state.hostPlan = userPlan; // Update plan from admin action

    // Plan limit check (admins bypass)
    if (!isAdmin(userRole)) {
        const limitCheck = checkLimit({
            plan: userPlan || 'freemium',
            resource: 'triviaQuestions',
            currentCount: state.questions.length
        });

        if (!limitCheck.allowed) {
            return res.status(403).json({
                error: limitCheck.reason,
                limitReached: true,
                current: state.questions.length,
                limit: limitCheck.limit
            });
        }
    }

    const newQuestion = {
        id: crypto.randomUUID(),
        text,
        options,
        correctOption,
        durationSeconds: durationSeconds || 10
    };
    state.questions.push(newQuestion);

    broadcastTriviaState(eventId);
    res.json({ success: true, question: newQuestion });
});

// Update question
app.put('/api/trivia/:eventId/questions/:questionId', (req, res) => {
    const { eventId, questionId } = req.params;
    const updates = req.body;

    const state = getTriviaState(eventId);
    const idx = state.questions.findIndex(q => q.id === questionId);
    if (idx >= 0) {
        state.questions[idx] = { ...state.questions[idx], ...updates };
        broadcastTriviaState(eventId);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Question not found' });
    }
});

// Delete question
app.delete('/api/trivia/:eventId/questions/:questionId', (req, res) => {
    const { eventId, questionId } = req.params;

    const state = getTriviaState(eventId);
    state.questions = state.questions.filter(q => q.id !== questionId);

    broadcastTriviaState(eventId);
    res.json({ success: true });
});

// Start game
app.post('/api/trivia/:eventId/start', (req, res) => {
    const { eventId } = req.params;
    const state = getTriviaState(eventId);

    state.status = 'PLAYING';
    state.currentQuestionIndex = -1;
    state.isAnswerRevealed = false;

    broadcastTriviaState(eventId);
    res.json({ success: true });
});

// Next question
app.post('/api/trivia/:eventId/next', (req, res) => {
    const { eventId } = req.params;
    const state = getTriviaState(eventId);

    const nextIndex = state.currentQuestionIndex + 1;
    if (nextIndex >= state.questions.length) {
        return res.json({ success: false, message: 'No more questions' });
    }

    state.currentQuestionIndex = nextIndex;
    state.questionStartTime = Date.now();
    state.isAnswerRevealed = false;

    broadcastTriviaState(eventId);
    res.json({ success: true, questionIndex: nextIndex });
});

// Reveal answer
app.post('/api/trivia/:eventId/reveal', (req, res) => {
    const { eventId } = req.params;
    const state = getTriviaState(eventId);

    state.isAnswerRevealed = true;

    broadcastTriviaState(eventId);
    res.json({ success: true });
});

// End game
app.post('/api/trivia/:eventId/end', (req, res) => {
    const { eventId } = req.params;
    const state = getTriviaState(eventId);

    state.status = 'FINISHED';
    state.currentQuestionIndex = -1;

    broadcastTriviaState(eventId);
    res.json({ success: true });
});

// Reset game
app.post('/api/trivia/:eventId/reset', (req, res) => {
    const { eventId } = req.params;

    triviaGames[eventId] = {
        eventId,
        status: 'WAITING',
        questions: [],
        currentQuestionIndex: -1,
        questionStartTime: null,
        isAnswerRevealed: false,
        backgroundUrl: 'https://res.cloudinary.com/djetzdm5n/image/upload/v1769432962/appxv-events/jp6fbqmcpg53lfbhtm42.png',
        players: {}
    };

    broadcastTriviaState(eventId);
    res.json({ success: true });
});

// Update config (background)
app.put('/api/trivia/:eventId/config', (req, res) => {
    const { eventId } = req.params;
    const { backgroundUrl } = req.body;
    const state = getTriviaState(eventId);
    if (backgroundUrl !== undefined) state.backgroundUrl = backgroundUrl;
    broadcastTriviaState(eventId);
    res.json(state);
});

// Join player
app.post('/api/trivia/:eventId/join', (req, res) => {
    const { eventId } = req.params;
    const { playerId, name } = req.body;

    const state = getTriviaState(eventId);

    if (!state.players[playerId]) {
        // Check limits
        const currentCount = Object.keys(state.players).length;
        const limitCheck = checkLimit({
            plan: state.hostPlan || 'freemium',
            resource: 'gameParticipants',
            currentCount
        });

        if (!limitCheck.allowed) {
            return res.status(403).json({
                error: limitCheck.reason || 'Límite de participantes alcanzado (Plan Limit)',
                limitReached: true
            });
        }

        state.players[playerId] = {
            id: playerId,
            name,
            score: 0,
            answers: {}
        };
        broadcastTriviaState(eventId);
    }

    res.json({ success: true, player: state.players[playerId] });
});

// Submit answer
app.post('/api/trivia/:eventId/answer', (req, res) => {
    const { eventId } = req.params;
    const { playerId, questionId, answer } = req.body;

    const state = getTriviaState(eventId);
    const player = state.players[playerId];
    const currentQuestion = state.questions[state.currentQuestionIndex];

    // Validations
    if (!player) {
        return res.status(400).json({ error: 'Player not found' });
    }
    if (!currentQuestion || currentQuestion.id !== questionId) {
        return res.status(400).json({ error: 'Invalid question' });
    }
    if (player.answers[questionId]) {
        return res.status(400).json({ error: 'Already answered' });
    }

    // Record answer and calculate score
    player.answers[questionId] = answer;
    if (currentQuestion.correctOption === answer) {
        player.score += 1;
    }

    broadcastTriviaState(eventId);
    res.json({ success: true, correct: currentQuestion.correctOption === answer });
});

// =====================================================
// PHOTO BINGO GAME API - Real-time Cross-Device Sync via SSE
// =====================================================

// Default bingo prompts
const DEFAULT_BINGO_PROMPTS = [
    { id: 1, text: "Selfie con el anfitrión", icon: "person_pin" },
    { id: 2, text: "Alguien riendo", icon: "sentiment_very_satisfied" },
    { id: 3, text: "La persona más alta", icon: "height" },
    { id: 4, text: "Un trago raro", icon: "local_bar" },
    { id: 5, text: "Selfie grupal (3+)", icon: "groups" },
    { id: 6, text: "Alguien de rojo", icon: "palette" },
    { id: 7, text: "Paso de baile gracioso", icon: "music_note" },
    { id: 8, text: "El invitado más viejo", icon: "elderly" },
    { id: 9, text: "¡Brindis!", icon: "celebration" },
];

// In-memory bingo game state (per event)
const bingoGames = {};

// SSE clients for bingo (per event)
const bingoClients = {};

// Helper to get or create bingo game state
const getBingoState = (eventId) => {
    if (!bingoGames[eventId]) {
        bingoGames[eventId] = {
            eventId,
            status: 'WAITING',
            hostPlan: 'freemium', // Default
            prompts: [...DEFAULT_BINGO_PROMPTS],
            googlePhotosLink: '',
            customImageUrl: 'https://res.cloudinary.com/djetzdm5n/image/upload/v1769432962/appxv-events/jp6fbqmcpg53lfbhtm42.png',
            winner: null,
            players: {},
            cards: {},
            submissions: []
        };
    }
    return bingoGames[eventId];
};

// Create lightweight state for broadcasts (without full Base64 photos in cards)
const createLightweightState = (state) => {
    // Deep copy the state but remove photo URLs from cards (guests have them locally)
    const lightState = {
        ...state,
        cards: {},
        // Keep photos in submissions for admin review on BigScreen
        submissions: state.submissions.map(sub => ({
            ...sub,
            card: {
                ...sub.card,
                cells: Object.fromEntries(
                    Object.entries(sub.card.cells).map(([promptId, cell]) => [
                        promptId,
                        {
                            promptId: cell.promptId,
                            timestamp: cell.timestamp,
                            hasPhoto: !!cell.photoUrl,
                            // Keep photo URL for admin review
                            photoUrl: cell.photoUrl
                        }
                    ])
                )
            }
        }))
    };

    // For cards (guest views), only send hasPhoto flag, NOT the Base64 data
    // Guests already have their own photos cached locally in their browser
    for (const [playerId, card] of Object.entries(state.cards)) {
        lightState.cards[playerId] = {
            ...card,
            cells: Object.fromEntries(
                Object.entries(card.cells).map(([promptId, cell]) => [
                    promptId,
                    {
                        promptId: cell.promptId,
                        timestamp: cell.timestamp,
                        hasPhoto: !!cell.photoUrl
                        // NO photoUrl here - saves ~80KB per photo per broadcast
                    }
                ])
            )
        };
    }

    return lightState;
};

// Broadcast bingo state to all SSE clients for an event
const broadcastBingoState = (eventId) => {
    const state = getBingoState(eventId);
    const clients = bingoClients[eventId] || [];

    // Use lightweight state to reduce memory usage
    const lightState = createLightweightState(state);
    const data = JSON.stringify(lightState);

    // Log the size for debugging
    const sizeKB = (data.length / 1024).toFixed(1);
    console.log(`📸 [BINGO] Broadcast ${sizeKB}KB to ${clients.length} clients for event ${eventId.substring(0, 8)}...`);

    clients.forEach((res) => {
        try {
            res.write(`data: ${data}\n\n`);
        } catch (e) {
            console.error('Bingo SSE write error:', e);
        }
    });
};

// Calculate bingo status (lines and full house)
const calculateBingoStatus = (card, prompts) => {
    const filledPromptIds = new Set(Object.keys(card.cells).map(Number));
    const promptIds = prompts.map(p => p.id);

    // Helper to check if a set of indices (0-8) are filled
    const checkIndices = (indices) => {
        return indices.every(idx => filledPromptIds.has(promptIds[idx]));
    };

    const winningLines = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // Cols
        [0, 4, 8], [2, 4, 6]             // Diagonals
    ];

    let lines = 0;
    for (const line of winningLines) {
        if (checkIndices(line)) lines++;
    }

    card.completedLines = lines;
    card.isFullHouse = filledPromptIds.size === 9;
};

// --- BINGO SSE STREAM ---
app.get('/api/bingo/:eventId/stream', (req, res) => {
    const { eventId } = req.params;
    const { clientId } = req.query;
    console.log(`📸 [BINGO SSE] Client ${clientId || 'unknown'} connected for event ${eventId.substring(0, 8)}...`);

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        'Access-Control-Allow-Origin': '*'
    });
    res.write(': ok\n\n');

    // Add client to list
    if (!bingoClients[eventId]) {
        bingoClients[eventId] = [];
    }
    bingoClients[eventId].push(res);

    // Send current state immediately
    const state = getBingoState(eventId);
    res.write(`data: ${JSON.stringify(state)}\n\n`);

    // Keep-alive ping every 30 seconds
    const keepAlive = setInterval(() => {
        res.write(': ping\n\n');
    }, 30000);

    // Remove client on disconnect
    req.on('close', () => {
        console.log(`📸 [BINGO SSE] Client ${clientId || 'unknown'} disconnected from event ${eventId.substring(0, 8)}...`);
        clearInterval(keepAlive);
        bingoClients[eventId] = bingoClients[eventId].filter(c => c !== res);

        // Remove player if they were a participant
        if (clientId && state.players[clientId]) {
            console.log(`👋 [BINGO] Removing player ${state.players[clientId].name} due to disconnect`);
            delete state.players[clientId];
            delete state.cards[clientId];
            broadcastBingoState(eventId);
        }
    });
});

// --- GET BINGO STATE ---
app.get('/api/bingo/:eventId', (req, res) => {
    const { eventId } = req.params;
    const state = getBingoState(eventId);
    res.json(state);
});

// --- ADMIN: UPDATE PROMPTS ---
app.put('/api/bingo/:eventId/prompts', (req, res) => {
    const { eventId } = req.params;
    const { prompts } = req.body;

    const state = getBingoState(eventId);
    if (prompts && Array.isArray(prompts) && prompts.length === 9) {
        state.prompts = prompts;
        broadcastBingoState(eventId);
        res.json({ success: true });
    } else {
        res.status(400).json({ error: 'Must provide exactly 9 prompts' });
    }
});

// --- ADMIN: UPDATE SETTINGS (Google Photos link & Branding) ---
app.put('/api/bingo/:eventId/settings', (req, res) => {
    const { eventId } = req.params;
    const { googlePhotosLink, hostPlan, customImageUrl } = req.body;

    const state = getBingoState(eventId);
    if (googlePhotosLink !== undefined) state.googlePhotosLink = googlePhotosLink;
    if (hostPlan !== undefined) state.hostPlan = hostPlan;
    if (customImageUrl !== undefined) state.customImageUrl = customImageUrl;

    broadcastBingoState(eventId);
    res.json({ success: true });
});


// --- AI GENERATION ENDPOINTS ---

app.post('/api/bingo/generate-prompts', async (req, res) => {
    try {
        const { theme, count } = req.body;
        if (!theme) return res.status(400).json({ error: 'Theme is required' });

        const prompts = await geminiService.generateBingoPrompts(theme, count);
        res.json({ prompts });
    } catch (error) {
        console.error('Error generating bingo prompts:', error);
        res.status(500).json({ error: 'Failed to generate prompts' });
    }
});

app.post('/api/impostor/generate-tasks', async (req, res) => {
    try {
        const { theme } = req.body;
        if (!theme) return res.status(400).json({ error: 'Theme is required' });

        const tasks = await geminiService.generateImpostorTasks(theme);
        res.json(tasks);
    } catch (error) {
        console.error('Error generating impostor tasks:', error);
        res.status(500).json({ error: 'Failed to generate tasks' });
    }
});

// --- ADMIN: START GAME ---
app.post('/api/bingo/:eventId/start', (req, res) => {
    const { eventId } = req.params;

    const state = getBingoState(eventId);
    state.status = 'PLAYING';
    state.winner = null;
    state.submissions = [];
    broadcastBingoState(eventId);
    res.json({ success: true });
});

// --- ADMIN: STOP GAME (enter review mode) ---
app.post('/api/bingo/:eventId/stop', (req, res) => {
    const { eventId } = req.params;

    const state = getBingoState(eventId);
    state.status = 'REVIEW';
    broadcastBingoState(eventId);
    res.json({ success: true });
});

// --- ADMIN: FINISH GAME ---
app.post('/api/bingo/:eventId/finish', (req, res) => {
    const { eventId } = req.params;

    const state = getBingoState(eventId);
    state.status = 'WINNER';

    broadcastBingoState(eventId);
    res.json({ success: true });
});

// --- ADMIN: APPROVE SUBMISSION (mark as winner but don't end game) ---
app.post('/api/bingo/:eventId/approve/:submissionId', (req, res) => {
    const { eventId, submissionId } = req.params;

    const state = getBingoState(eventId);
    const submission = state.submissions.find(s => s.id === submissionId);

    if (!submission) {
        return res.status(404).json({ error: 'Submission not found' });
    }

    // Only mark as approved - do NOT change game status to WINNER
    // Game continues until admin explicitly ends it (allows multiple winners)
    submission.status = 'APPROVED';

    broadcastBingoState(eventId);
    res.json({
        success: true,
        winner: {
            player: submission.player,
            type: submission.card.isFullHouse ? 'BINGO' : 'LINE'
        }
    });
});

// --- ADMIN: REJECT SUBMISSION ---
app.post('/api/bingo/:eventId/reject/:submissionId', (req, res) => {
    const { eventId, submissionId } = req.params;

    const state = getBingoState(eventId);
    const submission = state.submissions.find(s => s.id === submissionId);

    if (!submission) {
        return res.status(404).json({ error: 'Submission not found' });
    }

    submission.status = 'REJECTED';
    broadcastBingoState(eventId);
    res.json({ success: true });
});

// --- ADMIN: RESET GAME ---
app.post('/api/bingo/:eventId/reset', (req, res) => {
    const { eventId } = req.params;

    bingoGames[eventId] = {
        eventId,
        status: 'WAITING',
        prompts: [...DEFAULT_BINGO_PROMPTS],
        googlePhotosLink: bingoGames[eventId]?.googlePhotosLink || '',
        winner: null,
        players: {},
        cards: {},
        submissions: []
    };
    broadcastBingoState(eventId);
    res.json({ success: true });
});

// --- GUEST: JOIN GAME ---
app.post('/api/bingo/:eventId/join', (req, res) => {
    const { eventId } = req.params;
    const { name, userPlan, userRole } = req.body;

    const state = getBingoState(eventId);
    const playerCount = Object.keys(state.players).length;

    // Plan limit check (admins bypass)
    // Use hostPlan from state, fallback to freemium
    if (!isAdmin(userRole)) {
        const limitCheck = checkLimit({
            plan: state.hostPlan || 'freemium',
            resource: 'gameParticipants',
            currentCount: playerCount
        });

        if (!limitCheck.allowed) {
            return res.status(403).json({
                error: limitCheck.reason,
                limitReached: true,
                current: playerCount,
                limit: limitCheck.limit
            });
        }
    }

    const playerId = crypto.randomUUID();
    const player = {
        id: playerId,
        name: name || 'Jugador Anónimo',
        joinedAt: Date.now()
    };

    state.players[playerId] = player;

    // Initialize empty card
    state.cards[playerId] = {
        playerId,
        cells: {},
        completedLines: 0,
        isFullHouse: false
    };

    broadcastBingoState(eventId);
    res.json({ success: true, player });
});

// --- GUEST: UPLOAD PHOTO ---
app.post('/api/bingo/:eventId/upload', (req, res) => {
    const { eventId } = req.params;
    const { playerId, promptId, photoUrl } = req.body;

    const state = getBingoState(eventId);

    if (state.status !== 'PLAYING') {
        return res.status(400).json({ error: 'Game is not in progress' });
    }

    const card = state.cards[playerId];
    if (!card) {
        return res.status(404).json({ error: 'Player not found' });
    }

    if (card.submittedAt) {
        return res.status(400).json({ error: 'Card already submitted' });
    }

    // Update cell with photo
    card.cells[promptId] = {
        promptId,
        photoUrl,
        timestamp: Date.now()
    };

    // Recalculate bingo status
    calculateBingoStatus(card, state.prompts);

    broadcastBingoState(eventId);
    res.json({
        success: true,
        completedLines: card.completedLines,
        isFullHouse: card.isFullHouse
    });
});

// --- GUEST: SUBMIT CARD ---
app.post('/api/bingo/:eventId/submit', (req, res) => {
    const { eventId } = req.params;
    const { playerId } = req.body;

    const state = getBingoState(eventId);
    const player = state.players[playerId];
    const card = state.cards[playerId];

    if (!player || !card) {
        return res.status(404).json({ error: 'Player not found' });
    }

    if (card.submittedAt) {
        return res.status(400).json({ error: 'Card already submitted' });
    }

    // Validate that at least one line is completed
    if (card.completedLines === 0 && !card.isFullHouse) {
        return res.status(400).json({ error: 'Must complete at least one line to submit' });
    }

    card.submittedAt = Date.now();

    const submission = {
        id: crypto.randomUUID(),
        player: { ...player },
        card: { ...card },
        status: 'PENDING',
        submittedAt: card.submittedAt
    };

    state.submissions.push(submission);

    // NOTE: Do NOT auto-switch to REVIEW mode - allow multiple submissions
    // The admin can manually stop the game when they want to start reviewing
    // This allows multiple winners (e.g., 3 bingos, 7 lines as the host decides)

    broadcastBingoState(eventId);
    res.json({ success: true, submissionId: submission.id });
});

// --- RAFFLE GAME ROUTES ---

// Helper for Raffle SSE
const raffleClients = {}; // eventId -> [res, res, ...]

const broadcastRaffleState = (eventId) => {
    const clients = raffleClients[eventId] || [];
    const state = raffleGameService.getGame(eventId);
    const data = `data: ${JSON.stringify(state)}\n\n`;

    clients.forEach(client => client.write(data));
};

app.get('/api/raffle/:eventId/stream', (req, res) => {
    const { eventId } = req.params;
    const { clientId } = req.query;

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        'Access-Control-Allow-Origin': '*'
    });
    res.write(': ok\n\n');

    if (!raffleClients[eventId]) {
        raffleClients[eventId] = [];
    }
    raffleClients[eventId].push(res);

    // Send initial state
    const state = raffleGameService.getGame(eventId);
    res.write(`data: ${JSON.stringify(state)}\n\n`);

    req.on('close', () => {
        raffleClients[eventId] = raffleClients[eventId].filter(client => client !== res);

        // Remove participant if disconnected
        if (clientId) {
            const removed = raffleGameService.removeParticipant(eventId, clientId);
            if (removed) {
                console.log(`👋 [RAFFLE] Removing participant ${clientId} due to disconnect`);
                broadcastRaffleState(eventId);
            }
        }
    });
});

app.get('/api/raffle/:eventId', (req, res) => {
    const { eventId } = req.params;
    const state = raffleGameService.getGame(eventId);
    res.json(state);
});

app.put('/api/raffle/:eventId/config', (req, res) => {
    const { eventId } = req.params;
    const config = req.body;
    const state = raffleGameService.updateConfig(eventId, config);
    broadcastRaffleState(eventId);
    res.json(state);
});

app.post('/api/raffle/:eventId/start', (req, res) => {
    const { eventId } = req.params;
    const state = raffleGameService.start(eventId);
    broadcastRaffleState(eventId);
    res.json(state);
});

app.post('/api/raffle/:eventId/draw', async (req, res) => {
    const { eventId } = req.params;
    const state = await raffleGameService.drawWinner(eventId, broadcastRaffleState);
    res.json(state);
});

app.post('/api/raffle/:eventId/reset', (req, res) => {
    const { eventId } = req.params;
    const state = raffleGameService.reset(eventId);
    broadcastRaffleState(eventId);
    res.json(state);
});

// --- CONFESSIONS GAME ROUTES ---

const confessionsClients = {}; // eventId -> [res, res, ...]

const broadcastConfessionsState = (eventId) => {
    const clients = confessionsClients[eventId] || [];
    const state = confessionsGameService.getGame(eventId);
    const data = `data: ${JSON.stringify(state)}\n\n`;

    clients.forEach(client => {
        try {
            client.write(data);
        } catch (e) {
            console.error('Confessions SSE write error:', e);
        }
    });
};

app.get('/api/confessions/:eventId/stream', (req, res) => {
    const { eventId } = req.params;
    const { clientId } = req.query;

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        'Access-Control-Allow-Origin': '*'
    });
    res.write(': ok\n\n');

    if (!confessionsClients[eventId]) {
        confessionsClients[eventId] = [];
    }
    confessionsClients[eventId].push(res);

    // Send initial state
    const state = confessionsGameService.getGame(eventId);
    res.write(`data: ${JSON.stringify(state)}\n\n`);

    // Keep active
    const keepAlive = setInterval(() => {
        res.write(': ping\n\n');
    }, 30000);

    req.on('close', () => {
        clearInterval(keepAlive);
        confessionsClients[eventId] = confessionsClients[eventId].filter(client => client !== res);
    });
});

app.get('/api/confessions/:eventId', (req, res) => {
    const { eventId } = req.params;
    const state = confessionsGameService.getGame(eventId);
    res.json(state);
});

// --- REUSEABLE SSE INFRASTRUCTURE ---
const eventClients = {}; // eventId -> [res, res, ...]

const broadcastToEvent = (eventId, payload) => {
    const clients = eventClients[eventId] || [];
    const eventType = payload.type || 'message';
    const data = `event: ${eventType}\ndata: ${JSON.stringify(payload)}\n\n`;

    clients.forEach(client => {
        try {
            client.write(data);
        } catch (e) {
            console.error('SSE write error:', e);
        }
    });
};

app.get('/api/events/:eventId/stream', (req, res) => {
    const { eventId } = req.params;
    const { clientId } = req.query;

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        'Access-Control-Allow-Origin': '*'
    });
    res.write(': ok\n\n');

    if (!eventClients[eventId]) {
        eventClients[eventId] = [];
    }
    eventClients[eventId].push(res);

    // Keep active
    const keepAlive = setInterval(() => {
        res.write(': ping\n\n');
    }, 30000);

    req.on('close', () => {
        clearInterval(keepAlive);
        eventClients[eventId] = eventClients[eventId].filter(client => client !== res);

        // Handle Impostor player removal
        if (clientId) {
            const removed = impostorGameService.leaveSession(eventId, clientId);
            if (removed) {
                console.log(`👋 [IMPOSTOR] Removing player ${clientId} from lobby due to disconnect`);
                broadcastImpostorState(eventId);
            }
        }
    });
});

// --- IMPOSTOR GAME ---
const broadcastImpostorState = (eventId) => {
    const state = impostorGameService.getOrCreateSession(eventId);
    broadcastToEvent(eventId, { type: 'IMPOSTOR_UPDATE', state });
};

app.get('/api/impostor/:eventId', (req, res) => {
    const state = impostorGameService.getOrCreateSession(req.params.eventId);
    res.json(state);
});

app.post('/api/impostor/:eventId/join', (req, res) => {
    const state = impostorGameService.joinSession(req.params.eventId, req.body);
    broadcastImpostorState(req.params.eventId);
    res.json(state);
});

app.put('/api/impostor/:eventId/config', (req, res) => {
    const state = impostorGameService.updateConfig(req.params.eventId, req.body);
    broadcastImpostorState(req.params.eventId);
    res.json(state);
});

app.post('/api/impostor/:eventId/select-players', (req, res) => {
    // In a real scenario, we'd get connected guests. 
    // For now, we simulation with a list or get them from existing logic if available.
    // For this MVP, let's assume the admin sends a list of candidate players or we fetch from active guests.
    const { candidates } = req.body;
    const state = impostorGameService.selectPlayers(req.params.eventId, candidates || []);
    broadcastImpostorState(req.params.eventId);
    res.json(state);
});

app.post('/api/impostor/:eventId/start', (req, res) => {
    const state = impostorGameService.startRound(req.params.eventId);
    broadcastImpostorState(req.params.eventId);
    res.json(state);
});

app.post('/api/impostor/:eventId/answer', (req, res) => {
    const { playerId, answer } = req.body;
    const state = impostorGameService.submitAnswer(req.params.eventId, playerId, answer);
    broadcastImpostorState(req.params.eventId);
    res.json(state);
});

app.post('/api/impostor/:eventId/vote', (req, res) => {
    const { voterId, targetId } = req.body;
    const state = impostorGameService.castVote(req.params.eventId, voterId, targetId);
    broadcastImpostorState(req.params.eventId);
    res.json(state);
});

app.post('/api/impostor/:eventId/reveal', (req, res) => {
    const state = impostorGameService.revealImpostor(req.params.eventId);
    broadcastImpostorState(req.params.eventId);
    res.json(state);
});

app.post('/api/impostor/:eventId/reset', (req, res) => {
    const state = impostorGameService.resetGame(req.params.eventId);
    broadcastImpostorState(req.params.eventId);
    res.json(state);
});

app.put('/api/confessions/:eventId/config', async (req, res) => {
    const { eventId } = req.params;
    let config = req.body;

    // Handle Google Photos links automatically
    if (config.backgroundUrl && (config.backgroundUrl.includes('photos.app.goo.gl') || config.backgroundUrl.includes('google.com/photos'))) {
        try {
            console.log("📸 [Confessions] Resolving Google Photos link:", config.backgroundUrl);
            const photos = await googlePhotosService.getAlbumPhotos(config.backgroundUrl);
            if (photos && photos.length > 0) {
                config.backgroundUrl = photos[0].src; // Use the first photo found
                console.log("✅ [Confessions] Resolved to direct URL:", config.backgroundUrl);
            }
        } catch (e) {
            console.warn("⚠️ [Confessions] Failed to resolve Google Photos link (using original):", e.message);
        }
    }

    const state = confessionsGameService.updateConfig(eventId, config);
    broadcastConfessionsState(eventId);
    res.json(state);
});

app.post('/api/confessions/:eventId/message', (req, res) => {
    const { eventId } = req.params;
    const { text, author } = req.body;

    try {
        const message = confessionsGameService.addMessage(eventId, { text, author });
        broadcastConfessionsState(eventId);
        res.json({ success: true, message });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

app.post('/api/confessions/:eventId/reset', (req, res) => {
    const { eventId } = req.params;
    const state = confessionsGameService.reset(eventId);
    broadcastConfessionsState(eventId);
    res.json(state);
});

app.post('/api/raffle/:eventId/join', (req, res) => {
    const { eventId } = req.params;
    const { name, playerId } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });

    const participant = raffleGameService.joinParticipant(eventId, name, playerId);
    broadcastRaffleState(eventId);
    res.json({ success: true, participant });
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