import notion from './server/notion.js';

console.log("Notion keys:", Object.keys(notion));
if (notion.databases) {
    console.log("Notion.databases keys:", Object.keys(notion.databases));
} else {
    console.log("Notion.databases is missing!");
}
