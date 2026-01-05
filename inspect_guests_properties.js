import { Client } from "@notionhq/client";
import { NOTION_CONFIG } from './server/config.js';

const notion = new Client({ auth: NOTION_CONFIG.API_KEY });

async function inspectGuests() {
    try {
        const response = await notion.databases.retrieve({ database_id: NOTION_CONFIG.DATABASE.GUESTS });
        console.log("Property Names:");
        console.log(Object.keys(response.properties).join(", "));

        const query = await notion.databases.query({ database_id: NOTION_CONFIG.DATABASE.GUESTS, page_size: 10 });
        console.log("\nSample Guests data:");
        query.results.forEach(page => {
            const name = page.properties.Name?.title?.[0]?.plain_text || "Unnamed";
            const props = page.properties;
            console.log(`- ${name}:`);
            for (const key of Object.keys(props)) {
                if (props[key].number !== undefined) {
                    console.log(`  ${key}: ${props[key].number}`);
                }
            }
        });
    } catch (error) {
        console.error("Error:", error);
    }
}

inspectGuests();
