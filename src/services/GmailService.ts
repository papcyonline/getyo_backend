import { gmail_v1, google } from 'googleapis';
import GoogleOAuthService from './GoogleOAuthService';
import User from '../models/User';

interface EmailMessage {
  id: string;
  threadId: string;
  from: string;
  to: string[];
  subject: string;
  snippet: string;
  body: string;
  date: Date;
  isRead: boolean;
  hasAttachments: boolean;
  labels: string[];
  attachments?: Array<{
    filename: string;
    mimeType: string;
    size: number;
    attachmentId: string;
  }>;
}

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  body: string;
  cc?: string | string[];
  bcc?: string | string[];
  isHtml?: boolean;
}

class GmailService {
  /**
   * Get Gmail client for user
   */
  private async getGmailClient(userId: string): Promise<gmail_v1.Gmail> {
    const user = await User.findById(userId);
    if (!user || !user.integrations?.google?.accessToken) {
      throw new Error('Google account not connected');
    }

    const { accessToken, refreshToken, expiresAt } = user.integrations.google;

    // Check if token is expired
    if (expiresAt && GoogleOAuthService.isTokenExpired(expiresAt.getTime())) {
      console.log('🔄 Token expired, refreshing...');

      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      // Refresh token
      const tokens = await GoogleOAuthService.refreshAccessToken(refreshToken);

      // Update user's tokens
      user.integrations.google.accessToken = tokens.access_token;
      user.integrations.google.refreshToken = tokens.refresh_token || refreshToken;
      user.integrations.google.expiresAt = new Date(tokens.expiry_date);
      await user.save();

      return GoogleOAuthService.getGmailClient(tokens.access_token, tokens.refresh_token);
    }

    return GoogleOAuthService.getGmailClient(accessToken, refreshToken);
  }

  /**
   * Get user's email messages
   */
  async getMessages(userId: string, options: {
    maxResults?: number;
    query?: string;
    labelIds?: string[];
  } = {}): Promise<EmailMessage[]> {
    try {
      const gmail = await this.getGmailClient(userId);

      const { maxResults = 20, query, labelIds } = options;

      console.log(`📧 Fetching Gmail messages for user ${userId}...`);

      // List messages
      const response = await gmail.users.messages.list({
        userId: 'me',
        maxResults,
        q: query,
        labelIds,
      });

      if (!response.data.messages || response.data.messages.length === 0) {
        console.log('📭 No messages found');
        return [];
      }

      // Fetch full message details for each message
      const messages = await Promise.all(
        response.data.messages.map(async (msg) => {
          const fullMessage = await gmail.users.messages.get({
            userId: 'me',
            id: msg.id!,
            format: 'full',
          });

          return this.parseMessage(fullMessage.data);
        })
      );

      console.log(`✅ Fetched ${messages.length} Gmail messages`);
      return messages;
    } catch (error: any) {
      console.error('❌ Failed to fetch Gmail messages:', error.message);
      throw error;
    }
  }

  /**
   * Get a single message by ID
   */
  async getMessage(userId: string, messageId: string): Promise<EmailMessage> {
    try {
      const gmail = await this.getGmailClient(userId);

      const response = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      });

