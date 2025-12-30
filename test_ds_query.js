import { Client } from "@notionhq/client";
import { NOTION_CONFIG } from './server/config.js';

const notion = new Client({ auth: NOTION_CONFIG.API_KEY });
const USERS_ID = NOTION_CONFIG.USERS_DB_ID;

async function testDataSourceQuery() {
    console.log("Testing dataSources.query...");
    try {
        const response = await notion.dataSources.query({
            data_source_id: USERS_ID,
        });

        console.log(`Query Successful! Found ${response.results.length} items.`);

        const adminEmail = 'admin@appxv.com';
        const adminUser = response.results.find(page => {
            const email = page.properties.Email?.rich_text?.[0]?.plain_text;
            return email === adminEmail;
        });

        if (adminUser) console.log("Admin user FOUND.");
        else console.log("Admin user NOT FOUND.");

    } catch (error) {
        console.log("Error calling dataSources.query:", error.message);
        // Try with database_id just in case
        try {
            console.log("Retrying with database_id param...");
            const response2 = await notion.dataSources.query({
                database_id: USERS_ID,
            });
            console.log("Success with database_id!");
        } catch (err2) {
            console.log("Error with database_id:", err2.message);
        }
    }
}

testDataSourceQuery();
