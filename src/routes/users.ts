import express from 'express';
import { User } from '../models';
import { ApiResponse } from '../types';
import { authenticateToken } from '../middleware/auth';
import { uploadImageBuffer, upload } from '../services/imageUpload';

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
      assistantProfileImage: user.assistantProfileImage,
      assistantGender: user.assistantGender,
      assistantVoice: user.assistantVoice,
      hasCompletedOnboarding: user.hasCompletedOnboarding,
      // Legacy field for backward compatibility
      name: user.name,
      email: user.email,
      phone: user.phone,
      phoneVerified: user.phoneVerified,
      profileImage: user.profileImage,
      preferences: user.preferences,
      integrations: user.integrations,
      agentConfiguration: user.agentConfiguration,
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
      assistantProfileImage: user.assistantProfileImage,
      assistantGender: user.assistantGender,
      assistantVoice: user.assistantVoice,
      hasCompletedOnboarding: user.hasCompletedOnboarding,
      // Legacy field for backward compatibility
      name: user.name,
      email: user.email,
      phone: user.phone,
      phoneVerified: user.phoneVerified,
      profileImage: user.profileImage,
      preferences: user.preferences,
      integrations: user.integrations,
      agentConfiguration: user.agentConfiguration,
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

// @route   POST /api/users/profile/image
// @desc    Upload user profile image
// @access  Private
router.post('/profile/image', upload.single('profileImage'), async (req, res) => {
  try {
    const userId = (req as any).userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      } as ApiResponse<null>);
    }

    // Handle profile image upload
    const imageFile = (req as any).file;
    if (!imageFile) {
      return res.status(400).json({
        success: false,
        error: 'No image file provided',
      } as ApiResponse<null>);
    }

    console.log('📸 Processing user profile image upload...');

    const uploadResult = await uploadImageBuffer(
      imageFile.buffer,
      imageFile.originalname,
      'user-profiles'
    );

    if (uploadResult.success && uploadResult.url) {
      console.log('✅ Profile image uploaded successfully:', uploadResult.url);

      // Update user with new profile image
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { profileImage: uploadResult.url },
        { new: true, runValidators: true }
      ).select('-password');

      if (!updatedUser) {
        return res.status(500).json({
          success: false,
          error: 'Failed to update user profile image',
        } as ApiResponse<null>);
      }

      res.json({
        success: true,
        data: {
          imageUrl: updatedUser.profileImage,
        },
        message: 'Profile image uploaded successfully',
      } as ApiResponse<{ imageUrl: string | undefined }>);
    } else {
      console.error('❌ Failed to upload profile image:', uploadResult.error);
      return res.status(400).json({
        success: false,
        error: `Failed to upload profile image: ${uploadResult.error}`,
      } as ApiResponse<null>);
    }
  } catch (error) {
    console.error('Error uploading profile image:', error);
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

// @route   GET /api/users/privacy-settings
// @desc    Get user privacy and security settings
// @access  Private
router.get('/privacy-settings', async (req, res) => {
  try {
    const userId = (req as any).userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      } as ApiResponse<null>);
    }

    const privacySettings = {
      biometricLock: user.privacySettings?.biometricLock ?? true,
      dataEncryption: user.privacySettings?.dataEncryption ?? true,
      analyticsSharing: user.privacySettings?.analyticsSharing ?? false,
      crashReporting: user.privacySettings?.crashReporting ?? true,
      locationAccess: user.privacySettings?.locationAccess ?? true,
    };

    res.json({
      success: true,
      data: privacySettings,
      message: 'Privacy settings retrieved',
    } as ApiResponse<any>);
  } catch (error) {
    console.error('Get privacy settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
});

// @route   PUT /api/users/privacy-settings
// @desc    Update user privacy and security settings
// @access  Private
router.put('/privacy-settings', async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { biometricLock, dataEncryption, analyticsSharing, crashReporting, locationAccess } = req.body;

    const updateData: any = {};
    if (biometricLock !== undefined) updateData['privacySettings.biometricLock'] = biometricLock;
    if (dataEncryption !== undefined) updateData['privacySettings.dataEncryption'] = dataEncryption;
    if (analyticsSharing !== undefined) updateData['privacySettings.analyticsSharing'] = analyticsSharing;
    if (crashReporting !== undefined) updateData['privacySettings.crashReporting'] = crashReporting;
    if (locationAccess !== undefined) updateData['privacySettings.locationAccess'] = locationAccess;

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      } as ApiResponse<null>);
    }

    res.json({
      success: true,
      data: user.privacySettings,
      message: 'Privacy settings updated successfully',
    } as ApiResponse<any>);
  } catch (error) {
    console.error('Update privacy settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
});

// @route   POST /api/users/push-token
// @desc    Save user's push notification token
// @access  Private
router.post('/push-token', async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { pushToken } = req.body;

    if (!pushToken) {
      return res.status(400).json({
        success: false,
        error: 'Push token is required',
      } as ApiResponse<null>);
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { pushToken } },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      } as ApiResponse<null>);
    }

    console.log(`✅ Push token saved for user ${userId}: ${pushToken.substring(0, 20)}...`);

    res.json({
      success: true,
      data: { pushToken: user.pushToken },
      message: 'Push token saved successfully',
    } as ApiResponse<any>);
  } catch (error) {
    console.error('Save push token error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
});

export default router;