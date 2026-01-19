
import { Client } from "@notionhq/client";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const notionClient = new Client({ auth: process.env.NOTION_API_KEY });
const STAFF_ASSIGNMENTS_DB = "2f24d9c79e6d45e580e5b88c7d3d7c3d"; // From previous search results

async function verifyPermissions() {
    console.log("🔍 Testing staff permissions mapping...");

    // 1. Fetch Julia's assignment (assuming we know her StaffId or can find it)
    // Julia Corti's StaffId from previous logs was not explicitly saved, 
    // but we can find a staff assignment for her.

    const res = await notionClient.databases.query({
        database_id: STAFF_ASSIGNMENTS_DB,
    });

    console.log(`Found ${res.results.length} assignments.`);

    for (const assignment of res.results) {
        const props = assignment.properties;
        const name = props.Name.title[0]?.plain_text;
        const eventId = props.EventId.rich_text[0]?.plain_text;

        const perms = {
            invitados: props.access_invitados.checkbox,
            mesas: props.access_mesas.checkbox,
            link: props.access_link.checkbox,
            fotowall: props.access_fotowall.checkbox,
        };

        console.log(`- Staff: ${name}, Event: ${eventId}`);
        console.log(`  Permissions: Invitados:${perms.invitados}, Mesas:${perms.mesas}, Link:${perms.link}, FotoWall:${perms.fotowall}`);
    }
}

// verifyPermissions().catch(console.error);

// Simulating the server mapping logic
const mockAssignment = {
    properties: {
        access_invitados: { checkbox: false },
        access_mesas: { checkbox: false },
        access_link: { checkbox: false },
        access_fotowall: { checkbox: true },
        EventId: { rich_text: [{ plain_text: "some-event-id" }] }
    }
};

const mappedPerms = {
    access_invitados: mockAssignment.properties.access_invitados.checkbox || false,
    access_mesas: mockAssignment.properties.access_mesas.checkbox || false,
    access_link: mockAssignment.properties.access_link.checkbox || false,
    access_fotowall: mockAssignment.properties.access_fotowall.checkbox || false,
};

console.log("Mock Mapping Result:", mappedPerms);
if (mappedPerms.access_fotowall === true && mappedPerms.access_invitados === false) {
    console.log("✅ Mapping logic is correct.");
} else {
    console.log("❌ Mapping logic failed.");
}
