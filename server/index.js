console.log('ðŸ [STARTUP] server/index.js is being loaded...');
import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local', override: true });
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { checkLimit, isAdmin, DEFAULT_PLAN, getUsageSummary } from './planLimits.js';
import bcrypt from 'bcryptjs';
import { supabase, TABLES } from './supabase.js';
import { googlePhotosService } from './services/googlePhotos.js';
import googleAuth from './services/googleAuth.js';
import { uploadImage } from './services/imageUpload.js';
import { raffleGameService } from './services/raffleGameService.js';
import { confessionsGameService } from './services/confessionsGameService.js';
import { impostorGameService } from './services/impostorGameService.js';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 8080;

app.use(cors());
app.use(express.json({ limit: '10mb' })); // Increased for base64 images

// Startup diagnostics
console.log('--- STARTUP DIAGNOSTICS ---');
console.log('Node Version:', process.version);
console.log('Environment:', process.env.NODE_ENV);
console.log('Port:', PORT);
console.log('Working Directory:', process.cwd());
console.log('---------------------------');

// Global Error Handlers to prevent silent crashes
process.on('uncaughtException', (err) => {
    console.error('ðŸ”¥ CRITICAL: Uncaught Exception:', err);
    // Don't exit immediately in Cloud Run to allow logs to flush
    setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('ðŸ”¥ CRITICAL: Unhandled Rejection at:', promise, 'reason:', reason);
});

// Debug helper (keep existing if needed)
// Debug helper removed for production stability
// import '../debug_pkg.js';


// Serve static frontend files
app.use(express.static(path.join(__dirname, '../dist')));

// Health check - only responds when no static frontend is built
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/debug-mapping', async (req, res) => {
    try {
        const { data, error } = await supabase.from(TABLES.USERS).select('id').limit(1);
        res.json({
            supabase_connected: !error,
            tables: Object.values(TABLES),
            error: error?.message || null
        });
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

        console.log('ðŸ“¸ Uploading image to Cloudinary...');
        const result = await uploadImage(image);
        console.log('âœ… Image uploaded:', result.url);

        res.json({ success: true, url: result.url, publicId: result.publicId });
    } catch (error) {
        console.error('âŒ Image upload failed:', error);
        res.status(500).json({ error: error.message });
    }
});

// --- AI IMAGE GENERATION ---
import * as geminiService from './services/geminiService.js';
const {
    generateImage: geminiGenerateImage,
    editImage: geminiEditImage,
    generateTriviaQuestions
} = geminiService;

app.post('/api/trivia/generate-questions', async (req, res) => {
    try {
        const { theme, count } = req.body;
        if (!theme) {
            return res.status(400).json({ error: 'Theme is required' });
        }

        console.log(`ðŸ¤– AI generating ${count || 5} trivia questions for theme: ${theme}`);
        const questions = await generateTriviaQuestions(theme, count || 5);
        console.log(`âœ… AI generated ${questions.length} questions`);

        res.json({ success: true, questions });
    } catch (error) {
        console.error('âŒ AI trivia generation failed:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/ai/generate-image', async (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt) {
            return res.status(400).json({ error: 'No prompt provided' });
        }

        console.log('ðŸŽ¨ AI generating image with prompt:', prompt);
        const imageDataUrl = await geminiGenerateImage(prompt);
        console.log('âœ… AI image generated successfully');

        // Upload to Cloudinary to get a proper URL (Notion can't handle large base64)
        console.log('ðŸ“¤ Uploading AI image to Cloudinary...');
        const cloudinaryResult = await uploadImage(imageDataUrl, 'appxv-ai-images');
        console.log('âœ… AI image uploaded to Cloudinary:', cloudinaryResult.url);

        res.json({ success: true, image: cloudinaryResult.url });
    } catch (error) {
        console.error('âŒ AI image generation failed:', error);
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
            console.log('ðŸ”„ Fetching image from URL for editing...');
            const response = await fetch(image);
            const arrayBuffer = await response.arrayBuffer();
            const base64 = Buffer.from(arrayBuffer).toString('base64');
            const contentType = response.headers.get('content-type') || 'image/png';
            image = `data:${contentType};base64,${base64}`;
            console.log('âœ… Image fetched and converted to base64');
        }

        console.log('ðŸŽ¨ AI editing image with prompt:', prompt);
        const editedImageDataUrl = await geminiEditImage(image, prompt);
        console.log('âœ… AI image edited successfully');

        // Upload to Cloudinary
        console.log('ðŸ“¤ Uploading edited image to Cloudinary...');
        const cloudinaryResult = await uploadImage(editedImageDataUrl, 'appxv-ai-images');
        console.log('âœ… Edited image uploaded to Cloudinary:', cloudinaryResult.url);

        res.json({ success: true, image: cloudinaryResult.url });
    } catch (error) {
        console.error('âŒ AI image edit failed:', error);
        res.status(500).json({ error: error.message });
    }
});

