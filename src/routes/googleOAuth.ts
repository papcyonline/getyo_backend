import express from 'express';
import GoogleOAuthService from '../services/GoogleOAuthService';
import User from '../models/User';
import { authenticate } from '../middleware/auth';

const router = express.Router();

/**
 * @route   GET /api/oauth/google/auth-url
 * @desc    Get Google OAuth authorization URL
 * @access  Private
 */
router.get('/auth-url', authenticate, async (req, res) => {
  try {
    const { services } = req.query;

    // Parse services array from query
    const requestedServices = services
      ? (services as string).split(',')
      : ['gmail', 'calendar'];

    console.log(`🔐 Generating Google OAuth URL for services:`, requestedServices);

    const authUrl = GoogleOAuthService.generateAuthUrl(requestedServices);

    res.json({
      success: true,
      data: {
        authUrl,
        services: requestedServices,
      },
    });
  } catch (error: any) {
    console.error('❌ Failed to generate auth URL:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate authorization URL',
    });
  }
});

/**
 * @route   GET /api/oauth/google/callback
 * @desc    OAuth callback endpoint (receives authorization code from Google)
 * @access  Public
 */
router.get('/callback', async (req, res) => {
  try {
    const { code, error, state } = req.query;

    if (error) {
      console.error('❌ OAuth error:', error);
      return res.redirect(`myapp://oauth/error?error=${error}`);
    }

    if (!code) {
      return res.redirect('myapp://oauth/error?error=no_code');
    }

    // Redirect back to the app with the code
    // The app will call /connect endpoint to exchange the code
    const redirectUrl = `http://192.168.1.231:3000/api/oauth/google/callback?code=${code}&state=${state || ''}`;

    res.send(`
      <html>
        <head>
          <title>Authorization Successful</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            }
            .container {
              text-align: center;
              background: white;
              padding: 2rem;
              border-radius: 1rem;
              box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            }
            .success-icon {
              font-size: 4rem;
              margin-bottom: 1rem;
            }
            h1 {
              color: #333;
              margin-bottom: 0.5rem;
            }
            p {
              color: #666;
              margin-bottom: 1.5rem;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success-icon">✅</div>
            <h1>Authorization Successful!</h1>
            <p>You can close this window and return to the app.</p>
            <small style="color: #999;">Closing automatically...</small>
          </div>
          <script>
            // Close window after 2 seconds
            setTimeout(() => {
              window.close();
            }, 2000);
          </script>
        </body>
      </html>
    `);
  } catch (error: any) {
    console.error('❌ OAuth callback error:', error);
    res.status(500).send('OAuth callback failed');
  }
});

/**
 * @route   POST /api/oauth/google/connect
 * @desc    Exchange authorization code for tokens and connect Google account
 * @access  Private
 */
router.post('/connect', authenticate, async (req, res) => {
  try {
    const { code, services } = req.body;
    const userId = (req as any).user.userId;

    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Authorization code is required',
      });
    }

    console.log(`🔐 Connecting Google account for user ${userId}...`);

    // Exchange code for tokens
    const tokens = await GoogleOAuthService.getTokensFromCode(code);

    // Get user info from Google
    const userInfo = await GoogleOAuthService.getUserInfo(tokens.access_token);

    console.log(`✅ Google account connected: ${userInfo.email}`);

    // Update user's Google integration
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    // Initialize integrations if not exists
    if (!user.integrations) {
      user.integrations = {};
    }

    // Update Google integration
    user.integrations.google = {
      connected: true,
      email: userInfo.email,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || user.integrations.google?.refreshToken,
      expiresAt: new Date(tokens.expiry_date),
      scope: tokens.scope,
      connectedAt: new Date(),
      lastSyncedAt: new Date(),
      services: {
        gmail: services?.includes('gmail') ?? false,
        calendar: services?.includes('calendar') ?? false,
        drive: services?.includes('drive') ?? false,
        meet: services?.includes('meet') ?? false,
        contacts: services?.includes('contacts') ?? false,
      },
    };

    await user.save();

    console.log(`✅ User ${userId} Google integration saved`);

    res.json({
      success: true,
      data: {
        connected: true,
        email: userInfo.email,
        services: user.integrations.google.services,
        connectedAt: user.integrations.google.connectedAt,
      },
    });
  } catch (error: any) {
    console.error('❌ Failed to connect Google account:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to connect Google account',
    });
  }
});

/**
 * @route   POST /api/oauth/google/refresh
 * @desc    Refresh Google access token
 * @access  Private
 */
