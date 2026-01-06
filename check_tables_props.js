require('dotenv').config({ path: '.env.local' });
const { Client } = require('@notionhq/client');

const notion = new Client({
    auth: process.env.NOTION_API_KEY,
});

const DB_ID = process.env.NOTION_TABLES_DB_ID;

async function checkProps() {
    if (!DB_ID) {
        console.error("No Tables DB ID");
        return;
    }
    try {
        const response = await notion.databases.retrieve({ database_id: DB_ID });
        console.log("Database Properties:");
        console.log(Object.keys(response.properties));

        const hasAssignments = !!response.properties['Assignments']; // Or Asignaciones
        console.log("Has Assignments property?", hasAssignments);
    } catch (e) {
        console.error(e);
    }
}

checkProps();