// --- LOGIN ---
app.post('/api/login', async (req, res) => {
    const email = req.body.email?.trim();
    const password = req.body.password?.trim();
    console.log(`ðŸ” Intentando login para: ${email}`);

    try {
        // 1. Find user by email in public.users
        const { data: user, error } = await supabase
            .from(TABLES.USERS)
            .select('*')
            .eq('email', email)
            .single();

        if (error || !user) {
            return res.status(401).json({ success: false, message: 'Usuario no encontrado' });
        }

        // 2. Verify password via Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (authError) {
            console.log(`âŒ Password mismatch for ${email}: ${authError.message}`);
            return res.status(401).json({ success: false, message: 'ContraseÃ±a incorrecta' });
        }

        // 3. Handle based on role
        if (user.role === 'admin') {
            console.log(`âœ… Admin login successful: ${email}`);
            return res.json({
                success: true,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.username || user.email,
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
        }

        if (user.role === 'subscriber') {
            console.log(`âœ… Subscriber login successful: ${email} (plan: ${user.plan})`);
            return res.json({
                success: true,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.username || user.email,
                    role: 'subscriber',
                    plan: user.plan || 'freemium',
                    permissions: {
                        access_invitados: true,
                        access_mesas: true,
                        access_link: true,
                        access_fotowall: true,
                        access_games: true
                    }
                }
            });
        }

        if (user.role === 'staff') {
            console.log(`âœ… Staff login successful: ${email}`);

            // Fetch first staff assignment for permissions + eventId
            let staffPermissions = {};
            let staffEventId = undefined;
            const { data: assignments } = await supabase
                .from(TABLES.STAFF_ASSIGNMENTS)
                .select('event_id, permissions')
                .eq('staff_id', user.id)
                .limit(1);

            if (assignments && assignments.length > 0) {
                const a = assignments[0];
                staffEventId = a.event_id;
                const p = a.permissions || {};
                staffPermissions = {
                    access_invitados: p.invitados || false,
                    access_mesas: p.mesas || false,
                    access_link: p.link || false,
                    access_fotowall: p.fotowall || false,
                    access_games: p.games || false
                };
            }

            return res.json({
                success: true,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.username || user.email,
                    role: 'staff',
                    permissions: staffPermissions,
                    eventId: staffEventId
                }
            });
        }

        // Fallback
        return res.status(401).json({ success: false, message: 'Rol de usuario no reconocido' });

    } catch (error) {
        console.error("âŒ Error en Login:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- REGISTER ---
app.post('/api/register', async (req, res) => {
    const { username, name, email, password, captchaToken } = req.body;
    console.log(`ðŸ“ Registration attempt for username: ${username}`);

    try {
        // 1. Validate required fields
        if (!username || !name || !password) {
            return res.status(400).json({ success: false, message: 'Todos los campos son obligatorios' });
        }

        const usernameRegex = /^[a-zA-Z0-9._]{3,30}$/;
        if (!usernameRegex.test(username)) {
            return res.status(400).json({ success: false, message: 'El usuario debe tener entre 3 y 30 caracteres (letras, nÃºmeros, puntos y guiones bajos)' });
        }

        if (password.length < 8) {
            return res.status(400).json({ success: false, message: 'La contraseÃ±a debe tener al menos 8 caracteres' });
        }

        // 2. Verify reCAPTCHA v3 token
        const recaptchaSecret = process.env.RECAPTCHA_SECRET_KEY;
        if (recaptchaSecret && captchaToken) {
            try {
                const captchaResponse = await fetch('https://www.google.com/recaptcha/api/siteverify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: `secret=${recaptchaSecret}&response=${captchaToken}`
                });
                const captchaResult = await captchaResponse.json();
                console.log(`ðŸ¤– reCAPTCHA score: ${captchaResult.score}`);
                if (!captchaResult.success || captchaResult.score < 0.5) {
                    return res.status(403).json({ success: false, message: 'VerificaciÃ³n de seguridad fallida. Intenta de nuevo.' });
                }
            } catch (captchaError) {
                console.warn('âš ï¸ reCAPTCHA verification failed, proceeding anyway:', captchaError.message);
            }
        }

        // 3. Construct the @appxv.app email
        const appxvEmail = `${username.toLowerCase()}@appxv.app`;

        // 4. Check if username already exists
        const { data: existing } = await supabase
            .from(TABLES.USERS)
            .select('id')
            .eq('email', appxvEmail)
            .limit(1);

        if (existing && existing.length > 0) {
            return res.status(409).json({ success: false, message: 'Este nombre de usuario ya estÃ¡ registrado. Elige otro.' });
        }

        // 5. Create user in Supabase Auth
        const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
            email: appxvEmail,
            password: password,
            email_confirm: true
        });

        if (authError) {
            console.error('âŒ Supabase Auth createUser error:', authError);
            return res.status(500).json({ success: false, message: authError.message });
        }

        // 6. Create profile in public.users (trigger may do this, but ensure data)
        await supabase
            .from(TABLES.USERS)
            .upsert({
                id: authUser.user.id,
                email: appxvEmail,
                username: username.toLowerCase(),
                role: 'subscriber',
                plan: 'freemium',
                recovery_email: email || null
            });

        console.log(`âœ… New user registered: ${appxvEmail} (ID: ${authUser.user.id})`);

        return res.json({
            success: true,
            user: {
                id: authUser.user.id,
                name: name,
                email: appxvEmail,
                role: 'subscriber',
                plan: 'freemium',
                permissions: {
                    access_invitados: false,
                    access_mesas: false,
                    access_link: false,
                    access_fotowall: false,
                    access_games: false
                }
            }
        });

    } catch (error) {
        console.error("âŒ Error en Registro:", error);
        res.status(500).json({ success: false, message: error.message || 'Error interno del servidor' });
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

        // Check if user exists in public.users by email
        const userEmail = profile.email.toLowerCase();
        const { data: existingUser } = await supabase
            .from(TABLES.USERS)
            .select('*')
            .eq('email', userEmail)
            .maybeSingle();

        let userId, userName, userPlan;

        if (existingUser) {
            // User exists - update GoogleId and AvatarUrl
            userId = existingUser.id;
            userName = existingUser.username || profile.name;
            userPlan = existingUser.plan || 'freemium';

            await supabase
                .from(TABLES.USERS)
                .update({
                    google_id: profile.id,
                    avatar_url: profile.picture || null
                })
                .eq('id', userId);
        } else {
            // New user - create via Supabase Auth + public.users
            console.log('[GOOGLE AUTH] Creating new user...');
            const randomPassword = crypto.randomBytes(32).toString('hex');

            // Try to create auth user, or get existing if already registered
            let authId;
            const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
                email: userEmail,
                password: randomPassword,
                email_confirm: true
            });

            if (authError) {
                if (authError.message?.includes('already registered')) {
                    // User exists in Auth but not in public.users - fetch ID
                    console.log('[GOOGLE AUTH] User already in Auth, fetching ID...');
                    const { data: existingAuthUser } = await supabase.from('users').select('id').eq('email', userEmail).maybeSingle();
                    // Actually we can't easily get auth ID if not in public users without using listUsers which is heavy, 
                    // OR we assume they are in public.users if they are in Auth. But we just checked public.users and they weren't there.
                    // A better way is to rely on the fact that if they are in Auth, we can't get their ID easily without login.
                    // BUT, we can try to "recover" by just ignoring the error and trying to find them? No.
                    // If they are in Auth, they have an ID.
                    // Let's try to search by email in 'users' again? No we did that.
                    // We can use listUsers with filter?
                    // For now, let's assume if they are in Auth, we might have a data sync issue. 
                    // We will try to upsert to public.users using the email as key if possible? No, ID is PK.

                    // WORKAROUND: If auth exists, we might need to ask user to login via password? 
                    // Or we can try to find them in public.users again? No.

                    // Let's log deeply.
                    console.error('[GOOGLE AUTH] User in Auth but not public.users. syncing...');
                    // Try to get user by email from admin API
                    const { data: { users } } = await supabase.auth.admin.listUsers();
                    const found = users.find(u => u.email === userEmail);
                    if (found) {
                        authId = found.id;
                    } else {
                        throw authError;
                    }
                } else {
                    throw authError;
                }
            } else {
                authId = authUser.user.id;
            }

            if (!authId) throw new Error("Could not obtain User ID");

            await supabase
                .from(TABLES.USERS)
                .upsert({
                    id: authId,
                    email: userEmail,
                    username: profile.name,
                    role: 'subscriber',
                    plan: 'freemium',
                    google_id: profile.id,
                    avatar_url: profile.picture || null
                });

            userId = authId;
            userName = profile.name;
            userPlan = 'freemium';
        }

        // Redirect to frontend with user data
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
        const redirectUrl = `${FRONTEND_URL}/#/google-callback?googleAuth=success&user=${userData}`;
        console.log('[GOOGLE AUTH] Redirect URL:', redirectUrl);
        res.redirect(redirectUrl);

    } catch (error) {
        console.error('[GOOGLE AUTH] Callback error:', error);
        const FRONTEND_URL = req.query.state || process.env.FRONTEND_URL || '';
        res.redirect(`${FRONTEND_URL}/#/google-callback?error=google_auth_failed&message=` + encodeURIComponent(error.message));
    }
});

// --- EVENTS ---

// Helper: Map Supabase event object to Frontend structure
const mapEventFromSupabase = (ev) => {
    // fotowall_configs is returned as an array by the join
    const fw = (ev.fotowall_configs && ev.fotowall_configs.length > 0) ? ev.fotowall_configs[0] : {};
    return {
        id: ev.id,
        eventName: ev.name,
        hostName: ev.host_name,
        date: ev.date,
        time: ev.time,
        location: ev.location,
        image: ev.image_url,
        message: ev.message,
        giftType: ev.gift_type || 'none',
        giftDetail: ev.gift_detail,
        dressCode: ev.dress_code,
        venueNotes: ev.venue_notes,
        arrivalTips: ev.arrival_tips,
        fotowall: {
            albumUrl: fw.album_url || '',
            interval: fw.interval || 5,
            shuffle: fw.shuffle || false,
            overlayTitle: fw.overlay_title || '',
            mode: fw.moderation_mode || 'manual',
            filters: fw.filters || {}
        },
        guests: [],
        tables: []
    };
};

app.get('/api/events', async (req, res) => {
    try {
        const { email, staffId } = req.query;
        console.log(`[GET /api/events] Request for email: ${email}, staffId: ${staffId}`);
        let events = [];

        if (staffId) {
            // 1. Fetch assignments for this staff
            const { data: assignments, error: assignError } = await supabase
                .from('staff_assignments')
                .select('event_id, permissions')
                .eq('staff_id', staffId);

            if (assignError) throw assignError;

            if (assignments && assignments.length > 0) {
                const eventIds = assignments.map(a => a.event_id);
                // Fetch events + FW config + owner plan
                const { data: eventData, error: eventsError } = await supabase
                    .from('events')
                    .select('*, fotowall_configs(*), creator:users(plan)')
                    .in('id', eventIds);

                if (eventsError) throw eventsError;

                // Merge with permissions
                events = eventData.map(ev => {
                    const assignment = assignments.find(a => a.event_id === ev.id);
                    return {
                        ...mapEventFromSupabase(ev),
                        ownerPlan: ev.creator?.plan || DEFAULT_PLAN,
                        permissions: assignment?.permissions || {}
                    };
                });
            }
        } else if (email) {
            // 2. Fetch own events (Owner)
            const userEmail = email.toLowerCase();
            // First get user ID
            const { data: user } = await supabase.from('users').select('id, plan').eq('email', userEmail).maybeSingle();

            if (user) {
                console.log(`[GET /api/events] Fetching events for owner ID: ${user.id} (${userEmail})`);
                const { data: eventData, error: eventsError } = await supabase
                    .from('events')
                    .select('*, fotowall_configs(*)')
                    .eq('creator_id', user.id);

                if (eventsError) {
                    console.error(`[GET /api/events] Error fetching events for user ${user.id}:`, eventsError);
                    throw eventsError;
                }
                const eventCount = eventData?.length || 0;
                console.log(`[GET /api/events] Found ${eventCount} events for user ${user.id}`);

                events = (eventData || []).map(ev => {
                    try {
                        return {
                            ...mapEventFromSupabase(ev),
                            ownerPlan: user.plan || DEFAULT_PLAN,
                            permissions: {
                                access_invitados: true,
                                access_mesas: true,
                                access_link: true,
                                access_fotowall: true,
                                access_games: true
                            }
                        };
                    } catch (e) {
                        console.error(`[GET /api/events] Error mapping event ${ev.id}:`, e);
                        return null; // Filter out bad events
                    }
                }).filter(Boolean);
            } else {
                console.warn(`[GET /api/events] User not found in 'users' table for email: ${email}`);
                // Attempt to find user by email in auth.users if needed, or just return empty
            }
        }

        res.json(events);
    } catch (error) {
        console.error("âŒ Error fetching events:", error);
        res.status(500).json({ error: error.message });
    }
});

