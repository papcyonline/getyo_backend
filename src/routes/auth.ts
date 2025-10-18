import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models';
import OTP from '../models/OTP';
import { ApiResponse, AuthPayload, RegistrationRequest } from '../types';
import { authenticateToken } from '../middleware/auth';
import emailService from '../services/emailService';
import smsService from '../services/smsService';
import SessionService from '../services/SessionService';

const router = express.Router();

// Generate JWT token
const generateToken = (userId: string, email: string): string => {
  const secret = process.env.JWT_SECRET || 'your-secret-key';
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

  return (jwt as any).sign(
    { userId, email },
    secret,
    { expiresIn }
  );
};

// @route   POST /api/auth/register
// @desc    Register a new user with email and password
// @access  Public
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, acceptedTerms, termsVersion, privacyVersion } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Name, email, and password are required',
      } as ApiResponse<null>);
    }

    // Validate legal acceptance
    if (!acceptedTerms) {
      return res.status(400).json({
        success: false,
        error: 'You must accept the Terms of Service and Privacy Policy to create an account',
      } as ApiResponse<null>);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format',
      } as ApiResponse<null>);
    }

    // Validate password strength
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long',
      } as ApiResponse<null>);
    }

    // Check if user already exists with this email
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'An account with this email already exists',
      } as ApiResponse<null>);
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Get client IP address for legal record
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    const now = new Date();

    // Create user with default preferences and legal acceptance
    const user = await User.create({
      fullName: name,
      preferredName: name.split(' ')[0], // Use first name as preferred name
      name, // Legacy field for compatibility
      email: email.toLowerCase(),
      password: hashedPassword,
      hasCompletedOnboarding: false, // User needs to complete profile setup
      preferences: {
        voiceEnabled: true,
        reminderStyle: 'friendly',
        dailyBriefingTime: '08:00',
        theme: 'dark',
        wakeWord: 'Hey Yo',
        conversationStyle: 'casual',
        language: 'en',
      },
      integrations: {},
      legalAcceptance: {
        termsOfService: {
          accepted: true,
          version: termsVersion || '1.0',
          acceptedAt: now,
          ipAddress: ipAddress,
        },
        privacyPolicy: {
          accepted: true,
          version: privacyVersion || '1.0',
          acceptedAt: now,
          ipAddress: ipAddress,
        },
        acceptanceHistory: [
          {
            documentType: 'terms',
            version: termsVersion || '1.0',
            acceptedAt: now,
            ipAddress: ipAddress,
          },
          {
            documentType: 'privacy',
            version: privacyVersion || '1.0',
            acceptedAt: now,
            ipAddress: ipAddress,
          },
        ],
      },
    });

    // Generate token
    const token = generateToken(user._id.toString(), user.email);

    // Send welcome email (optional, non-blocking)
    emailService.sendWelcomeEmail(user.email, user.fullName).catch(err =>
      console.error('Failed to send welcome email:', err)
    );

    console.log(`✅ User registered with legal acceptance - Terms: ${termsVersion || '1.0'}, Privacy: ${privacyVersion || '1.0'}`);

    // Remove password from response
    const userResponse = {
      id: user._id,
      fullName: user.fullName,
      preferredName: user.preferredName,
      title: user.title,
      name: user.name,
      email: user.email,
      phone: user.phone,
      phoneVerified: user.phoneVerified,
      profileImage: user.profileImage,
      assistantName: user.assistantName,
      assistantGender: user.assistantGender,
      assistantVoice: user.assistantVoice,
      assistantProfileImage: user.assistantProfileImage,
      hasCompletedOnboarding: user.hasCompletedOnboarding,
      agentConfiguration: user.agentConfiguration,
      preferences: user.preferences,
      integrations: user.integrations,
      legalAcceptance: user.legalAcceptance,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    res.status(201).json({
      success: true,
      data: {
        user: userResponse,
        token,
      },
      message: 'User registered successfully',
    } as ApiResponse<{ user: any; token: string }>);
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
});

