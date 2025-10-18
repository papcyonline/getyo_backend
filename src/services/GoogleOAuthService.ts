import { google, Auth } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  scope: string;
  token_type: string;
  expiry_date: number;
}

interface GoogleUserInfo {
  email: string;
  name: string;
  picture?: string;
  verified_email: boolean;
}

class GoogleOAuthService {
  private oauth2Client: OAuth2Client;
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  // Scopes for different Google services
  private scopes = {
    gmail: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/gmail.compose',
    ],
    calendar: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
    ],
    drive: [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/drive.file',
    ],
    meet: [
      'https://www.googleapis.com/auth/meetings.space.created',
    ],
    contacts: [
      'https://www.googleapis.com/auth/contacts.readonly',
    ],
    userInfo: [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ],
  };

  constructor() {
    this.clientId = process.env.GOOGLE_CLIENT_ID || '';
    this.clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';

    // For mobile apps, we'll use a custom scheme redirect
    // Format: com.yourapp:/oauth2redirect
    this.redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/oauth/google/callback';

    if (!this.clientId || !this.clientSecret) {
      console.warn('⚠️ Google OAuth credentials not configured');
    }

    this.oauth2Client = new google.auth.OAuth2(
      this.clientId,
      this.clientSecret,
      this.redirectUri
    );
  }

  /**
   * Generate authorization URL for user to grant permissions
   */
  generateAuthUrl(services: string[] = ['gmail', 'calendar']): string {
    // Combine scopes from requested services
    const requestedScopes: string[] = [];

    services.forEach(service => {
      const serviceScopes = this.scopes[service as keyof typeof this.scopes];
      if (serviceScopes) {
        requestedScopes.push(...serviceScopes);
      }
    });

    // Always include user info to get email
    requestedScopes.push(...this.scopes.userInfo);

    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline', // Gets refresh token
      scope: requestedScopes,
      prompt: 'consent', // Force consent screen to ensure refresh token
      state: JSON.stringify({ services }), // Pass services for tracking
    });

    console.log('🔐 Generated Google Auth URL:', authUrl);
    return authUrl;
  }

  /**
   * Exchange authorization code for tokens
   */
  async getTokensFromCode(code: string): Promise<GoogleTokens> {
    try {
      console.log('🔄 Exchanging authorization code for tokens...');

      const { tokens } = await this.oauth2Client.getToken(code);

      if (!tokens.access_token) {
        throw new Error('No access token received');
      }

      console.log('✅ Successfully obtained tokens');
      console.log('📅 Token expires at:', new Date(tokens.expiry_date || 0).toISOString());
      console.log('🔑 Has refresh token:', !!tokens.refresh_token);

      return {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || undefined,
        scope: tokens.scope || '',
        token_type: tokens.token_type || 'Bearer',
        expiry_date: tokens.expiry_date || Date.now() + 3600000, // Default 1 hour
      };
    } catch (error: any) {
      console.error('❌ Failed to exchange code for tokens:', error.message);
      throw new Error(`OAuth token exchange failed: ${error.message}`);
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<GoogleTokens> {
    try {
      console.log('🔄 Refreshing access token...');

      this.oauth2Client.setCredentials({
        refresh_token: refreshToken,
      });

      const { credentials } = await this.oauth2Client.refreshAccessToken();

      if (!credentials.access_token) {
        throw new Error('No access token received from refresh');
      }

      console.log('✅ Successfully refreshed access token');
      console.log('📅 New token expires at:', new Date(credentials.expiry_date || 0).toISOString());

      return {
        access_token: credentials.access_token,
        refresh_token: credentials.refresh_token || refreshToken, // Keep existing if not provided
        scope: credentials.scope || '',
        token_type: credentials.token_type || 'Bearer',
        expiry_date: credentials.expiry_date || Date.now() + 3600000,
      };
    } catch (error: any) {
      console.error('❌ Failed to refresh token:', error.message);
      throw new Error(`Token refresh failed: ${error.message}`);
    }
  }

  /**
   * Get user info from Google
   */
  async getUserInfo(accessToken: string): Promise<GoogleUserInfo> {
    try {
      this.oauth2Client.setCredentials({ access_token: accessToken });

      const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client });
      const { data } = await oauth2.userinfo.get();

      return {
        email: data.email || '',
        name: data.name || '',
        picture: data.picture || undefined,
        verified_email: data.verified_email || false,
      };
    } catch (error: any) {
      console.error('❌ Failed to get user info:', error.message);
      throw new Error(`Failed to get user info: ${error.message}`);
    }
  }

  /**
   * Check if tokens are expired
   */
  isTokenExpired(expiryDate: number): boolean {
    // Add 5 minute buffer
    return Date.now() >= (expiryDate - 300000);
  }

  /**
   * Create OAuth2 client with credentials
   */
  createAuthenticatedClient(accessToken: string, refreshToken?: string): OAuth2Client {
    const client = new google.auth.OAuth2(
      this.clientId,
      this.clientSecret,
      this.redirectUri
    );

    client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    return client;
  }

  /**
   * Get Gmail API client
   */
  getGmailClient(accessToken: string, refreshToken?: string) {
    const auth = this.createAuthenticatedClient(accessToken, refreshToken);
    return google.gmail({ version: 'v1', auth });
  }

  /**
   * Get Calendar API client
   */
  getCalendarClient(accessToken: string, refreshToken?: string) {
    const auth = this.createAuthenticatedClient(accessToken, refreshToken);
    return google.calendar({ version: 'v3', auth });
  }

  /**
   * Get Drive API client
   */
  getDriveClient(accessToken: string, refreshToken?: string) {
    const auth = this.createAuthenticatedClient(accessToken, refreshToken);
    return google.drive({ version: 'v3', auth });
  }

  /**
   * Get People API client (for contacts)
   */
  getPeopleClient(accessToken: string, refreshToken?: string) {
    const auth = this.createAuthenticatedClient(accessToken, refreshToken);
    return google.people({ version: 'v1', auth });
  }

  /**
   * Revoke tokens (disconnect)
   */
  async revokeTokens(accessToken: string): Promise<void> {
    try {
      await this.oauth2Client.revokeToken(accessToken);
      console.log('✅ Successfully revoked Google tokens');
    } catch (error: any) {
      console.error('❌ Failed to revoke tokens:', error.message);
      throw new Error(`Token revocation failed: ${error.message}`);
    }
  }
}

export default new GoogleOAuthService();
