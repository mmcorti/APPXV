import { Client } from "@notionhq/client";

const notion = new Client({ auth: "secret_dummy" });

console.log("Databases keys:", Object.keys(notion.databases));
console.log("Databases prototype keys:", Object.getOwnPropertyNames(Object.getPrototypeOf(notion.databases)));
