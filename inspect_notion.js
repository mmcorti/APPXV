import { Client } from "@notionhq/client";
import { NOTION_CONFIG } from './server/config.js';

const notion = new Client({ auth: NOTION_CONFIG.API_KEY });

console.log("Notion Client Keys:", Object.keys(notion));
if (notion.databases) {
    console.log("notion.databases Keys:", Object.keys(notion.databases));
} else {
    console.log("notion.databases is UNDEFINED");
}
