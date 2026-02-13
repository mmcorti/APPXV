
import { Client } from '@notionhq/client';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config({ path: '.env.local', override: true });

const notion = new Client({ auth: process.env.NOTION_API_KEY });

const DS = {
    EVENTS: "8a693908-f427-4002-9902-4ac86b2e21d4",
    USERS: process.env.NOTION_USERS_DB_ID || "d7a654bcdb684918aca9b2164f2bd0d0"
};

function log(msg) {
    console.log(msg);
    try { fs.appendFileSync('output_diagnostic.txt', msg + '\n'); } catch (e) { }
}

async function checkEvents() {
    try {
        fs.writeFileSync('output_diagnostic.txt', ''); // Clear file
        log(`\n🔍 Checking DB: EVENTS (${DS.EVENTS})`);

        try {
            const db = await notion.databases.retrieve({ database_id: DS.EVENTS });

            const creatorProp = db.properties['Creator Email'] || db.properties['Email Creador'] || db.properties['CreatorEmail'] || db.properties['Email'];
            if (creatorProp) {
                log(`✅ Found Creator Email property: "${creatorProp.name}" [Type: ${creatorProp.type}]`);
            } else {
                log(`❌ Creator Email property NOT found. Available: ${Object.keys(db.properties).join(', ')}`);
            }

            const dateProp = db.properties['Date'] || db.properties['Fecha'];
            if (dateProp) log(`✅ Found Date property: "${dateProp.name}" [Type: ${dateProp.type}]`);
            else log(`❌ Date property NOT found. Available props: ${Object.keys(db.properties).join(', ')}`);

            const timeProp = db.properties['Time'] || db.properties['Hora'] || db.properties['Horario'];
            if (timeProp) log(`✅ Found Time property: "${timeProp.name}" [Type: ${timeProp.type}]`);
            else log(`❌ Time property NOT found.`);

            const query = await notion.databases.query({ database_id: DS.EVENTS });
            log(`📄 Total Events: ${query.results.length}`);

            query.results.forEach(p => {
                const props = p.properties;
                const title = props.Name?.title?.[0]?.plain_text || 'No Title';
                const emailValue = props[creatorProp?.name]?.email;
                const dateVal = props[dateProp?.name]?.date?.start;
                const timeVal = props[timeProp?.name]?.rich_text?.[0]?.plain_text;

                log(`   - "${title}" (Creator: ${emailValue || 'EMPTY'}) [Date: ${dateVal}] [Time: ${timeVal}]`);
            });

        } catch (dbError) {
            log(`❌ DB Retrieve Error: ${dbError.message}`);
            if (dbError.code === 'object_not_found') {
                log("The database ID seems invalid or not accessible.");
            }
        }

    } catch (e) {
        log(`❌ Error: ${e.message}\nStack: ${e.stack}`);
    }
}

checkEvents();