// @route   POST /api/auth/register-enhanced
// @desc    Register a new user with enhanced personal details for PA context
// @access  Public
router.post('/register-enhanced', async (req, res) => {
  try {
    const { userDetails, email, password, preferences }: RegistrationRequest = req.body;

    // Validate required fields
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required',
      } as ApiResponse<null>);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format',
      } as ApiResponse<null>);
    }

    // Validate password if provided
    if (password && password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long',
      } as ApiResponse<null>);
    }

    // Use defaults if userDetails are missing
    const fullName = userDetails?.fullName?.trim() || 'User';
    const preferredName = userDetails?.preferredName?.trim() || fullName;
    const title = userDetails?.title?.trim() || '';

    // Check if user already exists with this email
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'An account with this email already exists',
      } as ApiResponse<null>);
    }

    // Generate a temporary password if none provided (for OAuth users)
    const userPassword = password || Math.random().toString(36).slice(-12);

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(userPassword, saltRounds);

    // Create user with enhanced details
    const user = await User.create({
      fullName: fullName,
      preferredName: preferredName,
      title: title,
      name: preferredName, // Legacy field for backward compatibility
      email: email.toLowerCase(),
      password: hashedPassword,
      preferences: {
        voiceEnabled: true,
        reminderStyle: 'friendly',
        dailyBriefingTime: '08:00',
        theme: 'dark',
        wakeWord: 'Hey Yo',
        conversationStyle: 'casual',
        language: preferences?.language || 'en',
      },
      integrations: {},
    });

    // Generate token
    const token = generateToken(user._id.toString(), user.email);

    // Send welcome email (optional, non-blocking)
    emailService.sendWelcomeEmail(user.email, user.fullName).catch(err =>
      console.error('Failed to send welcome email:', err)
    );

    // Return enhanced user response
    const userResponse = {
      id: user._id,
      fullName: user.fullName,
      preferredName: user.preferredName,
      title: user.title,
      name: user.name, // Legacy field
      email: user.email,
      phone: user.phone,
      phoneVerified: user.phoneVerified,
      profileImage: user.profileImage,
      assistantName: user.assistantName,
      assistantGender: user.assistantGender,
      assistantVoice: user.assistantVoice,
      assistantProfileImage: user.assistantProfileImage,
      hasCompletedOnboarding: user.hasCompletedOnboarding,
      agentConfiguration: user.agentConfiguration,
      preferences: user.preferences,
      integrations: user.integrations,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    res.status(201).json({
      success: true,
      data: {
        user: userResponse,
        token,
        passwordGenerated: !password, // Let frontend know if password was auto-generated
      },
      message: 'User registered successfully with Personal Assistant context',
    } as ApiResponse<{ user: any; token: string; passwordGenerated: boolean }>);
  } catch (error) {
    console.error('Enhanced registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
});

