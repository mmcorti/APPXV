
import { Client } from '@notionhq/client';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const USERS_DB = '2dfff613-0900-8165-b79b-db1a30f6a793';

async function run() {
    try {
        const db = await notion.databases.retrieve({ database_id: USERS_DB });
        console.log('--- USERS DB PROPERTIES ---');
        for (const [name, prop] of Object.entries(db.properties)) {
            console.log(`- ${name} (Type: ${prop.type})`);
        }
    } catch (e) {
        console.error('ERROR:', e.message);
    }
}
run();
