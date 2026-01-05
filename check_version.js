import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pkg = require("@notionhq/client/package.json");
console.log("Installed version:", pkg.version);
