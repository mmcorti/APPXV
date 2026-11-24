import { GoogleGenerativeAI } from '@google/generative-ai';

// Current Gemini models (overridable via env vars)
const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image';
const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || 'gemini-3.5-flash-lite';
const TEXT_FALLBACK_MODELS = [
    TEXT_MODEL,
    'gemini-3.5-flash-lite',
    'gemini-3.8-flash',
    'gemini-3.1-flash-lite',
].filter((m, idx, arr) => m && arr.indexOf(m) === idx);
const TEXT_TIMEOUT_MS = 45_000;
const IMAGE_TIMEOUT_MS = 90_000;

async function generateTextOpenAI(prompt, label) {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) return null;
    console.log(`[GeminiService] Fallback: Generating ${label} with OpenAI gpt-4o-mini...`);
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(TEXT_TIMEOUT_MS),
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: 'Return ONLY valid JSON matching the exact schema requested by the user. Do not wrap in markdown or add extra text.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.7,
        }),
    });
    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenAI text fallback error ${response.status}: ${errText}`);
    }
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('OpenAI text fallback returned empty content');
    return content;
}

async function generateTextWithFallback(genAI, prompt, baseGenerationConfig, label) {
    let lastError = null;
    for (const modelName of TEXT_FALLBACK_MODELS) {
        try {
            const genConfig = { ...baseGenerationConfig };
            if (modelName.includes('3.8')) {
                genConfig.thinkingConfig = { thinkingLevel: 'LOW' };
            }
            const model = genAI.getGenerativeModel({
                model: modelName,
                generationConfig: genConfig,
            });
            const result = await withTimeout(
                model.generateContent(prompt),
                TEXT_TIMEOUT_MS,
                `Gemini ${label} (${modelName})`
            );
            return result.response.text();
        } catch (err) {
            lastError = err;
            console.warn(`[GeminiService] ${label} failed on ${modelName}: ${err.message}`);
        }
    }

    if (process.env.OPENAI_API_KEY) {
        try {
            const fallbackText = await generateTextOpenAI(prompt, label);
            if (fallbackText) return fallbackText;
        } catch (fallbackErr) {
            console.error(`[GeminiService] ${label} OpenAI fallback also failed:`, fallbackErr.message);
        }
    }

    throw lastError || new Error(`Gemini ${label} failed on all candidate models`);
}

function withTimeout(promise, ms, label) {
    let timer;
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
        })
    ]).finally(() => clearTimeout(timer));
}

function parseDataUrl(input, fallbackMime = 'image/png') {
    const match = typeof input === 'string' ? input.match(/^data:([^;]+);base64,(.+)$/s) : null;
    if (match) {
        return { mimeType: match[1].trim() || fallbackMime, data: match[2].trim() };
    }
    return { mimeType: fallbackMime, data: String(input || '').trim() };
}

/**
 * Fallback: Generate image using OpenAI DALL-E 3
 */
async function generateImageOpenAI(prompt) {
    console.log('[GeminiService] Fallback: Generating with OpenAI DALL-E 3...');
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

    const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
        body: JSON.stringify({
            model: 'dall-e-3',
            prompt: prompt,
            n: 1,
            size: '1024x1024',
            quality: 'standard',
            response_format: 'b64_json'
        })
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenAI API Error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    if (!data.data?.[0]?.b64_json) throw new Error('No image returned from OpenAI');

    return `data:image/png;base64,${data.data[0].b64_json}`;
}

/**
 * Generate an image using Gemini API or Fallback
 * @param {string} prompt - The image generation prompt
 * @returns {Promise<string>} - Base64 data URL of the generated image
 */
export async function generateImage(prompt) {
    console.log('[GeminiService] generateImage called with prompt:', prompt);

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
        if (process.env.OPENAI_API_KEY) {
            return await generateImageOpenAI(prompt);
        }
        throw new Error('GEMINI_API_KEY not configured in environment');
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    try {
        // Use v1beta for newest multimodal features
        const model = genAI.getGenerativeModel({ model: IMAGE_MODEL }, { apiVersion: 'v1beta' });

        const result = await withTimeout(
            model.generateContent({
                contents: [{
                    role: 'user',
                    parts: [{ text: `Generate a high-quality image based on this description: ${prompt}. Output ONLY the image data.` }]
                }],
                generationConfig: {
                    responseModalities: ['IMAGE'],
                }
            }),
            IMAGE_TIMEOUT_MS,
            'Gemini generateImage'
        );

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

        // If no image, maybe it's text? Check if it suggests fallback
        throw new Error('Model did not return image data');

    } catch (error) {
        console.warn('[GeminiService] Gemini generation failed:', error.message);

        // TRANSPARENT FALLBACK: If Gemini fails for ANY reason (expired key, modality error, etc.)
        // and we have an OpenAI key, try DALL-E 3.
        if (process.env.OPENAI_API_KEY) {
            try {
                return await generateImageOpenAI(prompt);
            } catch (fallbackError) {
                console.error('[GeminiService] Fallback also failed:', fallbackError.message);
            }
        }

        throw new Error(`AI Generation Error (Gemini & Fallback failed): ${error.message}`);
    }
}

/**
 * Edit an image using Gemini vision capabilities or Fallback
 * @param {string} base64Image - Base64 encoded image (data URL format)
 * @param {string} prompt - Edit instructions
 * @returns {Promise<string>} - Base64 data URL of the edited image
 */
export async function editImage(base64Image, prompt) {
    console.log('[GeminiService] editImage called');

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
        if (process.env.OPENAI_API_KEY) {
            return await generateImageOpenAI(`Create an updated invitation image with these changes: ${prompt}`);
        }
        throw new Error('GEMINI_API_KEY not configured in environment');
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    try {
        const model = genAI.getGenerativeModel({ model: IMAGE_MODEL }, { apiVersion: 'v1beta' });
        const { mimeType, data: cleanBase64 } = parseDataUrl(base64Image, 'image/png');

        const result = await withTimeout(
            model.generateContent({
                contents: [{
                    role: 'user',
                    parts: [
                        {
                            inlineData: {
                                mimeType,
                                data: cleanBase64
                            }
                        },
                        { text: `Edit this image based on these instructions: ${prompt}. Return ONLY the modified image.` }
                    ]
                }],
                generationConfig: {
                    responseModalities: ['IMAGE'],
                }
            }),
            IMAGE_TIMEOUT_MS,
            'Gemini editImage'
        );

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
        console.warn('[GeminiService] Gemini edit failed:', error.message);

        // Fallback to generating a NEW image with the prompt + context of the old one if editing fails
        if (process.env.OPENAI_API_KEY) {
            try {
                console.log('[GeminiService] Fallback to DALL-E for "edit" (will generate fresh version)');
                return await generateImageOpenAI(`Based on the previous scene, create a new image with these changes: ${prompt}`);
            } catch (fallbackError) {
                console.error('[GeminiService] Edit fallback also failed:', fallbackError.message);
            }
        }

        throw new Error(`Edit Error: ${error.message}`);
    }
}
/**
 * Helper: clean AI JSON response that might be wrapped in markdown code fences
 */
function cleanJsonResponse(text) {
    let cleaned = text.trim();
    // Strip markdown code fences: ```json ... ``` or ``` ... ```
    if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/, '');
    }
    return cleaned;
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

        const responseText = await generateTextWithFallback(
            genAI,
            prompt,
            { responseMimeType: "application/json" },
            'generateTriviaQuestions'
        );
        console.log('[GeminiService] AI Trivia raw response length:', responseText.length);

        const cleaned = cleanJsonResponse(responseText);
        const parsed = JSON.parse(cleaned);
        console.log('[GeminiService] AI Trivia parsed', Array.isArray(parsed) ? parsed.length : 0, 'questions');
        return parsed;
    } catch (error) {
        console.error('[GeminiService] Question generation error:', error.message, error.stack);
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

        const responseText = await generateTextWithFallback(
            genAI,
            prompt,
            { responseMimeType: "application/json" },
            'generateBingoPrompts'
        );
        console.log('[GeminiService] AI Bingo raw response length:', responseText.length);

        const cleaned = cleanJsonResponse(responseText);
        const parsed = JSON.parse(cleaned);
        console.log('[GeminiService] AI Bingo parsed', Array.isArray(parsed) ? parsed.length : 0, 'prompts');
        return parsed;
    } catch (error) {
        console.error('[GeminiService] Bingo generation error:', error.message, error.stack);
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

        const responseText = await generateTextWithFallback(
            genAI,
            prompt,
            {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "object",
                    properties: {
                        mainPrompt: { type: "string", description: "Instructions for regular players (Civilians)" },
                        impostorPrompt: { type: "string", description: "Instructions for the Impostor" }
                    },
                    required: ["mainPrompt", "impostorPrompt"]
                }
            },
            'generateImpostorTasks'
        );
        console.log('[GeminiService] AI Impostor raw response:', responseText);

        const cleaned = cleanJsonResponse(responseText);
        const parsed = JSON.parse(cleaned);
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
        console.error('[GeminiService] Impostor generation error:', error.message, error.stack);
        throw error;
    }
}
