import express from 'express';
import { User } from '../models';
import { ApiResponse } from '../types';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// @route   POST /api/onboarding/complete
// @desc    Complete onboarding with user profile and assistant setup
// @access  Private
router.post('/complete', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    const {
      // User profile
      fullName,
      preferredName,
      title,
      phone,
      role,
      challenges,
      workStyle,
      productiveTimes,
      communicationPreference,
      meetingPreference,

      // Assistant setup
      assistantName,
      assistantVoice,
      assistantGender,
    } = req.body;

    // Validate required fields
    if (!fullName || !preferredName || !role || !assistantName) {
      return res.status(400).json({
        success: false,
        error: 'Full name, preferred name, role, and assistant name are required',
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

    // Update user profile
    user.fullName = fullName.trim();
    user.preferredName = preferredName.trim();
    user.title = title?.trim() || undefined;
    user.phone = phone?.trim() || undefined;
    user.name = preferredName.trim(); // Legacy field

    // Update assistant configuration
    user.assistantName = assistantName.trim();
    user.assistantVoice = assistantVoice || 'nova';
    user.assistantGender = assistantGender || 'female';

    // Derive personality traits based on role and work style
    const personalityTraits = derivePersonalityTraits(role, workStyle, communicationPreference);

    // Derive availability from productive times
    const availability = deriveAvailability(productiveTimes);

    // Map challenges to task categories
    const taskCategories = mapChallengesToTaskCategories(challenges);

    // Update agent configuration
    user.agentConfiguration = {
      personality: {
        traits: personalityTraits,
        communicationStyle: mapCommunicationStyle(communicationPreference),
        formality: role === 'CEO/Founder' || role === 'Manager' ? 'professional' : 'casual',
      },
      availability: availability,
      taskPreferences: {
        categories: taskCategories,
        autoSuggest: true,
        prioritizationStyle: workStyle === 'structured' ? 'deadline-driven' : 'flexible',
      },
      learningPreferences: {
        adaptToUserStyle: true,
        contextualLearning: true,
        suggestImprovements: communicationPreference === 'direct',
      },
      privacy: {
        dataRetention: '90-days',
        analyticsSharing: false,
        crossDeviceSync: true,
      },
      aiAssistant: {
        proactiveMode: communicationPreference !== 'gentle',
        smartSuggestions: true,
        voiceCommands: true,
        contextAwareness: 'high',
      },
    };

    // Update preferences
    user.preferences = {
      ...user.preferences,
      conversationStyle: workStyle === 'structured' ? 'formal' : 'casual',
      reminderStyle: mapReminderStyle(communicationPreference),
      voiceEnabled: true,
      theme: 'dark',
      wakeWord: 'Hey Yo',
      language: 'en',
    };

    // Store onboarding metadata for analytics
    (user as any).onboardingData = {
      role,
      challenges,
      workStyle,
      productiveTimes,
      communicationPreference,
      meetingPreference,
      completedAt: new Date(),
    };

    // Mark onboarding as complete
    user.hasCompletedOnboarding = true;

    await user.save();

    const userResponse = {
      id: user._id,
      fullName: user.fullName,
      preferredName: user.preferredName,
      title: user.title,
      name: user.name,
      email: user.email,
      phone: user.phone,
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
      message: 'Onboarding completed successfully! Your assistant is ready.',
    } as ApiResponse<any>);
  } catch (error) {
    console.error('Onboarding completion error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
});

// Helper function to derive personality traits
function derivePersonalityTraits(
  role: string,
  workStyle: string,
  communicationPreference: string
): string[] {
  const traits: string[] = [];

  // Role-based traits
  const roleTraits: Record<string, string[]> = {
    'CEO/Founder': ['professional', 'analytical', 'concise'],
    'Manager': ['professional', 'encouraging', 'detailed'],
    'Developer': ['analytical', 'concise', 'detailed'],
    'Designer': ['friendly', 'encouraging', 'detailed'],
    'Marketer': ['friendly', 'encouraging', 'analytical'],
    'Sales': ['friendly', 'encouraging', 'concise'],
    'Student': ['friendly', 'encouraging', 'detailed'],
    'Freelancer': ['professional', 'friendly', 'concise'],
  };

  traits.push(...(roleTraits[role] || ['professional', 'friendly']));

  // Work style influence
  if (workStyle === 'structured') {
    traits.push('analytical');
  } else if (workStyle === 'flexible') {
    traits.push('encouraging');
  }

  // Communication preference influence
  if (communicationPreference === 'direct') {
    if (!traits.includes('concise')) traits.push('concise');
  } else if (communicationPreference === 'gentle') {
    if (!traits.includes('friendly')) traits.push('friendly');
  }

  // Remove duplicates and limit to 4 traits
  return [...new Set(traits)].slice(0, 4);
}

// Helper function to derive availability
function deriveAvailability(productiveTimes: string[]): any {
  const availability: any = {
    workingHours: { start: '09:00', end: '17:00' },
    quietHours: { start: '22:00', end: '07:00' },
    preferredTimeSlots: [],
    timezone: 'auto',
  };

  // Map productive times to preferred slots
  const timeMapping: Record<string, string> = {
    'early-morning': 'morning',
    'morning': 'morning',
    'afternoon': 'afternoon',
    'evening': 'evening',
    'night': 'night',
  };

  availability.preferredTimeSlots = (productiveTimes || []).map(
    (time: string) => timeMapping[time.toLowerCase()] || time
  );

  // Adjust working hours based on productive times
  if (productiveTimes?.includes('early-morning')) {
    availability.workingHours.start = '06:00';
  }
  if (productiveTimes?.includes('evening') || productiveTimes?.includes('night')) {
    availability.workingHours.end = '21:00';
  }

  return availability;
}

// Helper function to map challenges to task categories
function mapChallengesToTaskCategories(challenges: string[]): string[] {
  const categoryMapping: Record<string, string[]> = {
    'email-overload': ['email', 'communication'],
    'too-many-meetings': ['scheduling', 'meetings'],
    'task-tracking': ['tasks', 'project-management'],
    'time-management': ['scheduling', 'reminders'],
    'context-switching': ['focus', 'tasks'],
    'prioritization': ['tasks', 'decision-making'],
    'team-communication': ['communication', 'collaboration'],
    'meeting-deadlines': ['reminders', 'tasks'],
  };

  const categories = new Set<string>();

  (challenges || []).forEach((challenge: string) => {
    const mapped = categoryMapping[challenge.toLowerCase()] || [];
    mapped.forEach((cat) => categories.add(cat));
  });

  // Add default categories
  categories.add('scheduling');
  categories.add('reminders');

  return Array.from(categories);
}

// Helper function to map communication preference
function mapCommunicationStyle(preference: string): string {
  const mapping: Record<string, string> = {
    'gentle': 'gentle',
    'balanced': 'balanced',
    'direct': 'direct',
  };
  return mapping[preference?.toLowerCase()] || 'balanced';
}

// Helper function to map reminder style
function mapReminderStyle(communicationPreference: string): string {
  const mapping: Record<string, string> = {
    'gentle': 'friendly',
    'balanced': 'friendly',
    'direct': 'formal',
  };
  return mapping[communicationPreference?.toLowerCase()] || 'friendly';
}

export default router;
