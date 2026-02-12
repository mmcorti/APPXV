import { GoogleGenerativeAI } from '@google/generative-ai';

// Verified models from user's AI Studio list (Jan 2026)
const IMAGE_MODEL = 'gemini-2.0-flash';
const TEXT_MODEL = 'gemini-2.0-flash';

/**
 * Generate an image using Gemini API
 * @param {string} prompt - The image generation prompt
 * @returns {Promise<string>} - Base64 data URL of the generated image
 */
export async function generateImage(prompt) {
    console.log('[GeminiService] generateImage called with prompt:', prompt);

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY not configured in environment');
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    try {
        // Use v1beta for newest multimodal features
        const model = genAI.getGenerativeModel({ model: IMAGE_MODEL }, { apiVersion: 'v1beta' });

        const result = await model.generateContent({
            contents: [{
                role: 'user',
                parts: [{ text: `Generate a high-quality image based on this description: ${prompt}. Output ONLY the image data.` }]
            }],
            generationConfig: {
                responseModalities: ['IMAGE'],
            }
        });

        const response = await result.response;
        console.log('[GeminiService] AI Response received');

        // Check for image in response
        const candidate = response.candidates?.[0];
        if (candidate?.content?.parts) {
            for (const part of candidate.content.parts) {
                if (part.inlineData) {
                    console.log('[GeminiService] Image found in response parts');
                    return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                }
            }
        }

        // Handle case where it returned text instead of image
        const text = response.text ? response.text() : 'No text response';
        console.log('[GeminiService] No image in response. Text:', text.substring(0, 200));
        throw new Error(`AI generated text instead of an image: ${text.substring(0, 100)}...`);
    } catch (error) {
        console.error('[GeminiService] Generation Error:', error);
        // Extract more details if available
        const details = error.response?.data?.error || error.message;
        throw new Error(`Gemini API Error: ${details}`);
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

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY not configured in environment');
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    try {
        const model = genAI.getGenerativeModel({ model: IMAGE_MODEL }, { apiVersion: 'v1beta' });

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
                    { text: `Edit this image based on these instructions: ${prompt}. Return ONLY the modified image.` }
                ]
            }],
            generationConfig: {
                responseModalities: ['IMAGE'],
            }
        });

        const response = await result.response;
        const candidate = response.candidates?.[0];

        if (candidate?.content?.parts) {
            for (const part of candidate.content.parts) {
                if (part.inlineData) {
                    return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                }
            }
        }

        throw new Error('No edited image in response');
    } catch (error) {
        console.error('[GeminiService] Edit error:', error);
        throw new Error(`Gemini Edit Error: ${error.message}`);
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

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY not configured in environment');
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    try {
        const model = genAI.getGenerativeModel({
            model: TEXT_MODEL,
            generationConfig: {
                responseMimeType: "application/json",
            }
        });

        const prompt = `Generate ${count} trivia questions about the theme: "${theme}". 
        Language: Español Latino.
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

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY not configured in environment');
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    try {
        const model = genAI.getGenerativeModel({
            model: TEXT_MODEL,
            generationConfig: {
                responseMimeType: "application/json",
            }
        });

        const prompt = `Generate ${count} Photo Bingo challenges about the theme: "${theme}". 
        Language: Español Latino.
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

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY not configured in environment');
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    try {
        const model = genAI.getGenerativeModel({
            model: TEXT_MODEL,
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "object",
                    properties: {
                        mainPrompt: { type: "string", description: "Instructions for regular players (Civilians)" },
                        impostorPrompt: { type: "string", description: "Instructions for the Impostor" }
                    },
                    required: ["mainPrompt", "impostorPrompt"]
                }
            }
        });

        const prompt = `Genera un par de consignas para el juego "El Impostor" basado en la temática: "${theme}".

        MECÁNICA DEL JUEGO:
        - Todos los jugadores reciben una consigna y deben responder con UNA SOLA PALABRA.
        - Los civiles reciben la consigna principal (mainPrompt).
        - El impostor recibe una consigna diferente (impostorPrompt).
        - La clave es que ambas consignas deben ser lo suficientemente SIMILARES para que las respuestas se parezcan, pero lo suficientemente DISTINTAS para generar una leve diferencia que los demás puedan detectar.
        - NO debe ser sobre fotos. Es un juego de PALABRAS.

        REGLAS PARA LAS CONSIGNAS:
        1. Ambas consignas deben pedir describir, nombrar o asociar algo con UNA PALABRA.
        2. Las consignas deben estar relacionadas entre sí (misma categoría o campo semántico).
        3. La diferencia debe ser SUTIL, no obvia. El impostor no debe quedar expuesto inmediatamente.
        4. Evitar que una consigna sea demasiado genérica ni demasiado específica respecto a la otra.
        
        EJEMPLOS:
        Temática "Casamiento":
        mainPrompt: "Describí en una palabra lo que más te emociona de una boda"
        impostorPrompt: "Describí en una palabra lo que más te emociona de una fiesta de 15"
        
        Temática "Los Simpsons":
        mainPrompt: "Decí en una palabra algo que asocies con Homero Simpson"
        impostorPrompt: "Decí en una palabra algo que asocies con Pedro Picapiedra"
        
        Temática "Fútbol":
        mainPrompt: "Nombrá en una palabra algo que veas en una cancha de fútbol"
        impostorPrompt: "Nombrá en una palabra algo que veas en un estadio de tenis"

        Devolvé un JSON con exactamente estas dos claves: "mainPrompt" y "impostorPrompt".
        Idioma: Español Latino.`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        console.log('[GeminiService] AI Impostor raw response:', responseText);

        const parsed = JSON.parse(responseText);
        console.log('[GeminiService] AI Impostor parsed keys:', Object.keys(parsed));

        // Defensive key mapping: handle alternative key names the AI might use
        const normalized = {
            mainPrompt: parsed.mainPrompt || parsed.civilianPrompt || parsed.civilian || parsed.main || parsed.consignaCivil || parsed.consignaPrincipal || '',
            impostorPrompt: parsed.impostorPrompt || parsed.impostorTask || parsed.impostor || parsed.consignaImpostor || ''
        };

        // If both are still empty, try to extract from the first two values
        if (!normalized.mainPrompt && !normalized.impostorPrompt) {
            const values = Object.values(parsed).filter(v => typeof v === 'string');
            if (values.length >= 2) {
                normalized.mainPrompt = values[0];
                normalized.impostorPrompt = values[1];
                console.log('[GeminiService] Used positional fallback for keys');
            }
        }

        console.log('[GeminiService] AI Impostor final result:', JSON.stringify(normalized));
        return normalized;
    } catch (error) {
        console.error('[GeminiService] Impostor generation error:', error.message);
        throw error;
    }
}
