import { notion, DS } from './notion.js';
import fs from 'fs';

async function checkSchema() {
    console.log("Checking Schemas...");
    const output = {};

    try {
        console.log("Fetching EVENTS...");
        const eventsDb = await notion.databases.retrieve({ database_id: DS.EVENTS });
        output.EVENTS = { id: eventsDb.id, properties: Object.keys(eventsDb.properties) };

        console.log("Fetching GUESTS...");
        const guestsDb = await notion.databases.retrieve({ database_id: DS.GUESTS });
        output.GUESTS = { id: guestsDb.id, properties: Object.keys(guestsDb.properties) };

        console.log("Fetching TABLES...");
        const tablesDb = await notion.databases.retrieve({ database_id: DS.TABLES });
        output.TABLES = { id: tablesDb.id, properties: Object.keys(tablesDb.properties) };

        fs.writeFileSync('schema_dump.json', JSON.stringify(output, null, 2));
        console.log("Schema dumped to schema_dump.json");

    } catch (error) {
        console.error("Error retrieving schemas:", error);
        fs.writeFileSync('schema_error.txt', JSON.stringify(error, null, 2));
    }
}

checkSchema();
