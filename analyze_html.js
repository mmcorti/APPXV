
import fs from 'fs';

const html = fs.readFileSync('debug_html.txt', 'utf8');
const regex = /https:\/\/lh3\.googleusercontent\.com\/[^"]+/g;
let match;
let count = 0;

fs.writeFileSync('analysis_output.txt', '');

while ((match = regex.exec(html)) !== null) {
    count++;
    if (count <= 5) {
        const start = Math.max(0, match.index - 50);
        const end = Math.min(html.length, match.index + match[0].length + 50);
        const context = html.substring(start, end);
        fs.appendFileSync('analysis_output.txt', `Match ${count}:\n${match[0]}\nContext:\n${context}\n-------------------\n`);
    }
}
console.log(`Total matches: ${count}`);
