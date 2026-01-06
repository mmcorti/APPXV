
import dotenv from 'dotenv';
import { Client } from '@notionhq/client';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const notion = new Client({
    auth: process.env.NOTION_API_KEY,
});

const DB_ID = process.env.NOTION_DB_TABLES || "3956fff4-80f7-4bf5-81bb-41df10156a48";

async function inspectTablesDB() {
    try {
        console.log("=== INSPECTING TABLES DATABASE ===");
        console.log("Database ID:", DB_ID);

        const db = await notion.databases.retrieve({ database_id: DB_ID });

        console.log("\n📋 ALL PROPERTIES:");
        Object.entries(db.properties).forEach(([name, prop]) => {
            console.log(`  "${name}": ${prop.type}`);
        });

        console.log("\n🔍 LOOKING FOR GUEST-RELATED PROPERTIES:");
        const guestProps = Object.keys(db.properties).filter(k =>
            k.toLowerCase().includes('guest') ||
            k.toLowerCase().includes('invitado')
        );
        console.log("Found:", guestProps.length > 0 ? guestProps : "NONE");

        console.log("\n✅ HAS 'Assignments'?", !!db.properties['Assignments']);
        console.log("✅ HAS 'Guests'?", !!db.properties['Guests']);
        console.log("✅ HAS 'Invitados'?", !!db.properties['Invitados']);

    } catch (e) {
        console.error("❌ Error:", e.body || e.message);
    }
}

inspectTablesDB();
