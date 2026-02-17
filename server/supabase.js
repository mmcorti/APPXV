import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local', override: true });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ SUPABASE_URL and SUPABASE_SERVICE_KEY are required.');
    process.exit(1);
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
