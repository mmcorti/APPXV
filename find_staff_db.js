import { Client } from "@notionhq/client";

const notion = new Client({
    auth: "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",
});

async function findStaffDatabase() {
    try {
        console.log("Searching for Staff database...");
        const response = await notion.search({
            query: "APP XV - Staff",
            filter: { property: "object", value: "database" }
        });

        if (response.results.length > 0) {
            const db = response.results[0];
            console.log("✅ Found Staff database!");
            console.log("Full Database ID:", db.id);
            console.log("\nAdd this to your .env.local:");
            console.log(`NOTION_DS_STAFF=${db.id}`);
            console.log(`NOTION_DB_STAFF=${db.id}`);
        } else {
            console.log("❌ Staff database not found");
        }
    } catch (error) {
        console.error("Error:", error.message);
    }
}

findStaffDatabase();
