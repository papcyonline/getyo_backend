import express from 'express';
import { User } from '../models';
import { ApiResponse, PersonalAssistantContext, IUser } from '../types';
import { authenticateToken } from '../middleware/auth';
import { uploadBase64Image, uploadImageBuffer, upload } from '../services/imageUpload';

const router = express.Router();

// @route   POST /api/assistant/setup
// @desc    Set up Personal Assistant name and profile image
// @access  Private
router.post('/setup', authenticateToken, upload.single('profileImage'), async (req: any, res) => {
  try {
    const userId = req.userId;
    const { assistantName, assistantProfileImage } = req.body;

    if (!assistantName || assistantName.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Assistant name must be at least 2 characters long',
      } as ApiResponse<null>);
    }

    if (assistantName.trim().length > 20) {
      return res.status(400).json({
        success: false,
        error: 'Assistant name must be 20 characters or less',
      } as ApiResponse<null>);
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      } as ApiResponse<null>);
    }

    // Update assistant configuration
    const updateData: any = {
      assistantName: assistantName.trim(),
    };

    // Handle profile image upload if provided
    const imageFile = req.file; // From multipart upload
    if (imageFile) {
      console.log('📸 Processing multipart profile image upload...');

      const uploadResult = await uploadImageBuffer(
        imageFile.buffer,
        imageFile.originalname,
        'assistant-profiles'
      );

      if (uploadResult.success && uploadResult.url) {
        updateData.assistantProfileImage = uploadResult.url;
        console.log('✅ Profile image uploaded successfully:', uploadResult.url);
      } else {
        console.error('❌ Failed to upload profile image:', uploadResult.error);
        return res.status(400).json({
          success: false,
          error: `Failed to upload profile image: ${uploadResult.error}`,
        } as ApiResponse<null>);
      }
    } else if (assistantProfileImage) {
      console.log('📸 Processing base64 profile image upload...');

      // Check if it's a base64 data URI (backward compatibility)
      if (assistantProfileImage.startsWith('data:image/')) {
        const uploadResult = await uploadBase64Image(assistantProfileImage, 'assistant-profiles');

        if (uploadResult.success && uploadResult.url) {
          updateData.assistantProfileImage = uploadResult.url;
          console.log('✅ Profile image uploaded successfully:', uploadResult.url);
        } else {
          console.error('❌ Failed to upload profile image:', uploadResult.error);
          return res.status(400).json({
            success: false,
            error: `Failed to upload profile image: ${uploadResult.error}`,
          } as ApiResponse<null>);
        }
      } else {
        // If it's already a URL, keep it as is
        updateData.assistantProfileImage = assistantProfileImage;
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(500).json({
        success: false,
        error: 'Failed to update assistant configuration',
      } as ApiResponse<null>);
    }

    const responseData = {
      assistantName: updatedUser.assistantName,
      assistantProfileImage: updatedUser.assistantProfileImage,
    };

    res.json({
      success: true,
      data: responseData,
      message: 'Personal Assistant setup completed successfully',
    } as ApiResponse<typeof responseData>);
  } catch (error) {
    console.error('Error setting up Personal Assistant:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
});

// @route   GET /api/assistant/setup
// @desc    Get current Personal Assistant setup (name and profile image)
// @access  Private
router.get('/setup', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      } as ApiResponse<null>);
    }

    const setupData = {
      assistantName: user.assistantName || 'Yo!',
      assistantProfileImage: user.assistantProfileImage || null,
    };

    res.json({
      success: true,
      data: setupData,
      message: 'Personal Assistant setup retrieved successfully',
    } as ApiResponse<typeof setupData>);
  } catch (error) {
    console.error('Error getting PA setup:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
});

// @route   GET /api/assistant/context
// @desc    Get Personal Assistant context for the authenticated user
// @access  Private
router.get('/context', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      } as ApiResponse<null>);
    }

    // Build comprehensive PA context
    const paContext: PersonalAssistantContext = {
      userId: user._id.toString(),
      fullName: user.fullName,
      preferredName: user.preferredName,
      title: user.title,
      assistantName: user.assistantName || 'Yo!',
      preferences: user.preferences,
      professionalContext: {
        canMakeReservations: true,
        canBookMeetings: true,
        canHandleProfessionalEmails: !!user.title, // Enable if user has a title
        formalCommunicationStyle: user.preferences.conversationStyle === 'formal' || !!user.title,
      },
    };

    res.json({
      success: true,
      data: paContext,
      message: 'Personal Assistant context retrieved successfully',
    } as ApiResponse<PersonalAssistantContext>);
  } catch (error) {
    console.error('Error getting PA context:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
});

