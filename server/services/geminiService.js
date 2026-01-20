import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Generate an image using Gemini/Imagen API
 * @param {string} prompt - The image generation prompt
 * @returns {Promise<string>} - Base64 data URL of the generated image
 */
export async function generateImage(prompt) {
    console.log('[GeminiService] generateImage called with prompt:', prompt);

    if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY not configured in environment');
    }

    try {
        // Use Gemini 2.0 Flash for image generation (supports native image output)
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.0-flash-exp',
            generationConfig: {
                responseModalities: ['image', 'text']
            }
        });

        const result = await model.generateContent({
            contents: [{
                role: 'user',
                parts: [{ text: `Generate an image: ${prompt}. Output only the image.` }]
            }]
        });

        const response = result.response;
        console.log('[GeminiService] Response received');

        // Check for image in response
        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
                return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            }
        }

        // If no image, throw error with response text for debugging
        const text = response.text();
        throw new Error(`No image generated. Response: ${text?.substring(0, 200) || 'empty'}`);
    } catch (error) {
        console.error('[GeminiService] Error:', error);
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

    try {
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.0-flash-exp',
            generationConfig: {
                responseModalities: ['image', 'text']
            }
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
                    { text: `Edit this image: ${prompt}. Output the edited image.` }
                ]
            }]
        });

        const response = result.response;

        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
                return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            }
        }

        throw new Error('No edited image in response');
    } catch (error) {
        console.error('[GeminiService] Edit error:', error);
        throw error;
    }
}
