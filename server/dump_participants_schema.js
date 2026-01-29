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
const PARTICIPANTS_DB_ID = "24b56421c62b4e6eaac480216407e909";

async function dump() {
    try {
        const db = await notion.databases.retrieve({ database_id: PARTICIPANTS_DB_ID });
        fs.writeFileSync('participants_schema.json', JSON.stringify(db.properties, null, 2));
        console.log("Dumped participants schema to participants_schema.json");
    } catch (e) {
        console.error("Error: " + e.message);
    }
}

dump();
