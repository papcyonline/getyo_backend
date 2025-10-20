/**
 * ENCRYPTION SERVICE
 *
 * Provides secure encryption/decryption for sensitive data like OAuth tokens.
 *
 * Features:
 * - AES-256-GCM encryption (authenticated encryption)
 * - Unique initialization vector (IV) for each encryption
 * - Authentication tag for data integrity
 * - Secure key derivation from environment variable
 *
 * Security:
 * - Uses crypto.randomBytes for IV generation (cryptographically secure)
 * - AES-256-GCM provides both confidentiality and authenticity
 * - Each encrypted value has a unique IV to prevent pattern analysis
 *
 * Usage:
 * ```typescript
 * import EncryptionService from './services/encryptionService';
 *
 * // Encrypt a token before storing
 * const encryptedToken = EncryptionService.encrypt(accessToken);
 *
 * // Decrypt a token when needed
 * const accessToken = EncryptionService.decrypt(encryptedToken);
 * ```
 */

import crypto from 'crypto';
import logger, { logSecurity, logError } from '../utils/logger';

class EncryptionService {
  private algorithm = 'aes-256-gcm';
  private keyLength = 32; // 256 bits
  private ivLength = 16; // 128 bits
  private tagLength = 16; // 128 bits

  /**
   * Get encryption key from environment variable
   * In production, this should be a securely stored secret
   */
  private getEncryptionKey(): Buffer {
    const key = process.env.ENCRYPTION_KEY;

    if (!key) {
      logSecurity('ENCRYPTION_KEY not set in environment', 'critical');
      throw new Error('ENCRYPTION_KEY environment variable is not set');
    }

    // Ensure key is exactly 32 bytes (256 bits)
    // If key is longer, truncate. If shorter, pad with zeros (not ideal, but works)
    const keyBuffer = Buffer.from(key, 'utf-8');

    if (keyBuffer.length < this.keyLength) {
      logger.warn('ENCRYPTION_KEY is shorter than recommended 32 bytes. Padding with zeros.');
      return Buffer.concat([keyBuffer, Buffer.alloc(this.keyLength - keyBuffer.length)]);
    }

    if (keyBuffer.length > this.keyLength) {
      logger.warn('ENCRYPTION_KEY is longer than 32 bytes. Truncating to 32 bytes.');
      return keyBuffer.subarray(0, this.keyLength);
    }

    return keyBuffer;
  }

  /**
   * Encrypt a string value
   * Returns: base64-encoded string in format: iv:authTag:encryptedData
   *
   * @param plaintext - The string to encrypt
   * @returns Encrypted string (base64-encoded)
   */
  encrypt(plaintext: string): string {
    try {
      if (!plaintext) {
        return plaintext;
      }

      const key = this.getEncryptionKey();

      // Generate a random IV for each encryption
      const iv = crypto.randomBytes(this.ivLength);

      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, key, iv);

      // Encrypt the data
      let encrypted = cipher.update(plaintext, 'utf8', 'base64');
      encrypted += cipher.final('base64');

      // Get the authentication tag
      const authTag = (cipher as any).getAuthTag();

      // Combine IV, auth tag, and encrypted data
      // Format: iv:authTag:encryptedData (all base64)
      const combined = [
        iv.toString('base64'),
        authTag.toString('base64'),
        encrypted,
      ].join(':');

      logger.debug('Data encrypted successfully', { length: plaintext.length });

      return combined;
    } catch (error) {
      logError('Encryption failed', error as Error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt an encrypted string
   * Expects input in format: iv:authTag:encryptedData (base64-encoded)
   *
   * @param encryptedData - The encrypted string to decrypt
   * @returns Decrypted string
   */
  decrypt(encryptedData: string): string {
    try {
      if (!encryptedData) {
        return encryptedData;
      }

      const key = this.getEncryptionKey();

      // Split the combined data
      const parts = encryptedData.split(':');

      if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
      }

      const iv = Buffer.from(parts[0], 'base64');
      const authTag = Buffer.from(parts[1], 'base64');
      const encrypted = parts[2];

      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
      (decipher as any).setAuthTag(authTag);

      // Decrypt the data
      let decrypted = decipher.update(encrypted, 'base64', 'utf8');
      decrypted += decipher.final('utf8');

      logger.debug('Data decrypted successfully');

      return decrypted;
    } catch (error) {
      logError('Decryption failed', error as Error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Hash a value (one-way, for passwords or sensitive comparisons)
   * Uses SHA-256
   *
   * @param value - The value to hash
   * @returns Hash (hex-encoded)
   */
  hash(value: string): string {
    try {
      const hash = crypto.createHash('sha256');
      hash.update(value);
      return hash.digest('hex');
    } catch (error) {
      logError('Hashing failed', error as Error);
      throw new Error('Failed to hash value');
    }
  }

  /**
   * Generate a random token (for API keys, session tokens, etc.)
   *
   * @param length - Length in bytes (default: 32)
   * @returns Random token (hex-encoded)
   */
  generateRandomToken(length: number = 32): string {
    try {
      return crypto.randomBytes(length).toString('hex');
    } catch (error) {
      logError('Token generation failed', error as Error);
      throw new Error('Failed to generate random token');
    }
  }

  /**
   * Check if a string is encrypted (has the iv:authTag:data format)
   *
   * @param value - The value to check
   * @returns true if encrypted, false otherwise
   */
  isEncrypted(value: string): boolean {
    if (!value) return false;

    const parts = value.split(':');
    if (parts.length !== 3) return false;

    // Check if all parts are valid base64
    try {
      Buffer.from(parts[0], 'base64');
      Buffer.from(parts[1], 'base64');
      Buffer.from(parts[2], 'base64');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Encrypt an object (converts to JSON, then encrypts)
   *
   * @param obj - Object to encrypt
   * @returns Encrypted string
   */
  encryptObject(obj: any): string {
    try {
      const json = JSON.stringify(obj);
      return this.encrypt(json);
    } catch (error) {
      logError('Object encryption failed', error as Error);
      throw new Error('Failed to encrypt object');
    }
  }

  /**
   * Decrypt an object (decrypts, then parses JSON)
   *
   * @param encryptedData - Encrypted string
   * @returns Decrypted object
   */
  decryptObject<T = any>(encryptedData: string): T {
    try {
      const json = this.decrypt(encryptedData);
      return JSON.parse(json);
    } catch (error) {
      logError('Object decryption failed', error as Error);
      throw new Error('Failed to decrypt object');
    }
  }
}

// Export singleton instance
export default new EncryptionService();
