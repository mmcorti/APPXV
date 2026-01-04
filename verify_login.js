import { Client } from "@notionhq/client";
import { NOTION_CONFIG } from './server/config.js';

const notion = new Client({ auth: NOTION_CONFIG.API_KEY });
console.log("Using API Key length:", NOTION_CONFIG.API_KEY ? NOTION_CONFIG.API_KEY.length : 0);
const USERS_DB_ID = NOTION_CONFIG.USERS_DB_ID;

async function verifyLogin() {
    console.log("Checking for admin user...");
    try {
        console.log("Querying DB:", USERS_DB_ID);
        const response = await notion.dataSources.query({
            data_source_id: USERS_DB_ID,
        });

        console.log(`Found ${response.results.length} users in DB.`);

        const adminEmail = 'admin@appxv.com';
        const adminPass = 'admin123';

        const adminUser = response.results.find(page => {
            const email = page.properties.Email?.rich_text?.[0]?.plain_text;
            return email === adminEmail;
        });

        if (adminUser) {
            console.log("User 'admin@appxv.com' FOUND.");
            const storedPass = adminUser.properties.PasswordHash?.rich_text?.[0]?.plain_text;

            if (storedPass === adminPass) {
                console.log("LOGIN VERIFICATION: SUCCESS");
                console.log("Role:", adminUser.properties.Role?.select?.name || 'guest');
            } else {
                console.log("LOGIN VERIFICATION: FAILED (Password mismatch)");
            }
        } else {
            console.log("User 'admin@appxv.com' NOT FOUND in database.");
        }

    } catch (error) {
        console.log("Error querying connection:", error.message);
    }
}

verifyLogin();
