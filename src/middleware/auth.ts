import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthPayload } from '../types';
import { User } from '../models';
import SessionService from '../services/SessionService';

export interface AuthenticatedRequest extends Request {
  user?: any;
  userId?: string;
}

export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    console.log('🔐 Auth middleware - Authorization header:', authHeader ? `Bearer ${authHeader.slice(7, 20)}...` : 'Missing');
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      console.log('❌ Auth middleware - No token provided');
      res.status(401).json({
        success: false,
        error: 'Access token required',
      });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload;
    console.log('✅ Auth middleware - Token decoded, userId:', decoded.userId);

    // Verify user still exists
    const user = await User.findById(decoded.userId);
    if (!user) {
      console.log('❌ Auth middleware - User not found for userId:', decoded.userId);
      res.status(401).json({
        success: false,
        error: 'User not found',
      });
      return;
    }

    // Validate session is still active
    const session = await SessionService.getSessionByToken(token);
    if (!session || !session.isValid()) {
      console.log('❌ Auth middleware - Session invalid or expired');
      res.status(401).json({
        success: false,
        error: 'Session expired or terminated. Please log in again.',
      });
      return;
    }

    // Update session activity
    await SessionService.updateSessionActivity(token);

    console.log('✅ Auth middleware - User authenticated:', user.email);
    req.user = user;
    req.userId = decoded.userId;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        error: 'Invalid token',
      });
    } else if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        error: 'Token expired',
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Authentication error',
      });
    }
  }
};

export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload;
      const user = await User.findById(decoded.userId);
      if (user) {
        req.user = user;
        req.userId = decoded.userId;
      }
    }

    next();
  } catch (error) {
    // For optional auth, we don't return errors
    next();
  }
};

// Alias for consistency with the routes
export const authenticateToken = authenticate;