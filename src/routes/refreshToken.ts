import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models';

const router = Router();

/**
 * POST /api/auth/refresh-token
 * Refresh JWT access token
 */
router.post('/refresh-token', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token required',
      });
    }

    // Verify refresh token
    let decoded: any;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET!);
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired refresh token',
      });
    }

    // Find user
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    // Generate new access token
    const accessToken = jwt.sign(
      {
        userId: user._id,
        email: user.email,
      },
      process.env.JWT_SECRET!,
      { expiresIn: '15m' } // Short-lived access token
    );

    // Optionally rotate refresh token
    const newRefreshToken = jwt.sign(
      {
        userId: user._id,
        email: user.email,
      },
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET!,
      { expiresIn: '7d' } // Long-lived refresh token
    );

    res.json({
      success: true,
      data: {
        accessToken,
        refreshToken: newRefreshToken,
      },
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh token',
    });
  }
});

export default router;
