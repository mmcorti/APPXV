// Get all Staff related database IDs
import 'dotenv/config';
import { Client } from '@notionhq/client';

const notion = new Client({ auth: process.env.NOTION_API_KEY });

async function getIds() {
    const search = await notion.search({
        query: "Staff",
        filter: { property: "object", value: "database" }
    });

    console.log("=== STAFF DATABASE IDs ===");
    search.results.forEach(db => {
        const title = db.title?.[0]?.plain_text || "N/A";
        console.log(`${title}: ${db.id}`);
    });
}

getIds();
