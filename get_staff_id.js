import { Client } from "@notionhq/client";
import fs from "fs";

const notion = new Client({
    auth: "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",
});

async function findStaffDatabase() {
    try {
        const response = await notion.search({
            query: "APP XV - Staff",
            filter: { property: "object", value: "database" }
        });

        if (response.results.length > 0) {
            const dbId = response.results[0].id;
            fs.writeFileSync("staff_db_id.txt", dbId);
            console.log(dbId);
        } else {
            console.log("NOT_FOUND");
        }
    } catch (error) {
        console.error("ERROR:", error.message);
    }
}

findStaffDatabase();
