
import dotenv from 'dotenv';
import { Client } from '@notionhq/client';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const notion = new Client({
    auth: process.env.NOTION_API_KEY,
});

const DB_ID = process.env.NOTION_DB_TABLES || "3956fff4-80f7-4bf5-81bb-41df10156a48";
const DS_ID = process.env.NOTION_DS_TABLES || "3956fff4-80f7-4bf5-81bb-41df10156a48";

async function diagnose() {
    console.log("Database ID:", DB_ID);
    console.log("DataSource ID:", DS_ID);
    console.log("API Key present:", !!process.env.NOTION_API_KEY);

    try {
        console.log("\n=== RETRIEVING DATABASE SCHEMA ===");
        const db = await notion.databases.retrieve({ database_id: DB_ID });
        console.log("Database Title:", db.title?.[0]?.plain_text || "Untitled");
        console.log("Properties:");
        Object.entries(db.properties).forEach(([name, prop]) => {
            console.log(`  - ${name}: ${prop.type}`);
        });

        const hasAssignments = !!db.properties['Assignments'] || !!db.properties['Asignaciones'];
        console.log("\nHas Assignments property?", hasAssignments);

        if (!hasAssignments) {
            console.log("\n⚠️  PROBLEM: Assignments property is missing!");
            console.log("Attempting to add it...");

            try {
                await notion.databases.update({
                    database_id: DB_ID,
                    properties: {
                        "Assignments": {
                            rich_text: {}
                        }
                    }
                });
                console.log("✅ Assignments property added successfully.");
            } catch (updateError) {
                console.error("❌ Failed to add Assignments:", updateError.body || updateError.message);
            }
        }

        console.log("\n=== QUERYING EXISTING TABLES ===");
        const query = await notion.databases.query({
            database_id: DS_ID,
            page_size: 5
        });
        console.log(`Found ${query.results.length} existing tables`);

        query.results.forEach((page, idx) => {
            const name = page.properties.Name?.title?.[0]?.plain_text || "Unnamed";
            const capacity = page.properties.Capacity?.number || 0;
            console.log(`  ${idx + 1}. ${name} (capacity: ${capacity})`);
        });

    } catch (e) {
        console.error("❌ Error:", e.body || e.message);
        console.error(e);
    }
}

diagnose();