// @route   GET /api/assistant/booking-info
// @desc    Get user information formatted for bookings and reservations
// @access  Private
router.get('/booking-info', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      } as ApiResponse<null>);
    }

    const bookingInfo = {
      // For formal bookings (restaurants, hotels, professional meetings)
      formal: {
        name: user.title ? `${user.title} ${user.fullName}` : user.fullName,
        email: user.email,
        phone: user.phone,
      },
      // For casual bookings (personal appointments, informal meetings)
      casual: {
        name: user.preferredName,
        email: user.email,
        phone: user.phone,
      },
      // Assistant context
      assistant: {
        name: user.assistantName || 'Yo!',
        actingOnBehalfOf: user.fullName,
        communicationStyle: user.preferences.conversationStyle,
      },
    };

    res.json({
      success: true,
      data: bookingInfo,
      message: 'Booking information retrieved successfully',
    } as ApiResponse<typeof bookingInfo>);
  } catch (error) {
    console.error('Error getting booking info:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
});

// @route   POST /api/assistant/update-context
// @desc    Update Personal Assistant contextual preferences
// @access  Private
router.post('/update-context', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { professionalSettings, communicationPreferences } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      } as ApiResponse<null>);
    }

    // Update preferences that affect PA behavior
    const updatedPreferences = { ...user.preferences };

    if (communicationPreferences?.conversationStyle) {
      updatedPreferences.conversationStyle = communicationPreferences.conversationStyle;
    }

    if (communicationPreferences?.reminderStyle) {
      updatedPreferences.reminderStyle = communicationPreferences.reminderStyle;
    }

    await User.findByIdAndUpdate(userId, {
      preferences: updatedPreferences,
    });

    res.json({
      success: true,
      data: updatedPreferences,
      message: 'Personal Assistant context updated successfully',
    } as ApiResponse<typeof updatedPreferences>);
  } catch (error) {
    console.error('Error updating PA context:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
});

// @route   GET /api/assistant/communication-template/:type
// @desc    Get communication templates based on user context
// @access  Private
router.get('/communication-template/:type', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { type } = req.params; // 'formal', 'casual', 'booking', 'meeting'

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      } as ApiResponse<null>);
    }

    const templates = {
      formal: {
        greeting: `Good ${getTimeOfDay()}, this is ${user.assistantName}, ${user.fullName}'s personal assistant.`,
        introduction: `I am reaching out on behalf of ${user.title ? `${user.title} ${user.fullName}` : user.fullName}.`,
        closing: `Best regards,\n${user.assistantName}\nPersonal Assistant to ${user.fullName}`,
      },
      casual: {
        greeting: `Hi! This is ${user.assistantName}, ${user.preferredName}'s assistant.`,
        introduction: `I'm helping ${user.preferredName} with this request.`,
        closing: `Thanks!\n${user.assistantName}`,
      },
      booking: {
        restaurant: `Hello, I'd like to make a reservation for ${user.title ? `${user.title} ${user.fullName}` : user.fullName}.`,
        hotel: `Good ${getTimeOfDay()}, I'm calling to make a booking for ${user.title ? `${user.title} ${user.fullName}` : user.fullName}.`,
        appointment: `Hi, I'd like to schedule an appointment for ${user.preferredName}.`,
      },
      meeting: {
        professional: `I'm writing to schedule a meeting with ${user.title ? `${user.title} ${user.fullName}` : user.fullName}.`,
        casual: `${user.preferredName} would like to set up a meeting.`,
      },
    };

    const template = templates[type as keyof typeof templates];
    if (!template) {
      return res.status(400).json({
        success: false,
        error: 'Invalid template type',
      } as ApiResponse<null>);
    }

    res.json({
      success: true,
      data: template,
      message: 'Communication template retrieved successfully',
    } as ApiResponse<typeof template>);
  } catch (error) {
    console.error('Error getting communication template:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
});

// Helper function to get time of day for greetings
function getTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

export default router;