      return this.parseMessage(response.data);
    } catch (error: any) {
      console.error('❌ Failed to fetch Gmail message:', error.message);
      throw error;
    }
  }

  /**
   * Send an email
   */
  async sendEmail(userId: string, options: SendEmailOptions): Promise<{ id: string; threadId: string }> {
    try {
      const gmail = await this.getGmailClient(userId);

      const { to, subject, body, cc, bcc, isHtml = false } = options;

      // Get user's email address
      const user = await User.findById(userId);
      const fromEmail = user?.integrations?.google?.email || 'me';

      // Build email message
      const toAddresses = Array.isArray(to) ? to.join(', ') : to;
      const ccAddresses = cc ? (Array.isArray(cc) ? cc.join(', ') : cc) : undefined;
      const bccAddresses = bcc ? (Array.isArray(bcc) ? bcc.join(', ') : bcc) : undefined;

      const messageParts = [
        `From: ${fromEmail}`,
        `To: ${toAddresses}`,
        ccAddresses ? `Cc: ${ccAddresses}` : '',
        bccAddresses ? `Bcc: ${bccAddresses}` : '',
        `Subject: ${subject}`,
        'MIME-Version: 1.0',
        isHtml ? 'Content-Type: text/html; charset=utf-8' : 'Content-Type: text/plain; charset=utf-8',
        '',
        body,
      ].filter(Boolean);

      const message = messageParts.join('\r\n');

      // Encode message in base64
      const encodedMessage = Buffer.from(message)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      console.log(`📤 Sending email to ${toAddresses}...`);

      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage,
        },
      });

      console.log(`✅ Email sent successfully: ${response.data.id}`);

      return {
        id: response.data.id!,
        threadId: response.data.threadId!,
      };
    } catch (error: any) {
      console.error('❌ Failed to send email:', error.message);
      throw error;
    }
  }

  /**
   * Mark message as read
   */
  async markAsRead(userId: string, messageId: string): Promise<void> {
    try {
      const gmail = await this.getGmailClient(userId);

      await gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          removeLabelIds: ['UNREAD'],
        },
      });

      console.log(`✅ Message ${messageId} marked as read`);
    } catch (error: any) {
      console.error('❌ Failed to mark message as read:', error.message);
      throw error;
    }
  }

  /**
   * Mark message as unread
   */
  async markAsUnread(userId: string, messageId: string): Promise<void> {
    try {
      const gmail = await this.getGmailClient(userId);

      await gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          addLabelIds: ['UNREAD'],
        },
      });

      console.log(`✅ Message ${messageId} marked as unread`);
    } catch (error: any) {
      console.error('❌ Failed to mark message as unread:', error.message);
      throw error;
    }
  }

  /**
   * Delete a message (move to trash)
   */
  async deleteMessage(userId: string, messageId: string): Promise<void> {
    try {
      const gmail = await this.getGmailClient(userId);

      await gmail.users.messages.trash({
        userId: 'me',
        id: messageId,
      });

      console.log(`✅ Message ${messageId} moved to trash`);
    } catch (error: any) {
      console.error('❌ Failed to delete message:', error.message);
      throw error;
    }
  }

  /**
   * Search emails
   */
  async searchEmails(userId: string, query: string, maxResults: number = 20): Promise<EmailMessage[]> {
    return this.getMessages(userId, { query, maxResults });
  }

  /**
   * Get unread count
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const gmail = await this.getGmailClient(userId);

      const response = await gmail.users.messages.list({
        userId: 'me',
        labelIds: ['UNREAD'],
        maxResults: 1,
      });

      return response.data.resultSizeEstimate || 0;
    } catch (error: any) {
      console.error('❌ Failed to get unread count:', error.message);
      return 0;
    }
  }

  /**
   * Parse Gmail message to our format
   */
  private parseMessage(message: gmail_v1.Schema$Message): EmailMessage {
    const headers = message.payload?.headers || [];
    const getHeader = (name: string) => headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

    // Get message body
    let body = '';
    if (message.payload?.parts) {
      const textPart = message.payload.parts.find(p => p.mimeType === 'text/plain');
      const htmlPart = message.payload.parts.find(p => p.mimeType === 'text/html');
      const part = textPart || htmlPart;

      if (part?.body?.data) {
        body = Buffer.from(part.body.data, 'base64').toString('utf-8');
      }
    } else if (message.payload?.body?.data) {
      body = Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
    }

    // Parse attachments
    const attachments: EmailMessage['attachments'] = [];
    if (message.payload?.parts) {
      message.payload.parts.forEach(part => {
        if (part.filename && part.body?.attachmentId) {
          attachments.push({
            filename: part.filename,
            mimeType: part.mimeType || 'application/octet-stream',
            size: part.body.size || 0,
            attachmentId: part.body.attachmentId,
          });
        }
      });
    }

    return {
      id: message.id!,
      threadId: message.threadId!,
      from: getHeader('From'),
      to: getHeader('To').split(',').map(e => e.trim()).filter(Boolean),
      subject: getHeader('Subject'),
      snippet: message.snippet || '',
      body,
      date: new Date(parseInt(message.internalDate || '0')),
      isRead: !message.labelIds?.includes('UNREAD'),
      hasAttachments: attachments.length > 0,
      labels: message.labelIds || [],
      attachments: attachments.length > 0 ? attachments : undefined,
    };
  }
}

export default new GmailService();
