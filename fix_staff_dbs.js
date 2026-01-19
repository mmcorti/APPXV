// Script to add Password property to Staff Roster
import 'dotenv/config';
import { Client } from '@notionhq/client';

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const STAFF_ROSTER_ID = "2edff613-0900-815b-bf07-ca361d92c10a";

async function addPassword() {
    try {
        console.log("Adding Password property to Staff Roster...");
        await notion.databases.update({
            database_id: STAFF_ROSTER_ID,
            properties: {
                "Password": { rich_text: {} }
            }
        });
        console.log("Password property added successfully.");

    } catch (error) {
        console.error("Error:", error.message);
    }
}

addPassword();
