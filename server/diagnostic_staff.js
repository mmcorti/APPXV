import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local', override: true });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkTable() {
    console.log('Checking staff_assignments table...');
    const { data, error } = await supabase.from('staff_assignments').select('*').limit(1);

    if (error) {
        console.error('Error selecting from staff_assignments:', error);
    } else {
        console.log('Successfully selected from staff_assignments.');
        if (data.length > 0) {
            console.log('Columns found:', Object.keys(data[0]));
        } else {
            console.log('Table is empty, cannot determine columns via select.');

            // Try to insert a dummy row (will rollback or we delete it)
            // Or just check rpc if available. For now let's assume it failed if keys were wrong.
        }
    }

    console.log('\nChecking staff_profiles table...');
    const { data: pData, error: pError } = await supabase.from('staff_profiles').select('*').limit(1);
    if (pError) {
        console.error('Error selecting from staff_profiles:', pError);
    } else {
        console.log('Successfully selected from staff_profiles.');
        if (pData.length > 0) {
            console.log('Columns found:', Object.keys(pData[0]));
        }
    }
}

checkTable();
