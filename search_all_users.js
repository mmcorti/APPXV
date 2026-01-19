
import { Client } from '@notionhq/client';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const DB_IDS = {
    USERS: '2dfff613-0900-8165-b79b-db1a30f6a793',
    SUBSCRIBERS: '2ecff613-0900-81f5-8d52-f8bcd4bc0940',
    STAFF_ROSTER: '2edff613-0900-815b-bf07-ca361d92c10a'
};

async function checkDB(id, name) {
    try {
        console.log(`\n--- ${name} (${id}) ---`);
        const res = await notion.databases.query({ database_id: id });
        res.results.forEach(p => {
            const props = p.properties;
            const nameProp = Object.values(props).find(pr => pr.type === 'title');
            const nameVal = nameProp?.title?.[0]?.plain_text || 'No Name';
            const emailProp = props.Email || props.correo || props.email;
            let emailVal = 'N/A';
            if (emailProp?.type === 'email') emailVal = emailProp.email;
            else if (emailProp?.type === 'rich_text') emailVal = emailProp.rich_text.map(t => t.plain_text).join('');
            console.log(`- ${nameVal} (${emailVal}) [ID: ${p.id}]`);
        });
    } catch (e) {
        console.error(`ERROR ${name}:`, e.message);
    }
}

async function run() {
    for (const [name, id] of Object.entries(DB_IDS)) {
        await checkDB(id, name);
    }
}
run();
