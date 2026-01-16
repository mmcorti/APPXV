/**
 * AI Content Moderation Service
 * Uses OpenAI Vision as primary, with Google Cloud Vision as fallback.
 * 
 * Environment Variables:
 * - OPENAI_API_KEY: OpenAI API key (required for primary)
 * - GOOGLE_VISION_API_KEY: Google Cloud Vision API key (optional fallback)
 */

const OFFENSIVE_WORDS = [
    'puto', 'puta', 'mierda', 'verga', 'culo', 'pene', 'coño', 'fuck', 'shit',
    'dick', 'ass', 'bitch', 'whore', 'cock', 'porn', 'xxx', 'nude', 'naked'
];

export const moderationService = {
    /**
     * Analyze an image for inappropriate content
     * Returns: { safe: boolean, confidence: number, labels: string[], provider: string }
     */
    analyzeImage: async (imageUrl) => {
        console.log(`[Moderation] Analyzing image: ${imageUrl.substring(0, 80)}...`);

        // Try OpenAI first
        if (process.env.OPENAI_API_KEY) {
            try {
                const result = await moderationService.analyzeWithOpenAI(imageUrl);
                if (result) return { ...result, provider: 'openai' };
            } catch (error) {
                console.warn(`[Moderation] OpenAI failed, trying fallback:`, error.message);
            }
        }

        // Fallback to Google Vision
        if (process.env.GOOGLE_VISION_API_KEY) {
            try {
                const result = await moderationService.analyzeWithGoogleVision(imageUrl);
                if (result) return { ...result, provider: 'google' };
            } catch (error) {
                console.warn(`[Moderation] Google Vision failed:`, error.message);
            }
        }

        // If no API available, default to safe (or unsafe based on preference)
        console.warn(`[Moderation] No moderation API available, defaulting to UNSAFE`);
        return {
            safe: false,
            confidence: 0,
            labels: ['no_api_configured'],
            provider: 'none',
            error: 'No moderation API configured'
        };
    },

    /**
     * OpenAI Vision Analysis
     */
    analyzeWithOpenAI: async (imageUrl) => {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: `You are a content moderation system for a party photo slideshow. 
Analyze images and respond ONLY with a JSON object, no other text.

Flag as UNSAFE if the image contains:
- Nudity, sexual content, or suggestive poses
- Violence, blood, injuries, weapons
- Drugs, alcohol bottles/cans prominently displayed
- Offensive gestures (middle finger, etc.)
- Disturbing or inappropriate content
- Memes with offensive text
- Screenshots with inappropriate content
- Content not suitable for all ages at a family event

Flag as SAFE if the image is:
- Normal party/event photos (people smiling, dancing, eating)
- Decorations, venue, food, cake
- Group photos, selfies
- Appropriate content for all audiences

Response format:
{"safe": true/false, "confidence": 0.0-1.0, "labels": ["label1", "label2"]}`
                    },
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: 'Analyze this image for content moderation:' },
                            { type: 'image_url', image_url: { url: imageUrl, detail: 'low' } }
                        ]
                    }
                ],
                max_tokens: 150,
                temperature: 0.1
            })
        });

        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.status}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';

        console.log(`[Moderation] OpenAI response: ${content}`);

        // Parse JSON from response
        try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const result = JSON.parse(jsonMatch[0]);

                // Apply confidence threshold
                if (result.confidence < 0.7) {
                    result.safe = false;
                    result.labels = [...(result.labels || []), 'low_confidence'];
                }

                return result;
            }
        } catch (parseError) {
            console.error(`[Moderation] Failed to parse OpenAI response:`, parseError);
        }

        // Default to unsafe if parsing fails
        return { safe: false, confidence: 0.5, labels: ['parse_error'] };
    },

    /**
     * Google Cloud Vision SafeSearch Analysis
     */
    analyzeWithGoogleVision: async (imageUrl) => {
        const apiKey = process.env.GOOGLE_VISION_API_KEY;
        const endpoint = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                requests: [{
                    image: { source: { imageUri: imageUrl } },
                    features: [
                        { type: 'SAFE_SEARCH_DETECTION' },
                        { type: 'TEXT_DETECTION', maxResults: 5 }
                    ]
                }]
            })
        });

        if (!response.ok) {
            throw new Error(`Google Vision API error: ${response.status}`);
        }

        const data = await response.json();
        const result = data.responses?.[0];

        if (!result) {
            throw new Error('Empty response from Google Vision');
        }

        const safeSearch = result.safeSearchAnnotation || {};
        const textAnnotations = result.textAnnotations || [];

        // Extract detected text
        const detectedText = textAnnotations[0]?.description?.toLowerCase() || '';

        // Check for offensive words in text
        const hasOffensiveText = OFFENSIVE_WORDS.some(word => detectedText.includes(word));

        // Likelihood levels: UNKNOWN, VERY_UNLIKELY, UNLIKELY, POSSIBLE, LIKELY, VERY_LIKELY
        const dangerLevels = ['POSSIBLE', 'LIKELY', 'VERY_LIKELY'];

        const labels = [];
        let safe = true;

        // Check each category
        if (dangerLevels.includes(safeSearch.adult)) {
            labels.push('adult');
            safe = false;
        }
        if (dangerLevels.includes(safeSearch.violence)) {
            labels.push('violence');
            safe = false;
        }
        if (dangerLevels.includes(safeSearch.racy)) {
            labels.push('racy');
            // Racy alone doesn't block, but combined with others does
        }
        if (dangerLevels.includes(safeSearch.medical)) {
            labels.push('medical');
            safe = false;
        }

        if (hasOffensiveText) {
            labels.push('offensive_text');
            safe = false;
        }

        // Calculate confidence based on how clear the result is
        const confidence = safe ? 0.9 : 0.95;

        console.log(`[Moderation] Google Vision result:`, { safe, labels, safeSearch });

        return { safe, confidence, labels, rawScores: safeSearch };
    },

    /**
     * Batch analyze multiple images
     */
    analyzeMultiple: async (images) => {
        const results = [];

        for (const image of images) {
            try {
                const result = await moderationService.analyzeImage(image.src || image.url || image);
                results.push({
                    ...image,
                    moderation: result
                });
            } catch (error) {
                console.error(`[Moderation] Error analyzing image:`, error);
                results.push({
                    ...image,
                    moderation: { safe: false, confidence: 0, labels: ['error'], error: error.message }
                });
            }
        }

        return results;
    },

    /**
     * Filter to only safe images
     */
    filterSafe: (moderatedImages) => {
        return moderatedImages.filter(img => img.moderation?.safe === true);
    },

    /**
     * Get blocked images
     */
    filterBlocked: (moderatedImages) => {
        return moderatedImages.filter(img => img.moderation?.safe === false);
    }
};
