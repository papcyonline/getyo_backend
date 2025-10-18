import express from 'express';
import { google } from 'googleapis';
import { User } from '../models';
import { ApiResponse } from '../types';
import { authenticateToken } from '../middleware/auth';
import crypto from 'crypto';
import axios from 'axios';

const router = express.Router();

// Gmail OAuth2 Configuration
const GMAIL_OAUTH_CONFIG = {
  clientId: process.env.GOOGLE_CLIENT_ID || '1234567890-abcdefghijklmnopqrstuvwxyz.apps.googleusercontent.com',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'your-google-client-secret',
  redirectUri: process.env.GMAIL_REDIRECT_URI || 'exp://localhost:8081',
  scopes: [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.compose',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
  ],
};

// Outlook OAuth2 Configuration
const OUTLOOK_OAUTH_CONFIG = {
  clientId: process.env.OUTLOOK_CLIENT_ID || 'your-outlook-client-id',
  clientSecret: process.env.OUTLOOK_CLIENT_SECRET || 'your-outlook-client-secret',
  redirectUri: process.env.OUTLOOK_REDIRECT_URI || 'exp://localhost:8081',
  tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
  graphApiUrl: 'https://graph.microsoft.com/v1.0',
  scopes: [
    'https://graph.microsoft.com/Mail.Read',
    'https://graph.microsoft.com/Mail.Send',
    'https://graph.microsoft.com/Mail.ReadWrite',
    'https://graph.microsoft.com/User.Read',
    'offline_access',
  ],
};

// Yahoo Mail OAuth2 Configuration
const YAHOO_OAUTH_CONFIG = {
  clientId: process.env.YAHOO_CLIENT_ID || 'your-yahoo-client-id',
  clientSecret: process.env.YAHOO_CLIENT_SECRET || 'your-yahoo-client-secret',
  redirectUri: process.env.YAHOO_REDIRECT_URI || 'exp://localhost:8081',
  tokenUrl: 'https://api.login.yahoo.com/oauth2/get_token',
  apiUrl: 'https://api.mail.yahoo.com',
  scopes: [
    'mail-r',
    'mail-w',
  ],
};

// Create OAuth2 client
const createOAuth2Client = () => {
  return new google.auth.OAuth2(
    GMAIL_OAUTH_CONFIG.clientId,
    GMAIL_OAUTH_CONFIG.clientSecret,
    GMAIL_OAUTH_CONFIG.redirectUri
  );
};

// Apply auth middleware to all routes
router.use(authenticateToken);

// @route   GET /api/email/gmail/auth-url
// @desc    Get Gmail OAuth authorization URL
// @access  Private
router.get('/gmail/auth-url', async (req, res) => {
  try {
    const oauth2Client = createOAuth2Client();

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: GMAIL_OAUTH_CONFIG.scopes,
      prompt: 'consent', // Force consent to get refresh token
    });

    res.json({
      success: true,
      data: {
        authUrl,
        provider: 'gmail',
      },
      message: 'Gmail authorization URL generated',
    } as ApiResponse<any>);
  } catch (error: any) {
    console.error('❌ Gmail auth URL generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate Gmail authorization URL',
    } as ApiResponse<null>);
  }
});

