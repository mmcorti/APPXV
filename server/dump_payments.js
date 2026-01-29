import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env.local'), override: true });
import { Client } from '@notionhq/client';

const API_KEY = process.env.NOTION_API_KEY;

const notion = new Client({ auth: API_KEY });
const PAYMENTS_DB_ID = "e9c2d7d9d030480481d9a10b797514a2";

async function dump() {
    try {
        const response = await notion.databases.query({
            database_id: PAYMENTS_DB_ID,
            page_size: 1
        });
        if (response.results.length > 0) {
            fs.writeFileSync('payments_dump.json', JSON.stringify(response.results[0].properties, null, 2));
            console.log("Dumped 1 payment.");
        } else {
            console.log("No payments found.");
        }
    } catch (e) {
        console.error("Error: " + e.message);
    }
}

dump();
