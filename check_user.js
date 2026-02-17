import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

async function checkUser() {
    const email = 'julitablet8@gmail.com';
    console.log(`Checking user: ${email}`);

    // Check in auth.users
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
    const authUser = users.find(u => u.email === email);

    // Check in public.users
    const { data: publicUser, error: publicError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

    console.log('--- Auth User ---');
    console.log(authUser ? `Found: ${authUser.id}` : 'Not found');

    console.log('--- Public User ---');
    console.log(publicUser ? `Found: ${publicUser.id}, role: ${publicUser.role}` : 'Not found');
}

checkUser();
