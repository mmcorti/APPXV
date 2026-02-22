const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'server/.env' });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
    const { data, error } = await supabase.from('events').select('*, fotowall_configs(*)').eq('id', '239994e9-7863-4941-b6b6-ef0623e883a4').single();
    console.log(JSON.stringify(data, null, 2));
}

check();
