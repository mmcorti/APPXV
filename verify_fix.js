import { Client } from "@notionhq/client";
const notion = new Client({ auth: "secret" });
if (typeof notion.databases.query === 'function') {
    console.log("VERIFICATION_SUCCESS: usage of query is possible");
} else {
    console.log("VERIFICATION_FAILURE: query is missing");
    console.log("Keys:", Object.keys(notion.databases));
}
