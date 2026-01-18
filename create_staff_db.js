import { Client } from "@notionhq/client";

const notion = new Client({
    auth: "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",
});

// Parent page ID for the database (using Events database parent)
const EVENTS_DB_ID = "8a693908-f427-4002-9902-4ac86b2e21d4";

async function createStaffDatabase() {
    try {
        // First get the parent of Events database
        console.log("Getting parent information...");
        const eventsDb = await notion.databases.retrieve({ database_id: EVENTS_DB_ID });
        const parent = eventsDb.parent;

        console.log("Creating Staff database...");
        const response = await notion.databases.create({
            parent: parent,
            title: [{ type: "text", text: { content: "APP XV - Staff" } }],
            properties: {
                "Name": { title: {} },
                "Email": { email: {} },
                "Password": { rich_text: {} },
                "Event": {
                    relation: {
                        database_id: EVENTS_DB_ID,
                        single_property: {}
                    }
                },
                "access_invitados": { checkbox: {} },
                "access_mesas": { checkbox: {} },
                "access_link": { checkbox: {} },
                "access_fotowall": { checkbox: {} }
            }
        });

        console.log("✅ Staff database created successfully!");
        console.log("Database ID:", response.id);
        console.log("\nAdd this to your .env.local:");
        console.log(`NOTION_DS_STAFF=${response.id}`);
        console.log(`NOTION_DB_STAFF=${response.id}`);
    } catch (error) {
        console.error("❌ Error creating database:", error.message);
        if (error.body) console.error("Details:", error.body);
    }
}

createStaffDatabase();
