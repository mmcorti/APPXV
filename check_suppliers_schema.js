import fs from 'fs';
import { notion, DS } from './server/notion.js';

async function checkSchema() {
    try {
        const db = await notion.databases.retrieve({ database_id: DS.SUPPLIERS });
        fs.writeFileSync('suppliers_schema.json', JSON.stringify(db.properties, null, 2));
        console.log("Schema saved to suppliers_schema.json");
    } catch (e) {
        console.error("Error:", e);
    }
}

checkSchema();
