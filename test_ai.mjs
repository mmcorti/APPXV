import { generateImage } from './server/services/geminiService.js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function test() {
    try {
        console.log('Testing image generation...');
        const result = await generateImage('Una invitacion de boda elegante con flores doradas');
        console.log('Success! Image length:', result.length);
    } catch (err) {
        console.error('Test failed:', err.message);
    }
}

test();
