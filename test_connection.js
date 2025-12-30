import { Client } from "@notionhq/client";
import { NOTION_CONFIG } from './server/config.js';

const notion = new Client({ auth: NOTION_CONFIG.API_KEY });

async function testConnection() {
    try {
        console.log("Testing Notion API connection...");
        // Making a lightweight call to check auth
        const response = await notion.users.me({});
        console.log("Connection Successful!");
        console.log("Bot User:", response.name);
    } catch (error) {
        console.log("Connection Failed!");
        console.log("Error Code:", error.code);
        console.log("Error Message:", error.message);
    }
}

testConnection();
