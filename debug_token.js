import { NOTION_CONFIG } from './server/config.js';
import fs from 'fs';

const output = `
Token length: ${NOTION_CONFIG.API_KEY.length}
Token start: ${NOTION_CONFIG.API_KEY.substring(0, 10)}
Events DB: ${NOTION_CONFIG.DATA_SOURCE.EVENTS}
`;

fs.writeFileSync('token_debug_out.txt', output);
console.log("Written to token_debug_out.txt");
