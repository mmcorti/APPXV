
import { GoogleGenAI } from "@google/genai";

export class GeminiService {
  static async generateImage(prompt: string, size: '1K' | '2K' | '4K' = '1K'): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const interaction = await ai.interactions.create({
      model: 'gemini-3-pro-image-preview',
      input: prompt,
      response_modalities: ['image'],
    });

    for (const output of interaction.outputs || []) {
      if (output.type === 'image' && output.data) {
        return `data:${output.mime_type || 'image/png'};base64,${output.data}`;
      }
    }
    throw new Error("No image data found in response");
  }

  static async editImage(base64Image: string, prompt: string): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const cleanBase64 = base64Image.split(',')[1] || base64Image;

    // For image editing, we pass both the original image and the edit instruction
    const interaction = await ai.interactions.create({
      model: 'gemini-3-pro-image-preview',
      input: [
        {
          inlineData: {
            data: cleanBase64,
            mimeType: 'image/png'
          }
        },
        prompt
      ],
      response_modalities: ['image'],
    });

    for (const output of interaction.outputs || []) {
      if (output.type === 'image' && output.data) {
        return `data:${output.mime_type || 'image/png'};base64,${output.data}`;
      }
    }
    throw new Error("No image data found in response");
  }
}
