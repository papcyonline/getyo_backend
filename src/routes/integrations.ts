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

// @route   POST /api/integrations/google-calendar/create-event
// @desc    Create a new Google Calendar event
// @access  Private
router.post('/google-calendar/create-event', async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    const { title, description, startTime, endTime, location, attendees } = req.body;

    if (!title || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        error: 'Title, start time, and end time are required',
      } as ApiResponse<null>);
    }

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

    console.log('📅 Creating Google Calendar event...');

    const eventData = {
      summary: title,
      description: description || '',
      location: location || '',
      start: {
        dateTime: new Date(startTime).toISOString(),
        timeZone: 'UTC',
      },
      end: {
        dateTime: new Date(endTime).toISOString(),
        timeZone: 'UTC',
      },
      attendees: attendees?.map((email: string) => ({ email })) || [],
    };

    const response = await axios.post(
      `${GOOGLE_OAUTH_CONFIG.calendarApiUrl}/calendars/${encodeURIComponent(calendarId)}/events`,
      eventData,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ Google Calendar event created successfully');

    res.json({
      success: true,
      data: {
        id: response.data.id,
        title: response.data.summary,
        htmlLink: response.data.htmlLink,
        startTime: response.data.start.dateTime || response.data.start.date,
        endTime: response.data.end.dateTime || response.data.end.date,
      },
      message: 'Event created successfully',
    } as ApiResponse<any>);
  } catch (error: any) {
    console.error('❌ Google Calendar event creation error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: error.response?.data?.error?.message || 'Failed to create event',
    } as ApiResponse<null>);
  }
});

// @route   PUT /api/integrations/google-calendar/update-event/:eventId
// @desc    Update a Google Calendar event
// @access  Private
router.put('/google-calendar/update-event/:eventId', async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    const { eventId } = req.params;
    const { title, description, startTime, endTime, location, attendees } = req.body;

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

    console.log('📅 Updating Google Calendar event:', eventId);

    const eventData: any = {};
    if (title) eventData.summary = title;
    if (description !== undefined) eventData.description = description;
    if (location !== undefined) eventData.location = location;
    if (startTime) {
      eventData.start = {
        dateTime: new Date(startTime).toISOString(),
        timeZone: 'UTC',
      };
    }
    if (endTime) {
      eventData.end = {
        dateTime: new Date(endTime).toISOString(),
        timeZone: 'UTC',
      };
    }
    if (attendees) {
      eventData.attendees = attendees.map((email: string) => ({ email }));
    }

    const response = await axios.patch(
      `${GOOGLE_OAUTH_CONFIG.calendarApiUrl}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
      eventData,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ Google Calendar event updated successfully');

    res.json({
      success: true,
      data: {
        id: response.data.id,
        title: response.data.summary,
        htmlLink: response.data.htmlLink,
      },
      message: 'Event updated successfully',
    } as ApiResponse<any>);
  } catch (error: any) {
    console.error('❌ Google Calendar event update error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: error.response?.data?.error?.message || 'Failed to update event',
    } as ApiResponse<null>);
  }
});

// @route   DELETE /api/integrations/google-calendar/delete-event/:eventId
// @desc    Delete a Google Calendar event
// @access  Private
router.delete('/google-calendar/delete-event/:eventId', async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    const { eventId } = req.params;

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

    console.log('📅 Deleting Google Calendar event:', eventId);

    await axios.delete(
      `${GOOGLE_OAUTH_CONFIG.calendarApiUrl}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    console.log('✅ Google Calendar event deleted successfully');

    res.json({
      success: true,
      data: { eventId },
      message: 'Event deleted successfully',
    } as ApiResponse<any>);
  } catch (error: any) {
    console.error('❌ Google Calendar event deletion error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: error.response?.data?.error?.message || 'Failed to delete event',
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

// ============================================================================
// OUTLOOK CALENDAR ENDPOINTS
// ============================================================================

// Outlook OAuth2 Configuration
const OUTLOOK_CALENDAR_CONFIG = {
  clientId: process.env.OUTLOOK_CLIENT_ID || 'your-outlook-client-id',
  clientSecret: process.env.OUTLOOK_CLIENT_SECRET || 'your-outlook-client-secret',
  tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
  graphApiUrl: 'https://graph.microsoft.com/v1.0',
  redirectUri: process.env.OUTLOOK_REDIRECT_URI || 'exp://localhost:8081',
  scopes: [
    'https://graph.microsoft.com/Calendars.ReadWrite',
    'https://graph.microsoft.com/User.Read',
    'offline_access',
  ],
};

// @route   POST /api/integrations/outlook-calendar/connect
// @desc    Connect Outlook Calendar with OAuth2
// @access  Private
router.post('/outlook-calendar/connect', async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Authorization code is required',
      } as ApiResponse<null>);
    }

    console.log('🔐 Exchanging Outlook Calendar OAuth code for tokens for user:', userId);

    // Exchange code for tokens
    const tokenResponse = await axios.post(
      OUTLOOK_CALENDAR_CONFIG.tokenUrl,
      new URLSearchParams({
        client_id: OUTLOOK_CALENDAR_CONFIG.clientId,
        client_secret: OUTLOOK_CALENDAR_CONFIG.clientSecret,
        code: code,
        redirect_uri: OUTLOOK_CALENDAR_CONFIG.redirectUri,
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

    // Get user info from Microsoft Graph
    const userInfoResponse = await axios.get(`${OUTLOOK_CALENDAR_CONFIG.graphApiUrl}/me`, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    // Update user's integrations
    const user = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          'integrations.outlookCalendar': {
            connected: true,
            accessToken: access_token,
            refreshToken: refresh_token,
            expiresAt: expires_in ? new Date(Date.now() + expires_in * 1000) : undefined,
            connectedAt: new Date(),
            email: userInfoResponse.data.mail || userInfoResponse.data.userPrincipalName,
            name: userInfoResponse.data.displayName,
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

    console.log('✅ Outlook Calendar connected successfully for user:', userId);

    res.json({
      success: true,
      data: {
        connected: true,
        provider: 'outlook',
        connectedAt: user.integrations?.outlookCalendar?.connectedAt,
        email: userInfoResponse.data.mail || userInfoResponse.data.userPrincipalName,
      },
      message: 'Outlook Calendar connected successfully',
    } as ApiResponse<any>);
  } catch (error: any) {
    console.error('❌ Outlook Calendar connection error:', error.response?.data || error);
    res.status(500).json({
      success: false,
      error: error.response?.data?.error_description || 'Failed to connect Outlook Calendar',
    } as ApiResponse<null>);
  }
});

// @route   POST /api/integrations/outlook-calendar/disconnect
// @desc    Disconnect Outlook Calendar
// @access  Private
router.post('/outlook-calendar/disconnect', async (req, res) => {
  try {
    const userId = (req as any).user?.userId;

    const user = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          'integrations.outlookCalendar': {
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
        provider: 'outlook',
      },
      message: 'Outlook Calendar disconnected successfully',
    } as ApiResponse<any>);
  } catch (error) {
    console.error('Outlook Calendar disconnection error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to disconnect Outlook Calendar',
    } as ApiResponse<null>);
  }
});