// @route   POST /api/auth/oauth/google
// @desc    Google OAuth login/register
// @access  Public
router.post('/oauth/google', async (req, res) => {
  try {
    const { idToken, email, name } = req.body;

    if (!email || !name) {
      return res.status(400).json({
        success: false,
        error: 'Email and name are required from Google',
      } as ApiResponse<null>);
    }

    // Check if user exists
    let user = await User.findOne({ email: email.toLowerCase() });
    let isNewUser = false;

    if (!user) {
      // Create new user with Google OAuth - minimal profile for now
      isNewUser = true;
      user = await User.create({
        fullName: name,
        preferredName: name.split(' ')[0], // Temporary - user can customize later
        name, // Legacy field for compatibility
        email: email.toLowerCase(),
        password: await bcrypt.hash(Math.random().toString(36).slice(-12), 12), // Random password for OAuth users
        hasCompletedOnboarding: false, // Important: User needs to complete profile
        preferences: {
          voiceEnabled: true,
          reminderStyle: 'friendly',
          dailyBriefingTime: '08:00',
          theme: 'dark',
          wakeWord: 'Hey Yo',
          conversationStyle: 'casual',
          language: 'en',
        },
        integrations: {},
      });

      // Send welcome email (optional, non-blocking)
      emailService.sendWelcomeEmail(user.email, user.fullName).catch(err =>
        console.error('Failed to send welcome email:', err)
      );
    }

    // Generate token
    const token = generateToken(user._id.toString(), user.email);

    const userResponse = {
      id: user._id,
      fullName: user.fullName,
      preferredName: user.preferredName,
      title: user.title,
      name: user.name,
      email: user.email,
      phone: user.phone,
      phoneVerified: user.phoneVerified,
      profileImage: user.profileImage,
      assistantName: user.assistantName,
      assistantGender: user.assistantGender,
      assistantVoice: user.assistantVoice,
      assistantProfileImage: user.assistantProfileImage,
      hasCompletedOnboarding: user.hasCompletedOnboarding,
      agentConfiguration: user.agentConfiguration,
      preferences: user.preferences,
      integrations: user.integrations,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    res.json({
      success: true,
      data: {
        user: userResponse,
        token,
        isNewUser, // Flag to tell frontend if onboarding is needed
        requiresOnboarding: !user.hasCompletedOnboarding, // Explicit flag
      },
      message: isNewUser ? 'Account created successfully' : 'Login successful',
    } as ApiResponse<{ user: any; token: string; isNewUser: boolean; requiresOnboarding: boolean }>);
  } catch (error) {
    console.error('Google OAuth error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
});

// @route   POST /api/auth/oauth/apple
// @desc    Apple OAuth login/register
// @access  Public
router.post('/oauth/apple', async (req, res) => {
  try {
    const { identityToken, email, fullName } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required from Apple',
      } as ApiResponse<null>);
    }

    // Check if user exists
    let user = await User.findOne({ email: email.toLowerCase() });
    let isNewUser = false;

    if (!user) {
      // Create new user with Apple OAuth - minimal profile for now
      isNewUser = true;
      const name = fullName || email.split('@')[0];
      user = await User.create({
        fullName: name,
        preferredName: name.split(' ')[0], // Temporary - user can customize later
        name, // Legacy field for compatibility
        email: email.toLowerCase(),
        password: await bcrypt.hash(Math.random().toString(36).slice(-12), 12), // Random password for OAuth users
        hasCompletedOnboarding: false, // Important: User needs to complete profile
        preferences: {
          voiceEnabled: true,
          reminderStyle: 'friendly',
          dailyBriefingTime: '08:00',
          theme: 'dark',
          wakeWord: 'Hey Yo',
          conversationStyle: 'casual',
          language: 'en',
        },
        integrations: {},
      });

      // Send welcome email (optional, non-blocking)
      emailService.sendWelcomeEmail(user.email, user.fullName).catch(err =>
        console.error('Failed to send welcome email:', err)
      );
    }

    // Generate token
    const token = generateToken(user._id.toString(), user.email);

    const userResponse = {
      id: user._id,
      fullName: user.fullName,
      preferredName: user.preferredName,
      title: user.title,
      name: user.name,
      email: user.email,
      phone: user.phone,
      phoneVerified: user.phoneVerified,
      profileImage: user.profileImage,
      assistantName: user.assistantName,
      assistantGender: user.assistantGender,
      assistantVoice: user.assistantVoice,
      assistantProfileImage: user.assistantProfileImage,
      hasCompletedOnboarding: user.hasCompletedOnboarding,
      agentConfiguration: user.agentConfiguration,
      preferences: user.preferences,
      integrations: user.integrations,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    res.json({
      success: true,
      data: {
        user: userResponse,
        token,
        isNewUser, // Flag to tell frontend if onboarding is needed
        requiresOnboarding: !user.hasCompletedOnboarding, // Explicit flag
      },
      message: isNewUser ? 'Account created successfully' : 'Login successful',
    } as ApiResponse<{ user: any; token: string; isNewUser: boolean; requiresOnboarding: boolean }>);
  } catch (error) {
    console.error('Apple OAuth error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required',
      } as ApiResponse<null>);
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email or password',
      } as ApiResponse<null>);
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email or password',
      } as ApiResponse<null>);
    }

    // Check if 2FA is enabled
    if (user.twoFactorAuth?.enabled) {
      // Generate 6-digit OTP for login
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const normalizedEmail = user.email.toLowerCase().trim();
      const method = user.twoFactorAuth.method || 'email';
      const identifier = method === 'sms' ? user.phone! : normalizedEmail;

      // Delete any existing login 2FA OTP for this user
      await OTP.deleteMany({ identifier, type: '2fa-login' });

      // Store OTP with 10-minute expiry
      await OTP.create({
        identifier,
        code: otpCode,
        type: '2fa-login',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        attempts: 0,
        userId: user._id.toString(),
      });

      // Send OTP via the user's preferred method
      if (method === 'email') {
        const emailSent = await emailService.sendPasswordResetEmail(normalizedEmail, otpCode);
        if (!emailSent) {
          console.warn(`Failed to send 2FA login email to ${normalizedEmail}, but OTP stored for development`);
        }
        console.log(`📧 2FA login code sent to ${normalizedEmail}`);
      } else {
        const smsSent = await smsService.send2FASMS(user.phone!, otpCode);
        if (!smsSent && process.env.NODE_ENV !== 'development') {
          return res.status(500).json({
            success: false,
            error: 'Failed to send verification code via SMS',
          } as ApiResponse<null>);
        }
        console.log(`📱 2FA login code sent to ${user.phone}`);
      }

      return res.json({
        success: true,
        data: {
          requires2FA: true,
          email: normalizedEmail,
          method: method,
        },
        message: `Verification code sent to your ${method === 'email' ? 'email' : 'phone'}`,
        // In development, return the OTP for testing
        ...(process.env.NODE_ENV === 'development' && { otp: otpCode }),
      } as ApiResponse<any>);
    }

    // No 2FA - proceed with normal login
    // Generate token
    const token = generateToken(user._id.toString(), user.email);

    // Create session
    try {
      await SessionService.createSession(
        user._id.toString(),
        token,
        {
          userAgent: req.headers['user-agent'] || 'Unknown',
          ipAddress: req.ip || req.connection.remoteAddress || '127.0.0.1',
        }
      );
      console.log('✅ Session created for user:', user.email);
    } catch (sessionError) {
      console.error('⚠️ Failed to create session:', sessionError);
      // Don't fail login if session creation fails
    }

    // Remove password from response
    const userResponse = {
      id: user._id,
      fullName: user.fullName,
      preferredName: user.preferredName,
      title: user.title,
      name: user.name,
      email: user.email,
      phone: user.phone,
      phoneVerified: user.phoneVerified,
      profileImage: user.profileImage,
      assistantName: user.assistantName,
      assistantGender: user.assistantGender,
      assistantVoice: user.assistantVoice,
      assistantProfileImage: user.assistantProfileImage,
      hasCompletedOnboarding: user.hasCompletedOnboarding,
      agentConfiguration: user.agentConfiguration,
      preferences: user.preferences,
      integrations: user.integrations,
      legalAcceptance: user.legalAcceptance,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    res.json({
      success: true,
      data: {
        user: userResponse,
        token,
      },
      message: 'Login successful',
    } as ApiResponse<{ user: any; token: string }>);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
});

