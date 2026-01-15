
import { googlePhotosService } from './server/services/googlePhotos.js';
import fs from 'fs';

const TEST_URL = "https://photos.google.com/share/AF1QipN8ObNPswUWnzKz8bUMfDcpdU5V6tgEp6yunec8wz8txGFI4EY98pWgtv0vJ8rb9Q?key=bEFkUmNQT0JvdjZaVDVBbENtRXgtQjRPbHVjejd3";

async function run() {
    try {
        console.log("Testing URL:", TEST_URL);
        const resolved = await googlePhotosService.resolveUrl(TEST_URL);
        console.log("Resolved:", resolved);

        const response = await fetch(resolved);
        const html = await response.text();
        fs.writeFileSync('debug_html.txt', html);
        console.log("HTML dumped to debug_html.txt. Size:", html.length);

        const photos = await googlePhotosService.getAlbumPhotos(TEST_URL);
        console.log("Photos found:", photos.length);
    } catch (error) {
        console.error("FAILED:", error);
    }
}

run();
