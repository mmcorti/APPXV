import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local', override: true });
import { Client } from "@notionhq/client";
import { NOTION_CONFIG } from './server/config.js';

const notion = new Client({ auth: NOTION_CONFIG.API_KEY });
const DB_ID = NOTION_CONFIG.DATABASE.GUESTS;

async function test() {
    console.log("Inspecting GUESTS Database properties...");
    try {
        const res = await notion.databases.retrieve({ database_id: DB_ID });
        console.log("PROPERTIES:");
        console.log(Object.keys(res.properties).sort().join(", "));

        const query = await notion.databases.query({ database_id: DB_ID, page_size: 3 });
        console.log("\nSAMPLE GUEST:");
        if (query.results.length > 0) {
            const guest = query.results[0].properties;
            for (const key in guest) {
                if (guest[key].type === 'number') {
                    console.log(`${key}: ${guest[key].number}`);
                }
            }
        }
    } catch (e) {
        console.log("FAILED:", e.message);
    }
}

test();