// @route   POST /api/email/gmail/connect
// @desc    Connect Gmail account by exchanging OAuth code for tokens
// @access  Private
router.post('/gmail/connect', async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Authorization code is required',
      } as ApiResponse<null>);
    }

    console.log('🔐 Exchanging Gmail OAuth code for tokens for user:', userId);

    const oauth2Client = createOAuth2Client();

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    if (!tokens.access_token) {
      return res.status(400).json({
        success: false,
        error: 'Failed to obtain access token',
      } as ApiResponse<null>);
    }

    // Get user's Gmail profile
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: 'me' });

    // Get user info for email address and name
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();

    const emailAccount = {
      id: crypto.randomUUID(),
      provider: 'gmail' as const,
      email: userInfo.data.email || profile.data.emailAddress || '',
      name: userInfo.data.name || '',
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || '',
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
      connectedAt: new Date(),
      lastSyncedAt: new Date(),
      isDefault: false,
    };

    // Update user's email accounts
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      } as ApiResponse<null>);
    }

    // Check if account already exists
    const existingAccount = user.integrations?.emailAccounts?.find(
      (acc: any) => acc.email === emailAccount.email && acc.provider === 'gmail'
    );

    if (existingAccount) {
      // Update existing account
      await User.findOneAndUpdate(
        { _id: userId, 'integrations.emailAccounts.id': existingAccount.id },
        {
          $set: {
            'integrations.emailAccounts.$.accessToken': emailAccount.accessToken,
            'integrations.emailAccounts.$.refreshToken': emailAccount.refreshToken,
            'integrations.emailAccounts.$.expiresAt': emailAccount.expiresAt,
            'integrations.emailAccounts.$.lastSyncedAt': emailAccount.lastSyncedAt,
          },
        }
      );
    } else {
      // Add new account
      await User.findByIdAndUpdate(
        userId,
        {
          $push: {
            'integrations.emailAccounts': emailAccount,
          },
        }
      );
    }

    console.log('✅ Gmail account connected successfully:', emailAccount.email);

    res.json({
      success: true,
      data: {
        id: emailAccount.id,
        provider: emailAccount.provider,
        email: emailAccount.email,
        name: emailAccount.name,
        connectedAt: emailAccount.connectedAt,
      },
      message: 'Gmail account connected successfully',
    } as ApiResponse<any>);
  } catch (error: any) {
    console.error('❌ Gmail connection error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to connect Gmail account',
    } as ApiResponse<null>);
  }
});

// @route   GET /api/email/accounts
// @desc    Get all connected email accounts
// @access  Private
router.get('/accounts', async (req, res) => {
  try {
    const userId = (req as any).user?.userId;

    const user = await User.findById(userId).select('integrations.emailAccounts');
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      } as ApiResponse<null>);
    }

    const accounts = (user.integrations?.emailAccounts || []).map((account: any) => ({
      id: account.id,
      provider: account.provider,
      email: account.email,
      name: account.name,
      connectedAt: account.connectedAt,
      lastSyncedAt: account.lastSyncedAt,
      isDefault: account.isDefault,
    }));

    res.json({
      success: true,
      data: accounts,
      message: 'Email accounts retrieved successfully',
    } as ApiResponse<any>);
  } catch (error: any) {
    console.error('❌ Get email accounts error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve email accounts',
    } as ApiResponse<null>);
  }
});

// @route   DELETE /api/email/accounts/:accountId
// @desc    Disconnect email account
// @access  Private
router.delete('/accounts/:accountId', async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    const { accountId } = req.params;

    const user = await User.findByIdAndUpdate(
      userId,
      {
        $pull: {
          'integrations.emailAccounts': { id: accountId },
        },
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      } as ApiResponse<null>);
    }

    console.log('✅ Email account disconnected:', accountId);

    res.json({
      success: true,
      data: { accountId },
      message: 'Email account disconnected successfully',
    } as ApiResponse<any>);
  } catch (error: any) {
    console.error('❌ Disconnect email account error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to disconnect email account',
    } as ApiResponse<null>);
  }
});

// Helper function to get OAuth2 client with user's credentials
const getAuthenticatedGmailClient = async (userId: string, accountId: string) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const account = user.integrations?.emailAccounts?.find((acc: any) => acc.id === accountId);
  if (!account || account.provider !== 'gmail') {
    throw new Error('Gmail account not found');
  }

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    access_token: account.accessToken,
    refresh_token: account.refreshToken,
    expiry_date: account.expiresAt?.getTime(),
  });

  return { oauth2Client, account };
};

