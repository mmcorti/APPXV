import { Client } from "@notionhq/client";
import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local', override: true });

const API_KEY = process.env.NOTION_API_KEY;
const GUESTS_DB_ID = process.env.NOTION_DB_GUESTS || "cc6019a6-dfa0-4582-84d2-814e741019ab";

const notion = new Client({ auth: API_KEY });

async function run() {
    try {
        const response = await fetch(`https://api.notion.com/v1/databases/${GUESTS_DB_ID.replace(/-/g, '')}`, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Notion-Version': '2022-06-28',
                'Content-Type': 'application/json'
            }
        });
        const data = await response.json();
        if (data.properties) {
            console.log("Found Properties:", Object.keys(data.properties).sort());
        } else {
            console.log("No properties found or error:", data.message || data);
        }
    } catch (e) {
        console.error("Error:", e.message);
    }
}

run();