// @route   POST /api/auth/logout
// @desc    Logout user (invalidate token on client side)
// @access  Private
router.post('/logout', async (req, res) => {
  try {
    // In a more sophisticated setup, you might maintain a blacklist of tokens
    // For now, we'll rely on client-side token removal
    res.json({
      success: true,
      message: 'Logout successful',
    } as ApiResponse<null>);
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', authenticateToken, async (req, res) => {
  try {
    // Get user ID from auth middleware
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      } as ApiResponse<null>);
    }

    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      } as ApiResponse<null>);
    }

    const userResponse = {
      id: user._id,
      fullName: user.fullName,
      preferredName: user.preferredName,
      title: user.title,
      name: user.name,
      email: user.email,
      phone: user.phone,
      phoneVerified: user.phoneVerified,
      profileImage: user.profileImage,
      assistantName: user.assistantName,
      assistantGender: user.assistantGender,
      assistantVoice: user.assistantVoice,
      assistantProfileImage: user.assistantProfileImage,
      hasCompletedOnboarding: user.hasCompletedOnboarding,
      agentConfiguration: user.agentConfiguration,
      preferences: user.preferences,
      integrations: user.integrations,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    res.json({
      success: true,
      data: userResponse,
    } as ApiResponse<any>);
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
});

// @route   POST /api/auth/forgot-password
// @desc    Send OTP for password reset via email
// @access  Public
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required',
      } as ApiResponse<null>);
    }

    // Check if user exists
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // For security, don't reveal if email exists
      return res.json({
        success: true,
        message: 'If an account exists with this email, a verification code has been sent',
      } as ApiResponse<null>);
    }

    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Normalize email (lowercase, trim)
    const normalizedEmail = email.toLowerCase().trim();

    // Delete any existing OTP for this email
    await OTP.deleteMany({ identifier: normalizedEmail, type: 'reset' });

    // Store OTP in MongoDB with 10-minute expiry
    await OTP.create({
      identifier: normalizedEmail,
      code: otpCode,
      type: 'reset',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      attempts: 0
    });

    // Send email using Resend service
    const emailSent = await emailService.sendPasswordResetEmail(normalizedEmail, otpCode);

    if (!emailSent) {
      console.warn(`Failed to send email to ${normalizedEmail}, but OTP stored for development`);
    }

    res.json({
      success: true,
      message: 'Verification code sent to your email',
      // In development, return the OTP for testing
      ...(process.env.NODE_ENV === 'development' && { data: { otp: otpCode } })
    } as ApiResponse<any>);
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
});

// @route   POST /api/auth/verify-reset-otp
// @desc    Verify OTP for password reset
// @access  Public
router.post('/verify-reset-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        error: 'Email and OTP are required'
      } as ApiResponse<null>);
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    // Get stored OTP from MongoDB
    const storedOtp = await OTP.findOne({ identifier: normalizedEmail, type: 'reset' });

    if (!storedOtp) {
      return res.status(400).json({
        success: false,
        error: 'OTP not found or expired'
      } as ApiResponse<null>);
    }

    // Check if OTP is expired
    if (new Date() > storedOtp.expiresAt) {
      await OTP.deleteOne({ _id: storedOtp._id });
      return res.status(400).json({
        success: false,
        error: 'OTP expired'
      } as ApiResponse<null>);
    }

    // Check attempts
    if (storedOtp.attempts >= 3) {
      await OTP.deleteOne({ _id: storedOtp._id });
      return res.status(400).json({
        success: false,
        error: 'Too many failed attempts'
      } as ApiResponse<null>);
    }

    // Verify OTP
    if (storedOtp.code !== otp) {
      storedOtp.attempts++;
      await storedOtp.save();
      return res.status(400).json({
        success: false,
        error: 'Invalid OTP'
      } as ApiResponse<null>);
    }

    // OTP verified successfully - keep it for the reset-password step
    // We'll delete it after password is actually reset

    res.json({
      success: true,
      data: {
        verified: true,
        email: normalizedEmail
      },
      message: 'OTP verified successfully'
    } as ApiResponse<{ verified: boolean; email: string }>);
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    } as ApiResponse<null>);
  }
});

// @route   POST /api/auth/reset-password
// @desc    Reset password after OTP verification
// @access  Public
router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Email, OTP, and new password are required',
      } as ApiResponse<null>);
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 6 characters long',
      } as ApiResponse<null>);
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    // Verify OTP one more time
    const storedOtp = await OTP.findOne({ identifier: normalizedEmail, type: 'reset' });

    if (!storedOtp || storedOtp.code !== otp || new Date() > storedOtp.expiresAt) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired OTP',
      } as ApiResponse<null>);
    }

    // Find user
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      } as ApiResponse<null>);
    }

    // Update password directly (pre-save hook will hash it)
    user.password = newPassword;
    await user.save();

    // Delete the OTP after successful password reset
    await OTP.deleteOne({ _id: storedOtp._id });

    res.json({
      success: true,
      message: 'Password reset successfully',
    } as ApiResponse<null>);
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
});

