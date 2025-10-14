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

  async sendPasswordResetEmail(email: string, otpCode: string): Promise<boolean> {
    try {
      if (!this.resend) {
        console.log(`Email Service disabled. Password reset OTP for ${email}: ${otpCode}`);
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
              We received a request to reset your password for your Yo! account. Use the verification code below to reset your password.
            </p>

            <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
              <p style="color: #333; margin-bottom: 10px; font-weight: bold;">Your verification code is:</p>
              <div style="font-size: 32px; font-weight: bold; color: #3396D3; letter-spacing: 4px; font-family: monospace;">
                ${otpCode}
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
        console.log(`Email failed, but logging reset OTP for ${email}: ${otpCode}`);
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
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta name="color-scheme" content="light dark">
            <style>
              @media (prefers-color-scheme: dark) {
                .email-container {
                  background-color: #1a1a1a !important;
                }
                .content-card {
                  background: #2a2a2a !important;
                  border: 1px solid #404040 !important;
                }
                .text-primary {
                  color: #ffffff !important;
                }
                .text-secondary {
                  color: #b3b3b3 !important;
                }
                .feature-card {
                  background: #2a2a2a !important;
                  border: 1px solid #404040 !important;
                }
                .footer {
                  border-top: 1px solid #404040 !important;
                }
              }
            </style>
          </head>
          <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
            <div class="email-container" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
              <!-- Header with Gradient -->
              <div style="background: linear-gradient(135deg, #3396D3 0%, #2578B5 100%); padding: 40px 20px; text-align: center; border-radius: 0;">
                <h1 style="color: #ffffff; margin: 0; font-size: 48px; font-weight: 900; letter-spacing: 2px;">Yo!</h1>
                <p style="color: rgba(255, 255, 255, 0.9); margin: 8px 0 0; font-size: 16px; font-weight: 500;">Your Personal AI Assistant</p>
              </div>

              <!-- Main Content -->
              <div class="content-card" style="padding: 40px 30px; background: #ffffff;">
                <h2 class="text-primary" style="color: #333333; font-size: 32px; font-weight: 700; margin: 0 0 20px; text-align: center;">
                  Welcome, ${userName}! 👋
                </h2>

                <p class="text-secondary" style="color: #666666; font-size: 16px; line-height: 1.8; margin: 0 0 30px; text-align: center;">
                  Congratulations! Your Yo! account is ready. Your AI assistant is here to help you stay organized, productive, and in control.
                </p>

                <!-- Feature Cards Grid -->
                <div style="margin: 30px 0;">
                  <div class="feature-card" style="background: #f8f9fa; border-radius: 12px; padding: 20px; margin-bottom: 16px; border: 1px solid #e9ecef;">
                    <div style="display: flex; align-items: center;">
                      <span style="font-size: 32px; margin-right: 16px;">🗣️</span>
                      <div>
                        <h3 class="text-primary" style="color: #333333; margin: 0 0 4px; font-size: 18px; font-weight: 600;">Voice Conversations</h3>
                        <p class="text-secondary" style="color: #666666; margin: 0; font-size: 14px;">Natural voice interactions with your AI assistant</p>
                      </div>
                    </div>
                  </div>

                  <div class="feature-card" style="background: #f8f9fa; border-radius: 12px; padding: 20px; margin-bottom: 16px; border: 1px solid #e9ecef;">
                    <div style="display: flex; align-items: center;">
                      <span style="font-size: 32px; margin-right: 16px;">📋</span>
                      <div>
                        <h3 class="text-primary" style="color: #333333; margin: 0 0 4px; font-size: 18px; font-weight: 600;">Smart Task Management</h3>
                        <p class="text-secondary" style="color: #666666; margin: 0; font-size: 14px;">Intelligent reminders and task organization</p>
                      </div>
                    </div>
                  </div>

                  <div class="feature-card" style="background: #f8f9fa; border-radius: 12px; padding: 20px; margin-bottom: 16px; border: 1px solid #e9ecef;">
                    <div style="display: flex; align-items: center;">
                      <span style="font-size: 32px; margin-right: 16px;">📅</span>
                      <div>
                        <h3 class="text-primary" style="color: #333333; margin: 0 0 4px; font-size: 18px; font-weight: 600;">Calendar Integration</h3>
                        <p class="text-secondary" style="color: #666666; margin: 0; font-size: 14px;">Seamless scheduling and event management</p>
                      </div>
                    </div>
                  </div>

                  <div class="feature-card" style="background: #f8f9fa; border-radius: 12px; padding: 20px; margin-bottom: 0; border: 1px solid #e9ecef;">
                    <div style="display: flex; align-items: center;">
                      <span style="font-size: 32px; margin-right: 16px;">📊</span>
                      <div>
                        <h3 class="text-primary" style="color: #333333; margin: 0 0 4px; font-size: 18px; font-weight: 600;">Daily Insights</h3>
                        <p class="text-secondary" style="color: #666666; margin: 0; font-size: 14px;">Personalized briefings and productivity analytics</p>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- CTA Button -->
                <div style="text-align: center; margin: 40px 0 30px;">
                  <a href="#" style="display: inline-block; background: #3396D3; color: #ffffff; padding: 16px 48px; text-decoration: none; border-radius: 30px; font-weight: 700; font-size: 16px; letter-spacing: 0.5px; box-shadow: 0 4px 12px rgba(51, 150, 211, 0.3);">
                    Get Started with Yo!
                  </a>
                </div>

                <p class="text-secondary" style="color: #666666; font-size: 14px; line-height: 1.6; margin: 0; text-align: center;">
                  Questions? Our support team is here to help you get the most out of Yo!
                </p>
              </div>

              <!-- Footer with Social Icons -->
              <div class="footer" style="padding: 30px 20px; border-top: 1px solid #e9ecef; background: #ffffff;">
                <div style="text-align: center; margin-bottom: 20px;">
                  <a href="https://twitter.com/yoapp" style="display: inline-block; margin: 0 8px;">
                    <img src="https://cdn.simpleicons.org/x/1DA1F2" alt="X" width="24" height="24" style="opacity: 0.7;">
                  </a>
                  <a href="https://facebook.com/yoapp" style="display: inline-block; margin: 0 8px;">
                    <img src="https://cdn.simpleicons.org/facebook/1877F2" alt="Facebook" width="24" height="24" style="opacity: 0.7;">
                  </a>
                  <a href="https://instagram.com/yoapp" style="display: inline-block; margin: 0 8px;">
                    <img src="https://cdn.simpleicons.org/instagram/E4405F" alt="Instagram" width="24" height="24" style="opacity: 0.7;">
                  </a>
                  <a href="https://linkedin.com/company/yoapp" style="display: inline-block; margin: 0 8px;">
                    <img src="https://cdn.simpleicons.org/linkedin/0A66C2" alt="LinkedIn" width="24" height="24" style="opacity: 0.7;">
                  </a>
                </div>

                <p class="text-secondary" style="color: #999999; font-size: 12px; text-align: center; margin: 0 0 8px; line-height: 1.6;">
                  Welcome aboard!<br>
                  <strong>The Yo! Team</strong>
                </p>

                <p class="text-secondary" style="color: #999999; font-size: 11px; text-align: center; margin: 8px 0 0;">
                  © 2025 Yo! Personal AI Assistant. All rights reserved.<br>
                  <a href="#" style="color: #3396D3; text-decoration: none;">Privacy Policy</a> •
                  <a href="#" style="color: #3396D3; text-decoration: none;">Terms of Service</a> •
                  <a href="#" style="color: #3396D3; text-decoration: none;">Unsubscribe</a>
                </p>
              </div>
            </div>
          </body>
          </html>
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