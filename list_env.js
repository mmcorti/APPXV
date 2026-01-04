import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local', override: true });

console.log("--- ENV KEYS ---");
console.log(Object.keys(process.env).filter(k => k.startsWith('NOTION_')));
console.log("--- END ---");
