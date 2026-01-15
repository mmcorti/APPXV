
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

            const response = await fetch(finalUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });
            if (!response.ok) throw new Error(`Failed to fetch album: ${response.status}`);

            const html = await response.text();

            // Robust scraping: find all lh3.googleusercontent.com URLs
            const regex = /https:\/\/lh3\.googleusercontent\.com\/[^"'\s\)]+/g;

            const photos = [];
            const seen = new Set();
            let match;

            while ((match = regex.exec(html)) !== null) {
                const url = match[0];

                // Filter out likely non-photo resources (avatars, small icons which often have /a/ or are very short)
                if (url.includes('/a/') || url.length < 50) continue;

                // Remove parameters to get base URL
                const baseUrl = url.split('=')[0];

                if (seen.has(baseUrl)) continue;
                seen.add(baseUrl);

                // Construct high-quality URL
                // Using w1920-h1080-no for Full HD by default
                const src = `${baseUrl}=w1920-h1080-no`;

                photos.push({
                    id: baseUrl,
                    src: src,
                    width: 1920, // Placeholder
                    height: 1080 // Placeholder
                });
            }

            console.log(`📸 Extracted ${photos.length} photos`);

            if (photos.length === 0) {
                console.warn("⚠️ No photos found with new robust regex.");
            }

            return photos;

        } catch (error) {
            console.error("❌ Google Photos Service Error:", error);
            throw error;
        }
    }
};
