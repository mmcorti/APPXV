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

        // If no API available, default to unsafe with clear message
        const openaiConfigured = !!process.env.OPENAI_API_KEY;
        const googleConfigured = !!process.env.GOOGLE_VISION_API_KEY;
        console.warn(`[Moderation] No moderation API available. OpenAI configured: ${openaiConfigured}, Google configured: ${googleConfigured}`);

        return {
            safe: false,
            confidence: 0,
            labels: ['api_error'],
            provider: 'none',
            mode: 'ai',
            error: openaiConfigured ? 'Error al conectar con la API' : 'OPENAI_API_KEY no configurada en el servidor'
        };
    },

    /**
     * OpenAI Vision Analysis with dynamic filters
     */
    analyzeWithOpenAI: async (imageUrl, filters = {}, confidenceThreshold = 70) => {
        // Build dynamic prompt based on enabled filters
        const unsafeRules = [];
        const allowedContent = []; /* Explicitly allow content if filter is OFF */

        if (filters.nudity !== false) {
            unsafeRules.push('- Nudity: full or partial nudity, exposed genitals, exposed breasts');
        } else {
            allowedContent.push('- Partial nudity, artistic nudity, fashion, or swimwear');
        }

        if (filters.suggestivePoses === true) {
            unsafeRules.push('- Suggestive poses: provocative poses, seductive posing (NOT normal party dancing or selfies)');
        } else {
            allowedContent.push('- Poses, dancing, or selfies');
        }

        if (filters.violence !== false) {
            unsafeRules.push('- Violence, blood, severe injuries, weapons');
        }

        if (filters.drugs !== false) {
            unsafeRules.push('- Illegal drugs, drug paraphernalia');
            // Note: Alcohol is usually fine at parties unless specifically flagged
            if (filters.alcohol === true) unsafeRules.push('- Excessive alcohol consumption');
        }

        if (filters.hateSymbols !== false) {
            unsafeRules.push('- Hate symbols, swastikas, extremist imagery');
        }

        if (filters.offensiveLanguage !== false) {
            unsafeRules.push('- Middle finger or offensive hand gestures');
            unsafeRules.push('- Text containing heavy profanity or insults');
        }

        if (filters.hateSpeech !== false) {
            unsafeRules.push('- Text containing hate speech or discrimination');
        }

        if (filters.personalData !== false) {
            unsafeRules.push('- Clearly visible private documents (IDs, credit cards)');
        }

        // Generic fallback - make it less aggressive so it doesn't override specific "OFF" settings
        unsafeRules.push('- Extremely disturbing gore or hardcore pornography');

        const systemPrompt = `You are a strict content moderation system for a private party photo feed.
Analyze images and respond ONLY with a JSON object.

RULES FOR "UNSAFE":
Flag as UNSAFE (safe: false) ONLY if the image matches one of these strict criteria:
${unsafeRules.join('\n')}

RULES FOR "SAFE":
Flag as SAFE (safe: true) if the image DOES NOT match the strict criteria above, or if it contains:
${allowedContent.join('\n')}
- Normal party/event photos (people smiling, dancing, eating, drinking)
- Funny faces, joking posing
- Group photos, selfies
- Food, cake, decorations

REQUIRED JSON FORMAT:
{"safe": boolean, "confidence": 0.0-1.0, "labels": ["label_code"]}

Label Codes (use only these):
- "nudity" (for Nudity)
- "suggestive" (for Suggestive poses)
- "violence" (for Violence)
- "drugs" (for Drugs)
- "hate" (for Hate symbols/speech)
- "offensive" (for Offensive language/gestures)
- "personal_data" (for Personal Data)
- "gore" (for generic disturbing content)
`;

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
                            { type: 'text', text: 'Analyze this image and return the JSON decision:' },
                            { type: 'image_url', image_url: { url: imageUrl, detail: 'low' } }
                        ]
                    }
                ],
                max_tokens: 150,
                temperature: 0.0
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

                // Convert threshold from percentage (0-100) to decimal (0-1)
                const thresholdDecimal = confidenceThreshold / 100;

                console.log(`[Moderation] Parsed result: safe=${result.safe}, confidence=${result.confidence}, threshold=${thresholdDecimal}`);

                // Apply confidence threshold - ONLY mark as unsafe if it's unsafe AND confidence is high enough
                // If safe=true, keep it safe
                // If safe=false but confidence is below threshold, mark as safe (not confident enough to block)
                if (result.safe === false && result.confidence < thresholdDecimal) {
                    console.log(`[Moderation] Overriding to SAFE: confidence ${result.confidence} is below threshold ${thresholdDecimal}`);
                    result.safe = true;
                    result.labels = [...(result.labels || []), 'low_confidence_override'];
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
            labels.push('nudity'); // Standardize label
            safe = false;
        }
        if (dangerLevels.includes(safeSearch.violence)) {
            labels.push('violence');
            safe = false;
        }
        if (dangerLevels.includes(safeSearch.racy)) {
            labels.push('suggestive'); // Standardize label
            // Racy alone doesn't block unless very likely? Or based on config?
            // Existing logic was permissive on racy, keeping it for now but applying label.
        }
        if (dangerLevels.includes(safeSearch.medical)) {
            labels.push('gore'); // Standardize label
            safe = false;
        }

        if (hasOffensiveText) {
            labels.push('offensive');
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
