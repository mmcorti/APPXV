
/**
 * Service to extract photos from a public Google Photos shared album.
 * Note: This relies on parsing the HTML structure which may change.
 * Updated to use fetch() for Vercel/serverless compatibility.
 */
export const googlePhotosService = {
    /**
     * Resolves a URL to its final destination (handling short links like photos.app.goo.gl)
     * Uses fetch with redirect: 'manual' to capture the Location header
     */
    resolveUrl: async (url) => {
        console.log(`[GooglePhotos] Resolving URL: ${url}`);

        if (!url.includes('goo.gl') && !url.includes('google.com')) {
            console.log(`[GooglePhotos] URL does not need resolution`);
            return url;
        }

        try {
            // Use fetch with manual redirect to get the Location header
            const response = await fetch(url, {
                method: 'HEAD',
                redirect: 'manual',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            const location = response.headers.get('location');
            console.log(`[GooglePhotos] Response status: ${response.status}, Location: ${location}`);

            if (response.status >= 300 && response.status < 400 && location) {
                console.log(`[GooglePhotos] Resolved to: ${location}`);
                return location;
            }

            console.log(`[GooglePhotos] No redirect, using original URL`);
            return url;
        } catch (error) {
            console.error(`[GooglePhotos] Error resolving URL:`, error.message);
            // If resolution fails, try using the original URL
            return url;
        }
    },

    /**
     * Fetches the album page and extracts image URLs.
     */
    getAlbumPhotos: async (albumUrl) => {
        try {
            console.log(`[GooglePhotos] Getting photos from: ${albumUrl}`);

            const finalUrl = await googlePhotosService.resolveUrl(albumUrl);
            console.log(`[GooglePhotos] Fetching album HTML from: ${finalUrl}`);

            const response = await fetch(finalUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5'
                }
            });

            console.log(`[GooglePhotos] Fetch response status: ${response.status}`);

            if (!response.ok) {
                throw new Error(`Failed to fetch album: ${response.status} ${response.statusText}`);
            }

            const html = await response.text();
            console.log(`[GooglePhotos] HTML length: ${html.length} characters`);

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
                const src = `${baseUrl}=w1920-h1080-no`;

                photos.push({
                    id: baseUrl,
                    src: src,
                    width: 1920,
                    height: 1080
                });
            }

            console.log(`[GooglePhotos] Extracted ${photos.length} photos`);

            if (photos.length === 0) {
                console.warn(`[GooglePhotos] No photos found. HTML snippet: ${html.substring(0, 500)}`);
            }

            return photos;

        } catch (error) {
            console.error(`[GooglePhotos] Error:`, error.message);
            throw error;
        }
    }
};