// @route   POST /api/auth/complete-profile
// @desc    Complete user profile after initial registration (onboarding)
// @access  Private
router.post('/complete-profile', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    const { fullName, preferredName, title, assistantName, phone } = req.body;

    // Validate required fields for PA functionality
    if (!fullName || !preferredName) {
      return res.status(400).json({
        success: false,
        error: 'Full name and preferred name are required',
      } as ApiResponse<null>);
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      } as ApiResponse<null>);
    }

    // Update user profile with complete information
    user.fullName = fullName.trim();
    user.preferredName = preferredName.trim();
    user.title = title?.trim() || undefined;
    user.assistantName = assistantName?.trim() || undefined;
    user.phone = phone?.trim() || undefined;
    user.name = preferredName.trim(); // Legacy field
    user.hasCompletedOnboarding = true; // Mark onboarding as complete

    await user.save();

    const userResponse = {
      id: user._id,
      fullName: user.fullName,
      preferredName: user.preferredName,
      title: user.title,
      name: user.name,
      email: user.email,
      phone: user.phone,
      phoneVerified: user.phoneVerified,
      profileImage: user.profileImage,
      assistantName: user.assistantName,
      assistantGender: user.assistantGender,
      assistantVoice: user.assistantVoice,
      assistantProfileImage: user.assistantProfileImage,
      hasCompletedOnboarding: user.hasCompletedOnboarding,
      agentConfiguration: user.agentConfiguration,
      preferences: user.preferences,
      integrations: user.integrations,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    res.json({
      success: true,
      data: userResponse,
      message: 'Profile completed successfully',
    } as ApiResponse<any>);
  } catch (error) {
    console.error('Complete profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
});

// @route   POST /api/auth/change-password
// @desc    Change user password (authenticated user)
// @access  Private
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    // Get userId from middleware - it sets req.userId directly
    const userId = (req as any).userId;
    const { currentPassword, newPassword } = req.body;

    console.log('🔐 Change password request for userId:', userId);

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      } as ApiResponse<null>);
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current password and new password are required',
      } as ApiResponse<null>);
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 6 characters long',
      } as ApiResponse<null>);
    }

    // Find user
    const user = await User.findById(userId);
    console.log('👤 User found:', user ? `Yes (${user.email})` : 'No');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      } as ApiResponse<null>);
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        error: 'Current password is incorrect',
      } as ApiResponse<null>);
    }

    // Check if new password is same as current password
    if (newPassword === currentPassword) {
      return res.status(400).json({
        success: false,
        error: 'New password must be different from current password',
      } as ApiResponse<null>);
    }

    // Update password (pre-save hook will hash it automatically)
    console.log('🔄 Updating password for user:', user.email);
    console.log('📝 Password modified before save:', user.isModified('password'));
    user.password = newPassword;
    console.log('📝 Password modified after setting:', user.isModified('password'));
    user.markModified('password'); // Explicitly mark as modified
    console.log('💾 Saving user...');
    await user.save();
    console.log('✅ User saved successfully');

    // Verify the password was actually updated
    const updatedUser = await User.findById(userId);
    const canLoginWithNew = await bcrypt.compare(newPassword, updatedUser!.password);
    const canLoginWithOld = await bcrypt.compare(currentPassword, updatedUser!.password);
    console.log('🔍 Verification - Can login with new password:', canLoginWithNew);
    console.log('🔍 Verification - Can login with old password:', canLoginWithOld);

    res.json({
      success: true,
      message: 'Password changed successfully',
    } as ApiResponse<null>);
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
});

// @route   GET /api/auth/legal-status
// @desc    Check if user needs to re-accept updated terms
// @access  Private
router.get('/legal-status', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      } as ApiResponse<null>);
    }

    const CURRENT_TERMS_VERSION = '1.0';
    const CURRENT_PRIVACY_VERSION = '1.0';

    const userTermsVersion = user.legalAcceptance?.termsOfService?.version;
    const userPrivacyVersion = user.legalAcceptance?.privacyPolicy?.version;

    const needsTermsUpdate = !userTermsVersion || userTermsVersion !== CURRENT_TERMS_VERSION;
    const needsPrivacyUpdate = !userPrivacyVersion || userPrivacyVersion !== CURRENT_PRIVACY_VERSION;

    res.json({
      success: true,
      data: {
        needsAcceptance: needsTermsUpdate || needsPrivacyUpdate,
        currentVersions: {
          terms: CURRENT_TERMS_VERSION,
          privacy: CURRENT_PRIVACY_VERSION,
        },
        userVersions: {
          terms: userTermsVersion,
          privacy: userPrivacyVersion,
        },
      },
      message: 'Legal status retrieved successfully',
    } as ApiResponse<any>);
  } catch (error) {
    console.error('Legal status error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
});

