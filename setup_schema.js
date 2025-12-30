import { Client } from '@notionhq/client';
import { NOTION_CONFIG } from './server/config.js';

const notion = new Client({ auth: NOTION_CONFIG.API_KEY });

async function addProperty(id, propertyName) {
    if (!id) return;
    console.log(`Checking schema for data source ${id}...`);
    try {
        const ds = await notion.dataSources.retrieve({ data_source_id: id });
        const properties = ds.properties;

        if (properties[propertyName]) {
            console.log(`'${propertyName}' property already exists in ${id}.`);
        } else {
            console.log(`Adding '${propertyName}' property to ${id}...`);
            await notion.dataSources.update({
                data_source_id: id,
                properties: {
                    [propertyName]: {
                        email: {}
                    }
                }
            });
            console.log(`'${propertyName}' property added successfully to ${id}.`);
        }
    } catch (error) {
        console.error(`Error updating ${id}:`, error.body || error);
    }
}

async function run() {
    await addProperty(NOTION_CONFIG.DATA_SOURCE.EVENTS, 'Creator Email');
}

run();
