
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });
import { Client } from "@notionhq/client";
import { NOTION_CONFIG } from './server/config.js';

const notion = new Client({ auth: NOTION_CONFIG.API_KEY });

async function listEvents() {
    try {
        const response = await notion.databases.query({
            database_id: NOTION_CONFIG.DATABASE.EVENTS,
            page_size: 1
        });
        if (response.results.length > 0) {
            console.log("Valid Event ID:", response.results[0].id);
        } else {
            console.log("No events found.");
        }
    } catch (e) {
        console.error("Error:", e.message);
    }
}
listEvents();
