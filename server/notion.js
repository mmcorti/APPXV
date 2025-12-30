import { Client } from "@notionhq/client";
import { NOTION_CONFIG } from "./config.js";

const notion = new Client({
    auth: NOTION_CONFIG.API_KEY,
});

export default notion;

export const USERS_DB_ID = NOTION_CONFIG.USERS_DB_ID;

export const DS = NOTION_CONFIG.DATA_SOURCE;
export const DB = NOTION_CONFIG.DATABASE;
