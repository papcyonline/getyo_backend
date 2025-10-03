import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models';
import OTP from '../models/OTP';
import { ApiResponse, AuthPayload, RegistrationRequest, UserDetailsData } from '../types';
import { authenticateToken } from '../middleware/auth';
import smsService from '../services/smsService';
import emailService from '../services/emailService';

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
// @desc    Register a new user
// @access  Public
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Name, email, and password are required',
      } as ApiResponse<null>);
    }

    // Check if user already exists with this email
    const existingEmailUser = await User.findOne({ email: email.toLowerCase() });
    console.log(`🔍 Registration check for ${email.toLowerCase()}:`, existingEmailUser ? `Found user: ${existingEmailUser._id}` : 'No existing user');
    if (existingEmailUser) {
      return res.status(400).json({
        success: false,
        error: 'An account with this email already exists',
      } as ApiResponse<null>);
    }

    // Check if user already exists with this phone number (if phone is provided)
    if (phone) {
      const existingPhoneUser = await User.findOne({ phone: phone.trim() });
      if (existingPhoneUser) {
        return res.status(400).json({
          success: false,
          error: 'An account with this phone number already exists',
        } as ApiResponse<null>);
      }
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user with default preferences
    const user = await User.create({
      fullName: name,
      preferredName: name.split(' ')[0], // Use first name as preferred name
      name, // Legacy field for compatibility
      email: email.toLowerCase(),
      password: hashedPassword,
      phone,
      preferences: {
        voiceEnabled: true,
        reminderStyle: 'friendly',
        dailyBriefingTime: '08:00',
        theme: 'light',
        wakeWord: 'yo',
        conversationStyle: 'casual',
        language: 'en',
      },
      integrations: {},
    });

    // Generate token
    const token = generateToken(user._id.toString(), user.email);

    // Remove password from response
    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      assistantName: user.assistantName,
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
      },
      message: 'User registered successfully',
    } as ApiResponse<{ user: any; token: string }>);
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : (error instanceof Error ? error.message : 'Internal server error'),
      stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined,
    } as ApiResponse<null>);
  }
});

// @route   POST /api/auth/register-enhanced
// @desc    Register a new user with enhanced personal details for PA context
// @access  Public
router.post('/register-enhanced', async (req, res) => {
  try {
    const { userDetails, email, phone, assistantName, password }: RegistrationRequest = req.body;
    console.log('🔐 Enhanced registration attempt:', {
      email,
      hasPassword: !!password,
      passwordLength: password?.length
    });

    // Validate required fields - use defaults for missing userDetails
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required',
      } as ApiResponse<null>);
    }

    // Use defaults if userDetails are missing
    const fullName = userDetails?.fullName?.trim() || 'User';
    const preferredName = userDetails?.preferredName?.trim() || fullName;
    const title = userDetails?.title?.trim() || '';
    const finalAssistantName = assistantName?.trim() || 'Assistant';

    // Check if user already exists with this email
    const existingEmailUser = await User.findOne({ email: email.toLowerCase() });
    if (existingEmailUser) {
      return res.status(400).json({
        success: false,
        error: 'An account with this email already exists',
      } as ApiResponse<null>);
    }

    // Check if user already exists with this phone number (only if phone is provided)
    if (phone && phone.trim()) {
      const existingPhoneUser = await User.findOne({ phone: phone.trim() });
      if (existingPhoneUser) {
        return res.status(400).json({
          success: false,
          error: 'An account with this phone number already exists',
        } as ApiResponse<null>);
      }
    }

    // Generate a temporary password if none provided (user can set it later)
    const userPassword = password || Math.random().toString(36).slice(-12);
    console.log('🔑 Password handling:', {
      receivedPassword: !!password,
      usingGeneratedPassword: !password,
      passwordToStore: password ? 'user-provided' : 'auto-generated',
      actualPasswordReceived: password // This will show the actual password during registration
    });

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
      phone: phone ? phone.trim() : undefined,
      assistantName: finalAssistantName,
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

    // Generate token
    const token = generateToken(user._id.toString(), user.email);

    // Return enhanced user response
    const userResponse = {
      id: user._id,
      fullName: user.fullName,
      preferredName: user.preferredName,
      title: user.title,
      name: user.name, // Legacy field
      email: user.email,
      phone: user.phone,
      assistantName: user.assistantName,
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

    if (!user) {
      // Create new user with Google OAuth
      user = await User.create({
        fullName: name,
        preferredName: name.split(' ')[0], // Use first name as preferred name
        name, // Legacy field for compatibility
        email: email.toLowerCase(),
        password: Math.random().toString(36).slice(-12), // Random password for OAuth users
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
    }

    // Generate token
    const token = generateToken(user._id.toString(), user.email);

    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      assistantName: user.assistantName,
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
      },
      message: 'Google authentication successful',
    } as ApiResponse<{ user: any; token: string }>);
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

    if (!user) {
      // Create new user with Apple OAuth
      const name = fullName || email.split('@')[0];
      user = await User.create({
        fullName: name,
        preferredName: name.split(' ')[0], // Use first name as preferred name
        name, // Legacy field for compatibility
        email: email.toLowerCase(),
        password: Math.random().toString(36).slice(-12), // Random password for OAuth users
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
    }

    // Generate token
    const token = generateToken(user._id.toString(), user.email);

    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      assistantName: user.assistantName,
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
      },
      message: 'Apple authentication successful',
    } as ApiResponse<{ user: any; token: string }>);
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
    console.log('🔐 Login attempt:', { email: req.body.email, hasPassword: !!req.body.password });
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      console.log('Login validation failed:', { email: !!email, password: !!password });
      return res.status(400).json({
        success: false,
        error: 'Email and password are required',
      } as ApiResponse<null>);
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      console.log('❌ User not found:', email.toLowerCase());
      return res.status(400).json({
        success: false,
        error: 'Invalid email or password',
      } as ApiResponse<null>);
    }

    console.log('👤 User found:', {
      email: user.email,
      hasPassword: !!user.password,
      passwordHashLength: user.password?.length
    });

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log('🔐 Password check:', {
      providedPassword: password,
      providedLength: password.length,
      isValid: isPasswordValid
    });

    if (!isPasswordValid) {
      // Let's test with the password that was supposed to be set
      console.log('🔍 Debug: Testing if stored password matches what we think it should be');
      return res.status(400).json({
        success: false,
        error: 'Invalid email or password',
      } as ApiResponse<null>);
    }

    // Generate token
    const token = generateToken(user._id.toString(), user.email);

    // Remove password from response
    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      assistantName: user.assistantName,
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
router.get('/me', async (req, res) => {
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
      name: user.name,
      email: user.email,
      phone: user.phone,
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

// @route   POST /api/auth/send-phone-otp
// @desc    Send OTP for phone verification
// @access  Public
router.post('/send-phone-otp', async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required'
      } as ApiResponse<null>);
    }

    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Delete any existing OTP for this phone
    await OTP.deleteMany({ identifier: phone, type: 'phone' });

    // Store OTP in MongoDB with 10-minute expiry
    await OTP.create({
      identifier: phone,
      code: otpCode,
      type: 'phone',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      attempts: 0
    });

    // Send SMS using Twilio service
    const smsSent = await smsService.sendOTP(phone, otpCode);

    if (!smsSent) {
      console.warn(`Failed to send SMS to ${phone}, but OTP stored for development`);
    }

    res.json({
      success: true,
      message: 'OTP sent successfully',
      // In development, return the OTP for testing
      ...(process.env.NODE_ENV === 'development' && { data: { otp: otpCode } })
    } as ApiResponse<any>);
  } catch (error) {
    console.error('Send phone OTP error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    } as ApiResponse<null>);
  }
});

