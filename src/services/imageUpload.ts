import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import { Request } from 'express';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure multer for memory storage
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      const error = new Error('Only image files are allowed') as any;
      cb(error, false);
    }
  },
});

// Upload image to Cloudinary from base64 string
export const uploadBase64Image = async (
  base64String: string,
  folder: string = 'assistant-profiles'
): Promise<{ success: boolean; url?: string; error?: string }> => {
  try {
    // Validate base64 format
    if (!base64String.startsWith('data:image/')) {
      return { success: false, error: 'Invalid image format' };
    }

    const result = await cloudinary.uploader.upload(base64String, {
      folder,
      transformation: [
        { width: 400, height: 400, crop: 'fill', gravity: 'face' },
        { quality: 'auto', fetch_format: 'auto' }
      ],
    });

    return {
      success: true,
      url: result.secure_url,
    };
  } catch (error: any) {
    console.error('Cloudinary upload error:', error);
    return {
      success: false,
      error: error.message || 'Failed to upload image',
    };
  }
};

// Upload image to Cloudinary from file buffer
export const uploadImageBuffer = async (
  buffer: Buffer,
  originalname: string,
  folder: string = 'assistant-profiles'
): Promise<{ success: boolean; url?: string; error?: string }> => {
  try {
    return new Promise((resolve) => {
      cloudinary.uploader.upload_stream(
        {
          folder,
          transformation: [
            { width: 400, height: 400, crop: 'fill', gravity: 'face' },
            { quality: 'auto', fetch_format: 'auto' }
          ],
        },
        (error, result) => {
          if (error) {
            console.error('Cloudinary upload error:', error);
            resolve({
              success: false,
              error: error.message || 'Failed to upload image',
            });
          } else {
            resolve({
              success: true,
              url: result!.secure_url,
            });
          }
        }
      ).end(buffer);
    });
  } catch (error: any) {
    console.error('Image upload error:', error);
    return {
      success: false,
      error: error.message || 'Failed to upload image',
    };
  }
};

// Delete image from Cloudinary
export const deleteImage = async (imageUrl: string): Promise<boolean> => {
  try {
    // Extract public_id from Cloudinary URL
    const publicId = imageUrl.split('/').pop()?.split('.')[0];
    if (publicId) {
      await cloudinary.uploader.destroy(`assistant-profiles/${publicId}`);
    }
    return true;
  } catch (error) {
    console.error('Failed to delete image:', error);
    return false;
  }
};