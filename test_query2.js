import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'server/.env' });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
    const fwUpdates = {
        album_url: 'https://test.abc',
        interval: 5,
        shuffle: false,
        overlay_title: 'test',
        moderation_mode: 'ai',
        filters: {}
    };
    const { data, error } = await supabase.from('fotowall_configs').update(fwUpdates).eq('event_id', '239994e9-7863-4941-b6b6-ef0623e883a4').select();
    console.log('Update return:', { data, error });
}
check();
