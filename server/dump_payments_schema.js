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
        const db = await notion.databases.retrieve({ database_id: PAYMENTS_DB_ID });
        fs.writeFileSync('payments_schema.json', JSON.stringify(db.properties, null, 2));
        console.log("Dumped payments schema to payments_schema.json");
    } catch (e) {
        console.error("Error: " + e.message);
    }
}

dump();
