import express from 'express';
import { User } from '../models';
import { ApiResponse } from '../types';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Apply auth middleware to all routes
router.use(authenticateToken);

// @route   GET /api/users/profile
// @desc    Get user profile
// @access  Private
router.get('/profile', async (req, res) => {
  try {
    const userId = (req as any).userId;

    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      } as ApiResponse<null>);
    }

    const userResponse = {
      id: user._id,
      // Enhanced fields
      fullName: user.fullName,
      preferredName: user.preferredName,
      title: user.title,
      assistantName: user.assistantName,
      // Legacy field for backward compatibility
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
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
});

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', async (req, res) => {
  try {
    const userId = (req as any).userId;
    const updates = req.body;

    // Remove fields that shouldn't be updated this way
    delete updates._id;
    delete updates.password;
    delete updates.email; // Email changes might need separate verification

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      } as ApiResponse<null>);
    }

    const userResponse = {
      id: user._id,
      // Enhanced fields
      fullName: user.fullName,
      preferredName: user.preferredName,
      title: user.title,
      assistantName: user.assistantName,
      // Legacy field for backward compatibility
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
      message: 'Profile updated successfully',
    } as ApiResponse<any>);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
});

// @route   PUT /api/users/preferences
// @desc    Update user preferences
// @access  Private
router.put('/preferences', async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { preferences } = req.body;

    if (!preferences) {
      return res.status(400).json({
        success: false,
        error: 'Preferences are required',
      } as ApiResponse<null>);
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { preferences } },
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
      data: user.preferences,
      message: 'Preferences updated successfully',
    } as ApiResponse<any>);
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
});

// @route   PUT /api/users/integrations
// @desc    Update user integrations
// @access  Private
router.put('/integrations', async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { integrations } = req.body;

    if (!integrations) {
      return res.status(400).json({
        success: false,
        error: 'Integrations are required',
      } as ApiResponse<null>);
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { integrations } },
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
      data: user.integrations,
      message: 'Integrations updated successfully',
    } as ApiResponse<any>);
  } catch (error) {
    console.error('Update integrations error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
});

// @route   POST /api/users/assistant-voice
// @desc    Update assistant voice settings
// @access  Private
router.post('/assistant-voice', async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { assistantGender, assistantVoice } = req.body;

    if (!assistantGender || !assistantVoice) {
      return res.status(400).json({
        success: false,
        error: 'Assistant gender and voice are required',
      } as ApiResponse<null>);
    }

    // Validate voice options
    const validVoices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
    const validGenders = ['male', 'female', 'non-binary'];

    if (!validVoices.includes(assistantVoice)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid voice option',
      } as ApiResponse<null>);
    }

    if (!validGenders.includes(assistantGender)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid gender option',
      } as ApiResponse<null>);
    }

    const user = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          assistantGender,
          assistantVoice
        }
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
        assistantGender: user.assistantGender,
        assistantVoice: user.assistantVoice
      },
      message: 'Assistant voice updated successfully',
    } as ApiResponse<any>);
  } catch (error) {
    console.error('Update assistant voice error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
});

// @route   GET /api/users/wake-word
// @desc    Get wake word settings
// @access  Private
router.get('/wake-word', async (req, res) => {
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
        wakeWord: user.preferences?.wakeWord || 'Yo',
        enabled: user.preferences?.voiceEnabled || false,
      },
      message: 'Wake word settings retrieved',
    } as ApiResponse<any>);
  } catch (error) {
    console.error('Get wake word settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
});

// @route   PUT /api/users/wake-word
// @desc    Update wake word settings
// @access  Private
router.put('/wake-word', async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { wakeWord, enabled } = req.body;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      } as ApiResponse<null>);
    }

    // Update wake word settings
    if (wakeWord !== undefined) {
      user.preferences = user.preferences || {} as any;
      user.preferences.wakeWord = wakeWord;
    }

    if (enabled !== undefined) {
      user.preferences = user.preferences || {} as any;
      user.preferences.voiceEnabled = enabled;
    }

    await user.save();

    res.json({
      success: true,
      data: {
        wakeWord: user.preferences.wakeWord,
        enabled: user.preferences.voiceEnabled,
      },
      message: 'Wake word settings updated successfully',
    } as ApiResponse<any>);
  } catch (error) {
    console.error('Update wake word settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
});

export default router;