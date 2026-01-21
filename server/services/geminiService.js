import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Generate an image using Gemini 2.5 Flash Image API
 * @param {string} prompt - The image generation prompt
 * @returns {Promise<string>} - Base64 data URL of the generated image
 */
export async function generateImage(prompt) {
    console.log('[GeminiService] generateImage called with prompt:', prompt);
    console.log('[GeminiService] API Key present:', !!process.env.GEMINI_API_KEY);

    if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY not configured in environment');
    }

    // Initialize inside function to ensure env vars are loaded
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    try {
        // Use Gemini 2.5 Flash Image for image generation (Nano Banana model)
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash-preview-05-20',
        });

        const result = await model.generateContent({
            contents: [{
                role: 'user',
                parts: [{ text: `Generate a high-quality image based on this description: ${prompt}` }]
            }],
            generationConfig: {
                responseModalities: ['IMAGE', 'TEXT'],
            }
        });

        const response = result.response;
        console.log('[GeminiService] Response received');

        // Check for image in response
        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
                console.log('[GeminiService] Image found in response');
                return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            }
        }

        // If no image, throw error with response text for debugging
        const text = response.text?.() || '';
        console.log('[GeminiService] No image in response. Text:', text.substring(0, 200));
        throw new Error(`No image generated. Model may not support image output.`);
    } catch (error) {
        console.error('[GeminiService] Error:', error.message);
        throw error;
    }
}

/**
 * Edit an image using Gemini vision capabilities
 * @param {string} base64Image - Base64 encoded image
 * @param {string} prompt - Edit instructions
 * @returns {Promise<string>} - Base64 data URL of the edited image
 */
export async function editImage(base64Image, prompt) {
    console.log('[GeminiService] editImage called');

    if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY not configured in environment');
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    try {
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash-preview-05-20',
        });

        const cleanBase64 = base64Image.split(',')[1] || base64Image;

        const result = await model.generateContent({
            contents: [{
                role: 'user',
                parts: [
                    {
                        inlineData: {
                            mimeType: 'image/png',
                            data: cleanBase64
                        }
                    },
                    { text: `Edit this image based on these instructions: ${prompt}` }
                ]
            }],
            generationConfig: {
                responseModalities: ['IMAGE', 'TEXT'],
            }
        });

        const response = result.response;

        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
                return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            }
        }

        throw new Error('No edited image in response');
    } catch (error) {
        console.error('[GeminiService] Edit error:', error.message);
        throw error;
    }
}
