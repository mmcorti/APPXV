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
const EXPENSES_DB_ID = "57ee8337f02b4ffb9dc8d3a57d61a3bd";

async function dump() {
    try {
        const response = await notion.databases.query({
            database_id: EXPENSES_DB_ID,
            page_size: 1
        });
        if (response.results.length > 0) {
            fs.writeFileSync('expense_dump_fixed.json', JSON.stringify(response.results[0].properties, null, 2));
            console.log("Dumped 1 expense to expense_dump_fixed.json");
        } else {
            console.log("No expenses found.");
        }
    } catch (e) {
        console.error("Error: " + e.message);
    }
}

dump();
