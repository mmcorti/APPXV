import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local', override: true });
import { Client } from "@notionhq/client";
import { NOTION_CONFIG } from './server/config.js';

const notion = new Client({ auth: NOTION_CONFIG.API_KEY });
const DB_ID = NOTION_CONFIG.DATABASE.GUESTS;

async function fixAndAnalyze() {
    console.log("🔍 Analyzing GUESTS Database...");
    try {
        // 1. Check Schema
        const db = await notion.databases.retrieve({ database_id: DB_ID });
        const props = db.properties;
        const propNames = Object.keys(props);
        console.log("Current Properties:", propNames.join(", "));

        if (!propNames.includes("Companion Names")) {
            console.log("⚠️ Property 'Companion Names' is MISSING! Creating it...");
            await notion.databases.update({
                database_id: DB_ID,
                properties: {
                    "Companion Names": { rich_text: {} }
                }
            });
            console.log("✅ Created 'Companion Names' property.");
        } else {
            console.log("✅ 'Companion Names' property exists.");
        }

        // 2. Analyze Data
        console.log("\n📊 Analyzing Guest Counts...");
        const query = await notion.databases.query({ database_id: DB_ID });

        let stats = {
            total_guests: 0,
            status: { confirmed: 0, declined: 0, pending: 0 },
            allotted: { adults: 0, teens: 0, kids: 0, infants: 0 },
            confirmed: { adults: 0, teens: 0, kids: 0, infants: 0 }
        };

        query.results.forEach(page => {
            const p = page.properties;
            const name = p.Name?.title?.[0]?.plain_text || "Unnamed";
            const status = p.Status?.select?.name || "pending";

            const allotted = {
                adults: p["Adults Allotted"]?.number || 0,
                teens: p["Teens Allotted"]?.number || 0,
                kids: p["Kids Allotted"]?.number || 0,
                infants: p["Infants Allotted"]?.number || 0
            };

            const confirmed = {
                adults: p["Adults Confirmed"]?.number || 0,
                teens: p["Teens Confirmed"]?.number || 0,
                kids: p["Kids Confirmed"]?.number || 0,
                infants: p["Infants Confirmed"]?.number || 0
            };

            // Update Stats
            stats.total_guests++;
            stats.status[status] = (stats.status[status] || 0) + 1;

            stats.allotted.adults += allotted.adults;
            stats.allotted.teens += allotted.teens;
            stats.allotted.kids += allotted.kids;
            stats.allotted.infants += allotted.infants;

            if (status === 'confirmed') {
                stats.confirmed.adults += confirmed.adults;
                stats.confirmed.teens += confirmed.teens;
                stats.confirmed.kids += confirmed.kids;
                stats.confirmed.infants += confirmed.infants;
            }

            // Print suspicious records (e.g. status confirmed but 0 confirmed count)
            if (status === 'confirmed') {
                const totalConf = confirmed.adults + confirmed.teens + confirmed.kids + confirmed.infants;
                if (totalConf === 0) {
                    console.log(`⚠️ WARNING: Guest '${name}' is CONFIRMED but has 0 counts!`);
                }
            }
        });

        console.log("\n📈 Calculated Stats:");
        console.log(JSON.stringify(stats, null, 2));

    } catch (e) {
        console.error("❌ Error:", e.message);
    }
}

fixAndAnalyze();
