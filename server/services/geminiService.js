import { GoogleGenerativeAI } from '@google/generative-ai';

// Nano Banana model for image generation (2026)
const IMAGE_MODEL = 'gemini-2.5-flash-image';
const TEXT_MODEL = 'gemini-1.0-pro'; // Using 1.0-pro for stability/compatibility with v1beta as suggested

/**
 * Generate an image using Gemini API
 * @param {string} prompt - The image generation prompt
 * @returns {Promise<string>} - Base64 data URL of the generated image
 */
export async function generateImage(prompt) {
    console.log('[GeminiService] generateImage called with prompt:', prompt);
    console.log('[GeminiService] Using model:', IMAGE_MODEL);

    if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY not configured in environment');
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    try {
        const model = genAI.getGenerativeModel({ model: IMAGE_MODEL });

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

        // If no image, check text response
        const text = response.text?.() || '';
        console.log('[GeminiService] No image in response. Text:', text.substring(0, 200));
        throw new Error(`No image generated. Model response: ${text.substring(0, 100)}`);
    } catch (error) {
        console.error('[GeminiService] Error:', error.message);
        throw error;
    }
}

/**
 * Edit an image using Gemini vision capabilities
 * @param {string} base64Image - Base64 encoded image (data URL format)
 * @param {string} prompt - Edit instructions
 * @returns {Promise<string>} - Base64 data URL of the edited image
 */
export async function editImage(base64Image, prompt) {
    console.log('[GeminiService] editImage called');
    console.log('[GeminiService] Using model:', IMAGE_MODEL);

    if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY not configured in environment');
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    try {
        const model = genAI.getGenerativeModel({ model: IMAGE_MODEL });

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
                    { text: `Edit this image based on these instructions: ${prompt}. Return the modified image.` }
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
/**
 * Generate trivia questions using Gemini AI
 * @param {string} theme - The theme of the questions
 * @param {number} count - Number of questions to generate
 * @returns {Promise<Array>} - List of trivia questions with options and correct answer
 */
export async function generateTriviaQuestions(theme, count = 5) {
    console.log(`[GeminiService] generateTriviaQuestions called for theme: ${theme}, count: ${count}`);

    if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY not configured in environment');
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    try {
        const model = genAI.getGenerativeModel({
            model: TEXT_MODEL,
            generationConfig: {
                responseMimeType: "application/json",
            }
        });

        const prompt = `Generate ${count} trivia questions about the theme: "${theme}". 
        Return ONLY a JSON array of objects. 
        Each object MUST have the following structure:
        {
            "text": "The question text",
            "options": [
                {"key": "A", "text": "Option A text"},
                {"key": "B", "text": "Option B text"},
                {"key": "C", "text": "Option C text"},
                {"key": "D", "text": "Option D text"}
            ],
            "correctOption": "A", // Or B, C, D
            "durationSeconds": 15
        }
        The questions should be fun, varying in difficulty, and suitable for a general audience.
        Ensure one option is clearly correct.`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        console.log('[GeminiService] AI Response received');

        return JSON.parse(responseText);
    } catch (error) {
        console.error('[GeminiService] Question generation error:', error.message);
        throw error;
    }
}

/**
 * Generate Bingo prompts using Gemini AI
 * @param {string} theme - The theme of the bingo
 * @param {number} count - Number of prompts to generate
 * @returns {Promise<Array>} - List of bingo prompts with text and icon
 */
export async function generateBingoPrompts(theme, count = 9) {
    console.log(`[GeminiService] generateBingoPrompts called for theme: ${theme}, count: ${count}`);

    if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY not configured in environment');
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    try {
        const model = genAI.getGenerativeModel({
            model: TEXT_MODEL,
            generationConfig: {
                responseMimeType: "application/json",
            }
        });

        const prompt = `Generate ${count} Photo Bingo challenges about the theme: "${theme}". 
        Return ONLY a JSON array of objects.
        Each object MUST have the following structure:
        {
            "text": "Short challenge description (max 40 chars)",
            "icon": "Material Symbol name (e.g. photo_camera, star, cake, etc)"
        }
        The challenges should be visual things people can take photos of at an event.
        Keep text short and fun.`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        console.log('[GeminiService] AI Bingo Response received');

        return JSON.parse(responseText);
    } catch (error) {
        console.error('[GeminiService] Bingo generation error:', error.message);
        throw error;
    }
}

/**
 * Generate Impostor tasks using Gemini AI
 * @param {string} theme - The theme of the event
 * @returns {Promise<Object>} - Object with mainPrompt and impostorPrompt
 */
export async function generateImpostorTasks(theme) {
    console.log(`[GeminiService] generateImpostorTasks called for theme: ${theme}`);

    if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY not configured in environment');
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    try {
        const model = genAI.getGenerativeModel({
            model: TEXT_MODEL,
            generationConfig: {
                responseMimeType: "application/json",
            }
        });

        const prompt = `Generate a pair of tasks for the game "The Impostor" based on the theme: "${theme}".
        Return ONLY a JSON object with this structure:
        {
            "mainPrompt": "Instructions for regular players (Civilians). They must take a photo of something specific related to the theme.",
            "impostorPrompt": "Instructions for the Impostor. It must be slightly different/vague but plausible so they fit in, OR explicitly telling them to fake it."
        }
        Example for "Wedding":
        Civilians: "Take a photo of the bride smiling."
        Impostor: "Take a photo of someone in a white dress."
        
        Use the theme provided. Language: Spanish.`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        console.log('[GeminiService] AI Impostor Response received');

        return JSON.parse(responseText);
    } catch (error) {
        console.error('[GeminiService] Impostor generation error:', error.message);
        throw error;
    }
}
