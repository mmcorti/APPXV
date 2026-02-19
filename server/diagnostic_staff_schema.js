import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local', override: true });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkSchema() {
    console.log('--- Table: staff_assignments ---');
    // We can't easily get table structure without RPC or a row.
    // Let's try to fetch one row and see all columns.
    const { data: assignments, error: aError } = await supabase.from('staff_assignments').select('*').limit(1);
    if (aError) {
        console.error('Error fetching staff_assignments:', aError);
    } else {
        console.log('staff_assignments sample row:', assignments[0]);
    }

    console.log('\n--- Table: staff_profiles ---');
    const { data: profiles, error: pError } = await supabase.from('staff_profiles').select('*').limit(1);
    if (pError) {
        console.error('Error fetching staff_profiles:', pError);
    } else {
        console.log('staff_profiles sample row:', profiles[0]);
    }
}

checkSchema();
