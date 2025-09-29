import express from 'express';
import { User } from '../models';
import { ApiResponse } from '../types';
import { authenticateToken } from '../middleware/auth';
import axios from 'axios';

const router = express.Router();

// Google OAuth2 Configuration
const GOOGLE_OAUTH_CONFIG = {
  clientId: process.env.GOOGLE_CLIENT_ID || '1234567890-abcdefghijklmnopqrstuvwxyz.apps.googleusercontent.com',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'your-google-client-secret',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  calendarApiUrl: 'https://www.googleapis.com/calendar/v3',
};

// Exchange Google OAuth authorization code for access and refresh tokens
const exchangeGoogleOAuthCode = async (
  authCode: string,
  redirectUri: string
): Promise<{
  success: boolean;
  tokens?: {
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
  };
  error?: string;
}> => {
  try {
    console.log('🔄 Exchanging Google OAuth code for tokens...');

    const response = await axios.post(GOOGLE_OAUTH_CONFIG.tokenUrl, {
      client_id: GOOGLE_OAUTH_CONFIG.clientId,
      client_secret: GOOGLE_OAUTH_CONFIG.clientSecret,
      code: authCode,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const { access_token, refresh_token, expires_in } = response.data;

    if (!access_token) {
      console.error('❌ No access token in Google OAuth response');
      return { success: false, error: 'No access token received' };
    }

    const expiresAt = new Date(Date.now() + (expires_in * 1000));

    console.log('✅ Successfully exchanged Google OAuth code for tokens');

    return {
      success: true,
      tokens: {
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresAt,
      },
    };
  } catch (error: any) {
    console.error('❌ Google OAuth token exchange failed:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.error_description || 'Token exchange failed',
    };
  }
};

// Test Google Calendar access with access token
const testGoogleCalendarAccess = async (
  accessToken: string
): Promise<{
  success: boolean;
  calendarId?: string;
  error?: string;
}> => {
  try {
    console.log('🧪 Testing Google Calendar access...');

    const response = await axios.get(`${GOOGLE_OAUTH_CONFIG.calendarApiUrl}/users/me/calendarList`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    const primaryCalendar = response.data.items?.find((cal: any) => cal.primary);

    if (primaryCalendar) {
      console.log('✅ Google Calendar access verified');
      return {
        success: true,
        calendarId: primaryCalendar.id,
      };
    } else {
      console.error('❌ No primary calendar found');
      return { success: false, error: 'No primary calendar found' };
    }
  } catch (error: any) {
    console.error('❌ Google Calendar access test failed:', error.response?.data || error.message);
    return {
      success: false,
      error: 'Calendar access verification failed',
    };
  }
};

// Apply auth middleware to all routes
router.use(authenticateToken);

// @route   POST /api/integrations/google-calendar/connect
// @desc    Connect Google Calendar with real OAuth2 token exchange
// @access  Private
router.post('/google-calendar/connect', async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    const { authCode, redirectUri } = req.body;

    if (!authCode) {
      return res.status(400).json({
        success: false,
        error: 'Authorization code is required',
      } as ApiResponse<null>);
    }

    console.log('🔐 Exchanging Google OAuth code for tokens:', {
      userId,
      authCodeLength: authCode.length,
      redirectUri
    });

    // Exchange auth code for tokens using Google OAuth2
    const tokenResponse = await exchangeGoogleOAuthCode(authCode, redirectUri);

    if (!tokenResponse.success || !tokenResponse.tokens) {
      return res.status(400).json({
        success: false,
        error: tokenResponse.error || 'Failed to exchange authorization code',
      } as ApiResponse<null>);
    }

    const { accessToken, refreshToken, expiresAt } = tokenResponse.tokens;

    // Test the access token by fetching user's calendar info
    const calendarTestResponse = await testGoogleCalendarAccess(accessToken);

    if (!calendarTestResponse.success) {
      return res.status(400).json({
        success: false,
        error: 'Failed to verify calendar access',
      } as ApiResponse<null>);
    }

    // Update user's integrations with real tokens
    const user = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          'integrations.googleCalendar': {
            connected: true,
            accessToken: accessToken,
            refreshToken: refreshToken,
            expiresAt: expiresAt,
            connectedAt: new Date(),
            calendarId: calendarTestResponse.calendarId,
          },
        },
      },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      } as ApiResponse<null>);
    }

    console.log('✅ Google Calendar connected successfully for user:', userId);

    res.json({
      success: true,
      data: {
        connected: true,
        provider: 'google',
        connectedAt: user.integrations?.googleCalendar?.connectedAt,
        calendarId: calendarTestResponse.calendarId,
      },
      message: 'Google Calendar connected successfully',
    } as ApiResponse<any>);
  } catch (error) {
    console.error('❌ Google Calendar connection error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to connect Google Calendar',
    } as ApiResponse<null>);
  }
});

// @route   POST /api/integrations/google-calendar/disconnect
// @desc    Disconnect Google Calendar
// @access  Private
router.post('/google-calendar/disconnect', async (req, res) => {
  try {
    const userId = (req as any).user?.userId;

    // Update user's integrations
    const user = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          'integrations.googleCalendar': {
            connected: false,
            refreshToken: null,
          },
        },
      },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      } as ApiResponse<null>);
    }

    res.json({
      success: true,
      data: {
        connected: false,
        provider: 'google',
      },
      message: 'Google Calendar disconnected successfully',
    } as ApiResponse<any>);
  } catch (error) {
    console.error('Google Calendar disconnection error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to disconnect Google Calendar',
    } as ApiResponse<null>);
  }
});