// @route   POST /api/auth/send-email-otp
// @desc    Send OTP for email verification
// @access  Public
router.post('/send-email-otp', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      } as ApiResponse<null>);
    }

    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Delete any existing OTP for this email
    await OTP.deleteMany({ identifier: email, type: 'email' });

    // Store OTP in MongoDB with 10-minute expiry
    await OTP.create({
      identifier: email,
      code: otpCode,
      type: 'email',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      attempts: 0
    });

    console.log(`📧 OTP generated for ${email}: ${otpCode} (expires: ${new Date(Date.now() + 10 * 60 * 1000).toISOString()})`);

    // Send email using Resend service
    const emailSent = await emailService.sendOTPEmail(email, otpCode);

    if (!emailSent) {
      console.warn(`Failed to send email to ${email}, but OTP stored for development`);
    } else {
      console.log(`✅ OTP email sent successfully to ${email}`);
    }

    res.json({
      success: true,
      message: 'OTP sent successfully',
      // In development, return the OTP for testing
      ...(process.env.NODE_ENV === 'development' && { data: { otp: otpCode } })
    } as ApiResponse<any>);
  } catch (error) {
    console.error('Send email OTP error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    } as ApiResponse<null>);
  }
});

// @route   POST /api/auth/verify-otp
// @desc    Verify OTP
// @access  Public
router.post('/verify-otp', async (req, res) => {
  try {
    const { identifier, otp, type } = req.body; // identifier can be phone or email

    if (!identifier || !otp || !type) {
      return res.status(400).json({
        success: false,
        error: 'Identifier, OTP, and type are required'
      } as ApiResponse<null>);
    }

    console.log(`🔍 Verifying OTP for ${identifier}, type: ${type}`);

    // Get stored OTP from MongoDB
    const storedOtp = await OTP.findOne({ identifier, type });

    if (!storedOtp) {
      console.log(`❌ OTP not found for ${identifier}`);
      const otpCount = await OTP.countDocuments();
      console.log(`📋 Total OTPs in database: ${otpCount}`);
      return res.status(400).json({
        success: false,
        error: 'OTP not found or expired'
      } as ApiResponse<null>);
    }

    console.log(`✅ Found OTP for ${identifier}. Code: ${storedOtp.code}, Expires: ${storedOtp.expiresAt}, Attempts: ${storedOtp.attempts}`);

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

    // OTP verified successfully
    await OTP.deleteOne({ _id: storedOtp._id });

    res.json({
      success: true,
      data: {
        verified: true,
        type
      },
      message: 'OTP verified successfully'
    } as ApiResponse<{ verified: boolean; type: string }>);
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    } as ApiResponse<null>);
  }
});