// @route   GET /api/email/gmail/messages
// @desc    Fetch Gmail messages
// @access  Private
router.get('/gmail/messages', async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    const { accountId, maxResults = 50, pageToken, q } = req.query;

    if (!accountId) {
      return res.status(400).json({
        success: false,
        error: 'Account ID is required',
      } as ApiResponse<null>);
    }

    const { oauth2Client } = await getAuthenticatedGmailClient(userId, accountId as string);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // List messages
    const messagesResponse = await gmail.users.messages.list({
      userId: 'me',
      maxResults: parseInt(maxResults as string),
      pageToken: pageToken as string,
      q: q as string,
    });

    const messages = [];

    // Fetch full message details
    if (messagesResponse.data.messages) {
      for (const message of messagesResponse.data.messages.slice(0, 20)) { // Limit to 20 for performance
        const fullMessage = await gmail.users.messages.get({
          userId: 'me',
          id: message.id!,
          format: 'full',
        });

        const headers = fullMessage.data.payload?.headers || [];
        const getHeader = (name: string) => headers.find((h: any) => h.name === name)?.value || '';

        messages.push({
          id: fullMessage.data.id,
          threadId: fullMessage.data.threadId,
          snippet: fullMessage.data.snippet,
          subject: getHeader('Subject'),
          from: getHeader('From'),
          to: getHeader('To'),
          date: getHeader('Date'),
          isRead: !fullMessage.data.labelIds?.includes('UNREAD'),
          isStarred: fullMessage.data.labelIds?.includes('STARRED'),
          labels: fullMessage.data.labelIds || [],
        });
      }
    }

    res.json({
      success: true,
      data: {
        messages,
        nextPageToken: messagesResponse.data.nextPageToken,
        resultSizeEstimate: messagesResponse.data.resultSizeEstimate,
      },
      message: 'Gmail messages retrieved successfully',
    } as ApiResponse<any>);
  } catch (error: any) {
    console.error('❌ Fetch Gmail messages error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch Gmail messages',
    } as ApiResponse<null>);
  }
});

// @route   GET /api/email/gmail/messages/:messageId
// @desc    Get single Gmail message with full details
// @access  Private
router.get('/gmail/messages/:messageId', async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    const { messageId } = req.params;
    const { accountId } = req.query;

    if (!accountId) {
      return res.status(400).json({
        success: false,
        error: 'Account ID is required',
      } as ApiResponse<null>);
    }

    const { oauth2Client } = await getAuthenticatedGmailClient(userId, accountId as string);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const message = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });

    const headers = message.data.payload?.headers || [];
    const getHeader = (name: string) => headers.find((h: any) => h.name === name)?.value || '';

    // Extract body
    let body = '';
    if (message.data.payload?.parts) {
      const textPart = message.data.payload.parts.find((part: any) => part.mimeType === 'text/plain');
      if (textPart?.body?.data) {
        body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
      }
    } else if (message.data.payload?.body?.data) {
      body = Buffer.from(message.data.payload.body.data, 'base64').toString('utf-8');
    }

    res.json({
      success: true,
      data: {
        id: message.data.id,
        threadId: message.data.threadId,
        subject: getHeader('Subject'),
        from: getHeader('From'),
        to: getHeader('To'),
        cc: getHeader('Cc'),
        date: getHeader('Date'),
        body,
        snippet: message.data.snippet,
        isRead: !message.data.labelIds?.includes('UNREAD'),
        isStarred: message.data.labelIds?.includes('STARRED'),
        labels: message.data.labelIds || [],
      },
      message: 'Gmail message retrieved successfully',
    } as ApiResponse<any>);
  } catch (error: any) {
    console.error('❌ Fetch Gmail message error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch Gmail message',
    } as ApiResponse<null>);
  }
});