// @route   POST /api/auth/accept-legal
// @desc    Accept or re-accept terms and privacy policy
// @access  Private
router.post('/accept-legal', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const { termsVersion, privacyVersion } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      } as ApiResponse<null>);
    }

    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    const now = new Date();

    // Update current acceptance
    user.legalAcceptance.termsOfService = {
      accepted: true,
      version: termsVersion || '1.0',
      acceptedAt: now,
      ipAddress: ipAddress,
    };

    user.legalAcceptance.privacyPolicy = {
      accepted: true,
      version: privacyVersion || '1.0',
      acceptedAt: now,
      ipAddress: ipAddress,
    };

    // Add to history
    if (!user.legalAcceptance.acceptanceHistory) {
      user.legalAcceptance.acceptanceHistory = [];
    }

    user.legalAcceptance.acceptanceHistory.push({
      documentType: 'terms',
      version: termsVersion || '1.0',
      acceptedAt: now,
      ipAddress: ipAddress,
    });

    user.legalAcceptance.acceptanceHistory.push({
      documentType: 'privacy',
      version: privacyVersion || '1.0',
      acceptedAt: now,
      ipAddress: ipAddress,
    });

    await user.save();

    console.log(`✅ Legal re-acceptance recorded for user ${userId} - Terms: ${termsVersion}, Privacy: ${privacyVersion}`);

    res.json({
      success: true,
      message: 'Legal acceptance recorded successfully',
    } as ApiResponse<null>);
  } catch (error) {
    console.error('Accept legal error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
});

// ===================================
// Phone Verification
// ===================================

// @route   POST /api/auth/verify-phone/send
// @desc    Send verification code to phone number
// @access  Private
router.post('/verify-phone/send', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required',
      } as ApiResponse<null>);
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      } as ApiResponse<null>);
    }

    // Check if phone is already verified for this user
    if (user.phone === phone && user.phoneVerified) {
      return res.status(400).json({
        success: false,
        error: 'This phone number is already verified',
      } as ApiResponse<null>);
    }

    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Delete any existing phone verification OTP for this user
    await OTP.deleteMany({ identifier: phone, type: 'phone-verification' });

    // Store OTP with 10-minute expiry
    await OTP.create({
      identifier: phone,
      code: otpCode,
      type: 'phone-verification',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      attempts: 0,
      userId: userId, // Link to user for verification
    });

    // Send SMS using SMS service
    const smsSent = await smsService.sendPhoneVerificationSMS(phone, otpCode);

    if (!smsSent && process.env.NODE_ENV !== 'development') {
      return res.status(500).json({
        success: false,
        error: 'Failed to send verification code',
      } as ApiResponse<null>);
    }

    console.log(`📱 Phone verification code sent to ${phone}`);

    res.json({
      success: true,
      message: 'Verification code sent to your phone',
      // In development, return the OTP for testing
      ...(process.env.NODE_ENV === 'development' && { data: { otp: otpCode } }),
    } as ApiResponse<any>);
  } catch (error) {
    console.error('Send phone verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
});

// @route   POST /api/auth/verify-phone/verify
// @desc    Verify phone OTP and mark phone as verified
// @access  Private
router.post('/verify-phone/verify', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { phone, code } = req.body;

    if (!phone || !code) {
      return res.status(400).json({
        success: false,
        error: 'Phone number and verification code are required',
      } as ApiResponse<null>);
    }

    if (code.length !== 6) {
      return res.status(400).json({
        success: false,
        error: 'Invalid verification code',
      } as ApiResponse<null>);
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      } as ApiResponse<null>);
    }

    // Get stored OTP
    const storedOtp = await OTP.findOne({
      identifier: phone,
      type: 'phone-verification',
      userId: userId,
    });

    if (!storedOtp) {
      return res.status(400).json({
        success: false,
        error: 'Verification code not found or expired',
      } as ApiResponse<null>);
    }

    // Check if expired
    if (new Date() > storedOtp.expiresAt) {
      await OTP.deleteOne({ _id: storedOtp._id });
      return res.status(400).json({
        success: false,
        error: 'Verification code expired',
      } as ApiResponse<null>);
    }

    // Check attempts
    if (storedOtp.attempts >= 3) {
      await OTP.deleteOne({ _id: storedOtp._id });
      return res.status(400).json({
        success: false,
        error: 'Too many failed attempts',
      } as ApiResponse<null>);
    }

    // Verify code
    if (storedOtp.code !== code) {
      storedOtp.attempts++;
      await storedOtp.save();
      return res.status(400).json({
        success: false,
        error: 'Invalid verification code',
      } as ApiResponse<null>);
    }

    // Mark phone as verified and update user
    user.phone = phone;
    user.phoneVerified = true;
    await user.save();

    // Delete the OTP
    await OTP.deleteOne({ _id: storedOtp._id });

    console.log(`✅ Phone verified for user: ${user.email}`);

    res.json({
      success: true,
      data: {
        phone: user.phone,
        phoneVerified: user.phoneVerified,
      },
      message: 'Phone number verified successfully',
    } as ApiResponse<any>);
  } catch (error) {
    console.error('Verify phone error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
});

