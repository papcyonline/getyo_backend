import express from 'express';
import { User } from '../models';
import { ApiResponse } from '../types';
import { authenticateToken } from '../middleware/auth';
import axios from 'axios';
import crypto from 'crypto';

const router = express.Router();

// ============================================================================
// OAUTH CONFIGURATIONS
// ============================================================================

// Google Meet Configuration (uses Google Calendar API)
const GOOGLE_MEET_CONFIG = {
  clientId: process.env.GOOGLE_CLIENT_ID || '',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  calendarApiUrl: 'https://www.googleapis.com/calendar/v3',
  redirectUri: process.env.GOOGLE_MEET_REDIRECT_URI || 'exp://localhost:8081',
  scopes: [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
  ],
};

// Zoom Configuration
const ZOOM_CONFIG = {
  clientId: process.env.ZOOM_CLIENT_ID || '',
  clientSecret: process.env.ZOOM_CLIENT_SECRET || '',
  tokenUrl: 'https://zoom.us/oauth/token',
  apiUrl: 'https://api.zoom.us/v2',
  redirectUri: process.env.ZOOM_REDIRECT_URI || 'exp://localhost:8081',
};

// Microsoft Teams Configuration (uses Microsoft Graph)
const TEAMS_CONFIG = {
  clientId: process.env.TEAMS_CLIENT_ID || '',
  clientSecret: process.env.TEAMS_CLIENT_SECRET || '',
  tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
  graphApiUrl: 'https://graph.microsoft.com/v1.0',
  redirectUri: process.env.TEAMS_REDIRECT_URI || 'exp://localhost:8081',
  scopes: [
    'https://graph.microsoft.com/OnlineMeetings.ReadWrite',
    'https://graph.microsoft.com/Calendars.ReadWrite',
    'https://graph.microsoft.com/User.Read',
    'offline_access',
  ],
};

// Webex Configuration
const WEBEX_CONFIG = {
  clientId: process.env.WEBEX_CLIENT_ID || '',
  clientSecret: process.env.WEBEX_CLIENT_SECRET || '',
  tokenUrl: 'https://webexapis.com/v1/access_token',
  apiUrl: 'https://webexapis.com/v1',
  redirectUri: process.env.WEBEX_REDIRECT_URI || 'exp://localhost:8081',
  scopes: [
    'meeting:schedules_write',
    'meeting:schedules_read',
    'spark:people_read',
  ],
};

// Apply auth middleware
router.use(authenticateToken);

// ============================================================================
// GOOGLE MEET ENDPOINTS
// ============================================================================

// @route   POST /api/meetings/google-meet/connect
// @desc    Connect Google Meet (via Calendar API)
// @access  Private
router.post('/google-meet/connect', async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Authorization code is required',
      } as ApiResponse<null>);
    }

    console.log('🔐 Exchanging Google Meet OAuth code for tokens for user:', userId);

    // Exchange code for tokens
    const tokenResponse = await axios.post(
      GOOGLE_MEET_CONFIG.tokenUrl,
      new URLSearchParams({
        client_id: GOOGLE_MEET_CONFIG.clientId,
        client_secret: GOOGLE_MEET_CONFIG.clientSecret,
        code: code,
        redirect_uri: GOOGLE_MEET_CONFIG.redirectUri,
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

    // Get user info
    const userInfoResponse = await axios.get(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      }
    );

    const meetingAccount = {
      id: crypto.randomUUID(),
      provider: 'google-meet' as const,
      email: userInfoResponse.data.email || '',
      name: userInfoResponse.data.name || '',
      accessToken: access_token,
      refreshToken: refresh_token || '',
      expiresAt: expires_in ? new Date(Date.now() + expires_in * 1000) : undefined,
      connectedAt: new Date(),
    };

    // Update user's meeting integrations
    await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          'integrations.googleMeet': meetingAccount,
        },
      }
    );

    console.log('✅ Google Meet connected successfully:', meetingAccount.email);

    res.json({
      success: true,
      data: {
        id: meetingAccount.id,
        provider: meetingAccount.provider,
        email: meetingAccount.email,
        name: meetingAccount.name,
        connectedAt: meetingAccount.connectedAt,
      },
      message: 'Google Meet connected successfully',
    } as ApiResponse<any>);
  } catch (error: any) {
    console.error('❌ Google Meet connection error:', error.response?.data || error);
    res.status(500).json({
      success: false,
      error: error.response?.data?.error_description || error.message || 'Failed to connect Google Meet',
    } as ApiResponse<null>);
  }
});

