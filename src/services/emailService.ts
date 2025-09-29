import { Resend } from 'resend';

class EmailService {
  private resend: Resend | null = null;
  private fromEmail: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    this.fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@papcy.com';

    if (!apiKey) {
      console.warn('Resend API key not configured. Email functionality will be disabled.');
      return;
    }

    this.resend = new Resend(apiKey);
  }

  async sendPasswordResetEmail(email: string, resetCode: string): Promise<boolean> {
    try {
      if (!this.resend) {
        console.log(`Email Service disabled. Password reset code for ${email}: ${resetCode}`);
        return true;
      }

      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: [email],
        subject: 'Reset Your Yo! Password',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #3396D3; margin: 0;">Yo!</h1>
              <p style="color: #666; margin: 5px 0;">Personal AI Assistant</p>
            </div>

            <h2 style="color: #333; margin-bottom: 20px;">Reset Your Password</h2>

            <p style="color: #666; line-height: 1.6;">
              We received a request to reset your password for your Yo! account.
            </p>

            <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
              <p style="color: #333; margin-bottom: 10px; font-weight: bold;">Your verification code is:</p>
              <div style="font-size: 32px; font-weight: bold; color: #3396D3; letter-spacing: 4px; font-family: monospace;">
                ${resetCode}
              </div>
              <p style="color: #666; margin-top: 10px; font-size: 14px;">This code will expire in 10 minutes</p>
            </div>

            <p style="color: #666; line-height: 1.6;">
              If you didn't request this password reset, please ignore this email or contact support if you have concerns.
            </p>

            <div style="border-top: 1px solid #eee; margin-top: 30px; padding-top: 20px;">
              <p style="color: #999; font-size: 12px; text-align: center;">
                This email was sent by Yo! Personal AI Assistant<br>
                Please do not reply to this email.
              </p>
            </div>
          </div>
        `,
      });

      if (error) {
        console.error('Failed to send password reset email:', error);
        return false;
      }

      console.log(`Password reset email sent successfully. ID: ${data?.id}`);
      return true;
    } catch (error: any) {
      console.error('Failed to send password reset email:', error.message);

      if (process.env.NODE_ENV === 'development') {
        console.log(`Email failed, but logging reset code for ${email}: ${resetCode}`);
        return true;
      }

      return false;
    }
  }

  async sendWelcomeEmail(email: string, userName: string): Promise<boolean> {
    try {
      if (!this.resend) {
        console.log(`Email Service disabled. Welcome email for ${email}`);
        return true;
      }

      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: [email],
        subject: 'Welcome to Yo! - Your AI Assistant is Ready',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #3396D3; margin: 0;">Welcome to Yo!</h1>
              <p style="color: #666; margin: 5px 0;">Your Personal AI Assistant</p>
            </div>

            <h2 style="color: #333; margin-bottom: 20px;">Hello ${userName}! 👋</h2>

            <p style="color: #666; line-height: 1.6;">
              Congratulations! Your Yo! account has been successfully created and your AI assistant is ready to help you stay organized and productive.
            </p>

            <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="color: #3396D3; margin-top: 0;">What you can do with Yo!:</h3>
              <ul style="color: #666; line-height: 1.8;">
                <li>🗣️ Voice conversations with your AI assistant</li>
                <li>📋 Smart task management and reminders</li>
                <li>📅 Calendar integration and scheduling</li>
                <li>📊 Daily briefings and insights</li>
                <li>🔍 Intelligent search and assistance</li>
              </ul>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="#" style="background: #3396D3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                Get Started with Yo!
              </a>
            </div>

            <p style="color: #666; line-height: 1.6;">
              If you have any questions or need help getting started, don't hesitate to reach out to our support team.
            </p>

            <div style="border-top: 1px solid #eee; margin-top: 30px; padding-top: 20px;">
              <p style="color: #999; font-size: 12px; text-align: center;">
                Welcome aboard!<br>
                The Yo! Team
              </p>
            </div>
          </div>
        `,
      });

      if (error) {
        console.error('Failed to send welcome email:', error);
        return false;
      }

      console.log(`Welcome email sent successfully. ID: ${data?.id}`);
      return true;
    } catch (error: any) {
      console.error('Failed to send welcome email:', error.message);
      return false;
    }
  }

  async sendOTPEmail(email: string, otpCode: string): Promise<boolean> {
    try {
      if (!this.resend) {
        console.log(`Email Service disabled. OTP for ${email}: ${otpCode}`);
        return true;
      }

      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: [email],
        subject: 'Yo! Email Verification Code',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #3396D3; margin: 0;">Yo!</h1>
              <p style="color: #666; margin: 5px 0;">Personal AI Assistant</p>
            </div>

            <h2 style="color: #333; margin-bottom: 20px;">Email Verification</h2>

            <p style="color: #666; line-height: 1.6;">
              Please use the following verification code to complete your registration:
            </p>

            <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
              <p style="color: #333; margin-bottom: 10px; font-weight: bold;">Your verification code is:</p>
              <div style="font-size: 32px; font-weight: bold; color: #3396D3; letter-spacing: 4px; font-family: monospace;">
                ${otpCode}
              </div>
              <p style="color: #666; margin-top: 10px; font-size: 14px;">This code will expire in 10 minutes</p>
            </div>

            <p style="color: #666; line-height: 1.6;">
              If you didn't request this verification code, please ignore this email.
            </p>

            <div style="border-top: 1px solid #eee; margin-top: 30px; padding-top: 20px;">
              <p style="color: #999; font-size: 12px; text-align: center;">
                This email was sent by Yo! Personal AI Assistant<br>
                Please do not reply to this email.
              </p>
            </div>
          </div>
        `,
      });

      if (error) {
        console.error('Failed to send OTP email:', error);
        return false;
      }

      console.log(`OTP email sent successfully. ID: ${data?.id}`);
      return true;
    } catch (error: any) {
      console.error('Failed to send OTP email:', error.message);

      if (process.env.NODE_ENV === 'development') {
        console.log(`Email failed, but logging OTP for ${email}: ${otpCode}`);
        return true;
      }

      return false;
    }
  }

  isConfigured(): boolean {
    return !!this.resend;
  }
}

export default new EmailService();