// @route   POST /api/email/gmail/send
// @desc    Send Gmail message
// @access  Private
router.post('/gmail/send', async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    const { accountId, to, subject, body, cc, bcc } = req.body;

    if (!accountId || !to || !subject || !body) {
      return res.status(400).json({
        success: false,
        error: 'Account ID, to, subject, and body are required',
      } as ApiResponse<null>);
    }

    const { oauth2Client } = await getAuthenticatedGmailClient(userId, accountId);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Create email message
    const messageParts = [
      `To: ${to}`,
      cc ? `Cc: ${cc}` : '',
      bcc ? `Bcc: ${bcc}` : '',
      `Subject: ${subject}`,
      '',
      body,
    ].filter(Boolean).join('\n');

    const encodedMessage = Buffer.from(messageParts).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
      },
    });

    console.log('✅ Gmail message sent:', result.data.id);

    res.json({
      success: true,
      data: {
        id: result.data.id,
        threadId: result.data.threadId,
      },
      message: 'Email sent successfully',
    } as ApiResponse<any>);
  } catch (error: any) {
    console.error('❌ Send Gmail error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to send email',
    } as ApiResponse<null>);
  }
});

// ============================================================================
// OUTLOOK / MICROSOFT 365 ENDPOINTS
// ============================================================================

// @route   POST /api/email/outlook/connect
// @desc    Connect Outlook account by exchanging OAuth code for tokens
// @access  Private
router.post('/outlook/connect', async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Authorization code is required',
      } as ApiResponse<null>);
    }

    console.log('🔐 Exchanging Outlook OAuth code for tokens for user:', userId);

    // Exchange code for tokens
    const tokenResponse = await axios.post(
      OUTLOOK_OAUTH_CONFIG.tokenUrl,
      new URLSearchParams({
        client_id: OUTLOOK_OAUTH_CONFIG.clientId,
        client_secret: OUTLOOK_OAUTH_CONFIG.clientSecret,
        code: code,
        redirect_uri: OUTLOOK_OAUTH_CONFIG.redirectUri,
        grant_type: 'authorization_code',
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    if (!access_token) {
      return res.status(400).json({
        success: false,
        error: 'Failed to obtain access token',
      } as ApiResponse<null>);
    }

    // Get user's profile info from Microsoft Graph
    const userInfoResponse = await axios.get(`${OUTLOOK_OAUTH_CONFIG.graphApiUrl}/me`, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    const emailAccount = {
      id: crypto.randomUUID(),
      provider: 'outlook' as const,
      email: userInfoResponse.data.mail || userInfoResponse.data.userPrincipalName || '',
      name: userInfoResponse.data.displayName || '',
      accessToken: access_token,
      refreshToken: refresh_token || '',
      expiresAt: expires_in ? new Date(Date.now() + expires_in * 1000) : undefined,
      connectedAt: new Date(),
      lastSyncedAt: new Date(),
      isDefault: false,
    };

    // Update user's email accounts
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      } as ApiResponse<null>);
    }

    // Check if account already exists
    const existingAccount = user.integrations?.emailAccounts?.find(
      (acc: any) => acc.email === emailAccount.email && acc.provider === 'outlook'
    );

    if (existingAccount) {
      // Update existing account
      await User.findOneAndUpdate(
        { _id: userId, 'integrations.emailAccounts.id': existingAccount.id },
        {
          $set: {
            'integrations.emailAccounts.$.accessToken': emailAccount.accessToken,
            'integrations.emailAccounts.$.refreshToken': emailAccount.refreshToken,
            'integrations.emailAccounts.$.expiresAt': emailAccount.expiresAt,
            'integrations.emailAccounts.$.lastSyncedAt': emailAccount.lastSyncedAt,
          },
        }
      );
    } else {
      // Add new account
      await User.findByIdAndUpdate(
        userId,
        {
          $push: {
            'integrations.emailAccounts': emailAccount,
          },
        }
      );
    }

    console.log('✅ Outlook account connected successfully:', emailAccount.email);

    res.json({
      success: true,
      data: {
        id: emailAccount.id,
        provider: emailAccount.provider,
        email: emailAccount.email,
        name: emailAccount.name,
        connectedAt: emailAccount.connectedAt,
      },
      message: 'Outlook account connected successfully',
    } as ApiResponse<any>);
  } catch (error: any) {
    console.error('❌ Outlook connection error:', error.response?.data || error);
    res.status(500).json({
      success: false,
      error: error.response?.data?.error_description || error.message || 'Failed to connect Outlook account',
    } as ApiResponse<null>);
  }
});

