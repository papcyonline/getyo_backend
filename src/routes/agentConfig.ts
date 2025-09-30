import express from 'express';
import { User } from '../models';
import { ApiResponse } from '../types';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// @route   GET /api/agent-config
// @desc    Get current agent configuration
// @access  Private
router.get('/', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      } as ApiResponse<null>);
    }

    res.json({
      success: true,
      data: user.agentConfiguration,
      message: 'Agent configuration retrieved successfully',
    } as ApiResponse<any>);
  } catch (error) {
    console.error('Error getting agent configuration:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
});

// @route   PUT /api/agent-config/personality
// @desc    Update agent personality configuration
// @access  Private
router.put('/personality', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { traits, communicationStyle, responseStyle } = req.body;

    if (!traits || !Array.isArray(traits)) {
      return res.status(400).json({
        success: false,
        error: 'Personality traits are required and must be an array',
      } as ApiResponse<null>);
    }

    // Validate personality traits
    const validTraits = ['professional', 'friendly', 'concise', 'detailed', 'encouraging', 'analytical'];
    const invalidTraits = traits.filter((trait: string) => !validTraits.includes(trait));

    if (invalidTraits.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Invalid personality traits: ${invalidTraits.join(', ')}`,
      } as ApiResponse<null>);
    }

    const user = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          'agentConfiguration.personality.traits': traits,
          'agentConfiguration.personality.communicationStyle': communicationStyle || 'casual',
          'agentConfiguration.personality.responseStyle': responseStyle || 'balanced',
        }
      },
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
      data: user.agentConfiguration.personality,
      message: 'Agent personality updated successfully',
    } as ApiResponse<any>);
  } catch (error) {
    console.error('Error updating agent personality:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
});

// @route   PUT /api/agent-config/availability
// @desc    Update agent availability configuration
// @access  Private
router.put('/availability', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { alwaysAvailable, workingHours, availableDays, quietHours, urgentOnly, preferredTimeSlots } = req.body;

    const updateData: any = {};

    // Handle alwaysAvailable toggle
    if (typeof alwaysAvailable === 'boolean') {
      updateData['agentConfiguration.availability.alwaysAvailable'] = alwaysAvailable;
    }

    // Handle working hours
    if (workingHours) {
      updateData['agentConfiguration.availability.workingHours'] = workingHours;
    }

    // Handle available days
    if (availableDays) {
      const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      const invalidDays = availableDays.filter((day: string) => !validDays.includes(day));

      if (invalidDays.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Invalid days: ${invalidDays.join(', ')}`,
        } as ApiResponse<null>);
      }

      updateData['agentConfiguration.availability.availableDays'] = availableDays;
    }

    // Handle quiet hours
    if (quietHours) {
      updateData['agentConfiguration.availability.quietHours'] = quietHours;
    }

    // Handle urgent only toggle
    if (typeof urgentOnly === 'boolean') {
      updateData['agentConfiguration.availability.urgentOnly'] = urgentOnly;
    }

    // Handle preferred time slots
    if (preferredTimeSlots && Array.isArray(preferredTimeSlots)) {
      const validSlotIds = ['early_morning', 'morning', 'afternoon', 'evening', 'night'];
      const invalidSlots = preferredTimeSlots.filter((slot: any) => !validSlotIds.includes(slot.id));

      if (invalidSlots.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Invalid time slot IDs: ${invalidSlots.map((s: any) => s.id).join(', ')}`,
        } as ApiResponse<null>);
      }

      updateData['agentConfiguration.availability.preferredTimeSlots'] = preferredTimeSlots;
    }

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
      data: user.agentConfiguration.availability,
      message: 'Agent availability updated successfully',
    } as ApiResponse<any>);
  } catch (error) {
    console.error('Error updating agent availability:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
});

// @route   PUT /api/agent-config/task-categories
// @desc    Update agent task categories configuration
// @access  Private
router.put('/task-categories', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { enabledCategories, priorityOrder } = req.body;

    const validCategories = [
      'scheduling', 'email_management', 'research', 'reminders',
      'travel_planning', 'document_management', 'social_media', 'finance_tracking'
    ];

    if (enabledCategories) {
      const invalidCategories = enabledCategories.filter((cat: string) => !validCategories.includes(cat));

      if (invalidCategories.length > 0) {
        console.error('Invalid task categories received:', invalidCategories);
        return res.status(400).json({
          success: false,
          error: `Invalid task categories: ${invalidCategories.join(', ')}`,
        } as ApiResponse<null>);
      }
    }

    // If neither field is provided, return error
    if (!enabledCategories && !priorityOrder) {
      console.error('No task categories or priority order provided in request body:', req.body);
      return res.status(400).json({
        success: false,
        error: 'Either enabledCategories or priorityOrder must be provided',
      } as ApiResponse<null>);
    }

    const updateData: any = {};

    if (enabledCategories) {
      updateData['agentConfiguration.taskCategories.enabledCategories'] = enabledCategories;
    }

    if (priorityOrder) {
      updateData['agentConfiguration.taskCategories.priorityOrder'] = priorityOrder;
    }

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
      data: user.agentConfiguration.taskCategories,
      message: 'Agent task categories updated successfully',
    } as ApiResponse<any>);
  } catch (error) {
    console.error('Error updating agent task categories:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
});

// @route   PUT /api/agent-config/learning
// @desc    Update agent learning preferences
// @access  Private
router.put('/learning', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { adaptToUserStyle, learnFromInteractions, suggestImprovements, contextualLearning } = req.body;

    const updateData: any = {};

    if (typeof adaptToUserStyle === 'boolean') {
      updateData['agentConfiguration.learning.adaptToUserStyle'] = adaptToUserStyle;
    }

    if (typeof learnFromInteractions === 'boolean') {
      updateData['agentConfiguration.learning.learnFromInteractions'] = learnFromInteractions;
    }

    if (typeof suggestImprovements === 'boolean') {
      updateData['agentConfiguration.learning.suggestImprovements'] = suggestImprovements;
    }

    if (typeof contextualLearning === 'boolean') {
      updateData['agentConfiguration.learning.contextualLearning'] = contextualLearning;
    }

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
      data: user.agentConfiguration.learning,
      message: 'Agent learning preferences updated successfully',
    } as ApiResponse<any>);
  } catch (error) {
    console.error('Error updating agent learning preferences:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
});

// @route   PUT /api/agent-config/privacy
// @desc    Update agent privacy settings
// @access  Private
router.put('/privacy', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { dataRetentionDays, shareAnalytics, personalizeExperience, crossDeviceSync } = req.body;

    const updateData: any = {};

    if (typeof dataRetentionDays === 'number' && dataRetentionDays > 0) {
      updateData['agentConfiguration.privacy.dataRetentionDays'] = dataRetentionDays;
    }

    if (typeof shareAnalytics === 'boolean') {
      updateData['agentConfiguration.privacy.shareAnalytics'] = shareAnalytics;
    }

    if (typeof personalizeExperience === 'boolean') {
      updateData['agentConfiguration.privacy.personalizeExperience'] = personalizeExperience;
    }

    if (typeof crossDeviceSync === 'boolean') {
      updateData['agentConfiguration.privacy.crossDeviceSync'] = crossDeviceSync;
    }

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
      data: user.agentConfiguration.privacy,
      message: 'Agent privacy settings updated successfully',
    } as ApiResponse<any>);
  } catch (error) {
    console.error('Error updating agent privacy settings:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
});


// @route   POST /api/agent-config/complete-setup
// @desc    Mark agent configuration setup as complete
// @access  Private
router.post('/complete-setup', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.userId;

    const user = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          'agentConfiguration.setupCompleted': true,
          hasCompletedOnboarding: true  // Mark full onboarding as complete
        }
      },
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
      data: {
        setupCompleted: user.agentConfiguration.setupCompleted,
        hasCompletedOnboarding: user.hasCompletedOnboarding,
      },
      message: 'Agent setup completed successfully',
    } as ApiResponse<any>);
  } catch (error) {
    console.error('Error completing agent setup:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
});

// @route   POST /api/agent-config/conversation
// @desc    Save conversation interview data and extract preferences
// @access  Private
router.post('/conversation', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { messages, conversationSummary } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        success: false,
        error: 'Conversation messages are required',
      } as ApiResponse<null>);
    }

    // Extract user responses for analysis
    const userResponses = messages
      .filter((msg: any) => msg.type === 'user')
      .map((msg: any) => msg.message);

    // TODO: Use AI to analyze responses and extract preferences
    // For now, we'll set some default smart preferences based on common patterns
    const extractedPreferences = {
      personality: {
        traits: ['friendly', 'professional', 'helpful'],
        communicationStyle: 'casual',
        responseStyle: 'balanced'
      },
      availability: {
        workingHours: {
          enabled: true,
          startTime: '09:00',
          endTime: '17:00',
          timezone: 'UTC'
        },
        quietHours: {
          enabled: true,
          startTime: '22:00',
          endTime: '07:00'
        }
      },
      taskCategories: {
        enabledCategories: ['scheduling', 'email_management', 'reminders', 'research'],
        priorityOrder: ['scheduling', 'reminders', 'email_management', 'research']
      },
      learning: {
        adaptToUserStyle: true,
        learnFromInteractions: true,
        suggestImprovements: true,
        contextualLearning: true
      }
    };

    // Update user's agent configuration with extracted preferences
    const user = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          'agentConfiguration.personality': extractedPreferences.personality,
          'agentConfiguration.availability': extractedPreferences.availability,
          'agentConfiguration.taskCategories': extractedPreferences.taskCategories,
          'agentConfiguration.learning': extractedPreferences.learning,
          'agentConfiguration.conversationData': {
            messages,
            summary: conversationSummary,
            analyzedAt: new Date()
          }
        }
      },
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
      data: {
        extractedPreferences,
        userResponses: userResponses.length,
        configurationUpdated: true
      },
      message: 'Conversation analyzed and preferences updated successfully',
    } as ApiResponse<any>);
  } catch (error) {
    console.error('Error processing conversation:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
});

// @route   GET /api/agent-config/defaults
// @desc    Get default configuration options for agent setup
// @access  Private
router.get('/defaults', authenticateToken, async (req: any, res) => {
  try {
    const defaults = {
      personalityTraits: [
        { id: 'professional', name: 'Professional', description: 'Formal, business-focused communication' },
        { id: 'friendly', name: 'Friendly', description: 'Warm, approachable, and conversational' },
        { id: 'concise', name: 'Concise', description: 'Brief, to-the-point responses' },
        { id: 'detailed', name: 'Detailed', description: 'Thorough explanations and information' },
        { id: 'encouraging', name: 'Encouraging', description: 'Supportive and motivational tone' },
        { id: 'analytical', name: 'Analytical', description: 'Data-driven, logical approach' },
      ],
      taskCategories: [
        { id: 'scheduling', name: 'Scheduling', description: 'Calendar management and appointment booking' },
        { id: 'email_management', name: 'Email Management', description: 'Email organization and responses' },
        { id: 'research', name: 'Research', description: 'Information gathering and analysis' },
        { id: 'reminders', name: 'Reminders', description: 'Task and event reminders' },
        { id: 'travel_planning', name: 'Travel Planning', description: 'Trip organization and booking' },
        { id: 'document_management', name: 'Document Management', description: 'File organization and processing' },
        { id: 'social_media', name: 'Social Media', description: 'Social media management and posting' },
        { id: 'finance_tracking', name: 'Finance Tracking', description: 'Expense tracking and financial management' },
      ],
      communicationStyles: [
        { id: 'casual', name: 'Casual', description: 'Relaxed, informal communication' },
        { id: 'formal', name: 'Formal', description: 'Professional, structured communication' },
      ],
      responseStyles: [
        { id: 'brief', name: 'Brief', description: 'Short, concise responses' },
        { id: 'detailed', name: 'Detailed', description: 'Comprehensive, thorough responses' },
        { id: 'balanced', name: 'Balanced', description: 'Moderate detail level' },
      ],
    };

    res.json({
      success: true,
      data: defaults,
      message: 'Default configuration options retrieved successfully',
    } as ApiResponse<any>);
  } catch (error) {
    console.error('Error getting default options:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
});

// @route   GET /api/agent-config/ai-assistant
// @desc    Get AI Assistant settings
// @access  Private
router.get('/ai-assistant', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      } as ApiResponse<null>);
    }

    // Ensure AI Assistant settings are initialized with defaults if not present
    let aiAssistantSettings = user.agentConfiguration?.aiAssistant;

    if (!aiAssistantSettings || Object.keys(aiAssistantSettings).length === 0) {
      console.log('🔧 Initializing AI Assistant settings with defaults for user:', userId);

      // Initialize with schema defaults
      const defaultSettings = {
        coreAI: {
          proactiveMode: true,
          smartSuggestions: true,
          contextAwareness: true,
          learningMode: true,
          voiceCommands: true,
        },
        taskManagement: {
          autoScheduling: true,
          priorityIntelligence: true,
          deadlineTracking: true,
          followUpReminders: true,
        },
        research: {
          webResearch: true,
          marketAnalysis: false,
          competitorTracking: false,
          newsMonitoring: true,
        },
        communication: {
          emailDrafting: true,
          meetingScheduling: true,
          contactManagement: true,
          socialMediaMonitoring: false,
        },
        intelligenceLevels: {
          creativityLevel: 0.7,
          formalityLevel: 0.5,
          proactivityLevel: 0.8,
        },
      };

      // Update user with default settings
      await User.findByIdAndUpdate(userId, {
        $set: {
          'agentConfiguration.aiAssistant': defaultSettings,
        },
      });

      aiAssistantSettings = defaultSettings;
      console.log('✅ AI Assistant settings initialized with defaults');
    }

    res.json({
      success: true,
      data: aiAssistantSettings,
      message: 'AI Assistant settings retrieved successfully',
    } as ApiResponse<any>);
  } catch (error) {
    console.error('Error getting AI Assistant settings:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
});

// @route   PUT /api/agent-config/ai-assistant
// @desc    Update AI Assistant settings
// @access  Private
router.put('/ai-assistant', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { coreAI, taskManagement, research, communication, intelligenceLevels } = req.body;

    const updateData: any = {};
    if (coreAI) updateData['agentConfiguration.aiAssistant.coreAI'] = coreAI;
    if (taskManagement) updateData['agentConfiguration.aiAssistant.taskManagement'] = taskManagement;
    if (research) updateData['agentConfiguration.aiAssistant.research'] = research;
    if (communication) updateData['agentConfiguration.aiAssistant.communication'] = communication;
    if (intelligenceLevels) updateData['agentConfiguration.aiAssistant.intelligenceLevels'] = intelligenceLevels;

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
      data: user.agentConfiguration.aiAssistant,
      message: 'AI Assistant settings updated successfully',
    } as ApiResponse<any>);
  } catch (error) {
    console.error('Error updating AI Assistant settings:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
});

// @route   PUT /api/agent-config/ai-assistant/toggle
// @desc    Toggle individual AI Assistant setting
// @access  Private
router.put('/ai-assistant/toggle', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { category, setting, value } = req.body;

    if (!category || !setting || value === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Category, setting, and value are required',
      } as ApiResponse<null>);
    }

    const updatePath = `agentConfiguration.aiAssistant.${category}.${setting}`;

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { [updatePath]: value } },
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
      data: user.agentConfiguration.aiAssistant,
      message: 'Setting toggled successfully',
    } as ApiResponse<any>);
  } catch (error) {
    console.error('Error toggling AI Assistant setting:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
});

export default router;