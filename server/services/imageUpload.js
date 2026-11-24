import crypto from 'crypto';
import { v2 as cloudinary } from 'cloudinary';
import { supabase } from '../supabase.js';

const MEDIA_BUCKET = process.env.SUPABASE_MEDIA_BUCKET || 'appxv-media';
const CACHE_CONTROL_SECONDS = '31536000'; // 1 year browser/CDN cache
let bucketReadyPromise = null;

const hasCloudinaryConfig = Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
);

if (hasCloudinaryConfig) {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    });
}

async function ensureMediaBucket() {
    if (!bucketReadyPromise) {
        bucketReadyPromise = (async () => {
            try {
                const { data: buckets, error } = await supabase.storage.listBuckets();
                if (error) {
                    console.warn('⚠️ [MEDIA STORAGE] Could not list buckets:', error.message);
                    bucketReadyPromise = null;
                    return false;
                }
                if (!buckets?.some((b) => b.name === MEDIA_BUCKET)) {
                    const { error: createErr } = await supabase.storage.createBucket(MEDIA_BUCKET, {
                        public: true,
                    });
                    if (createErr && !createErr.message.toLowerCase().includes('already')) {
                        console.warn('⚠️ [MEDIA STORAGE] Could not create bucket:', createErr.message);
                        bucketReadyPromise = null;
                        return false;
                    }
                    console.log(`✅ [MEDIA STORAGE] Created public bucket '${MEDIA_BUCKET}'`);
                }
                return true;
            } catch (err) {
                console.warn('⚠️ [MEDIA STORAGE] Bucket check failed:', err.message);
                bucketReadyPromise = null;
                return false;
            }
        })();
    }
    return bucketReadyPromise;
}

function parseBase64Image(base64Image) {
    if (!base64Image || typeof base64Image !== 'string') {
        throw new Error('Invalid image payload');
    }
    const match = base64Image.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/s);
    if (match) {
        const mimeType = match[1].toLowerCase();
        const rawExt = mimeType.split('/')[1]?.split('+')[0] || 'png';
        const ext = rawExt === 'jpeg' ? 'jpg' : rawExt;
        return { mimeType, ext, buffer: Buffer.from(match[2], 'base64') };
    }
    return {
        mimeType: 'image/png',
        ext: 'png',
        buffer: Buffer.from(base64Image, 'base64')
    };
}

/**
 * Upload a base64 image to Supabase Storage (primary), with optional Cloudinary fallback.
 * @param {string} base64Image - Base64 encoded image (with or without data: prefix)
 * @param {string} folder - Folder prefix in storage
 * @returns {Promise<{url: string, publicId: string}>}
 */
export async function uploadImage(base64Image, folder = 'appxv-events') {
    const safeFolder = String(folder || 'appxv-events').replace(/[^a-zA-Z0-9/_-]/g, '_').replace(/^\/+|\/+$/g, '') || 'appxv-events';
    const { mimeType, ext, buffer } = parseBase64Image(base64Image);

    // Primary: Supabase Storage
    try {
        const ready = await ensureMediaBucket();
        if (ready) {
            const fileName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
            const filePath = `${safeFolder}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from(MEDIA_BUCKET)
                .upload(filePath, buffer, {
                    contentType: mimeType,
                    cacheControl: CACHE_CONTROL_SECONDS,
                    upsert: false,
                });

            if (uploadError) {
                throw new Error(uploadError.message);
            }

            const { data: publicData } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(filePath);
            if (!publicData?.publicUrl) {
                throw new Error('Could not generate public URL');
            }

            console.log(`✅ [MEDIA STORAGE] Uploaded ${filePath} (${(buffer.length / 1024).toFixed(1)}KB)`);
            return {
                url: publicData.publicUrl,
                publicId: filePath
            };
        }
    } catch (supabaseErr) {
        console.warn('⚠️ [MEDIA STORAGE] Supabase upload failed:', supabaseErr.message);
        if (!hasCloudinaryConfig) {
            throw new Error(`Failed to upload image: ${supabaseErr.message}`);
        }
    }

    // Fallback: Cloudinary (only if configured)
    if (hasCloudinaryConfig) {
        try {
            const imageData = base64Image.startsWith('data:') ? base64Image : `data:${mimeType};base64,${base64Image}`;
            const result = await cloudinary.uploader.upload(imageData, {
                folder: safeFolder,
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

    throw new Error('Failed to upload image: Storage backend unavailable');
}

/**
 * Delete an image from Supabase Storage (and Cloudinary if configured)
 * @param {string} publicId - Storage object path or Cloudinary public ID
 */
export async function deleteImage(publicId) {
    if (!publicId) return;
    try {
        await supabase.storage.from(MEDIA_BUCKET).remove([publicId]);
    } catch (error) {
        console.warn('⚠️ [MEDIA STORAGE] Delete warning:', error.message);
    }
    if (hasCloudinaryConfig) {
        try {
            await cloudinary.uploader.destroy(publicId);
        } catch (error) {
            console.warn('⚠️ Cloudinary delete warning:', error.message);
        }
    }
}

export default { uploadImage, deleteImage };