// Helper function to get authenticated Outlook client
const getAuthenticatedOutlookClient = async (userId: string, accountId: string) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const account = user.integrations?.emailAccounts?.find((acc: any) => acc.id === accountId);
  if (!account || account.provider !== 'outlook') {
    throw new Error('Outlook account not found');
  }

  return { accessToken: account.accessToken, account };
};

// @route   GET /api/email/outlook/messages
// @desc    Fetch Outlook messages
// @access  Private
router.get('/outlook/messages', async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    const { accountId, maxResults = 50, q } = req.query;

    if (!accountId) {
      return res.status(400).json({
        success: false,
        error: 'Account ID is required',
      } as ApiResponse<null>);
    }

    const { accessToken } = await getAuthenticatedOutlookClient(userId, accountId as string);

    // Build filter query
    let filter = '';
    if (q) {
      filter = `?$search="${q}"`;
    }

    // Fetch messages from Microsoft Graph API
    const messagesResponse = await axios.get(
      `${OUTLOOK_OAUTH_CONFIG.graphApiUrl}/me/messages${filter ? filter : '?'}$top=${maxResults}&$orderby=receivedDateTime desc`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const messages = messagesResponse.data.value.map((msg: any) => ({
      id: msg.id,
      threadId: msg.conversationId,
      snippet: msg.bodyPreview,
      subject: msg.subject,
      from: msg.from?.emailAddress?.address || '',
      to: msg.toRecipients?.map((r: any) => r.emailAddress?.address).join(', ') || '',
      date: msg.receivedDateTime,
      isRead: msg.isRead,
      isStarred: msg.flag?.flagStatus === 'flagged',
    }));

    res.json({
      success: true,
      data: {
        messages,
        nextPageToken: messagesResponse.data['@odata.nextLink'],
        resultSizeEstimate: messages.length,
      },
      message: 'Outlook messages retrieved successfully',
    } as ApiResponse<any>);
  } catch (error: any) {
    console.error('❌ Fetch Outlook messages error:', error.response?.data || error);
    res.status(500).json({
      success: false,
      error: error.response?.data?.error?.message || error.message || 'Failed to fetch Outlook messages',
    } as ApiResponse<null>);
  }
});

