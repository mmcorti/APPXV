
import https from 'https';

/**
 * Service to extract photos from a public Google Photos shared album.
 * Note: This relies on parsing the HTML structure which may change.
 */
export const googlePhotosService = {
    /**
     * Resolves a URL to its final destination (handling short links like photos.app.goo.gl)
     */
    resolveUrl: async (url) => {
        return new Promise((resolve, reject) => {
            if (!url.includes('goo.gl') && !url.includes('google.com')) {
                return resolve(url);
            }

            https.get(url, (res) => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    resolve(res.headers.location);
                } else {
                    resolve(url);
                }
            }).on('error', (err) => reject(err));
        });
    },

    /**
     * Fetches the album page and extracts image URLs.
     */
    getAlbumPhotos: async (albumUrl) => {
        try {
            const finalUrl = await googlePhotosService.resolveUrl(albumUrl);
            console.log(`🔗 Resolved URL: ${finalUrl}`);

            const response = await fetch(finalUrl);
            if (!response.ok) throw new Error(`Failed to fetch album: ${response.status}`);

            const html = await response.text();

            // Regex to find image URLs in the specific Google Photos structure
            // We look for patterns like: ["https://lh3.googleusercontent.com/...", width, height]
            // This is a common heuristic for their packed JSON data.
            const regex = /\["(https:\/\/lh3\.googleusercontent\.com\/[^"]+)",\s*(\d+),\s*(\d+)\]/g;

            const photos = [];
            let match;
            const seen = new Set();

            while ((match = regex.exec(html)) !== null) {
                const url = match[1];
                const width = parseInt(match[2]);
                const height = parseInt(match[3]);

                // Filter out small icons/thumbnails if possible (arbitrary threshold like 100px)
                if (width > 100 && !seen.has(url)) {
                    seen.add(url);
                    photos.push({
                        url: url,
                        width: width,
                        height: height,
                        // Add base params to ensure high quality
                        src: `${url}=w${Math.min(width, 1920)}-h${Math.min(height, 1080)}-no`
                    });
                }
            }

            // Deduplicate logic often needed because same URL appears multiple times in different contexts
            console.log(`📸 Extracted ${photos.length} photos`);

            if (photos.length === 0) {
                console.warn("⚠️ No photos found. Google structure might have changed or album is empty.");
            }

            return photos;

        } catch (error) {
            console.error("❌ Google Photos Service Error:", error);
            throw error;
        }
    }
};
