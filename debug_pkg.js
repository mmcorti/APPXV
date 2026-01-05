
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

try {
    const pkgPath = require.resolve('@notionhq/client/package.json');
    console.log(`Package Path: ${pkgPath}`);
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    console.log(`Installed @notionhq/client Version: ${pkg.version}`);
} catch (e) {
    console.error('Error finding package:', e);
}
