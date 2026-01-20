
import { GoogleGenAI } from "@google/genai";

export class GeminiService {
  static async generateImage(prompt: string, size: '1K' | '2K' | '4K' = '1K'): Promise<string> {
    // Instantiate fresh to use the latest API key from process.env.API_KEY
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'imagen-3.0-generate-001',
      contents: [
        { text: prompt },
      ],
      config: {
        imageConfig: {
          aspectRatio: "3:4",
          imageSize: size
        }
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No image data found in response");
  }

  static async editImage(base64Image: string, prompt: string): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const cleanBase64 = base64Image.split(',')[1] || base64Image;

    const response = await ai.models.generateContent({
      model: 'imagen-3.0-generate-001',
      contents: [
        {
          inlineData: {
            data: cleanBase64,
            mimeType: 'image/png'
          }
        },
        {
          text: prompt
        }
      ]
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No image data found in response");
  }
}