// @route   POST /api/auth/complete-registration
// @desc    Complete user registration after OTP verification
// @access  Public
router.post('/complete-registration', async (req, res) => {
  try {
    const { phone, email, assistantName, language } = req.body;

    if (!phone || !email || !assistantName) {
      return res.status(400).json({
        success: false,
        error: 'Phone, email, and assistant name are required'
      } as ApiResponse<null>);
    }

    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email: email.toLowerCase() }, { phone }] });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'User already exists with this email or phone'
      } as ApiResponse<null>);
    }

    // Create user with temporary password (they can set it later)
    const tempPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    const user = await User.create({
      name: assistantName, // Using assistant name as user name for now
      email: email.toLowerCase(),
      password: hashedPassword,
      phone,
      preferences: {
        voiceEnabled: true,
        reminderStyle: 'friendly',
        dailyBriefingTime: '08:00',
        theme: 'dark',
        wakeWord: 'yo',
        conversationStyle: 'casual',
        language: language || 'en',
      },
      integrations: {},
    });

    // Generate JWT token
    const token = generateToken(user._id.toString(), user.email);

    // Remove password from response
    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
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
      },
      message: 'Registration completed successfully'
    } as ApiResponse<{ user: any; token: string }>);
  } catch (error) {
    console.error('Complete registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    } as ApiResponse<null>);
  }
});

// @route   POST /api/auth/change-password
// @desc    Change user password (authenticated user)
// @access  Private
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    const { currentPassword, newPassword } = req.body;

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

    // Hash new password and update
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);
    user.password = hashedNewPassword;
    await user.save();

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

// @route   POST /api/auth/forgot-password
// @desc    Send password reset OTP
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
        message: 'If an account exists with this email, a reset code has been sent',
      } as ApiResponse<null>);
    }

    // Generate 6-digit reset code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Delete any existing reset code for this email
    await OTP.deleteMany({ identifier: email, type: 'reset' });

    // Store reset code in MongoDB with 15-minute expiry
    await OTP.create({
      identifier: email,
      code: resetCode,
      type: 'reset',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      attempts: 0
    });

    // Send password reset email using Resend service
    const emailSent = await emailService.sendPasswordResetEmail(email, resetCode);

    if (!emailSent) {
      console.warn(`Failed to send password reset email to ${email}, but code stored for development`);
    }

    res.json({
      success: true,
      message: 'Password reset code sent to your email',
      // In development, return the code for testing
      ...(process.env.NODE_ENV === 'development' && { data: { resetCode } })
    } as ApiResponse<any>);
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
});

// @route   POST /api/auth/reset-password
// @desc    Reset password using OTP
// @access  Public
router.post('/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Email, reset code, and new password are required',
      } as ApiResponse<null>);
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 6 characters long',
      } as ApiResponse<null>);
    }

    // Get stored reset code from MongoDB
    const storedReset = await OTP.findOne({ identifier: email, type: 'reset' });

    if (!storedReset) {
      return res.status(400).json({
        success: false,
        error: 'Reset code not found or expired',
      } as ApiResponse<null>);
    }

    // Check if reset code is expired
    if (new Date() > storedReset.expiresAt) {
      await OTP.deleteOne({ _id: storedReset._id });
      return res.status(400).json({
        success: false,
        error: 'Reset code expired',
      } as ApiResponse<null>);
    }

    // Check attempts
    if (storedReset.attempts >= 3) {
      await OTP.deleteOne({ _id: storedReset._id });
      return res.status(400).json({
        success: false,
        error: 'Too many failed attempts',
      } as ApiResponse<null>);
    }

    // Verify reset code
    if (storedReset.code !== code) {
      storedReset.attempts++;
      await storedReset.save();
      return res.status(400).json({
        success: false,
        error: 'Invalid reset code',
      } as ApiResponse<null>);
    }

    // Find user and update password
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      await OTP.deleteOne({ _id: storedReset._id });
      return res.status(404).json({
        success: false,
        error: 'User not found',
      } as ApiResponse<null>);
    }

    // Hash new password and update only the password field
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await User.findByIdAndUpdate(user._id, {
      password: hashedPassword,
      resetPasswordCode: undefined,
      resetPasswordExpiry: undefined
    });

    // Clean up reset code
    await OTP.deleteOne({ _id: storedReset._id });

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

// Duplicate route removed - using the first implementation above

// @route   POST /api/auth/verify-reset-code
// @desc    Verify password reset code
// @access  Public
router.post('/verify-reset-code', async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        success: false,
        error: 'Email and code are required',
      } as ApiResponse<null>);
    }

    const user = await User.findOne({
      email: email.toLowerCase(),
      resetPasswordCode: code,
      resetPasswordExpiry: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired reset code',
      } as ApiResponse<null>);
    }

    res.json({
      success: true,
      message: 'Code verified successfully',
    } as ApiResponse<null>);
  } catch (error) {
    console.error('Verify reset code error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
});

// Duplicate route removed - using the first implementation above

export default router;