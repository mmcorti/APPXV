import fs from 'fs';
try {
    const data = JSON.parse(fs.readFileSync('expense_dump.json', 'utf8'));
    for (const [key, val] of Object.entries(data)) {
        console.log(`${key}: ${val.type}`);
    }
} catch (e) {
    console.error(e);
}