// @route   POST /api/integrations/outlook-calendar/create-event
// @desc    Create a new Outlook Calendar event
// @access  Private
router.post('/outlook-calendar/create-event', async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    const { title, description, startTime, endTime, location, attendees } = req.body;

    if (!title || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        error: 'Title, start time, and end time are required',
      } as ApiResponse<null>);
    }

    const user = await User.findById(userId);
    if (!user || !user.integrations?.outlookCalendar?.connected) {
      return res.status(400).json({
        success: false,
        error: 'Outlook Calendar not connected',
      } as ApiResponse<null>);
    }

    const { accessToken } = user.integrations.outlookCalendar;

    if (!accessToken) {
      return res.status(400).json({
        success: false,
        error: 'Outlook Calendar access token missing',
      } as ApiResponse<null>);
    }

    console.log('📅 Creating Outlook Calendar event...');

    const eventData = {
      subject: title,
      body: {
        contentType: 'HTML',
        content: description || '',
      },
      start: {
        dateTime: new Date(startTime).toISOString(),
        timeZone: 'UTC',
      },
      end: {
        dateTime: new Date(endTime).toISOString(),
        timeZone: 'UTC',
      },
      location: {
        displayName: location || '',
      },
      attendees: attendees?.map((email: string) => ({
        emailAddress: { address: email },
        type: 'required',
      })) || [],
    };

    const response = await axios.post(
      `${OUTLOOK_CALENDAR_CONFIG.graphApiUrl}/me/events`,
      eventData,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ Outlook Calendar event created successfully');

    res.json({
      success: true,
      data: {
        id: response.data.id,
        title: response.data.subject,
        webLink: response.data.webLink,
        startTime: response.data.start.dateTime,
        endTime: response.data.end.dateTime,
      },
      message: 'Event created successfully',
    } as ApiResponse<any>);
  } catch (error: any) {
    console.error('❌ Outlook Calendar event creation error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: error.response?.data?.error?.message || 'Failed to create event',
    } as ApiResponse<null>);
  }
});

