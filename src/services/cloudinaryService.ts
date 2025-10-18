import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';

class CloudinaryService {
  constructor() {
    // Configure Cloudinary
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    console.log('☁️ Cloudinary configured:', {
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      hasApiKey: !!process.env.CLOUDINARY_API_KEY,
      hasApiSecret: !!process.env.CLOUDINARY_API_SECRET,
    });
  }

  /**
   * Upload audio file to Cloudinary
   */
  async uploadAudio(filePath: string, options?: {
    folder?: string;
    publicId?: string;
    resourceType?: string;
  }): Promise<{
    url: string;
    secureUrl: string;
    publicId: string;
    format: string;
    duration?: number;
    bytes: number;
  }> {
    try {
      console.log('☁️ Uploading audio to Cloudinary:', filePath);

      const uploadResult = await cloudinary.uploader.upload(filePath, {
        resource_type: 'video', // Cloudinary uses 'video' for audio files
        folder: options?.folder || 'voice-notes',
        public_id: options?.publicId,
        format: 'm4a',
        ...options,
      });

      console.log('✅ Audio uploaded to Cloudinary:', uploadResult.secure_url);

      // Delete local file after upload
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('🗑️ Local file deleted:', filePath);
      }

      return {
        url: uploadResult.url,
        secureUrl: uploadResult.secure_url,
        publicId: uploadResult.public_id,
        format: uploadResult.format,
        duration: uploadResult.duration,
        bytes: uploadResult.bytes,
      };
    } catch (error) {
      console.error('❌ Cloudinary upload error:', error);
      throw error;
    }
  }

  /**
   * Upload image to Cloudinary
   */
  async uploadImage(filePath: string, options?: {
    folder?: string;
    publicId?: string;
    transformation?: any;
  }): Promise<{
    url: string;
    secureUrl: string;
    publicId: string;
    format: string;
    width: number;
    height: number;
    bytes: number;
  }> {
    try {
      console.log('☁️ Uploading image to Cloudinary:', filePath);

      const uploadResult = await cloudinary.uploader.upload(filePath, {
        resource_type: 'image',
        folder: options?.folder || 'images',
        public_id: options?.publicId,
        transformation: options?.transformation,
        ...options,
      });

      console.log('✅ Image uploaded to Cloudinary:', uploadResult.secure_url);

      // Delete local file after upload
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('🗑️ Local file deleted:', filePath);
      }

      return {
        url: uploadResult.url,
        secureUrl: uploadResult.secure_url,
        publicId: uploadResult.public_id,
        format: uploadResult.format,
        width: uploadResult.width,
        height: uploadResult.height,
        bytes: uploadResult.bytes,
      };
    } catch (error) {
      console.error('❌ Cloudinary upload error:', error);
      throw error;
    }
  }

  /**
   * Delete file from Cloudinary
   */
  async deleteFile(publicId: string, resourceType: 'image' | 'video' = 'video'): Promise<void> {
    try {
      console.log('☁️ Deleting file from Cloudinary:', publicId);

      await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
      });

      console.log('✅ File deleted from Cloudinary');
    } catch (error) {
      console.error('❌ Cloudinary delete error:', error);
      throw error;
    }
  }

  /**
   * Get file URL from Cloudinary
   */
  getFileUrl(publicId: string, options?: any): string {
    return cloudinary.url(publicId, {
      resource_type: 'video',
      ...options,
    });
  }

  /**
   * Check if Cloudinary is configured
   */
  isConfigured(): boolean {
    return !!(
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
    );
  }
}

export const cloudinaryService = new CloudinaryService();
export default cloudinaryService;
