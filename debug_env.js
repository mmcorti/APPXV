import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local', override: true });
import { NOTION_CONFIG } from './server/config.js';

console.log("--- DEBUG ENV ---");
console.log("NOTION_API_KEY length:", process.env.NOTION_API_KEY ? process.env.NOTION_API_KEY.length : 0);
console.log("NOTION_API_KEY prefix:", process.env.NOTION_API_KEY ? process.env.NOTION_API_KEY.substring(0, 7) + "..." : "MISSING");
console.log("NOTION_CONFIG.API_KEY length:", NOTION_CONFIG.API_KEY ? NOTION_CONFIG.API_KEY.length : 0);
console.log("--- END DEBUG ---");
