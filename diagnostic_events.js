
import { Client } from '@notionhq/client';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });

const notion = new Client({ auth: process.env.NOTION_API_KEY });

const DS = {
    EVENTS: "8a693908-f427-4002-9902-4ac86b2e21d4",
    USERS: process.env.NOTION_USERS_DB_ID || "d7a654bcdb684918aca9b2164f2bd0d0"
};

async function checkEvents() {
    try {
        console.log(`\n🔍 Checking DB: EVENTS (${DS.EVENTS})`);
        const db = await notion.databases.retrieve({ database_id: DS.EVENTS });
        const creatorProp = db.properties['Creator Email'] || db.properties['Email Creador'] || db.properties['CreatorEmail'] || db.properties['Email'];

        if (creatorProp) {
            console.log(`✅ Found Creator Email property: "${creatorProp.name}" [Type: ${creatorProp.type}]`);
        } else {
            console.log(`❌ Creator Email property NOT found. Available: ${Object.keys(db.properties).join(', ')}`);
        }

        const query = await notion.databases.query({ database_id: DS.EVENTS });
        console.log(`📄 Total Events: ${query.results.length}`);

        query.results.forEach(p => {
            const props = p.properties;
            const title = props.Name?.title?.[0]?.plain_text || 'No Title';
            const emailValue = props[creatorProp.name]?.email;
            console.log(`   - "${title}" (Creator: ${emailValue || 'EMPTY'})`);
        });

        // Test the filter exactly as the server does
        const testEmail = "admin@appxv.com";
        console.log(`\n🧪 Testing filter for "${testEmail}"...`);
        const filteredRes = await notion.databases.query({
            database_id: DS.EVENTS,
            filter: {
                property: creatorProp.name,
                email: { equals: testEmail }
            }
        });
        console.log(`🎯 Match count for "${testEmail}": ${filteredRes.results.length}`);

    } catch (e) {
        console.error(`❌ Error: ${e.message}`);
    }
}

checkEvents();
