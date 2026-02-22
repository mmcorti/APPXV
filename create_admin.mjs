import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function promoteOrRegister() {
    const email = 'mmcorti@appxv.app';
    const password = 'JuliaDante#02';

    console.log(`Getting user ID via generateLink trick for ${email}...`);

    // We try to generate an invite or recovery link. This forces Supabase to return the user payload.
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: email
    });

    let userId;

    if (linkData && linkData.user) {
        userId = linkData.user.id;
        console.log(`Yess! Found user ID: ${userId}`);

        // Update password
        await supabase.auth.admin.updateUserById(userId, { password: password, email_confirm: true });
        console.log(`Password updated for existing user.`);

    } else {
        console.log(`User does not seem to exist. Let's create.`);
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true
        });

        if (createError) {
            console.error("Oh no, create error:", createError);
            return;
        }
        userId = newUser.user.id;
        console.log(`Created new user with ID: ${userId}`);
    }

    // UPSERT into users table
    console.log(`Upserting role admin for ID ${userId}...`);
    const { error: upsertErr } = await supabase.from('users').upsert({
        id: userId,
        email: email,
        username: 'mmcorti',
        role: 'admin',
        plan: 'vip'
    });

    if (upsertErr) {
        console.error("Failed to upsert user profile:", upsertErr);
    } else {
        console.log(`Admin user ${email} is thoroughly complete and ready.`);
    }
}

promoteOrRegister();
