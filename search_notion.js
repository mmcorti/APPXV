
import { Client } from '@notionhq/client';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });

const notion = new Client({ auth: process.env.NOTION_API_KEY });

async function run() {
    try {
        const res = await notion.search({ filter: { property: 'object', value: 'database' } });
        console.log(`Found ${res.results.length} accessible databases:`);
        res.results.forEach(db => {
            const title = db.title?.[0]?.plain_text || 'Untitled';
            console.log(`- ${title} (ID: ${db.id})`);
        });
    } catch (e) {
        console.error('ERROR:', e.message);
    }
}
run();
