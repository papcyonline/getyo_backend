import { Request, Response } from 'express';
import LegalService from '../services/LegalService';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

export class LegalController {
  // GET /api/legal/terms
  static async getTerms(req: Request, res: Response): Promise<void> {
    try {
      const language = req.query.language as string || 'en';
      const content = await LegalService.getContent('terms', language);

      if (!content) {
        res.status(404).json({
          success: false,
          error: 'Terms of service not found',
        });
        return;
      }

      res.json({
        success: true,
        data: content,
      });
    } catch (error) {
      console.error('Error fetching terms:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  // GET /api/legal/privacy
  static async getPrivacy(req: Request, res: Response): Promise<void> {
    try {
      const language = req.query.language as string || 'en';
      const content = await LegalService.getContent('privacy', language);

      if (!content) {
        res.status(404).json({
          success: false,
          error: 'Privacy policy not found',
        });
        return;
      }

      res.json({
        success: true,
        data: content,
      });
    } catch (error) {
      console.error('Error fetching privacy policy:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  // GET /api/legal/combined
  static async getCombined(req: Request, res: Response): Promise<void> {
    try {
      const language = req.query.language as string || 'en';
      const content = await LegalService.getContent('combined', language);

      if (!content) {
        res.status(404).json({
          success: false,
          error: 'Legal content not found',
        });
        return;
      }

      res.json({
        success: true,
        data: content,
      });
    } catch (error) {
      console.error('Error fetching combined legal content:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  // GET /api/legal/all
  static async getAllContent(req: Request, res: Response): Promise<void> {
    try {
      const language = req.query.language as string || 'en';
      const content = await LegalService.getAllContent(language);

      res.json({
        success: true,
        data: content,
      });
    } catch (error) {
      console.error('Error fetching all legal content:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  // POST /api/legal/accept
  static async acceptLegal(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { type, sessionId } = req.body;
      const userId = req.user?.id;

      // Allow anonymous acceptance for initial signup flow
      if (!userId && !sessionId) {
        res.status(400).json({
          success: false,
          error: 'Either authentication or sessionId is required',
        });
        return;
      }

      if (!type || !['terms', 'privacy', 'combined'].includes(type)) {
        res.status(400).json({
          success: false,
          error: 'Valid type is required (terms, privacy, or combined)',
        });
        return;
      }

      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.get('User-Agent');

      const acceptance = await LegalService.recordAcceptance(
        userId || sessionId, // Use sessionId for anonymous users
        type,
        ipAddress,
        userAgent,
        !userId // isAnonymous flag
      );

      res.json({
        success: true,
        data: {
          id: acceptance._id,
          type: acceptance.type,
          version: acceptance.version,
          acceptedAt: acceptance.acceptedAt,
        },
      });
    } catch (error) {
      console.error('Error recording legal acceptance:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }

  // GET /api/legal/status
  static async getAcceptanceStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { type } = req.query;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      if (type && !['terms', 'privacy', 'combined'].includes(type as string)) {
        res.status(400).json({
          success: false,
          error: 'Invalid type parameter',
        });
        return;
      }

      if (type) {
        // Check specific type
        const hasAccepted = await LegalService.hasUserAccepted(userId, type as 'terms' | 'privacy' | 'combined');
        res.json({
          success: true,
          data: {
            type,
            hasAccepted,
          },
        });
      } else {
        // Check all types
        const [terms, privacy, combined] = await Promise.all([
          LegalService.hasUserAccepted(userId, 'terms'),
          LegalService.hasUserAccepted(userId, 'privacy'),
          LegalService.hasUserAccepted(userId, 'combined'),
        ]);

        res.json({
          success: true,
          data: {
            terms,
            privacy,
            combined,
          },
        });
      }
    } catch (error) {
      console.error('Error checking acceptance status:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  // GET /api/legal/history
  static async getAcceptanceHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const history = await LegalService.getUserAcceptanceHistory(userId);

      res.json({
        success: true,
        data: history,
      });
    } catch (error) {
      console.error('Error fetching acceptance history:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  // POST /api/legal/content (Admin only)
  static async createContent(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Add admin authentication middleware
      const contentData = req.body;

      const content = await LegalService.createContent(contentData);

      res.status(201).json({
        success: true,
        data: content,
      });
    } catch (error) {
      console.error('Error creating legal content:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }
}

export default LegalController;