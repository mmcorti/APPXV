
import { Client } from '@notionhq/client';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const USERS_DB = '2dfff613-0900-8165-b79b-db1a30f6a793';

async function run() {
    try {
        console.log('--- USERS ---');
        const res = await notion.databases.query({ database_id: USERS_DB });
        res.results.forEach(p => {
            const props = p.properties;
            const name = props.Name?.title?.[0]?.plain_text;
            const email = props.Email?.email;
            console.log(`- ${name} (${email})`);
        });
    } catch (e) {
        console.error('ERROR:', e.message);
    }
}
run();
