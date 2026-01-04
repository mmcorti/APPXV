import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local', override: true });

const keys = ['NOTION_API_KEY', 'NOTION_USERS_DB_ID'];
console.log("--- ENV CHECK ---");
keys.forEach(k => {
    const val = process.env[k];
    console.log(`${k}: ${val ? 'LOADED (Length: ' + val.length + ')' : 'MISSING'}`);
});
console.log("--- END ---");
