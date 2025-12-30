import { Client } from "@notionhq/client";
import { NOTION_CONFIG } from './server/config.js';

const notion = new Client({ auth: NOTION_CONFIG.API_KEY });

console.log("KEYS_START");
console.log("DB_KEYS:");
for (const key in notion.databases) {
    console.log(key);
}

console.log("DB_QUERY_TYPE:" + typeof notion.databases.query);

if (notion.dataSources) {
    console.log("DS_KEYS:");
    for (const key in notion.dataSources) {
        console.log(key);
    }
}
console.log("KEYS_END");