// @route   PUT /api/integrations/outlook-calendar/update-event/:eventId
// @desc    Update an Outlook Calendar event
// @access  Private
router.patch('/outlook-calendar/update-event/:eventId', async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    const { eventId } = req.params;
    const { title, description, startTime, endTime, location, attendees } = req.body;

    const user = await User.findById(userId);
    if (!user || !user.integrations?.outlookCalendar?.connected) {
      return res.status(400).json({
        success: false,
        error: 'Outlook Calendar not connected',
      } as ApiResponse<null>);
    }

    const { accessToken } = user.integrations.outlookCalendar;

    if (!accessToken) {
      return res.status(400).json({
        success: false,
        error: 'Outlook Calendar access token missing',
      } as ApiResponse<null>);
    }

    console.log('📅 Updating Outlook Calendar event:', eventId);

    const eventData: any = {};
    if (title) eventData.subject = title;
    if (description !== undefined) {
      eventData.body = {
        contentType: 'HTML',
        content: description,
      };
    }
    if (location !== undefined) {
      eventData.location = { displayName: location };
    }
    if (startTime) {
      eventData.start = {
        dateTime: new Date(startTime).toISOString(),
        timeZone: 'UTC',
      };
    }
    if (endTime) {
      eventData.end = {
        dateTime: new Date(endTime).toISOString(),
        timeZone: 'UTC',
      };
    }
    if (attendees) {
      eventData.attendees = attendees.map((email: string) => ({
        emailAddress: { address: email },
        type: 'required',
      }));
    }

    const response = await axios.patch(
      `${OUTLOOK_CALENDAR_CONFIG.graphApiUrl}/me/events/${eventId}`,
      eventData,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ Outlook Calendar event updated successfully');

    res.json({
      success: true,
      data: {
        id: response.data.id,
        title: response.data.subject,
        webLink: response.data.webLink,
      },
      message: 'Event updated successfully',
    } as ApiResponse<any>);
  } catch (error: any) {
    console.error('❌ Outlook Calendar event update error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: error.response?.data?.error?.message || 'Failed to update event',
    } as ApiResponse<null>);
  }
});

// @route   DELETE /api/integrations/outlook-calendar/delete-event/:eventId
// @desc    Delete an Outlook Calendar event
// @access  Private
router.delete('/outlook-calendar/delete-event/:eventId', async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    const { eventId } = req.params;

    const user = await User.findById(userId);
    if (!user || !user.integrations?.outlookCalendar?.connected) {
      return res.status(400).json({
        success: false,
        error: 'Outlook Calendar not connected',
      } as ApiResponse<null>);
    }

    const { accessToken } = user.integrations.outlookCalendar;

    if (!accessToken) {
      return res.status(400).json({
        success: false,
        error: 'Outlook Calendar access token missing',
      } as ApiResponse<null>);
    }

    console.log('📅 Deleting Outlook Calendar event:', eventId);

    await axios.delete(
      `${OUTLOOK_CALENDAR_CONFIG.graphApiUrl}/me/events/${eventId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    console.log('✅ Outlook Calendar event deleted successfully');

    res.json({
      success: true,
      data: { eventId },
      message: 'Event deleted successfully',
    } as ApiResponse<any>);
  } catch (error: any) {
    console.error('❌ Outlook Calendar event deletion error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: error.response?.data?.error?.message || 'Failed to delete event',
    } as ApiResponse<null>);
  }
});

// @route   GET /api/integrations/outlook-calendar/events
// @desc    Fetch Outlook Calendar events from Microsoft Graph API
// @access  Private
router.get('/outlook-calendar/events', async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    const { startDate, endDate, maxResults = 50 } = req.query;

    const user = await User.findById(userId);
    if (!user || !user.integrations?.outlookCalendar?.connected) {
      return res.status(400).json({
        success: false,
        error: 'Outlook Calendar not connected',
      } as ApiResponse<null>);
    }

    const { accessToken } = user.integrations.outlookCalendar;

    if (!accessToken) {
      return res.status(400).json({
        success: false,
        error: 'Outlook Calendar access token missing',
      } as ApiResponse<null>);
    }

    console.log('📅 Fetching Outlook Calendar events...');

    // Build query parameters
    let queryString = `?$top=${maxResults}&$orderby=start/dateTime`;

    if (startDate && endDate) {
      const start = new Date(startDate as string).toISOString();
      const end = new Date(endDate as string).toISOString();
      queryString += `&$filter=start/dateTime ge '${start}' and end/dateTime le '${end}'`;
    }

    // Fetch events from Microsoft Graph API
    const response = await axios.get(
      `${OUTLOOK_CALENDAR_CONFIG.graphApiUrl}/me/events${queryString}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const events = response.data.value?.map((event: any) => ({
      id: event.id,
      title: event.subject,
      description: event.bodyPreview,
      startTime: event.start?.dateTime,
      endTime: event.end?.dateTime,
      location: event.location?.displayName,
      attendees: event.attendees?.map((attendee: any) => attendee.emailAddress?.address) || [],
      status: event.isCancelled ? 'cancelled' : 'confirmed',
      isOnline: event.isOnlineMeeting,
      onlineMeetingUrl: event.onlineMeetingUrl,
    })) || [];

    console.log(`✅ Successfully fetched ${events.length} Outlook Calendar events`);

    res.json({
      success: true,
      data: {
        events: events,
        totalCount: events.length,
        synced: true,
        lastSyncAt: new Date().toISOString(),
      },
      message: 'Outlook Calendar events fetched successfully',
    } as ApiResponse<any>);
  } catch (error: any) {
    console.error('❌ Outlook Calendar events fetch error:', error.response?.data || error.message);

    if (error.response?.status === 401) {
      res.status(401).json({
        success: false,
        error: 'Outlook Calendar access token expired',
        code: 'TOKEN_EXPIRED',
      } as ApiResponse<null>);
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch Outlook Calendar events',
      } as ApiResponse<null>);
    }
  }
});

