import twilio from 'twilio';

class SMSService {
  private client: twilio.Twilio | null = null;
  private fromPhoneNumber: string = '';

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    this.fromPhoneNumber = process.env.TWILIO_PHONE_NUMBER || '';
    this.client = null; // Initialize to null

    if (!accountSid || !authToken || !this.fromPhoneNumber) {
      console.warn('Twilio credentials not configured. SMS functionality will be disabled.');
      return;
    }

    this.client = twilio(accountSid, authToken);
  }

  async sendOTP(phoneNumber: string, otpCode: string): Promise<boolean> {
    try {
      if (!this.client) {
        console.log(`SMS Service disabled. OTP for ${phoneNumber}: ${otpCode}`);
        return true; // Return true in development when SMS is disabled
      }

      // Validate phone number format
      const cleanPhone = this.formatPhoneNumber(phoneNumber);
      if (!cleanPhone) {
        console.error(`Invalid phone number format: ${phoneNumber}`);
        if (process.env.NODE_ENV === 'development') {
          console.log(`Invalid phone format, but logging OTP for ${phoneNumber}: ${otpCode}`);
          return true;
        }
        return false;
      }

      const message = `Your Yo! verification code is: ${otpCode}. This code will expire in 10 minutes.`;

      console.log(`Attempting to send SMS to ${cleanPhone} from ${this.fromPhoneNumber}`);

      const result = await this.client.messages.create({
        body: message,
        from: this.fromPhoneNumber,
        to: cleanPhone,
      });

      console.log(`SMS sent successfully. SID: ${result.sid}`);

      // Always log OTP in development for easy access
      if (process.env.NODE_ENV === 'development') {
        console.log(`🔐 OTP Code for ${cleanPhone}: ${otpCode}`);
      }

      return true;
    } catch (error: any) {
      console.error('Failed to send SMS:', error.message);

      // Log additional error details for debugging
      if (error.code) {
        console.error(`Twilio Error Code: ${error.code}`);
      }
      if (error.moreInfo) {
        console.error(`More Info: ${error.moreInfo}`);
      }

      // In development, still log the OTP even if SMS fails
      if (process.env.NODE_ENV === 'development') {
        console.log(`SMS failed, but logging OTP for ${phoneNumber}: ${otpCode}`);
        return true;
      }

      return false;
    }
  }

  private formatPhoneNumber(phone: string): string | null {
    // Remove all non-digit characters except +
    let cleaned = phone.replace(/[^\d+]/g, '');

    // If no country code, assume US
    if (!cleaned.startsWith('+')) {
      if (cleaned.length === 10) {
        cleaned = '+1' + cleaned;
      } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
        cleaned = '+' + cleaned;
      } else {
        return null; // Invalid format
      }
    }

    // Validate length (minimum 10 digits after country code)
    if (cleaned.length < 12) {
      return null;
    }

    return cleaned;
  }

  async sendPasswordResetOTP(phoneNumber: string, otpCode: string): Promise<boolean> {
    try {
      if (!this.client) {
        console.log(`SMS Service disabled. Password reset OTP for ${phoneNumber}: ${otpCode}`);
        return true;
      }

      const message = `Your Yo! password reset code is: ${otpCode}. This code will expire in 10 minutes.`;

      const result = await this.client.messages.create({
        body: message,
        from: this.fromPhoneNumber,
        to: phoneNumber,
      });

      console.log(`Password reset SMS sent successfully. SID: ${result.sid}`);
      return true;
    } catch (error: any) {
      console.error('Failed to send password reset SMS:', error.message);

      if (process.env.NODE_ENV === 'development') {
        console.log(`SMS failed, but logging password reset OTP for ${phoneNumber}: ${otpCode}`);
        return true;
      }

      return false;
    }
  }

  async sendWelcomeSMS(phoneNumber: string, userName: string): Promise<boolean> {
    try {
      if (!this.client) {
        console.log(`SMS Service disabled. Welcome message for ${phoneNumber}`);
        return true;
      }

      const message = `Welcome to Yo!, ${userName}! Your personal AI assistant is ready to help you stay organized and productive. 🚀`;

      const result = await this.client.messages.create({
        body: message,
        from: this.fromPhoneNumber,
        to: phoneNumber,
      });

      console.log(`Welcome SMS sent successfully. SID: ${result.sid}`);
      return true;
    } catch (error: any) {
      console.error('Failed to send welcome SMS:', error.message);
      return false;
    }
  }

  isConfigured(): boolean {
    return !!this.client;
  }
}

export default new SMSService();