// @route   GET /api/email/outlook/messages/:messageId
// @desc    Get single Outlook message with full details
// @access  Private
router.get('/outlook/messages/:messageId', async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    const { messageId } = req.params;
    const { accountId } = req.query;

    if (!accountId) {
      return res.status(400).json({
        success: false,
        error: 'Account ID is required',
      } as ApiResponse<null>);
    }

    const { accessToken } = await getAuthenticatedOutlookClient(userId, accountId as string);

    const messageResponse = await axios.get(
      `${OUTLOOK_OAUTH_CONFIG.graphApiUrl}/me/messages/${messageId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const msg = messageResponse.data;

    res.json({
      success: true,
      data: {
        id: msg.id,
        threadId: msg.conversationId,
        subject: msg.subject,
        from: msg.from?.emailAddress?.address || '',
        to: msg.toRecipients?.map((r: any) => r.emailAddress?.address).join(', ') || '',
        cc: msg.ccRecipients?.map((r: any) => r.emailAddress?.address).join(', ') || '',
        date: msg.receivedDateTime,
        body: msg.body?.content || '',
        snippet: msg.bodyPreview,
        isRead: msg.isRead,
        isStarred: msg.flag?.flagStatus === 'flagged',
      },
      message: 'Outlook message retrieved successfully',
    } as ApiResponse<any>);
  } catch (error: any) {
    console.error('❌ Fetch Outlook message error:', error.response?.data || error);
    res.status(500).json({
      success: false,
      error: error.response?.data?.error?.message || error.message || 'Failed to fetch Outlook message',
    } as ApiResponse<null>);
  }
});

// @route   POST /api/email/outlook/send
// @desc    Send Outlook message
// @access  Private
router.post('/outlook/send', async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    const { accountId, to, subject, body, cc, bcc } = req.body;

    if (!accountId || !to || !subject || !body) {
      return res.status(400).json({
        success: false,
        error: 'Account ID, to, subject, and body are required',
      } as ApiResponse<null>);
    }

    const { accessToken } = await getAuthenticatedOutlookClient(userId, accountId);

    // Create message object for Microsoft Graph API
    const message = {
      subject,
      body: {
        contentType: 'Text',
        content: body,
      },
      toRecipients: to.split(',').map((email: string) => ({
        emailAddress: {
          address: email.trim(),
        },
      })),
      ...(cc && {
        ccRecipients: cc.split(',').map((email: string) => ({
          emailAddress: {
            address: email.trim(),
          },
        })),
      }),
      ...(bcc && {
        bccRecipients: bcc.split(',').map((email: string) => ({
          emailAddress: {
            address: email.trim(),
          },
        })),
      }),
    };

    const result = await axios.post(
      `${OUTLOOK_OAUTH_CONFIG.graphApiUrl}/me/sendMail`,
      {
        message,
        saveToSentItems: true,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ Outlook message sent successfully');

    res.json({
      success: true,
      data: {
        id: 'sent',
        status: 'sent',
      },
      message: 'Email sent successfully',
    } as ApiResponse<any>);
  } catch (error: any) {
    console.error('❌ Send Outlook error:', error.response?.data || error);
    res.status(500).json({
      success: false,
      error: error.response?.data?.error?.message || error.message || 'Failed to send email',
    } as ApiResponse<null>);
  }
});

// ============================================================================
// YAHOO MAIL ENDPOINTS
// ============================================================================

// @route   POST /api/email/yahoo/connect
// @desc    Connect Yahoo Mail account by exchanging OAuth code for tokens
// @access  Private
router.post('/yahoo/connect', async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Authorization code is required',
      } as ApiResponse<null>);
    }

    console.log('🔐 Exchanging Yahoo OAuth code for tokens for user:', userId);

    // Exchange code for tokens
    const tokenResponse = await axios.post(
      YAHOO_OAUTH_CONFIG.tokenUrl,
      new URLSearchParams({
        client_id: YAHOO_OAUTH_CONFIG.clientId,
        client_secret: YAHOO_OAUTH_CONFIG.clientSecret,
        code: code,
        redirect_uri: YAHOO_OAUTH_CONFIG.redirectUri,
        grant_type: 'authorization_code',
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const { access_token, refresh_token, expires_in, xoauth_yahoo_guid } = tokenResponse.data;

    if (!access_token) {
      return res.status(400).json({
        success: false,
        error: 'Failed to obtain access token',
      } as ApiResponse<null>);
    }

    // Get user's profile info from Yahoo API
    const userInfoResponse = await axios.get(
      `https://api.login.yahoo.com/openid/v1/userinfo`,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      }
    );

    const emailAccount = {
      id: crypto.randomUUID(),
      provider: 'yahoo' as const,
      email: userInfoResponse.data.email || '',
      name: userInfoResponse.data.name || userInfoResponse.data.given_name || '',
      accessToken: access_token,
      refreshToken: refresh_token || '',
      expiresAt: expires_in ? new Date(Date.now() + expires_in * 1000) : undefined,
      connectedAt: new Date(),
      lastSyncedAt: new Date(),
      yahooGuid: xoauth_yahoo_guid,
      isDefault: false,
    };

    // Update user's email accounts
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      } as ApiResponse<null>);
    }

    // Check if account already exists
    const existingAccount = user.integrations?.emailAccounts?.find(
      (acc: any) => acc.email === emailAccount.email && acc.provider === 'yahoo'
    );

    if (existingAccount) {
      // Update existing account
      await User.findOneAndUpdate(
        { _id: userId, 'integrations.emailAccounts.id': existingAccount.id },
        {
          $set: {
            'integrations.emailAccounts.$.accessToken': emailAccount.accessToken,
            'integrations.emailAccounts.$.refreshToken': emailAccount.refreshToken,
            'integrations.emailAccounts.$.expiresAt': emailAccount.expiresAt,
            'integrations.emailAccounts.$.lastSyncedAt': emailAccount.lastSyncedAt,
            'integrations.emailAccounts.$.yahooGuid': emailAccount.yahooGuid,
          },
        }
      );
    } else {
      // Add new account
      await User.findByIdAndUpdate(
        userId,
        {
          $push: {
            'integrations.emailAccounts': emailAccount,
          },
        }
      );
    }

    console.log('✅ Yahoo Mail account connected successfully:', emailAccount.email);

    res.json({
      success: true,
      data: {
        id: emailAccount.id,
        provider: emailAccount.provider,
        email: emailAccount.email,
        name: emailAccount.name,
        connectedAt: emailAccount.connectedAt,
      },
      message: 'Yahoo Mail account connected successfully',
    } as ApiResponse<any>);
  } catch (error: any) {
    console.error('❌ Yahoo connection error:', error.response?.data || error);
    res.status(500).json({
      success: false,
      error: error.response?.data?.error_description || error.message || 'Failed to connect Yahoo Mail account',
    } as ApiResponse<null>);
  }
});