// @route   POST /api/meetings/google-meet/create
// @desc    Create a Google Meet meeting
// @access  Private
router.post('/google-meet/create', async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    const { summary, description, startTime, endTime, attendees } = req.body;

    const user = await User.findById(userId);
    if (!user || !user.integrations?.googleMeet?.accessToken) {
      return res.status(400).json({
        success: false,
        error: 'Google Meet not connected',
      } as ApiResponse<null>);
    }

    const { accessToken } = user.integrations.googleMeet;

    // Create calendar event with Google Meet link
    const event = {
      summary: summary || 'Meeting',
      description: description || '',
      start: {
        dateTime: startTime,
        timeZone: 'UTC',
      },
      end: {
        dateTime: endTime,
        timeZone: 'UTC',
      },
      attendees: attendees?.map((email: string) => ({ email })) || [],
      conferenceData: {
        createRequest: {
          requestId: crypto.randomUUID(),
          conferenceSolutionKey: {
            type: 'hangoutsMeet',
          },
        },
      },
    };

    const response = await axios.post(
      `${GOOGLE_MEET_CONFIG.calendarApiUrl}/calendars/primary/events?conferenceDataVersion=1`,
      event,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const meetingLink = response.data.hangoutLink || response.data.conferenceData?.entryPoints?.[0]?.uri;

    res.json({
      success: true,
      data: {
        meetingId: response.data.id,
        meetingLink,
        eventLink: response.data.htmlLink,
      },
      message: 'Google Meet created successfully',
    } as ApiResponse<any>);
  } catch (error: any) {
    console.error('❌ Create Google Meet error:', error.response?.data || error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create Google Meet',
    } as ApiResponse<null>);
  }
});

// ============================================================================
// ZOOM ENDPOINTS
// ============================================================================

// @route   POST /api/meetings/zoom/connect
// @desc    Connect Zoom account
// @access  Private
router.post('/zoom/connect', async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Authorization code is required',
      } as ApiResponse<null>);
    }

    console.log('🔐 Exchanging Zoom OAuth code for tokens for user:', userId);

    // Exchange code for tokens
    const tokenResponse = await axios.post(
      ZOOM_CONFIG.tokenUrl,
      new URLSearchParams({
        code: code,
        redirect_uri: ZOOM_CONFIG.redirectUri,
        grant_type: 'authorization_code',
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${ZOOM_CONFIG.clientId}:${ZOOM_CONFIG.clientSecret}`).toString('base64')}`,
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

    // Get user info
    const userInfoResponse = await axios.get(`${ZOOM_CONFIG.apiUrl}/users/me`, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    const meetingAccount = {
      id: crypto.randomUUID(),
      provider: 'zoom' as const,
      email: userInfoResponse.data.email || '',
      name: `${userInfoResponse.data.first_name} ${userInfoResponse.data.last_name}`.trim(),
      accessToken: access_token,
      refreshToken: refresh_token || '',
      expiresAt: expires_in ? new Date(Date.now() + expires_in * 1000) : undefined,
      connectedAt: new Date(),
      zoomUserId: userInfoResponse.data.id,
    };

    // Update user's meeting integrations
    await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          'integrations.zoom': meetingAccount,
        },
      }
    );

    console.log('✅ Zoom connected successfully:', meetingAccount.email);

    res.json({
      success: true,
      data: {
        id: meetingAccount.id,
        provider: meetingAccount.provider,
        email: meetingAccount.email,
        name: meetingAccount.name,
        connectedAt: meetingAccount.connectedAt,
      },
      message: 'Zoom connected successfully',
    } as ApiResponse<any>);
  } catch (error: any) {
    console.error('❌ Zoom connection error:', error.response?.data || error);
    res.status(500).json({
      success: false,
      error: error.response?.data?.error_description || error.message || 'Failed to connect Zoom',
    } as ApiResponse<null>);
  }
});

// @route   POST /api/meetings/zoom/create
// @desc    Create a Zoom meeting
// @access  Private
router.post('/zoom/create', async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    const { topic, startTime, duration, agenda, timezone } = req.body;

    const user = await User.findById(userId);
    if (!user || !user.integrations?.zoom?.accessToken) {
      return res.status(400).json({
        success: false,
        error: 'Zoom not connected',
      } as ApiResponse<null>);
    }

    const { accessToken, zoomUserId } = user.integrations.zoom;

    const meeting = {
      topic: topic || 'Meeting',
      type: 2, // Scheduled meeting
      start_time: startTime,
      duration: duration || 60,
      timezone: timezone || 'UTC',
      agenda: agenda || '',
      settings: {
        host_video: true,
        participant_video: true,
        join_before_host: false,
        mute_upon_entry: false,
        watermark: false,
        use_pmi: false,
        approval_type: 0,
        audio: 'both',
      },
    };

    const response = await axios.post(
      `${ZOOM_CONFIG.apiUrl}/users/${zoomUserId}/meetings`,
      meeting,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    res.json({
      success: true,
      data: {
        meetingId: response.data.id,
        meetingLink: response.data.join_url,
        password: response.data.password,
        startUrl: response.data.start_url,
      },
      message: 'Zoom meeting created successfully',
    } as ApiResponse<any>);
  } catch (error: any) {
    console.error('❌ Create Zoom meeting error:', error.response?.data || error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create Zoom meeting',
    } as ApiResponse<null>);
  }
});

