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
     * @param {string} imageUrl - URL of the image to analyze
     * @param {object} settings - Filter settings from frontend
     * Returns: { safe: boolean, confidence: number, labels: string[], provider: string }
     */
    analyzeImage: async (imageUrl, settings = null) => {
        console.log(`[Moderation] Analyzing image: ${imageUrl.substring(0, 80)}...`);
        console.log(`[Moderation] Settings:`, settings);

        // If mode is 'off', return safe immediately (no filtering)
        if (settings?.mode === 'off') {
            return { safe: true, confidence: 1.0, labels: [], provider: 'none', mode: 'off' };
        }

        // If mode is 'manual', return unsafe immediately (all blocked for manual review)
        if (settings?.mode === 'manual') {
            return { safe: false, confidence: 1.0, labels: ['manual_review'], provider: 'manual', mode: 'manual' };
        }

        // AI mode - use OpenAI or Google Vision
        const filters = settings?.filters || {};
        const confidenceThreshold = filters.confidenceThreshold || 70;

        // Try OpenAI first
        if (process.env.OPENAI_API_KEY) {
            try {
                const result = await moderationService.analyzeWithOpenAI(imageUrl, filters, confidenceThreshold);
                if (result) return { ...result, provider: 'openai', mode: 'ai' };
            } catch (error) {
                console.warn(`[Moderation] OpenAI failed, trying fallback:`, error.message);
            }
        }

        // Fallback to Google Vision
        if (process.env.GOOGLE_VISION_API_KEY) {
            try {
                const result = await moderationService.analyzeWithGoogleVision(imageUrl, filters);
                if (result) return { ...result, provider: 'google', mode: 'ai' };
            } catch (error) {
                console.warn(`[Moderation] Google Vision failed:`, error.message);
            }
        }

        // If no API available, default to unsafe
        console.warn(`[Moderation] No moderation API available, defaulting to UNSAFE`);
        return {
            safe: false,
            confidence: 0,
            labels: ['no_api_configured'],
            provider: 'none',
            mode: 'ai',
            error: 'No moderation API configured'
        };
    },

    /**
     * OpenAI Vision Analysis with dynamic filters
     */
    analyzeWithOpenAI: async (imageUrl, filters = {}, confidenceThreshold = 70) => {
        // Build dynamic prompt based on enabled filters
        const unsafeRules = [];

        if (filters.nudity !== false) {
            unsafeRules.push('- Nudity: full or partial nudity, exposed genitals, exposed breasts');
        }
        if (filters.suggestivePoses === true) {
            unsafeRules.push('- Suggestive poses: provocative poses, seductive posing (NOT normal party dancing or selfies)');
        }
        if (filters.violence !== false) {
            unsafeRules.push('- Violence, blood, injuries, weapons');
        }
        if (filters.drugs !== false) {
            unsafeRules.push('- Drugs, alcohol bottles/cans prominently displayed');
        }
        if (filters.hateSymbols !== false) {
            unsafeRules.push('- Hate symbols, discriminatory or extremist content');
        }
        if (filters.offensiveLanguage !== false) {
            unsafeRules.push('- Offensive gestures (middle finger, etc.)');
            unsafeRules.push('- Memes or text with offensive language, insults, or slurs');
        }
        if (filters.hateSpeech !== false) {
            unsafeRules.push('- Hate speech, discriminatory, or threatening text');
        }
        if (filters.personalData !== false) {
            unsafeRules.push('- Visible personal data: phone numbers, addresses, IDs, credit cards');
        }

        // Default rules always applied
        unsafeRules.push('- Disturbing or inappropriate content');
        unsafeRules.push('- Content not suitable for all ages at a family event');

        const systemPrompt = `You are a content moderation system for a party photo slideshow.
Analyze images and respond ONLY with a JSON object, no other text.

Flag as UNSAFE if the image contains:
${unsafeRules.join('\n')}

Flag as SAFE if the image is:
- Normal party/event photos (people smiling, dancing, eating)
- Decorations, venue, food, cake
- Group photos, selfies
- Appropriate content for all audiences

Response format:
{"safe": true/false, "confidence": 0.0-1.0, "labels": ["label1", "label2"]}`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
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