// GET Single Event (Public access for RSVP)
app.get('/api/events/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { data: event, error } = await supabase
            .from('events')
            .select('*, fotowall_configs(*), creator:users(plan)')
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({ error: 'Event not found' });
            }
            throw error;
        }

        const mappedEvent = {
            ...mapEventFromSupabase(event),
            ownerPlan: event.creator?.plan || DEFAULT_PLAN,
            permissions: {} // Public access has no specific staff permissions
        };

        res.json(mappedEvent);
    } catch (error) {
        console.error("âŒ Error fetching event:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/events', async (req, res) => {
    try {
        const { eventName, date, location, message, image, userEmail, time, hostName, giftType, giftDetail, userPlan, userRole } = req.body;
        console.log(`ðŸ“ [DEBUG] Creating event: ${eventName} for ${userEmail}`);

        // 1. Get User ID
        const email = userEmail.toLowerCase();
        const { data: user } = await supabase.from('users').select('id, plan').eq('email', email).maybeSingle();
        if (!user) {
            console.error(`âŒ User not found for email: ${email} (original: ${userEmail})`);
            return res.status(404).json({ error: "User not found" });
        }

        // 2. Check Limits
        if (!isAdmin(userRole)) {
            const { count, error: countError } = await supabase
                .from('events')
                .select('*', { count: 'exact', head: true })
                .eq('creator_id', user.id);

            if (countError) throw countError;

            const limitCheck = checkLimit({
                plan: user.plan || DEFAULT_PLAN,
                resource: 'events',
                currentCount: count || 0
            });

            if (!limitCheck.allowed) {
                return res.status(403).json({
                    error: limitCheck.reason,
                    limitReached: true,
                    current: count,
                    limit: limitCheck.limit
                });
            }
        }

        // 3. Create Event
        const { data: newEvent, error: insertError } = await supabase
            .from('events')
            .insert({
                creator_id: user.id,
                name: eventName || "Nuevo Evento",
                date: date || new Date().toISOString().split('T')[0],
                time,
                location,
                message,
                image_url: image,
                host_name: hostName,
                gift_type: giftType,
                gift_detail: giftDetail,
                dress_code: req.body.dressCode,
                venue_notes: req.body.venueNotes,
                arrival_tips: req.body.arrivalTips
            })
            .select()
            .single();

        if (insertError) throw insertError;

        // 4. Create default FotoWall config
        await supabase.from('fotowall_configs').insert({ event_id: newEvent.id });

        res.json({ success: true, id: newEvent.id });
    } catch (error) {
        console.error("âŒ Error Creating Event:", error);
        // Provide more context in error for debugging
        const errorMessage = error.message || "Unknown error during event creation";
        res.status(500).json({ error: errorMessage });
    }
});


app.put(['/api/events', '/api/events/:id'], async (req, res) => {
    try {
        const id = req.params.id || req.body.id;
        const { eventName, date, time, location, message, hostName, giftType, giftDetail, image } = req.body;

        // Update basic info
        const { error } = await supabase
            .from('events')
            .update({
                name: eventName,
                date,
                time,
                location,
                message,
                host_name: hostName,
                gift_type: giftType,
                gift_detail: giftDetail,
                image_url: image, // Map image -> image_url
                dress_code: req.body.dressCode,
                venue_notes: req.body.venueNotes,
                arrival_tips: req.body.arrivalTips
            })
            .eq('id', id);

        if (error) throw error;

        // Handle FotoWall updates if present
        if (req.body.fotowall) {
            const fw = req.body.fotowall;
            // Update or upsert if missing? Assuming exist because created on POST
            const { error: fwError } = await supabase
                .from('fotowall_configs')
                .update({
                    album_url: fw.albumUrl,
                    interval: fw.interval,
                    shuffle: fw.shuffle,
                    overlay_title: fw.overlayTitle,
                    moderation_mode: fw.mode,
                    filters: fw.filters
                })
                .eq('event_id', id);
            if (fwError) console.warn("Error updating fotowall config:", fwError);
        }

        res.json({ success: true });
    } catch (error) {
        console.error("âŒ Error Updating Event:", error);
        res.status(500).json({ error: error.message });
    }
});

app.delete(['/api/events', '/api/events/:id'], async (req, res) => {
    try {
        const id = req.params.id || req.body.id;

        // Notion logic used databases.delete equivalent (archiving). Supabase delete.
        const { error } = await supabase.from('events').delete().eq('id', id);

        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        console.error("âŒ Error Deleting Event:", error);
        res.status(500).json({ error: error.message });
    }
});

// --- GUESTS ---

// Helper: Convert companion names object â†’ DB format
// The DB column companion_names is TEXT[] (PostgreSQL array), not JSONB.
// We store the structured object as a single JSON string inside the array.
function companionNamesToDb(companionNames) {
    if (!companionNames) return [];
    // If it's already an array (legacy), return as-is
    if (Array.isArray(companionNames)) return companionNames;
    // Store the object as a JSON-encoded string inside a single-element TEXT[]
    // This preserves category structure (adults, teens, kids, infants)
    try {
        return [JSON.stringify(companionNames)];
    } catch {
        return [];
    }
}