// ============================================================================
// APPLE CALENDAR ENDPOINTS
// ============================================================================

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

// @route   GET /api/integrations/apple-calendar/events
// @desc    Get Apple Calendar events (device-side only)
// @access  Private
router.get('/apple-calendar/events', async (req, res) => {
  try {
    const userId = (req as any).user?.userId;

    const user = await User.findById(userId);
    if (!user || !user.integrations?.appleCalendar?.connected) {
      return res.status(400).json({
        success: false,
        error: 'Apple Calendar not connected',
      } as ApiResponse<null>);
    }

    // For Apple Calendar, events are fetched on the device using EventKit
    // This endpoint just confirms connection status
    res.json({
      success: true,
      data: {
        connected: true,
        message: 'Events are fetched from device calendar using EventKit',
      },
      message: 'Apple Calendar events are managed on device',
    } as ApiResponse<any>);
  } catch (error) {
    console.error('Apple Calendar events error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check Apple Calendar status',
    } as ApiResponse<null>);
  }
});

// @route   POST /api/integrations/apple-calendar/create-event
// @desc    Create Apple Calendar event (device-side)
// @access  Private
router.post('/apple-calendar/create-event', async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    const { eventId, title } = req.body;

    const user = await User.findById(userId);
    if (!user || !user.integrations?.appleCalendar?.connected) {
      return res.status(400).json({
        success: false,
        error: 'Apple Calendar not connected',
      } as ApiResponse<null>);
    }

    // For Apple Calendar, events are created on the device using EventKit
    // This endpoint acknowledges the event was created
    console.log('📅 Apple Calendar event created on device:', eventId);

    res.json({
      success: true,
      data: {
        eventId,
        title,
        message: 'Event created on device using EventKit',
      },
      message: 'Event created successfully',
    } as ApiResponse<any>);
  } catch (error) {
    console.error('Apple Calendar create event error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create Apple Calendar event',
    } as ApiResponse<null>);
  }
});

// @route   PUT /api/integrations/apple-calendar/update-event/:eventId
// @desc    Update Apple Calendar event (device-side)
// @access  Private
router.put('/apple-calendar/update-event/:eventId', async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    const { eventId } = req.params;

    const user = await User.findById(userId);
    if (!user || !user.integrations?.appleCalendar?.connected) {
      return res.status(400).json({
        success: false,
        error: 'Apple Calendar not connected',
      } as ApiResponse<null>);
    }

    // For Apple Calendar, events are updated on the device using EventKit
    // This endpoint acknowledges the event was updated
    console.log('📅 Apple Calendar event updated on device:', eventId);

    res.json({
      success: true,
      data: {
        eventId,
        message: 'Event updated on device using EventKit',
      },
      message: 'Event updated successfully',
    } as ApiResponse<any>);
  } catch (error) {
    console.error('Apple Calendar update event error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update Apple Calendar event',
    } as ApiResponse<null>);
  }
});

// @route   DELETE /api/integrations/apple-calendar/delete-event/:eventId
// @desc    Delete Apple Calendar event (device-side)
// @access  Private
router.delete('/apple-calendar/delete-event/:eventId', async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    const { eventId } = req.params;

    const user = await User.findById(userId);
    if (!user || !user.integrations?.appleCalendar?.connected) {
      return res.status(400).json({
        success: false,
        error: 'Apple Calendar not connected',
      } as ApiResponse<null>);
    }

    // For Apple Calendar, events are deleted on the device using EventKit
    // This endpoint acknowledges the event was deleted
    console.log('📅 Apple Calendar event deleted on device:', eventId);

    res.json({
      success: true,
      data: {
        eventId,
        message: 'Event deleted on device using EventKit',
      },
      message: 'Event deleted successfully',
    } as ApiResponse<any>);
  } catch (error) {
    console.error('Apple Calendar delete event error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete Apple Calendar event',
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
      outlookCalendar: {
        connected: user.integrations?.outlookCalendar?.connected || false,
        connectedAt: user.integrations?.outlookCalendar?.connectedAt || null,
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