// ============================================================================
// MICROSOFT TEAMS ENDPOINTS
// ============================================================================

// @route   POST /api/meetings/teams/connect
// @desc    Connect Microsoft Teams account
// @access  Private
router.post('/teams/connect', async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Authorization code is required',
      } as ApiResponse<null>);
    }

    console.log('🔐 Exchanging Teams OAuth code for tokens for user:', userId);

    // Exchange code for tokens
    const tokenResponse = await axios.post(
      TEAMS_CONFIG.tokenUrl,
      new URLSearchParams({
        client_id: TEAMS_CONFIG.clientId,
        client_secret: TEAMS_CONFIG.clientSecret,
        code: code,
        redirect_uri: TEAMS_CONFIG.redirectUri,
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
    const userInfoResponse = await axios.get(`${TEAMS_CONFIG.graphApiUrl}/me`, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    const meetingAccount = {
      id: crypto.randomUUID(),
      provider: 'teams' as const,
      email: userInfoResponse.data.mail || userInfoResponse.data.userPrincipalName || '',
      name: userInfoResponse.data.displayName || '',
      accessToken: access_token,
      refreshToken: refresh_token || '',
      expiresAt: expires_in ? new Date(Date.now() + expires_in * 1000) : undefined,
      connectedAt: new Date(),
      teamsUserId: userInfoResponse.data.id,
    };

    // Update user's meeting integrations
    await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          'integrations.teams': meetingAccount,
        },
      }
    );

    console.log('✅ Microsoft Teams connected successfully:', meetingAccount.email);

    res.json({
      success: true,
      data: {
        id: meetingAccount.id,
        provider: meetingAccount.provider,
        email: meetingAccount.email,
        name: meetingAccount.name,
        connectedAt: meetingAccount.connectedAt,
      },
      message: 'Microsoft Teams connected successfully',
    } as ApiResponse<any>);
  } catch (error: any) {
    console.error('❌ Teams connection error:', error.response?.data || error);
    res.status(500).json({
      success: false,
      error: error.response?.data?.error_description || error.message || 'Failed to connect Microsoft Teams',
    } as ApiResponse<null>);
  }
});

// @route   POST /api/meetings/teams/create
// @desc    Create a Microsoft Teams meeting
// @access  Private
router.post('/teams/create', async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    const { subject, startDateTime, endDateTime } = req.body;

    const user = await User.findById(userId);
    if (!user || !user.integrations?.teams?.accessToken) {
      return res.status(400).json({
        success: false,
        error: 'Microsoft Teams not connected',
      } as ApiResponse<null>);
    }

    const { accessToken } = user.integrations.teams;

    const meeting = {
      subject: subject || 'Meeting',
      startDateTime,
      endDateTime,
    };

    const response = await axios.post(
      `${TEAMS_CONFIG.graphApiUrl}/me/onlineMeetings`,
      meeting,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    res.json({
      success: true,
      data: {
        meetingId: response.data.id,
        meetingLink: response.data.joinWebUrl,
        audioConferencing: response.data.audioConferencing,
      },
      message: 'Microsoft Teams meeting created successfully',
    } as ApiResponse<any>);
  } catch (error: any) {
    console.error('❌ Create Teams meeting error:', error.response?.data || error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create Teams meeting',
    } as ApiResponse<null>);
  }
});

// ============================================================================
// WEBEX ENDPOINTS
// ============================================================================

// @route   POST /api/meetings/webex/connect
// @desc    Connect Webex account
// @access  Private
router.post('/webex/connect', async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Authorization code is required',
      } as ApiResponse<null>);
    }

    console.log('🔐 Exchanging Webex OAuth code for tokens for user:', userId);

    // Exchange code for tokens
    const tokenResponse = await axios.post(
      WEBEX_CONFIG.tokenUrl,
      new URLSearchParams({
        client_id: WEBEX_CONFIG.clientId,
        client_secret: WEBEX_CONFIG.clientSecret,
        code: code,
        redirect_uri: WEBEX_CONFIG.redirectUri,
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

    // Get user info
    const userInfoResponse = await axios.get(`${WEBEX_CONFIG.apiUrl}/people/me`, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    const meetingAccount = {
      id: crypto.randomUUID(),
      provider: 'webex' as const,
      email: userInfoResponse.data.emails?.[0] || '',
      name: userInfoResponse.data.displayName || '',
      accessToken: access_token,
      refreshToken: refresh_token || '',
      expiresAt: expires_in ? new Date(Date.now() + expires_in * 1000) : undefined,
      connectedAt: new Date(),
      webexUserId: userInfoResponse.data.id,
    };

    // Update user's meeting integrations
    await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          'integrations.webex': meetingAccount,
        },
      }
    );

    console.log('✅ Webex connected successfully:', meetingAccount.email);

    res.json({
      success: true,
      data: {
        id: meetingAccount.id,
        provider: meetingAccount.provider,
        email: meetingAccount.email,
        name: meetingAccount.name,
        connectedAt: meetingAccount.connectedAt,
      },
      message: 'Webex connected successfully',
    } as ApiResponse<any>);
  } catch (error: any) {
    console.error('❌ Webex connection error:', error.response?.data || error);
    res.status(500).json({
      success: false,
      error: error.response?.data?.error_description || error.message || 'Failed to connect Webex',
    } as ApiResponse<null>);
  }
});