// Helper: Convert DB format â†’ companion names object for frontend
function companionNamesFromDb(dbValue, allotted) {
    const defaultVal = { adults: [], teens: [], kids: [], infants: [] };
    if (!dbValue) return defaultVal;

    // If it's already an object (JSONB column), return directly
    if (typeof dbValue === 'object' && !Array.isArray(dbValue)) {
        return { ...defaultVal, ...dbValue };
    }

    // If it's a TEXT[] array
    if (Array.isArray(dbValue)) {
        // Try to parse first element as JSON (our encoding)
        if (dbValue.length === 1) {
            try {
                const parsed = JSON.parse(dbValue[0]);
                if (typeof parsed === 'object' && !Array.isArray(parsed)) {
                    return { ...defaultVal, ...parsed };
                }
            } catch { /* not JSON, fall through */ }
        }
        // Legacy: flat array of names, distribute based on allotted counts
        if (dbValue.length === 0) return defaultVal;
        const a = allotted || { adults: 0, teens: 0, kids: 0, infants: 0 };
        let idx = 0;
        const result = { adults: [], teens: [], kids: [], infants: [] };
        const adultSlots = Math.max(0, (a.adults || 0) - 1); // main guest is first adult
        for (let i = 0; i < adultSlots && idx < dbValue.length; i++, idx++) result.adults.push(dbValue[idx]);
        for (let i = 0; i < (a.teens || 0) && idx < dbValue.length; i++, idx++) result.teens.push(dbValue[idx]);
        for (let i = 0; i < (a.kids || 0) && idx < dbValue.length; i++, idx++) result.kids.push(dbValue[idx]);
        for (let i = 0; i < (a.infants || 0) && idx < dbValue.length; i++, idx++) result.infants.push(dbValue[idx]);
        // Any remaining go to adults
        while (idx < dbValue.length) { result.adults.push(dbValue[idx]); idx++; }
        return result;
    }

    return defaultVal;
}
app.get('/api/guests', async (req, res) => {
    try {
        const { eventId } = req.query;
        // console.log(`ðŸ“ [GET /api/guests] Fetching guests for event: ${eventId}`); // Verbose log

        let query = supabase.from('guests').select('*');
        if (eventId) {
            query = query.eq('event_id', eventId);
        } else {
            // Optional: Limit or warn if no eventId
            // console.warn("âš ï¸ [GET /api/guests] No eventId provided, fetching all guests!");
        }

        const { data: guestsData, error } = await query;
        if (error) {
            console.error(`âŒ [GET /api/guests] Error fetching:`, error);
            throw error;
        }

        // console.log(`âœ… [GET /api/guests] Found ${guestsData?.length || 0} guests`);

        // Map to frontend structure
        const guests = (guestsData || []).map(g => ({
            id: g.id,
            name: g.name,
            email: g.email,
            status: g.status,
            allotted: g.allotted || { adults: 0, teens: 0, kids: 0, infants: 0 },
            confirmed: g.confirmed || { adults: 0, teens: 0, kids: 0, infants: 0 },
            companionNames: companionNamesFromDb(g.companion_names, g.allotted),
            sent: g.invitation_sent,
            tableId: g.assigned_table_id // distinct from Notion relation, but useful?
        }));

        res.json(guests);
    } catch (error) {
        console.error("âŒ Error fetching guests:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/guests', async (req, res) => {
    try {
        const { eventId, guest, userPlan, userRole } = req.body;
        console.log(`ðŸ“ [POST /api/guests] Creating guest for event ${eventId}:`, guest.name);

        // 1. Check Limits
        if (!isAdmin(userRole)) {
            const { count, error: countError } = await supabase
                .from('guests')
                .select('*', { count: 'exact', head: true })
                .eq('event_id', eventId);

            if (countError) {
                console.error(`âŒ [POST /api/guests] Error checking guest count:`, countError);
                throw countError;
            }

            const limitCheck = checkLimit({
                plan: userPlan || DEFAULT_PLAN,
                resource: 'guests',
                currentCount: count || 0
            });

            if (!limitCheck.allowed) {
                console.warn(`âš ï¸ [POST /api/guests] Limit reached for event ${eventId}: ${count}/${limitCheck.limit}`);
                return res.status(403).json({
                    error: limitCheck.reason,
                    limitReached: true,
                    current: count,
                    limit: limitCheck.limit
                });
            }
        }

        // Validate guest object
        if (!guest || !guest.name) {
            console.error(`âŒ [POST /api/guests] Invalid guest data:`, guest);
            return res.status(400).json({ error: "Guest name is required" });
        }

        // 2. Insert Guest
        const { data: newGuest, error } = await supabase
            .from('guests')
            .insert({
                event_id: eventId,
                name: guest.name,
                email: guest.email,
                status: guest.status || 'pending',
                allotted: guest.allotted || {},
                confirmed: guest.confirmed || {},
                companion_names: companionNamesToDb(guest.companionNames),
                invitation_sent: false
            })
            .select()
            .single();

        if (error) {
            console.error(`âŒ [POST /api/guests] Supabase insert error:`, error);
            throw error;
        }

        console.log(`âœ… [POST /api/guests] Guest created: ${newGuest.id}`);
        res.json({ success: true, id: newGuest.id });


    } catch (error) {
        console.error("âŒ Error creating guest:", error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/guests/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { guest } = req.body;

        if (!guest) {
            console.error(`âŒ [PUT /api/guests] Missing guest data for ID: ${id}`);
            return res.status(400).json({ error: "Missing guest data" });
        }

        console.log(`ðŸ“ [PUT /api/guests] Updating guest ${id}:`, guest.name);

        const updates = {};
        if (guest.name) updates.name = guest.name;
        if (guest.email !== undefined) updates.email = guest.email;
        if (guest.status) updates.status = guest.status;
        if (guest.allotted) updates.allotted = guest.allotted;
        if (guest.confirmed) updates.confirmed = guest.confirmed;
        if (guest.companionNames) updates.companion_names = companionNamesToDb(guest.companionNames);
        if (guest.sent !== undefined) updates.invitation_sent = guest.sent;

        const { error } = await supabase
            .from('guests')
            .update(updates)
            .eq('id', id);

        if (error) {
            console.error(`âŒ [PUT /api/guests] Update error for ${id}:`, error);
            throw error;
        }

        console.log(`âœ… [PUT /api/guests] Guest updated: ${id}`);
        res.json({ success: true });
    } catch (error) {
        console.error("âŒ Error updating guest:", error);
        res.status(500).json({ error: error.message });
    }
});

app.patch('/api/guests/:id/rsvp', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, confirmed, companionNames } = req.body;
        console.log(`ðŸ“ [PATCH /api/guests/rsvp] RSVP update for ${id}:`, { status });

        const updates = {};
        if (status) updates.status = status;
        if (confirmed) updates.confirmed = confirmed;
        if (companionNames) updates.companion_names = companionNamesToDb(companionNames);

        const { error } = await supabase
            .from('guests')
            .update(updates)
            .eq('id', id);

        if (error) {
            console.error(`âŒ [PATCH /api/guests] RSVP update error for ${id}:`, error);
            throw error;
        }
        res.json({ success: true });
    } catch (error) {
        console.error("âŒ RSVP Error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/guests/:id', async (req, res) => {
    try {
        const { error } = await supabase.from('guests').delete().eq('id', req.params.id);
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// --- SUBSCRIBERS (Staff) ---
app.get('/api/subscribers', async (req, res) => {
    try {
        const { eventId } = req.query;
        if (!eventId) return res.status(400).json({ error: "eventId is required" });

        // Get assignments for this event
        const { data: assignments, error } = await supabase
            .from('staff_assignments')
            .select(`
                id,
                permissions,
                user:users (
                    id,
                    email,
                    role,
                    username
                )
            `)
            .eq('event_id', eventId);

        if (error) throw error;

        // Map to frontend structure
        const subscribers = assignments.map(a => ({
            id: a.id,
            userId: a.user?.id,
            name: a.user?.username || a.user?.email,
            email: a.user?.email,
            plan: 'freemium', // Staff inherits owner's plan, return 'freemium' as placeholder
            permissions: a.permissions || {}
        }));

        res.json(subscribers);
    } catch (error) {
        console.error("âŒ Error fetching subscribers:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/subscribers', async (req, res) => {
    try {
        const { eventId, name, email, password, permissions, userRole } = req.body;

        // Admin Check
        if (!isAdmin(userRole)) {
            return res.status(403).json({ error: 'Solo los administradores pueden crear suscriptores' });
        }

        // 1. Check if user exists by email
        const { data: existingUser } = await supabase
            .from('users')
            .select('id, email')
            .eq('email', email)
            .single();

        let userId = existingUser?.id;

        if (!userId) {
            // 2. Create Auth User
            const { data: authData, error: authError } = await supabase.auth.admin.createUser({
                email,
                password,
                email_confirm: true
            });

            if (authError) throw authError;
            userId = authData.user.id;

            // Upsert profile to ensure name/role key
            await supabase.from('users').upsert({
                id: userId,
                email: email,
                username: name || email.split('@')[0],
                role: 'staff'
            });
        }

        // 3. Check if assignment exists
        const { data: existingAssign } = await supabase
            .from('staff_assignments')
            .select('id')
            .eq('event_id', eventId)
            .eq('staff_id', userId)
            .single();

        if (existingAssign) {
            return res.status(409).json({ error: 'Staff member already assigned' });
        }

        // 4. Create Assignment
        const { data: newAssign, error: assignError } = await supabase
            .from('staff_assignments')
            .insert({
                event_id: eventId,
                staff_id: userId,
                permissions: permissions || {}
            })
            .select()
            .single();

        if (assignError) throw assignError;

        res.json({ success: true, id: newAssign.id });
    } catch (error) {
        console.error("âŒ Error creating staff:", error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/subscribers/:id', async (req, res) => {
    try {
        const { id } = req.params; // Assignment ID
        const { permissions } = req.body;

        if (permissions) {
            const { error } = await supabase
                .from('staff_assignments')
                .update({ permissions })
                .eq('id', id);
            if (error) throw error;
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/subscribers/:id', async (req, res) => {
    try {
        const { error } = await supabase
            .from('staff_assignments')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        console.error("Error deleting subscriber:", error);
        res.status(500).json({ error: error.message });
    }
});

// ========================================
// TABLES ENDPOINTS
// ========================================
app.get('/api/tables', async (req, res) => {
    try {
        const { eventId } = req.query;
        if (!eventId) return res.status(400).json({ error: "Missing eventId" });

        // 1. Get Tables (including their assignments JSONB)
        const { data: tablesData, error: tablesError } = await supabase
            .from('tables')
            .select('*')
            .eq('event_id', eventId)
            .order('sort_order', { ascending: true });

        if (tablesError) throw tablesError;

        // 2. Get all Guests for this event
        const { data: guestsData, error: guestsError } = await supabase
            .from('guests')
            .select('*')
            .eq('event_id', eventId);

        if (guestsError) throw guestsError;

        // Build a guest lookup map by ID
        const guestMap = {};
        (guestsData || []).forEach(g => { guestMap[g.id] = g; });

        // Helper: resolve name for a companion by index
        const resolveCompanionName = (guest, companionIndex) => {
            const namesObj = companionNamesFromDb(guest.companion_names, guest.allotted);
            const isConfirmed = guest.status === 'confirmed';
            const counts = isConfirmed ? guest.confirmed : guest.allotted;
            const safeCounts = counts || { adults: 0, teens: 0, kids: 0, infants: 0 };

            // Build flat list of companion names in the same order as the frontend
            const categories = ['adults', 'teens', 'kids', 'infants'];
            let mainCategory = 'adults';
            if ((safeCounts.adults || 0) > 0) mainCategory = 'adults';
            else if ((safeCounts.teens || 0) > 0) mainCategory = 'teens';
            else if ((safeCounts.kids || 0) > 0) mainCategory = 'kids';
            else if ((safeCounts.infants || 0) > 0) mainCategory = 'infants';

            const flatNames = [];
            const categoryLabels = { adults: 'Adulto', teens: 'Adolescente', kids: 'Nino', infants: 'Bebe' };

            categories.forEach(cat => {
                const count = safeCounts[cat] || 0;
                const effectiveCount = (cat === mainCategory) ? Math.max(0, count - 1) : count;
                const catNames = (namesObj[cat] || []).filter(
                    n => n && n.trim().toLowerCase() !== guest.name.trim().toLowerCase()
                );
                for (let i = 0; i < effectiveCount; i++) {
                    const suppliedName = catNames[i] || "";
                    const displayName = suppliedName.trim() ? suppliedName : `${categoryLabels[cat]} ${i + 1} - ${guest.name}`;
                    flatNames.push(displayName);
                }
            });

            return flatNames[companionIndex] || `Acompanante ${companionIndex + 1}`;
        };

        // 3. Build table response using assignments JSONB from each table
        const result = (tablesData || []).map(t => {
            const tableAssignments = t.assignments || [];
            const guests = [];

            tableAssignments.forEach(a => {
                const guest = guestMap[a.guestId];
                if (!guest) return; // Guest was deleted, skip

                const compIdx = a.companionIndex ?? -1;

                if (compIdx === -1) {
                    // Main guest
                    guests.push({
                        guestId: guest.id,
                        companionIndex: -1,
                        name: guest.name,
                        status: guest.status || 'pending',
                        avatar: guest.avatar
                    });
                } else {
                    // Companion
                    const name = resolveCompanionName(guest, compIdx);
                    guests.push({
                        guestId: guest.id,
                        companionIndex: compIdx,
                        name: name,
                        status: guest.status || 'pending'
                    });
                }
            });

            return {
                id: t.id,
                name: t.name,
                capacity: t.capacity || 0,
                order: t.sort_order !== null ? t.sort_order : 999,
                guests
            };
        });

        res.json(result);
    } catch (error) {
        console.error("Error [GET /api/tables]:", error);
        res.status(500).json({ error: error.message });
    }
});


app.post('/api/tables', async (req, res) => {
    try {
        let { eventId, name, capacity, table } = req.body;
        if (table) {
            name = table.name;
            capacity = table.capacity;
        }

        if (!name || !eventId) {
            return res.status(400).json({ error: "Missing name or eventId" });
        }

        // Get max order to append at end
        const { data: maxOrderData } = await supabase
            .from('tables')
            .select('sort_order')
            .eq('event_id', eventId)
            .order('sort_order', { ascending: false })
            .limit(1);

        const nextOrder = (maxOrderData && maxOrderData.length > 0) ? (maxOrderData[0].sort_order + 1) : 0;

        const { data: newTable, error } = await supabase
            .from('tables')
            .insert({
                event_id: eventId,
                name,
                capacity: Number(capacity) || 10,
                sort_order: nextOrder
            })
            .select()
            .single();

        if (error) throw error;
        res.json({ success: true, id: newTable.id });
    } catch (error) {
        console.error("âŒ Error creating table:", error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/tables/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, capacity, order } = req.body;

        const updates = {};
        if (name) updates.name = name;
        if (capacity !== undefined) updates.capacity = Number(capacity);
        if (order !== undefined) updates.sort_order = Number(order);

        const { error } = await supabase
            .from('tables')
            .update(updates)
            .eq('id', id);

        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        console.error("âŒ Error updating table:", error);
        res.status(500).json({ error: error.message });
    }
});

app.patch('/api/tables/reorder', async (req, res) => {
    try {
        const { orders } = req.body;

        for (const { tableId, order } of orders) {
            const { error } = await supabase
                .from('tables')
                .update({ sort_order: Number(order) })
                .eq('id', tableId);
            if (error) throw error;
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.patch('/api/tables/:id/guests', async (req, res) => {
    try {
        const { id: tableId } = req.params;
        const { assignments } = req.body; // Array of { guestId, companionIndex, ... }

        console.log(`[PATCH /api/tables/${tableId}/guests] Saving ${assignments?.length} assignments`);

        // Store only the essential fields in the JSONB column
        const cleanAssignments = (assignments || []).map(a => ({
            guestId: String(a.guestId),
            companionIndex: a.companionIndex ?? -1
        }));

        // Update the assignments JSONB column on the table record
        const { error } = await supabase
            .from('tables')
            .update({ assignments: cleanAssignments })
            .eq('id', tableId);

        if (error) throw error;

        res.json({ success: true });
    } catch (error) {
        console.error("Error updating table guests:", error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/tables/:id', async (req, res) => {
    try {
        const { error } = await supabase.from('tables').delete().eq('id', req.params.id);
        if (error) throw error;
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
            res.json({ valid: false, message: "Ãlbum vacÃ­o o inaccesible" });
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
        const { ownerId } = req.query; // ownerId is creator_id in users/events

        // Profiles are stored in staff_profiles with owner_id
        const { data: roster, error } = await supabase
            .from('staff_profiles')
            .select(`
                id,
                description,
                user:users (
                    name,
                    email,
                    username
                )
            `)
            .eq('owner_id', ownerId);

        if (error) throw error;

        const formattedRoster = roster.map(item => ({
            id: item.id,
            name: item.user?.username || item.user?.name || item.user?.email,
            email: item.user?.email,
            description: item.description,
            ownerId: ownerId
        }));

        res.json(formattedRoster);
    } catch (error) {
        console.error("âŒ Error getting staff roster:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/staff-roster', async (req, res) => {
    try {
        const { name, email, password, description, ownerId } = req.body;

        if (!email || !ownerId) {
            return res.status(400).json({ error: 'Email and OwnerId are required' });
        }

        // 1. Get Owner to check limits
        const { data: owner } = await supabase.from('users').select('plan').eq('id', ownerId).single();
        const plan = (owner?.plan || 'freemium').toLowerCase();

        // 2. Count current roster members
        const { count: currentCount } = await supabase
            .from('staff_profiles')
            .select('*', { count: 'exact', head: true })
            .eq('owner_id', ownerId);

        const limits = getPlanLimits(plan);

        if (currentCount >= limits.maxStaffRoster) {
            return res.status(403).json({
                error: `LÃ­mite alcanzado: Tu plan ${plan.toUpperCase()} permite hasta ${limits.maxStaffRoster} miembros.`,
                limitReached: true,
                current: currentCount,
                limit: limits.maxStaffRoster
            });
        }

        // 3. Create or find User
        const { data: existingUser } = await supabase.from('users').select('id').eq('email', email).single();
        let userId = existingUser?.id;

        if (!userId) {
            const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
                email,
                password: password || crypto.randomBytes(32).toString('hex'),
                email_confirm: true
            });
            if (authError) throw authError;
            userId = authUser.user.id;

            await supabase.from('users').upsert({
                id: userId,
                email,
                username: name || email.split('@')[0],
                role: 'staff'
            });
        }

        // 4. Create Profile
        const { error: profileError } = await supabase.from('staff_profiles').upsert({
            id: userId,
            description,
            owner_id: ownerId
        });

        if (profileError) throw profileError;

        res.json({ success: true, id: userId });
    } catch (error) {
        console.error("âŒ Error creating staff roster member:", error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/staff-roster/:id', async (req, res) => {
    try {
        // Just delete the profile, keeping the user
        const { error } = await supabase.from('staff_profiles').delete().eq('id', req.params.id);
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        console.error("âŒ Error deleting staff roster:", error);
        res.status(500).json({ error: error.message });
    }
});

// --- STAFF ASSIGNMENTS ---
app.get('/api/staff-assignments', async (req, res) => {
    try {
        const { eventId, staffId } = req.query;

        let query = supabase.from('staff_assignments').select(`
            id,
            permissions,
            user:users (
                id,
                username,
                email
            ),
            event_id
        `);

        if (eventId) query = query.eq('event_id', eventId);
        if (staffId) query = query.eq('staff_id', staffId);

        const { data: assignments, error } = await query;
        if (error) throw error;

        const formatted = assignments.map(a => ({
            id: a.id,
            name: a.user?.username || a.user?.email || "Staff",
            staffId: a.user?.id,
            eventId: a.event_id,
            permissions: a.permissions || {}
        }));

        res.json(formatted);
    } catch (error) {
        console.error("âŒ Error getting assignments:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/staff-assignments', async (req, res) => {
    try {
        const { name, staffId, eventId, permissions } = req.body;

        const { data: newAssign, error } = await supabase
            .from('staff_assignments')
            .upsert({
                staff_id: staffId,
                event_id: eventId,
                permissions: permissions || {}
            })
            .select()
            .single();

        if (error) throw error;
        res.json({ success: true, id: newAssign.id });
    } catch (error) {
        console.error("âŒ Error creating assignment:", error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/staff-assignments/:id', async (req, res) => {
    try {
        const { error } = await supabase.from('staff_assignments').delete().eq('id', req.params.id);
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        console.error("âŒ Error deleting assignment:", error);
        res.status(500).json({ error: error.message });
    }
});

// --- USAGE SUMMARY ENDPOINT ---
app.get('/api/usage-summary', async (req, res) => {
    try {
        let { email, plan } = req.query;

        if (!email) {
            return res.status(400).json({ error: 'email is required' });
        }

        const userEmail = email.toLowerCase();

        // 1. Get user profile from Supabase
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id, plan')
            .eq('email', userEmail)
            .maybeSingle();

        if (userError || !user) {
            console.warn(`âš ï¸ User profile not found for usage summary: ${userEmail} (original: ${email})`);
            return res.json({
                events: { current: 0, limit: 1, display: '0/1' }, // Fallback default
                guests: { current: 0, limit: 10, display: '0/10' },
                staffRoster: { current: 0, limit: 0, display: '0/0' },
                plan: plan || DEFAULT_PLAN,
                aiFeatures: false
            });
        }

        const detectedPlan = user.plan || plan || DEFAULT_PLAN;

        // 2. Count events for this user
        const { count: eventCount, error: eventsError } = await supabase
            .from('events')
            .select('*', { count: 'exact', head: true })
            .eq('creator_id', user.id);

        if (eventsError) throw eventsError;

        // 3. Count other resources (optional)
        // Guests count (across all events of the user)
        const { count: guestCount } = await supabase
            .from('guests')
            .select('id', { count: 'exact', head: true })
            .in('event_id', (await supabase.from('events').select('id').eq('creator_id', user.id)).data?.map(e => e.id) || []);

        // 4. Build usage summary
        const summary = getUsageSummary(
            {
                events: eventCount || 0,
                guests: guestCount || 0,
                staffRoster: 0
            },
            detectedPlan.toLowerCase()
        );

        res.json(summary);
    } catch (error) {
        console.error("âŒ Error getting usage summary:", error);
        res.status(500).json({ error: error.message });
    }
});

// =============================================
// === EXPENSE CONTROL MODULE ENDPOINTS ===
// =============================================

// =============================================
// === EXPENSE CONTROL MODULE ENDPOINTS ===
// =============================================

// Helper to find or create category/supplier by name
async function getOrCreateResource(table, eventId, name) {
    if (!name) return null;
    const { data: existing } = await supabase
        .from(table)
        .select('id')
        .eq('event_id', eventId)
        .ilike('name', name)
        .maybeSingle();

    if (existing) return existing.id;

    const { data: newRecord, error } = await supabase
        .from(table)
        .insert({ event_id: eventId, name })
        .select()
        .single();

    if (error) {
        console.error(`Error creating ${table}:`, error);
        return null; // Fallback? Or throw?
    }
    return newRecord.id;
}


// --- EXPENSES ---
app.get('/api/events/:eventId/expenses', async (req, res) => {
    try {
        const { eventId } = req.params;
        const { data: expenses, error } = await supabase
            .from('expenses')
            .select(`
                *,
                category:expense_categories(name),
                supplier:suppliers(name)
            `)
            .eq('event_id', eventId);

        if (error) throw error;

        // Map to frontend structure
        const mapped = expenses.map(e => ({
            id: e.id,
            name: e.name,
            category: e.category?.name || '',
            supplier: e.supplier?.name || '',
            total: e.total || 0,
            paid: e.paid || 0,
            status: e.status || 'Pendiente',
            staff: e.responsible || ''
        }));

        res.json(mapped);
    } catch (error) {
        console.error("âŒ Error fetching expenses:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/events/:eventId/expenses', async (req, res) => {
    try {
        const { eventId } = req.params;
        const { name, category, supplier, total, paid, status, staff, userPlan, userRole } = req.body;

        // Check Limits
        if (!isAdmin(userRole)) {
            const { count, error: countError } = await supabase
                .from('expenses')
                .select('*', { count: 'exact', head: true })
                .eq('event_id', eventId);

            if (countError) throw countError;

            const limitCheck = checkLimit({
                plan: userPlan || DEFAULT_PLAN,
                resource: 'expenses',
                currentCount: count || 0
            });

            if (!limitCheck.allowed) {
                return res.status(403).json({
                    error: limitCheck.reason,
                    limitReached: true,
                    current: count,
                    limit: limitCheck.limit
                });
            }
        }

        // Resolve IDs
        let categoryId = null;
        if (category) categoryId = await getOrCreateResource('expense_categories', eventId, category);

        let supplierId = null;
        if (supplier) supplierId = await getOrCreateResource('suppliers', eventId, supplier);

        const { data: newExpense, error } = await supabase
            .from('expenses')
            .insert({
                event_id: eventId,
                name: name || 'Gasto sin nombre',
                category_id: categoryId,
                supplier_id: supplierId,
                total: Number(total) || 0,
                paid: Number(paid) || 0,
                status: status || 'Pendiente',
                responsible: staff || ''
            })
            .select()
            .single();

        if (error) throw error;
        res.json({ success: true, id: newExpense.id });
    } catch (error) {
        console.error("âŒ Error creating expense:", error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/expenses/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, category, supplier, total, paid, status, staff } = req.body;

        // Fetch existing to get event_id
        const { data: existing } = await supabase.from('expenses').select('event_id').eq('id', id).single();
        if (!existing) return res.status(404).json({ error: "Expense not found" });
        const eventId = existing.event_id;

        const updates = {};
        if (name !== undefined) updates.name = name;
        if (total !== undefined) updates.total = Number(total);
        if (paid !== undefined) updates.paid = Number(paid);
        if (status !== undefined) updates.status = status;
        if (staff !== undefined) updates.responsible = staff;

        // Handle relations
        if (category !== undefined) {
            updates.category_id = category ? await getOrCreateResource('expense_categories', eventId, category) : null;
        }
        if (supplier !== undefined) {
            updates.supplier_id = supplier ? await getOrCreateResource('suppliers', eventId, supplier) : null;
        }

        const { error } = await supabase.from('expenses').update(updates).eq('id', id);
        if (error) throw error;

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/expenses/:id', async (req, res) => {
    try {
        const { error } = await supabase.from('expenses').delete().eq('id', req.params.id);
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- SUPPLIERS ---
app.get('/api/events/:eventId/suppliers', async (req, res) => {
    try {
        const { eventId } = req.params;
        const { data, error } = await supabase
            .from('suppliers')
            .select('*')
            .eq('event_id', eventId);
        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/events/:eventId/suppliers', async (req, res) => {
    try {
        const { eventId } = req.params;
        const { name, category, phone, email, userPlan, userRole } = req.body;

        if (!isAdmin(userRole)) {
            const { count, error: countError } = await supabase
                .from('suppliers')
                .select('*', { count: 'exact', head: true })
                .eq('event_id', eventId);
            if (countError) throw countError;

            const limitCheck = checkLimit({
                plan: userPlan || DEFAULT_PLAN,
                resource: 'suppliers',
                currentCount: count || 0
            });
            if (!limitCheck.allowed) {
                return res.status(403).json({ error: limitCheck.reason, limitReached: true });
            }
        }

        const { data, error } = await supabase
            .from('suppliers')
            .insert({
                event_id: eventId, name, category, phone, email: email || null
            })
            .select()
            .single();
        if (error) throw error;
        res.json({ success: true, id: data.id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/suppliers/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, category, phone, email } = req.body;
        const updates = { name, category, phone, email };
        Object.keys(updates).forEach(key => updates[key] === undefined && delete updates[key]);

        const { error } = await supabase.from('suppliers').update(updates).eq('id', id);
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/suppliers/:id', async (req, res) => {
    try {
        const { error } = await supabase.from('suppliers').delete().eq('id', req.params.id);
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- EXPENSE CATEGORIES ---
app.get('/api/events/:eventId/expense-categories', async (req, res) => {
    try {
        const { eventId } = req.params;
        const { data, error } = await supabase.from('expense_categories').select('*').eq('event_id', eventId);
        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/events/:eventId/expense-categories', async (req, res) => {
    try {
        const { eventId } = req.params;
        const { name, icon, subtitle } = req.body;
        const { data, error } = await supabase
            .from('expense_categories')
            .insert({ event_id: eventId, name, icon: icon || 'category', subtitle })
            .select()
            .single();
        if (error) throw error;
        res.json({ success: true, id: data.id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/expense-categories/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, icon, subtitle } = req.body;
        const updates = { name, icon, subtitle };
        Object.keys(updates).forEach(key => updates[key] === undefined && delete updates[key]);
        const { error } = await supabase.from('expense_categories').update(updates).eq('id', id);
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/expense-categories/:id', async (req, res) => {
    try {
        const { error } = await supabase.from('expense_categories').delete().eq('id', req.params.id);
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========================================
// PAYMENT PARTICIPANTS ENDPOINTS
// ========================================
app.get('/api/events/:eventId/participants', async (req, res) => {
    try {
        const { eventId } = req.params;
        const { data, error } = await supabase
            .from('payment_participants')
            .select('*')
            .eq('event_id', eventId);
        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/events/:eventId/participants', async (req, res) => {
    try {
        const { eventId } = req.params;
        const { name, weight = 1, userPlan, userRole } = req.body;

        if (!isAdmin(userRole)) {
            const { count, error } = await supabase.from('payment_participants').select('*', { count: 'exact', head: true }).eq('event_id', eventId);
            if (error) throw error;

            const limitCheck = checkLimit({
                plan: userPlan || DEFAULT_PLAN,
                resource: 'participants',
                currentCount: count || 0
            });
            if (!limitCheck.allowed) {
                return res.status(403).json({ error: limitCheck.reason, limitReached: true });
            }
        }

        const { data, error } = await supabase
            .from('payment_participants')
            .insert({ event_id: eventId, name, weight })
            .select()
            .single();
        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/participants/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, weight } = req.body;
        const updates = { name, weight };
        Object.keys(updates).forEach(key => updates[key] === undefined && delete updates[key]);
        const { error } = await supabase.from('payment_participants').update(updates).eq('id', id);
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/participants/:id', async (req, res) => {
    try {
        const { error } = await supabase.from('payment_participants').delete().eq('id', req.params.id);
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========================================
// PAYMENTS ENDPOINTS
// ========================================
app.get('/api/expenses/:expenseId/payments', async (req, res) => {
    try {
        const { expenseId } = req.params;
        const { data, error } = await supabase
            .from('payments')
            .select('*')
            .eq('expense_id', expenseId);

        if (error) throw error;

        // Map to frontend
        const payments = data.map(p => ({
            id: p.id,
            expenseId: p.expense_id,
            participantId: p.participant_id,
            amount: p.amount,
            date: p.date,
            description: p.receipt_url ? 'Comprobante' : '',
            receiptUrl: p.receipt_url
        }));

        res.json(payments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/expenses/:expenseId/payments', async (req, res) => {
    try {
        const { expenseId } = req.params;
        const { participantId, amount, date, description, receiptUrl } = req.body;

        const { data, error } = await supabase
            .from('payments')
            .insert({
                expense_id: expenseId,
                participant_id: participantId,
                amount: Number(amount),
                date: date,
                receipt_url: receiptUrl
            })
            .select()
            .single();
        if (error) throw error;

        res.json({
            id: data.id,
            expenseId: data.expense_id,
            participantId: data.participant_id,
            amount: data.amount,
            date: data.date,
            receiptUrl: data.receipt_url
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/payments/:id', async (req, res) => {
    try {
        const { error } = await supabase.from('payments').delete().eq('id', req.params.id);
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========================================
// BALANCES ENDPOINT
// ========================================
app.get('/api/events/:eventId/balances', async (req, res) => {
    try {
        const { eventId } = req.params;
        console.log('ðŸ“Š Calculating balances for event:', eventId);

        // 1. Get Participants
        const { data: participants, error: partError } = await supabase
            .from('payment_participants')
            .select('*')
            .eq('event_id', eventId);
        if (partError) throw partError;

        // 2. Get Expenses
        const { data: expenses, error: expError } = await supabase
            .from('expenses')
            .select('id, total')
            .eq('event_id', eventId);
        if (expError) throw expError;

        const totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.total) || 0), 0);
        const expenseIds = expenses.map(e => e.id);

        // 3. Get Payments
        let allPayments = [];
        if (expenseIds.length > 0) {
            const { data: payments, error: payError } = await supabase
                .from('payments')
                .select('*')
                .in('expense_id', expenseIds);
            if (payError) throw payError;
            allPayments = payments;
        }

        // 4. Calculate
        const totalWeight = participants.reduce((sum, p) => sum + (Number(p.weight) || 1), 0);

        const balances = participants.map(p => {
            const weight = Number(p.weight) || 1;
            const fairShare = totalWeight > 0 ? (totalExpenses * weight) / totalWeight : 0;
            const totalPaid = allPayments
                .filter(pay => pay.participant_id === p.id)
                .reduce((sum, pay) => sum + (Number(pay.amount) || 0), 0);

            return {
                participantId: p.id,
                name: p.name,
                weight: weight,
                fairShare,
                totalPaid,
                balance: totalPaid - fairShare // positive = owed money, negative = owes money
            };
        });

        // Calculate settlements
        const debtors = balances.filter(b => b.balance < -0.01).map(b => ({ ...b, owes: Math.abs(b.balance) }));
        const creditors = balances.filter(b => b.balance > 0.01).map(b => ({ ...b, owed: b.balance }));

        debtors.sort((a, b) => b.owes - a.owes);
        creditors.sort((a, b) => b.owed - a.owed);

        const settlements = [];
        let i = 0, j = 0;

        while (i < debtors.length && j < creditors.length) {
            const debtor = debtors[i];
            const creditor = creditors[j];

            const amount = Math.min(debtor.owes, creditor.owed);

            if (amount > 0.01) {
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
        console.error("âŒ Error calculating balances:", error);
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
    console.log(`ðŸ“¡ [TRIVIA] Broadcast to ${clients.length} clients for event ${eventId.substring(0, 8)}...`);
};

// SSE endpoint for real-time updates
app.get('/api/trivia/:eventId/stream', (req, res) => {
    const { eventId } = req.params;
    const { clientId } = req.query; // Track who is connecting
    console.log(`ðŸ“¡ [TRIVIA SSE] Client ${clientId || 'unknown'} connected for event ${eventId.substring(0, 8)}...`);

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

    // Update player last seen if they are a participant
    if (clientId && state.players[clientId]) {
        state.players[clientId].lastSeen = Date.now();
        state.players[clientId].online = true;
        // If they were offline, broadcast their return immediately
        broadcastTriviaState(eventId);
    }

    res.write(`data: ${JSON.stringify(state)}\n\n`);

    // Keep-alive ping every 30 seconds
    const keepAlive = setInterval(() => {
        res.write(': ping\n\n');
        // Update presence if player exists
        if (clientId && state.players[clientId]) {
            state.players[clientId].lastSeen = Date.now();
            if (!state.players[clientId].online) {
                state.players[clientId].online = true;
                broadcastTriviaState(eventId);
            }
        }
    }, 30000);

    // Remove client on disconnect
    req.on('close', () => {
        console.log(`ðŸ“¡ [TRIVIA SSE] Client ${clientId || 'unknown'} disconnected from event ${eventId.substring(0, 8)}...`);
        clearInterval(keepAlive);
        triviaClients[eventId] = triviaClients[eventId].filter(c => c !== res);

        // Mark player as offline but persist data
        if (clientId && state.players[clientId]) {
            state.players[clientId].online = false;
            broadcastTriviaState(eventId);
        }
    });
});

// Garbage Collector: Cleanup inactive players every minute
setInterval(() => {
    Object.keys(triviaGames).forEach(eventId => {
        const state = triviaGames[eventId];
        if (!state.players) return;

        const now = Date.now();
        let changed = false;

        Object.keys(state.players).forEach(playerId => {
            const player = state.players[playerId];
            // Remove players inactive for more than 10 minutes
            // This prevents "zombies" from filling up the plan limit (e.g., 20 guests)
            if (player.lastSeen && (now - player.lastSeen > 10 * 60 * 1000)) {
                console.log(`ðŸ§¹ [TRIVIA GC] Removing inactive player ${player.name} (${playerId})`);
                delete state.players[playerId];
                changed = true;
            }
        });

        if (changed) {
            broadcastTriviaState(eventId);
        }
    });
}, 60 * 1000); // Run every minute

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

// Update all questions duration (Bulk Action)
app.put('/api/trivia/:eventId/questions/duration', (req, res) => {
    const { eventId } = req.params;
    const { durationSeconds } = req.body;

    const state = getTriviaState(eventId);
    const newDuration = parseInt(durationSeconds) || 10;

    state.questions.forEach(q => {
        q.durationSeconds = newDuration;
    });

    broadcastTriviaState(eventId);
    res.json({ success: true, count: state.questions.length });
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
                error: limitCheck.reason || 'LÃ­mite de participantes alcanzado (Plan Limit)',
                limitReached: true
            });
        }

        state.players[playerId] = {
            id: playerId,
            name,
            score: 0,
            answers: {},
            lastSeen: Date.now(),
            online: true
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
    { id: 1, text: "Selfie con el anfitriÃ³n", icon: "person_pin" },
    { id: 2, text: "Alguien riendo", icon: "sentiment_very_satisfied" },
    { id: 3, text: "La persona mÃ¡s alta", icon: "height" },
    { id: 4, text: "Un trago raro", icon: "local_bar" },
    { id: 5, text: "Selfie grupal (3+)", icon: "groups" },
    { id: 6, text: "Alguien de rojo", icon: "palette" },
    { id: 7, text: "Paso de baile gracioso", icon: "music_note" },
    { id: 8, text: "El invitado mÃ¡s viejo", icon: "elderly" },
    { id: 9, text: "Â¡Brindis!", icon: "celebration" },
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
    console.log(`ðŸ“¸ [BINGO] Broadcast ${sizeKB}KB to ${clients.length} clients for event ${eventId.substring(0, 8)}...`);

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
    console.log(`ðŸ“¸ [BINGO SSE] Client ${clientId || 'unknown'} connected for event ${eventId.substring(0, 8)}...`);

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

    // Update player presence if they are a participant
    if (clientId && state.players[clientId]) {
        state.players[clientId].lastSeen = Date.now();
        state.players[clientId].online = true;
        // If they were offline, broadcast their return immediately
        broadcastBingoState(eventId);
    }

    res.write(`data: ${JSON.stringify(createLightweightState(state))}\n\n`);

    // Keep-alive ping every 30 seconds
    const keepAlive = setInterval(() => {
        res.write(': ping\n\n');
        // Update presence if player exists
        if (clientId && state.players[clientId]) {
            state.players[clientId].lastSeen = Date.now();
            if (!state.players[clientId].online) {
                state.players[clientId].online = true;
                broadcastBingoState(eventId);
            }
        }
    }, 30000);

    // Remove client on disconnect
    req.on('close', () => {
        console.log(`ðŸ“¸ [BINGO SSE] Client ${clientId || 'unknown'} disconnected from event ${eventId.substring(0, 8)}...`);
        clearInterval(keepAlive);
        bingoClients[eventId] = bingoClients[eventId].filter(c => c !== res);

        // Mark player as offline but persist data
        if (clientId && state.players[clientId]) {
            state.players[clientId].online = false;
            console.log(`ðŸ‘‹ [BINGO] Player ${state.players[clientId].name} went offline (persisted)`);
            broadcastBingoState(eventId);
        }
    });
});

// Garbage Collector: Cleanup inactive bingo players every minute
setInterval(() => {
    Object.keys(bingoGames).forEach(eventId => {
        const state = bingoGames[eventId];
        if (!state.players) return;

        const now = Date.now();
        let changed = false;

        Object.keys(state.players).forEach(playerId => {
            const player = state.players[playerId];
            // Remove players inactive for more than 10 minutes
            if (player.lastSeen && (now - player.lastSeen > 10 * 60 * 1000)) {
                console.log(`ðŸ§¹ [BINGO GC] Removing inactive player ${player.name} (${playerId})`);
                delete state.players[playerId];
                // Also remove their card
                if (state.cards[playerId]) {
                    delete state.cards[playerId];
                }
                changed = true;
            }
        });

        if (changed) {
            broadcastBingoState(eventId);
        }
    });
}, 60 * 1000); // Run every minute

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

        // Validate response has required fields
        if (!tasks.mainPrompt || !tasks.impostorPrompt) {
            console.error('[Impostor] Generated tasks missing required fields:', tasks);
            return res.status(500).json({ error: 'AI generated invalid response format' });
        }

        console.log('[Impostor] Generated tasks OK:', { mainPrompt: tasks.mainPrompt.substring(0, 50), impostorPrompt: tasks.impostorPrompt.substring(0, 50) });
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
        name: name || 'Jugador AnÃ³nimo',
        joinedAt: Date.now(),
        lastSeen: Date.now(),
        online: true
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

        // Mark participant as offline if disconnected
        if (clientId) {
            const updated = raffleGameService.setParticipantStatus(eventId, clientId, false);
            if (updated) {
                console.log(`ðŸ‘‹ [RAFFLE] Participant ${clientId} went offline`);
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

        // Handle Impostor player offline
        if (clientId) {
            const updated = impostorGameService.setPlayerStatus(eventId, clientId, false);
            if (updated) {
                console.log(`ðŸ‘‹ [IMPOSTOR] Player ${clientId} went offline`);
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
            console.log("ðŸ“¸ [Confessions] Resolving Google Photos link:", config.backgroundUrl);
            const photos = await googlePhotosService.getAlbumPhotos(config.backgroundUrl);
            if (photos && photos.length > 0) {
                config.backgroundUrl = photos[0].src; // Use the first photo found
                console.log("âœ… [Confessions] Resolved to direct URL:", config.backgroundUrl);
            }
        } catch (e) {
            console.warn("âš ï¸ [Confessions] Failed to resolve Google Photos link (using original):", e.message);
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
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`-----------------------------------------`);
        console.log(`ðŸš€ API Server running on port: ${PORT}`);
        console.log(`ðŸ“¡ Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`ðŸ”‘ Supabase URL: ${process.env.SUPABASE_URL ? 'Present âœ…' : 'NOT FOUND âŒ'}`);
        console.log(`-----------------------------------------`);
    });
};

start();