// @route   POST /api/email/icloud/connect
// @desc    Connect iCloud Mail using App-Specific Password
// @access  Private
router.post('/icloud/connect', async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    const { email, appPassword, name } = req.body;

    if (!email || !appPassword) {
      return res.status(400).json({
        success: false,
        error: 'Email and app-specific password are required',
      } as ApiResponse<null>);
    }

    console.log('🔐 Connecting iCloud Mail for user:', userId);

    // For iCloud, we store the credentials securely
    // The actual IMAP/SMTP connection will be handled by the email client
    const emailAccount = {
      id: crypto.randomUUID(),
      provider: 'icloud' as const,
      email: email,
      name: name || email.split('@')[0],
      // Note: In production, encrypt the app password before storing
      appPassword: appPassword,
      imapServer: 'imap.mail.me.com',
      imapPort: 993,
      smtpServer: 'smtp.mail.me.com',
      smtpPort: 587,
      connectedAt: new Date(),
      lastSyncedAt: new Date(),
      isDefault: false,
    };

    // Update user's email accounts
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      } as ApiResponse<null>);
    }

    // Check if account already exists
    const existingAccount = user.integrations?.emailAccounts?.find(
      (acc: any) => acc.email === emailAccount.email && acc.provider === 'icloud'
    );

    if (existingAccount) {
      // Update existing account
      await User.findOneAndUpdate(
        { _id: userId, 'integrations.emailAccounts.id': existingAccount.id },
        {
          $set: {
            'integrations.emailAccounts.$.appPassword': emailAccount.appPassword,
            'integrations.emailAccounts.$.lastSyncedAt': emailAccount.lastSyncedAt,
          },
        }
      );
    } else {
      // Add new account
      await User.findByIdAndUpdate(
        userId,
        {
          $push: {
            'integrations.emailAccounts': emailAccount,
          },
        }
      );
    }

    console.log('✅ iCloud Mail account connected successfully:', emailAccount.email);

    res.json({
      success: true,
      data: {
        id: emailAccount.id,
        provider: emailAccount.provider,
        email: emailAccount.email,
        name: emailAccount.name,
        connectedAt: emailAccount.connectedAt,
      },
      message: 'iCloud Mail account connected successfully',
    } as ApiResponse<any>);
  } catch (error: any) {
    console.error('❌ iCloud connection error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to connect iCloud Mail account',
    } as ApiResponse<null>);
  }
});

export default router;
