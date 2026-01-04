import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local', override: true });
import { Client } from "@notionhq/client";
import { NOTION_CONFIG } from './server/config.js';

const notion = new Client({ auth: NOTION_CONFIG.API_KEY });
const DB_ID = NOTION_CONFIG.USERS_DB_ID;

async function test() {
    console.log("Testing as DATABASE...");
    try {
        const res = await notion.databases.query({ database_id: DB_ID });
        console.log("Database Query SUCCESS, found:", res.results.length);
    } catch (e) {
        console.log("Database Query FAILED:", e.message);
    }

    console.log("\nTesting as DATA_SOURCE...");
    try {
        const res = await notion.dataSources.query({ data_source_id: DB_ID });
        console.log("DataSource Query SUCCESS, found:", res.results.length);
    } catch (e) {
        console.log("DataSource Query FAILED:", e.message);
    }
}

test();
