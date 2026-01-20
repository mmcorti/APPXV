import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary with env variables
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Upload a base64 image to Cloudinary
 * @param {string} base64Image - Base64 encoded image (with or without data: prefix)
 * @param {string} folder - Folder name in Cloudinary
 * @returns {Promise<{url: string, publicId: string}>}
 */
export async function uploadImage(base64Image, folder = 'appxv-events') {
    try {
        // Ensure proper data URI format
        let imageData = base64Image;
        if (!base64Image.startsWith('data:')) {
            imageData = `data:image/png;base64,${base64Image}`;
        }

        const result = await cloudinary.uploader.upload(imageData, {
            folder,
            resource_type: 'image',
            transformation: [
                { quality: 'auto:good' },
                { fetch_format: 'auto' }
            ]
        });

        return {
            url: result.secure_url,
            publicId: result.public_id
        };
    } catch (error) {
        console.error('❌ Cloudinary upload error:', error);
        throw new Error(`Failed to upload image: ${error.message}`);
    }
}

/**
 * Delete an image from Cloudinary
 * @param {string} publicId - The public ID of the image
 */
export async function deleteImage(publicId) {
    try {
        await cloudinary.uploader.destroy(publicId);
    } catch (error) {
        console.error('❌ Cloudinary delete error:', error);
    }
}

export default { uploadImage, deleteImage };
