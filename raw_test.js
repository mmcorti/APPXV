import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local', override: true });

async function test() {
    console.log("Testing Notion API key via fetch...");
    const key = process.env.NOTION_API_KEY;
    const res = await fetch('https://api.notion.com/v1/users/me', {
        headers: {
            'Authorization': `Bearer ${key}`,
            'Notion-Version': '2022-06-28'
        }
    });
    const data = await res.json();
    console.log("Bot Name:", data.name);
    console.log("Status:", res.status);
    if (data.error) console.log("Error:", data.message);
}

test();