// @route   GET /api/integrations/google-calendar/events
// @desc    Fetch real Google Calendar events from Google Calendar API
// @access  Private
router.get('/google-calendar/events', async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    const { startDate, endDate, maxResults = 50 } = req.query;

    const user = await User.findById(userId);
    if (!user || !user.integrations?.googleCalendar?.connected) {
      return res.status(400).json({
        success: false,
        error: 'Google Calendar not connected',
      } as ApiResponse<null>);
    }

    const { accessToken, calendarId } = user.integrations.googleCalendar;

    if (!accessToken || !calendarId) {
      return res.status(400).json({
        success: false,
        error: 'Google Calendar access token or calendar ID missing',
      } as ApiResponse<null>);
    }

    console.log('📅 Fetching real Google Calendar events...');

    // Build query parameters for Google Calendar API
    const queryParams = new URLSearchParams({
      calendarId: calendarId,
      maxResults: maxResults.toString(),
      singleEvents: 'true',
      orderBy: 'startTime',
    });

    if (startDate) {
      queryParams.append('timeMin', new Date(startDate as string).toISOString());
    }
    if (endDate) {
      queryParams.append('timeMax', new Date(endDate as string).toISOString());
    }

    // Fetch events from Google Calendar API
    const response = await axios.get(
      `${GOOGLE_OAUTH_CONFIG.calendarApiUrl}/calendars/${encodeURIComponent(calendarId)}/events?${queryParams}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    const events = response.data.items?.map((event: any) => ({
      id: event.id,
      title: event.summary,
      description: event.description,
      startTime: event.start?.dateTime || event.start?.date,
      endTime: event.end?.dateTime || event.end?.date,
      location: event.location,
      attendees: event.attendees?.map((attendee: any) => attendee.email) || [],
      status: event.status,
      htmlLink: event.htmlLink,
    })) || [];

    console.log(`✅ Successfully fetched ${events.length} Google Calendar events`);

    res.json({
      success: true,
      data: {
        events: events,
        totalCount: events.length,
        synced: true,
        lastSyncAt: new Date().toISOString(),
        nextSyncToken: response.data.nextSyncToken,
      },
      message: 'Google Calendar events fetched successfully',
    } as ApiResponse<any>);
  } catch (error: any) {
    console.error('❌ Google Calendar events fetch error:', error.response?.data || error.message);

    if (error.response?.status === 401) {
      // Access token expired, should refresh token
      res.status(401).json({
        success: false,
        error: 'Google Calendar access token expired',
        code: 'TOKEN_EXPIRED',
      } as ApiResponse<null>);
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch Google Calendar events',
      } as ApiResponse<null>);
    }
  }
});

// @route   POST /api/integrations/apple-calendar/connect
// @desc    Connect Apple Calendar using system EventKit integration
// @access  Private
router.post('/apple-calendar/connect', async (req, res) => {
  try {
    const userId = (req as any).user?.userId;

    console.log('🍎 Connecting Apple Calendar for user:', userId);

    // For Apple Calendar, we rely on device-level permissions and EventKit
    // The frontend should handle requesting calendar permissions
    // This endpoint confirms the connection in our system

    const { hasPermission, calendarSource } = req.body;

    if (!hasPermission) {
      return res.status(400).json({
        success: false,
        error: 'Calendar permission is required to connect Apple Calendar',
        code: 'PERMISSION_REQUIRED',
      } as ApiResponse<null>);
    }

    // Update user's integrations
    const user = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          'integrations.appleCalendar': {
            connected: true,
            connectedAt: new Date(),
            calendarSource: calendarSource || 'default',
            permissionGranted: true,
          },
        },
      },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      } as ApiResponse<null>);
    }

    console.log('✅ Apple Calendar connected successfully for user:', userId);

    res.json({
      success: true,
      data: {
        connected: true,
        provider: 'apple',
        connectedAt: user.integrations?.appleCalendar?.connectedAt,
        calendarSource: calendarSource || 'default',
      },
      message: 'Apple Calendar connected successfully',
    } as ApiResponse<any>);
  } catch (error) {
    console.error('❌ Apple Calendar connection error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to connect Apple Calendar',
    } as ApiResponse<null>);
  }
});

// @route   POST /api/integrations/apple-calendar/disconnect
// @desc    Disconnect Apple Calendar
// @access  Private
router.post('/apple-calendar/disconnect', async (req, res) => {
  try {
    const userId = (req as any).user?.userId;

    // Update user's integrations
    const user = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          'integrations.appleCalendar': {
            connected: false,
          },
        },
      },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      } as ApiResponse<null>);
    }

    res.json({
      success: true,
      data: {
        connected: false,
        provider: 'apple',
      },
      message: 'Apple Calendar disconnected successfully',
    } as ApiResponse<any>);
  } catch (error) {
    console.error('Apple Calendar disconnection error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to disconnect Apple Calendar',
    } as ApiResponse<null>);
  }
});

// @route   GET /api/integrations/status
// @desc    Get all integration statuses
// @access  Private
router.get('/status', async (req, res) => {
  try {
    const userId = (req as any).user?.userId;

    const user = await User.findById(userId).select('integrations');
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      } as ApiResponse<null>);
    }

    const integrationStatus = {
      googleCalendar: {
        connected: user.integrations?.googleCalendar?.connected || false,
        connectedAt: user.integrations?.googleCalendar?.connectedAt || null,
      },
      appleCalendar: {
        connected: user.integrations?.appleCalendar?.connected || false,
        connectedAt: user.integrations?.appleCalendar?.connectedAt || null,
      },
    };

    res.json({
      success: true,
      data: integrationStatus,
    } as ApiResponse<typeof integrationStatus>);
  } catch (error) {
    console.error('Integration status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch integration status',
    } as ApiResponse<null>);
  }
});

export default router;