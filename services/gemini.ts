
import { GoogleGenAI } from "@google/genai";

export class GeminiService {
  static async generateImage(prompt: string, size: '1K' | '2K' | '4K' = '1K'): Promise<string> {
    const apiKey = process.env.API_KEY;
    console.log('[GeminiService] generateImage called');
    console.log('[GeminiService] API Key present:', !!apiKey);
    console.log('[GeminiService] Prompt:', prompt);

    if (!apiKey) {
      throw new Error('API Key no configurada. Verifica GEMINI_API_KEY en .env.local');
    }

    const ai = new GoogleGenAI({ apiKey });

    console.log('[GeminiService] Calling ai.models.generateImages...');

    // Use the correct Imagen API for image generation
    const response = await ai.models.generateImages({
      model: 'imagen-3.0-generate-002',
      prompt: prompt,
      config: {
        numberOfImages: 1,
        aspectRatio: '3:4',
      }
    });

    console.log('[GeminiService] Response received:', response);

    const images = response.generatedImages || [];
    if (images.length > 0 && images[0].image?.imageBytes) {
      const base64 = images[0].image.imageBytes;
      return `data:image/png;base64,${base64}`;
    }

    throw new Error("No image data found in response");
  }

  static async editImage(base64Image: string, prompt: string): Promise<string> {
    const apiKey = process.env.API_KEY;
    console.log('[GeminiService] editImage called');

    if (!apiKey) {
      throw new Error('API Key no configurada. Verifica GEMINI_API_KEY en .env.local');
    }

    const ai = new GoogleGenAI({ apiKey });
    const cleanBase64 = base64Image.split(',')[1] || base64Image;

    // Use Gemini model with vision for editing
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                data: cleanBase64,
                mimeType: 'image/png'
              }
            },
            {
              text: `Edit this image: ${prompt}. Return only the edited image.`
            }
          ]
        }
      ],
      generationConfig: {
        responseModalities: ['image', 'text']
      }
    });

    console.log('[GeminiService] Edit response:', response);

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No image data found in response");
  }
}
