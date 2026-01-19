import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local', override: true });

console.log('NOTION_DB_STAFF_ROSTER:', process.env.NOTION_DB_STAFF_ROSTER);
console.log('NOTION_DB_SUBSCRIBERS:', process.env.NOTION_DB_SUBSCRIBERS);
console.log('NOTION_DB_STAFF_ASSIGNMENTS:', process.env.NOTION_DB_STAFF_ASSIGNMENTS);