router.post('/refresh', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user.userId;

    console.log(`🔄 Refreshing Google token for user ${userId}...`);

    const user = await User.findById(userId);
    if (!user || !user.integrations?.google?.refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Google account not connected or no refresh token available',
      });
    }

    // Refresh the token
    const tokens = await GoogleOAuthService.refreshAccessToken(
      user.integrations.google.refreshToken
    );

    // Update user's tokens
    user.integrations.google.accessToken = tokens.access_token;
    user.integrations.google.refreshToken = tokens.refresh_token || user.integrations.google.refreshToken;
    user.integrations.google.expiresAt = new Date(tokens.expiry_date);
    user.integrations.google.lastSyncedAt = new Date();

    await user.save();

    console.log(`✅ Google token refreshed for user ${userId}`);

    res.json({
      success: true,
      data: {
        refreshed: true,
        expiresAt: user.integrations.google.expiresAt,
      },
    });
  } catch (error: any) {
    console.error('❌ Failed to refresh token:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to refresh access token',
    });
  }
});

/**
 * @route   GET /api/oauth/google/status
 * @desc    Get Google connection status
 * @access  Private
 */
router.get('/status', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user.userId;

    const user = await User.findById(userId);
    if (!user || !user.integrations?.google) {
      return res.json({
        success: true,
        data: {
          connected: false,
        },
      });
    }

    const googleIntegration = user.integrations.google;

    // Check if token is expired
    const isExpired = googleIntegration.expiresAt
      ? GoogleOAuthService.isTokenExpired(googleIntegration.expiresAt.getTime())
      : true;

    res.json({
      success: true,
      data: {
        connected: googleIntegration.connected,
        email: googleIntegration.email,
        services: googleIntegration.services,
        connectedAt: googleIntegration.connectedAt,
        lastSyncedAt: googleIntegration.lastSyncedAt,
        tokenExpired: isExpired,
        expiresAt: googleIntegration.expiresAt,
      },
    });
  } catch (error: any) {
    console.error('❌ Failed to get Google status:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get connection status',
    });
  }
});

/**
 * @route   POST /api/oauth/google/disconnect
 * @desc    Disconnect Google account
 * @access  Private
 */
router.post('/disconnect', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user.userId;

    console.log(`🔌 Disconnecting Google account for user ${userId}...`);

    const user = await User.findById(userId);
    if (!user || !user.integrations?.google) {
      return res.status(400).json({
        success: false,
        error: 'Google account not connected',
      });
    }

    // Revoke tokens from Google
    if (user.integrations.google.accessToken) {
      try {
        await GoogleOAuthService.revokeTokens(user.integrations.google.accessToken);
      } catch (error) {
        console.warn('⚠️ Failed to revoke tokens from Google (continuing anyway)');
      }
    }

    // Clear Google integration data
    user.integrations.google = {
      connected: false,
      email: undefined,
      accessToken: undefined,
      refreshToken: undefined,
      expiresAt: undefined,
      scope: undefined,
      connectedAt: undefined,
      lastSyncedAt: undefined,
      services: {
        gmail: false,
        calendar: false,
        drive: false,
        meet: false,
        contacts: false,
      },
    };

    await user.save();

    console.log(`✅ Google account disconnected for user ${userId}`);

    res.json({
      success: true,
      data: {
        disconnected: true,
      },
    });
  } catch (error: any) {
    console.error('❌ Failed to disconnect Google account:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to disconnect Google account',
    });
  }
});

/**
 * @route   POST /api/oauth/google/enable-service
 * @desc    Enable a specific Google service
 * @access  Private
 */
router.post('/enable-service', authenticate, async (req, res) => {
  try {
    const { service } = req.body;
    const userId = (req as any).user.userId;

    if (!['gmail', 'calendar', 'drive', 'meet', 'contacts'].includes(service)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid service name',
      });
    }

    const user = await User.findById(userId);
    if (!user || !user.integrations?.google?.connected) {
      return res.status(400).json({
        success: false,
        error: 'Google account not connected',
      });
    }

    // Enable the service
    if (!user.integrations.google.services) {
      user.integrations.google.services = {};
    }
    user.integrations.google.services[service as keyof typeof user.integrations.google.services] = true;

    await user.save();

    console.log(`✅ Enabled ${service} for user ${userId}`);

    res.json({
      success: true,
      data: {
        service,
        enabled: true,
        services: user.integrations.google.services,
      },
    });
  } catch (error: any) {
    console.error('❌ Failed to enable service:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to enable service',
    });
  }
});

export default router;
