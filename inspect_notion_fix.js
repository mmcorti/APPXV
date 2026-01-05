import { Client } from "@notionhq/client";
import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local', override: true });

const API_KEY = process.env.NOTION_API_KEY;
const GUESTS_DB_ID = process.env.NOTION_DB_GUESTS || "cc6019a6-dfa0-4582-84d2-814e741019ab";

const notion = new Client({ auth: API_KEY });

async function run() {
    try {
        console.log("Using Database ID:", GUESTS_DB_ID);
        const db = await notion.databases.retrieve({ database_id: GUESTS_DB_ID });
        console.log("Available Properties:");
        Object.keys(db.properties).forEach(p => {
            console.log(`- ${p} (${db.properties[p].type})`);
        });

        const query = await notion.databases.query({ database_id: GUESTS_DB_ID, page_size: 5 });
        console.log("\nSample Data:");
        query.results.forEach(page => {
            const name = page.properties.Name?.title?.[0]?.plain_text || "unnamed";
            console.log(`Guest: ${name}`);
            Object.keys(page.properties).forEach(p => {
                const prop = page.properties[p];
                if (prop.type === 'number') {
                    console.log(`  ${p}: ${prop.number}`);
                }
            });
        });
    } catch (e) {
        console.error("Error:", e.message);
    }
}

run();
