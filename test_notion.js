
import { Client } from "@notionhq/client";
import dotenv from 'dotenv';
dotenv.config();

const notion = new Client({
    auth: process.env.NOTION_API_KEY
});

console.log('Notion Client Version Test');
console.log('databases type:', typeof notion.databases);
if (notion.databases) {
    console.log('databases keys:', Object.keys(notion.databases));
    console.log('databases proto keys:', Object.getOwnPropertyNames(Object.getPrototypeOf(notion.databases)));
    console.log('databases.query type:', typeof notion.databases.query);
}
console.log('users type:', typeof notion.users);