// ===================================
// Two-Factor Authentication (2FA)
// ===================================

// @route   GET /api/auth/2fa/status
// @desc    Get 2FA status for current user
// @access  Private
router.get('/2fa/status', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      } as ApiResponse<null>);
    }

    res.json({
      success: true,
      data: {
        enabled: user.twoFactorAuth?.enabled || false,
        method: user.twoFactorAuth?.method || 'email',
        verifiedAt: user.twoFactorAuth?.verifiedAt,
      },
      message: '2FA status retrieved successfully',
    } as ApiResponse<any>);
  } catch (error) {
    console.error('Get 2FA status error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
});

// @route   POST /api/auth/2fa/setup
// @desc    Send verification code to email or SMS to enable 2FA
// @access  Private
router.post('/2fa/setup', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { method } = req.body; // 'email' or 'sms'
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      } as ApiResponse<null>);
    }

    // Check if 2FA is already enabled
    if (user.twoFactorAuth?.enabled) {
      return res.status(400).json({
        success: false,
        error: '2FA is already enabled',
      } as ApiResponse<null>);
    }

    // Validate method
    const selectedMethod = method || 'email';
    if (!['email', 'sms'].includes(selectedMethod)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid 2FA method. Must be "email" or "sms"',
      } as ApiResponse<null>);
    }

    // If SMS is selected, check if phone is verified
    if (selectedMethod === 'sms') {
      if (!user.phone || !user.phoneVerified) {
        return res.status(400).json({
          success: false,
          error: 'You must verify your phone number before enabling SMS-based 2FA',
        } as ApiResponse<null>);
      }
    }

    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const normalizedEmail = user.email.toLowerCase().trim();
    const identifier = selectedMethod === 'sms' ? user.phone! : normalizedEmail;

    // Delete any existing 2FA OTP for this user
    await OTP.deleteMany({ identifier, type: '2fa' });

    // Store OTP with 10-minute expiry
    await OTP.create({
      identifier,
      code: otpCode,
      type: '2fa',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      attempts: 0,
      userId: userId,
    });

    // Send OTP via selected method
    let sent = false;
    if (selectedMethod === 'email') {
      sent = await emailService.sendPasswordResetEmail(normalizedEmail, otpCode);
      if (!sent) {
        console.warn(`Failed to send 2FA email to ${normalizedEmail}, but OTP stored for development`);
      }
      console.log(`📧 2FA setup code sent to ${normalizedEmail}`);
    } else {
      sent = await smsService.send2FASMS(user.phone!, otpCode);
      if (!sent && process.env.NODE_ENV !== 'development') {
        return res.status(500).json({
          success: false,
          error: 'Failed to send verification code via SMS',
        } as ApiResponse<null>);
      }
      console.log(`📱 2FA setup code sent to ${user.phone}`);
    }

    res.json({
      success: true,
      data: {
        method: selectedMethod,
      },
      message: `Verification code sent to your ${selectedMethod === 'email' ? 'email' : 'phone'}`,
      // In development, return the OTP for testing
      ...(process.env.NODE_ENV === 'development' && { otp: otpCode }),
    } as ApiResponse<any>);
  } catch (error) {
    console.error('2FA setup error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
});

// @route   POST /api/auth/2fa/verify
// @desc    Verify OTP code and enable 2FA
// @access  Private
router.post('/2fa/verify', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { code } = req.body;

    if (!code || code.length !== 6) {
      return res.status(400).json({
        success: false,
        error: 'Invalid verification code',
      } as ApiResponse<null>);
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      } as ApiResponse<null>);
    }

    const normalizedEmail = user.email.toLowerCase().trim();

    // Try to find OTP - check both email and phone identifiers
    let storedOtp = await OTP.findOne({ identifier: normalizedEmail, type: '2fa', userId });
    let usedMethod: 'email' | 'sms' = 'email';

    if (!storedOtp && user.phone) {
      // Check if SMS OTP exists
      storedOtp = await OTP.findOne({ identifier: user.phone, type: '2fa', userId });
      if (storedOtp) {
        usedMethod = 'sms';
      }
    }

    if (!storedOtp) {
      return res.status(400).json({
        success: false,
        error: 'Verification code not found or expired',
      } as ApiResponse<null>);
    }

    // Check if expired
    if (new Date() > storedOtp.expiresAt) {
      await OTP.deleteOne({ _id: storedOtp._id });
      return res.status(400).json({
        success: false,
        error: 'Verification code expired',
      } as ApiResponse<null>);
    }

    // Check attempts
    if (storedOtp.attempts >= 3) {
      await OTP.deleteOne({ _id: storedOtp._id });
      return res.status(400).json({
        success: false,
        error: 'Too many failed attempts',
      } as ApiResponse<null>);
    }

    // Verify code
    if (storedOtp.code !== code) {
      storedOtp.attempts++;
      await storedOtp.save();
      return res.status(400).json({
        success: false,
        error: 'Invalid verification code',
      } as ApiResponse<null>);
    }

    // Enable 2FA with the method that was used
    user.twoFactorAuth = {
      enabled: true,
      method: usedMethod,
      verifiedAt: new Date(),
    };
    await user.save();

    // Delete the OTP
    await OTP.deleteOne({ _id: storedOtp._id });

    console.log(`✅ 2FA enabled for user: ${user.email} using ${usedMethod}`);

    res.json({
      success: true,
      data: {
        method: usedMethod,
      },
      message: 'Two-factor authentication enabled successfully',
    } as ApiResponse<any>);
  } catch (error) {
    console.error('2FA verify error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
});

