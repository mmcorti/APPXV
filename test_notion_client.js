import { Client } from "@notionhq/client";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

try {
    const pkg = require("@notionhq/client/package.json");
    console.log("Notion Client Version:", pkg.version);
} catch (e) {
    console.log("Could not load package.json");
}

const notion = new Client({ auth: "secret_dummy" });

console.log("Has databases.query:", typeof notion.databases?.query);
console.log("Has databases.list:", typeof notion.databases?.list);

try {
    if (notion.databases) {
        console.log("Databases keys:", Object.getOwnPropertyNames(notion.databases));
        const proto = Object.getPrototypeOf(notion.databases);
        if (proto) {
            console.log("Databases proto keys:", Object.getOwnPropertyNames(proto));
        }
    } else {
        console.log("notion.databases is undefined");
    }
} catch (e) {
    console.log("Error inspecting keys:", e.message);
}
