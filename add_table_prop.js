
import dotenv from 'dotenv';
import { Client } from '@notionhq/client';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const notion = new Client({
    auth: process.env.NOTION_API_KEY,
});

const DB_ID = process.env.NOTION_TABLES_DB_ID || "3956fff4-80f7-4bf5-81bb-41df10156a48";

async function addProperty() {
    if (!DB_ID) {
        console.error("No Tables DB ID");
        return;
    }
    try {
        console.log(`Adding 'Assignments' property to database ${DB_ID}...`);
        const response = await notion.databases.update({
            database_id: DB_ID,
            properties: {
                "Assignments": {
                    rich_text: {}
                }
            }
        });
        console.log("Success! New properties:", Object.keys(response.properties));
    } catch (e) {
        console.error("Error adding property:", e.body || e);
    }
}

addProperty();
