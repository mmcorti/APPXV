import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local', override: true });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.warn('⚠️  WARNING: SUPABASE_URL or SUPABASE_SERVICE_KEY is missing.');
    console.warn('Current SUPABASE_URL:', SUPABASE_URL ? 'Defined' : 'UNDEFINED');
    console.warn('Current SUPABASE_SERVICE_KEY:', SUPABASE_SERVICE_KEY ? 'Defined' : 'UNDEFINED');
    console.warn('Application will likely fail on database requests.');
} else {
    console.log('✅ Supabase configuration detected.');
    try {
        const payload = JSON.parse(Buffer.from(SUPABASE_SERVICE_KEY.split('.')[1], 'base64').toString());
        if (payload.role !== 'service_role') {
            console.error('🔥 CRITICAL ERROR: SUPABASE_SERVICE_KEY is NOT a service role key! Found role:', payload.role);
        } else {
            console.log('✅ Service Role key verified successfully.');
        }
    } catch (e) {
        console.error('⚠️ Could not verify SUPABASE_SERVICE_KEY payload:', e.message);
    }
}

// Use the service_role key on the backend — bypasses RLS
// NEVER expose this key to the frontend
export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

// Table name constants for type safety
export const TABLES = {
    USERS: 'users',
    STAFF_PROFILES: 'staff_profiles',
    STAFF_ASSIGNMENTS: 'staff_assignments',
    EVENTS: 'events',
    FOTOWALL_CONFIGS: 'fotowall_configs',
    TABLES: 'tables',
    GUESTS: 'guests',
    EXPENSE_CATEGORIES: 'expense_categories',
    SUPPLIERS: 'suppliers',
    EXPENSES: 'expenses',
    PAYMENT_PARTICIPANTS: 'payment_participants',
    PAYMENTS: 'payments',
    GAME_SESSIONS: 'game_sessions',
    GAME_PARTICIPANTS: 'game_participants',
    GAME_SUBMISSIONS: 'game_submissions',
    SUBSCRIPTIONS: 'subscriptions',
    PAYMENT_INTENTS: 'payment_intents',
    INVOICES: 'invoices',
    WEBHOOK_EVENTS: 'webhook_events',
};

console.log('✅ Supabase client initialized:', SUPABASE_URL);
