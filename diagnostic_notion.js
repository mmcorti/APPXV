
import { Client } from '@notionhq/client';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });

const notion = new Client({ auth: process.env.NOTION_API_KEY });

const DS = {
    EVENTS: "8a693908-f427-4002-9902-4ac86b2e21d4",
    GUESTS: "cc6019a6-dfa0-4582-84d2-814e741019ab",
    TABLES: "3956fff4-80f7-4bf5-81bb-41df10156a48",
    USERS: process.env.NOTION_USERS_DB_ID || "d7a654bcdb684918aca9b2164f2bd0d0"
};

async function checkDB(id, name) {
    if (!id) {
        console.log(`\n⚠️ Missing ID for ${name}`);
        return;
    }
    try {
        console.log(`\n🔍 Checking DB: ${name} (${id})`);
        const db = await notion.databases.retrieve({ database_id: id });
        console.log(`✅ Success! Properties: ${Object.keys(db.properties).join(', ')}`);

        const query = await notion.databases.query({ database_id: id, page_size: 10 });
        console.log(`📄 Found ${query.results.length} items (showing up to 10)`);
        query.results.forEach(p => {
            const props = p.properties;
            const titleProp = Object.values(props).find(pr => pr.type === 'title');
            const title = titleProp?.title?.[0]?.plain_text || 'No Title';

            if (name === 'EVENTS') {
                const creatorProp = props['Creator Email'] || props['Email Creador'] || props['CreatorEmail'] || props['Email'];
                const creatorEmail = creatorProp?.email || 'N/A';
                console.log(`   - ${title} [Creator: ${creatorEmail}] (ID: ${p.id})`);
            } else if (name === 'USERS') {
                const emailProp = props['Email'];
                console.log(`   - ${title} (Email: ${emailProp?.email || 'N/A'})`);
            } else {
                console.log(`   - ${title} (ID: ${p.id})`);
            }
        });
    } catch (e) {
        console.error(`❌ Error checking ${name}: ${e.message}`);
    }
}

async function run() {
    console.log('--- STARTING DIAGNOSTIC ---');
    console.log('Notion API Key length:', process.env.NOTION_API_KEY?.length || 0);

    await checkDB(DS.USERS, 'USERS');
    await checkDB(DS.EVENTS, 'EVENTS');
    await checkDB(DS.GUESTS, 'GUESTS');
}
run();