// @route   POST /api/auth/2fa/disable
// @desc    Disable 2FA (requires password confirmation)
// @access  Private
router.post('/2fa/disable', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        error: 'Password is required to disable 2FA',
      } as ApiResponse<null>);
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      } as ApiResponse<null>);
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        error: 'Incorrect password',
      } as ApiResponse<null>);
    }

    // Disable 2FA
    user.twoFactorAuth = {
      enabled: false,
      method: 'email',
      verifiedAt: undefined,
    };
    await user.save();

    console.log(`❌ 2FA disabled for user: ${user.email}`);

    res.json({
      success: true,
      message: 'Two-factor authentication disabled successfully',
    } as ApiResponse<null>);
  } catch (error) {
    console.error('2FA disable error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
});

// @route   POST /api/auth/login-2fa-verify
// @desc    Verify 2FA code during login and return token
// @access  Public
router.post('/login-2fa-verify', async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        success: false,
        error: 'Email and verification code are required',
      } as ApiResponse<null>);
    }

    if (code.length !== 6) {
      return res.status(400).json({
        success: false,
        error: 'Invalid verification code',
      } as ApiResponse<null>);
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Find user
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      } as ApiResponse<null>);
    }

    // Determine which identifier to use based on user's 2FA method
    const method = user.twoFactorAuth?.method || 'email';
    const identifier = method === 'sms' ? user.phone! : normalizedEmail;

    // Get stored OTP
    const storedOtp = await OTP.findOne({ identifier, type: '2fa-login' });

    if (!storedOtp) {
      return res.status(400).json({
        success: false,
        error: 'Verification code not found or expired',
      } as ApiResponse<null>);
    }

    // Check if expired
    if (new Date() > storedOtp.expiresAt) {
      await OTP.deleteOne({ _id: storedOtp._id });
      return res.status(400).json({
        success: false,
        error: 'Verification code expired',
      } as ApiResponse<null>);
    }

    // Check attempts
    if (storedOtp.attempts >= 3) {
      await OTP.deleteOne({ _id: storedOtp._id });
      return res.status(400).json({
        success: false,
        error: 'Too many failed attempts',
      } as ApiResponse<null>);
    }

    // Verify code
    if (storedOtp.code !== code) {
      storedOtp.attempts++;
      await storedOtp.save();
      return res.status(400).json({
        success: false,
        error: 'Invalid verification code',
      } as ApiResponse<null>);
    }

    // Code verified - delete OTP
    await OTP.deleteOne({ _id: storedOtp._id });

    // Generate token
    const token = generateToken(user._id.toString(), user.email);

    // Create session
    try {
      await SessionService.createSession(
        user._id.toString(),
        token,
        {
          userAgent: req.headers['user-agent'] || 'Unknown',
          ipAddress: req.ip || req.connection.remoteAddress || '127.0.0.1',
        }
      );
      console.log('✅ Session created for user (2FA):', user.email);
    } catch (sessionError) {
      console.error('⚠️ Failed to create session:', sessionError);
      // Don't fail login if session creation fails
    }

    // Build user response
    const userResponse = {
      id: user._id,
      fullName: user.fullName,
      preferredName: user.preferredName,
      title: user.title,
      name: user.name,
      email: user.email,
      phone: user.phone,
      phoneVerified: user.phoneVerified,
      profileImage: user.profileImage,
      assistantName: user.assistantName,
      assistantGender: user.assistantGender,
      assistantVoice: user.assistantVoice,
      assistantProfileImage: user.assistantProfileImage,
      hasCompletedOnboarding: user.hasCompletedOnboarding,
      agentConfiguration: user.agentConfiguration,
      preferences: user.preferences,
      integrations: user.integrations,
      legalAcceptance: user.legalAcceptance,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    console.log(`✅ 2FA login successful for user: ${user.email}`);

    res.json({
      success: true,
      data: {
        user: userResponse,
        token,
      },
      message: 'Login successful',
    } as ApiResponse<{ user: any; token: string }>);
  } catch (error) {
    console.error('2FA login verify error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
});

export default router;
