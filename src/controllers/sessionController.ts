import { Response } from 'express';
import { AuthRequest } from '../types';
import SessionService from '../services/SessionService';

export const sessionController = {
  /**
   * Get all active sessions for the current user
   * GET /api/auth/sessions
   */
  async getActiveSessions(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
      }

      const sessions = await SessionService.getUserSessions(userId);

      // Get current session token to mark it
      const currentToken = req.headers.authorization?.replace('Bearer ', '') || '';
      const currentSession = await SessionService.getSessionByToken(currentToken);

      // Format sessions for frontend
      const formattedSessions = sessions.map((session: any) => ({
        id: session._id,
        deviceName: session.deviceName,
        deviceType: session.deviceType,
        location: `${session.location?.city || 'Unknown'}, ${session.location?.country || 'Unknown'}`,
        ipAddress: session.ipAddress,
        lastActive: session.lastActive,
        isCurrent: currentSession ? session._id.toString() === currentSession._id.toString() : false,
        deviceInfo: session.deviceInfo,
        createdAt: session.createdAt,
      }));

      res.json({
        success: true,
        data: formattedSessions,
        count: formattedSessions.length,
      });
    } catch (error: any) {
      console.error('Error fetching active sessions:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch active sessions',
        message: error.message,
      });
    }
  },

  /**
   * Terminate a specific session
   * DELETE /api/auth/sessions/:sessionId
   */
  async terminateSession(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { sessionId } = req.params;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
      }

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          error: 'Session ID is required',
        });
      }

      // Check if user is trying to terminate their current session
      const currentToken = req.headers.authorization?.replace('Bearer ', '') || '';
      const currentSession = await SessionService.getSessionByToken(currentToken);

      if (currentSession && currentSession._id.toString() === sessionId) {
        return res.status(400).json({
          success: false,
          error: 'Cannot terminate your current session. Please log out instead.',
        });
      }

      const terminatedSession = await SessionService.terminateSession(sessionId, userId);

      res.json({
        success: true,
        message: 'Session terminated successfully',
        data: {
          sessionId: terminatedSession._id,
          deviceName: terminatedSession.deviceName,
        },
      });
    } catch (error: any) {
      console.error('Error terminating session:', error);

      if (error.message === 'Session not found') {
        return res.status(404).json({
          success: false,
          error: 'Session not found or already terminated',
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to terminate session',
        message: error.message,
      });
    }
  },

  /**
   * Terminate all other sessions (keep current)
   * DELETE /api/auth/sessions/others
   */
  async terminateAllOtherSessions(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
      }

      const currentToken = req.headers.authorization?.replace('Bearer ', '') || '';

      if (!currentToken) {
        return res.status(400).json({
          success: false,
          error: 'No active session found',
        });
      }

      const result = await SessionService.terminateAllOtherSessions(currentToken, userId);

      res.json({
        success: true,
        message: `Successfully terminated ${result.modifiedCount} other session(s)`,
        data: {
          terminatedCount: result.modifiedCount,
        },
      });
    } catch (error: any) {
      console.error('Error terminating all other sessions:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to terminate other sessions',
        message: error.message,
      });
    }
  },

  /**
   * Get session statistics
   * GET /api/auth/sessions/stats
   */
  async getSessionStats(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
      }

      const sessionCount = await SessionService.getUserSessionCount(userId);
      const sessions = await SessionService.getUserSessions(userId);

      // Group by device type
      const deviceTypes = sessions.reduce((acc: any, session: any) => {
        const type = session.deviceType;
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {});

      res.json({
        success: true,
        data: {
          totalSessions: sessionCount,
          deviceTypes,
          sessions: sessions.length,
        },
      });
    } catch (error: any) {
      console.error('Error fetching session stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch session statistics',
        message: error.message,
      });
    }
  },

  /**
   * Extend current session expiry
   * POST /api/auth/sessions/extend
   */
  async extendSession(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { hours = 24 } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
      }

      const currentToken = req.headers.authorization?.replace('Bearer ', '') || '';

      if (!currentToken) {
        return res.status(400).json({
          success: false,
          error: 'No active session found',
        });
      }

      const extendedSession = await SessionService.extendSession(currentToken, hours);

      if (!extendedSession) {
        return res.status(404).json({
          success: false,
          error: 'Session not found',
        });
      }

      res.json({
        success: true,
        message: `Session extended by ${hours} hours`,
        data: {
          expiresAt: extendedSession.expiresAt,
        },
      });
    } catch (error: any) {
      console.error('Error extending session:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to extend session',
        message: error.message,
      });
    }
  },
};