// @route   POST /api/meetings/webex/create
// @desc    Create a Webex meeting
// @access  Private
router.post('/webex/create', async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    const { title, start, end, agenda } = req.body;

    const user = await User.findById(userId);
    if (!user || !user.integrations?.webex?.accessToken) {
      return res.status(400).json({
        success: false,
        error: 'Webex not connected',
      } as ApiResponse<null>);
    }

    const { accessToken } = user.integrations.webex;

    const meeting = {
      title: title || 'Meeting',
      start,
      end,
      agenda: agenda || '',
      enabledAutoRecordMeeting: false,
      allowAnyUserToBeCoHost: false,
    };

    const response = await axios.post(
      `${WEBEX_CONFIG.apiUrl}/meetings`,
      meeting,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    res.json({
      success: true,
      data: {
        meetingId: response.data.id,
        meetingLink: response.data.webLink,
        meetingNumber: response.data.meetingNumber,
        password: response.data.password,
      },
      message: 'Webex meeting created successfully',
    } as ApiResponse<any>);
  } catch (error: any) {
    console.error('❌ Create Webex meeting error:', error.response?.data || error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create Webex meeting',
    } as ApiResponse<null>);
  }
});

// ============================================================================
// SHARED ENDPOINTS
// ============================================================================

// @route   GET /api/meetings/accounts
// @desc    Get all connected meeting accounts
// @access  Private
router.get('/accounts', async (req, res) => {
  try {
    const userId = (req as any).user?.userId;

    const user = await User.findById(userId).select('integrations');
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      } as ApiResponse<null>);
    }

    const accounts = [];

    if (user.integrations?.googleMeet) {
      accounts.push({
        provider: 'google-meet',
        email: user.integrations.googleMeet.email,
        name: user.integrations.googleMeet.name,
        connectedAt: user.integrations.googleMeet.connectedAt,
      });
    }

    if (user.integrations?.zoom) {
      accounts.push({
        provider: 'zoom',
        email: user.integrations.zoom.email,
        name: user.integrations.zoom.name,
        connectedAt: user.integrations.zoom.connectedAt,
      });
    }

    if (user.integrations?.teams) {
      accounts.push({
        provider: 'teams',
        email: user.integrations.teams.email,
        name: user.integrations.teams.name,
        connectedAt: user.integrations.teams.connectedAt,
      });
    }

    if (user.integrations?.webex) {
      accounts.push({
        provider: 'webex',
        email: user.integrations.webex.email,
        name: user.integrations.webex.name,
        connectedAt: user.integrations.webex.connectedAt,
      });
    }

    res.json({
      success: true,
      data: accounts,
      message: 'Meeting accounts retrieved successfully',
    } as ApiResponse<any>);
  } catch (error: any) {
    console.error('❌ Get meeting accounts error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve meeting accounts',
    } as ApiResponse<null>);
  }
});

// @route   DELETE /api/meetings/:provider/disconnect
// @desc    Disconnect meeting provider
// @access  Private
router.delete('/:provider/disconnect', async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    const { provider } = req.params;

    const providerMap: Record<string, string> = {
      'google-meet': 'googleMeet',
      'zoom': 'zoom',
      'teams': 'teams',
      'webex': 'webex',
    };

    const integrationKey = providerMap[provider];
    if (!integrationKey) {
      return res.status(400).json({
        success: false,
        error: 'Invalid provider',
      } as ApiResponse<null>);
    }

    await User.findByIdAndUpdate(
      userId,
      {
        $unset: {
          [`integrations.${integrationKey}`]: '',
        },
      }
    );

    console.log(`✅ ${provider} disconnected:`, userId);

    res.json({
      success: true,
      data: { provider },
      message: `${provider} disconnected successfully`,
    } as ApiResponse<any>);
  } catch (error: any) {
    console.error('❌ Disconnect meeting provider error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to disconnect meeting provider',
    } as ApiResponse<null>);
  }
});

export default router;
