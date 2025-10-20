import mongoose, { Schema, Document } from 'mongoose';

/**
 * USER PROFILE - Persistent Learning & Personalization
 *
 * This model stores everything the PA learns about the user over time:
 * - Communication preferences (tone, length, formality)
 * - Behavioral patterns (work hours, habits, routines)
 * - Relationships (family, colleagues, friends)
 * - Preferences (liked/disliked suggestions)
 * - Context (projects, goals, interests)
 *
 * This is injected into AI prompts for truly personalized responses.
 */

export interface IUserProfile extends Document {
  userId: mongoose.Types.ObjectId;

  // Communication Preferences
  communicationStyle: 'casual' | 'formal' | 'balanced';
  responseLength: 'brief' | 'detailed' | 'balanced';
  proactivityLevel: number; // 1-5: How pushy should PA be?
  preferredGreeting: string;
  tonePreference: 'friendly' | 'professional' | 'energetic' | 'calm';

  // Learned Behavioral Patterns
  workHours: {
    enabled: boolean;
    start: string; // "09:00"
    end: string; // "17:00"
    timezone: string;
    workDays: number[]; // [1,2,3,4,5] = Mon-Fri
  };
  sleepSchedule: {
    enabled: boolean;
    bedtime: string; // "22:30"
    wakeTime: string; // "07:00"
  };
  lunchTime: {
    enabled: boolean;
    time: string; // "12:30"
    duration: number; // minutes
  };

  // Common Activities & Habits
  commonTasks: Array<{
    title: string;
    frequency: 'daily' | 'weekly' | 'monthly';
    preferredTime: string;
    priority: 'low' | 'medium' | 'high';
    automationOffered: boolean;
    automationAccepted: boolean;
  }>;

  // Relationships
  relationships: Array<{
    name: string;
    relation: 'spouse' | 'partner' | 'parent' | 'child' | 'sibling' | 'boss' | 'colleague' | 'friend' | 'client' | 'other';
    contactFrequency: 'daily' | 'weekly' | 'monthly' | 'rarely';
    preferredCommunication: 'call' | 'text' | 'email' | 'in-person';
    importanceLevel: number; // 1-5
    notes: string;
  }>;

  // User Preferences & Learning
  preferredApps: string[]; // ['Gmail', 'Google Calendar', 'Slack']
  favoriteLocations: Array<{
    name: string;
    address: string;
    type: 'home' | 'work' | 'gym' | 'restaurant' | 'other';
  }>;
  interests: string[]; // ['technology', 'fitness', 'travel']
  projects: Array<{
    name: string;
    status: 'active' | 'paused' | 'completed';
    priority: 'low' | 'medium' | 'high';
    deadline?: Date;
  }>;

  // Feedback & Learning
  likedSuggestions: string[]; // Suggestions user approved
  dislikedSuggestions: string[]; // Suggestions user rejected
  forbiddenTopics: string[]; // Topics user asked to stop suggesting
  successfulActions: number; // Count of actions that helped user
  failedActions: number; // Count of actions that didn't help

  // Context & Memory
  currentGoals: string[];
  upcomingEvents: string[];
  recentTopics: string[];

  // Metadata
  lastUpdated: Date;
  learningScore: number; // 0-100: How well PA knows this user
  interactionCount: number;
}

const UserProfileSchema = new Schema<IUserProfile>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true,
  },

  // Communication Preferences
  communicationStyle: {
    type: String,
    enum: ['casual', 'formal', 'balanced'],
    default: 'balanced',
  },
  responseLength: {
    type: String,
    enum: ['brief', 'detailed', 'balanced'],
    default: 'balanced',
  },
  proactivityLevel: {
    type: Number,
    min: 1,
    max: 5,
    default: 3,
  },
  preferredGreeting: {
    type: String,
    default: 'Hey Boss!',
  },
  tonePreference: {
    type: String,
    enum: ['friendly', 'professional', 'energetic', 'calm'],
    default: 'friendly',
  },

  // Behavioral Patterns
  workHours: {
    enabled: { type: Boolean, default: false },
    start: { type: String, default: '09:00' },
    end: { type: String, default: '17:00' },
    timezone: { type: String, default: 'UTC' },
    workDays: { type: [Number], default: [1, 2, 3, 4, 5] }, // Mon-Fri
  },
  sleepSchedule: {
    enabled: { type: Boolean, default: false },
    bedtime: { type: String, default: '22:30' },
    wakeTime: { type: String, default: '07:00' },
  },
  lunchTime: {
    enabled: { type: Boolean, default: false },
    time: { type: String, default: '12:30' },
    duration: { type: Number, default: 60 },
  },

  // Common Activities
  commonTasks: [{
    title: { type: String, required: true },
    frequency: { type: String, enum: ['daily', 'weekly', 'monthly'], required: true },
    preferredTime: { type: String, required: true },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    automationOffered: { type: Boolean, default: false },
    automationAccepted: { type: Boolean, default: false },
  }],

  // Relationships
  relationships: [{
    name: { type: String, required: true },
    relation: {
      type: String,
      enum: ['spouse', 'partner', 'parent', 'child', 'sibling', 'boss', 'colleague', 'friend', 'client', 'other'],
      required: true,
    },
    contactFrequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'rarely'],
      default: 'weekly',
    },
    preferredCommunication: {
      type: String,
      enum: ['call', 'text', 'email', 'in-person'],
      default: 'call',
    },
    importanceLevel: { type: Number, min: 1, max: 5, default: 3 },
    notes: { type: String, default: '' },
  }],

  // Preferences
  preferredApps: [{ type: String }],
  favoriteLocations: [{
    name: { type: String, required: true },
    address: { type: String, required: true },
    type: { type: String, enum: ['home', 'work', 'gym', 'restaurant', 'other'], default: 'other' },
  }],
  interests: [{ type: String }],
  projects: [{
    name: { type: String, required: true },
    status: { type: String, enum: ['active', 'paused', 'completed'], default: 'active' },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    deadline: { type: Date },
  }],

  // Feedback & Learning
  likedSuggestions: [{ type: String }],
  dislikedSuggestions: [{ type: String }],
  forbiddenTopics: [{ type: String }],
  successfulActions: { type: Number, default: 0 },
  failedActions: { type: Number, default: 0 },

  // Context
  currentGoals: [{ type: String }],
  upcomingEvents: [{ type: String }],
  recentTopics: [{ type: String }],

  // Metadata
  lastUpdated: { type: Date, default: Date.now },
  learningScore: { type: Number, default: 0, min: 0, max: 100 },
  interactionCount: { type: Number, default: 0 },
}, {
  timestamps: true,
});

// Update lastUpdated on save
UserProfileSchema.pre('save', function(next) {
  this.lastUpdated = new Date();
  next();
});

// Calculate learning score based on data completeness
UserProfileSchema.methods.calculateLearningScore = function(): number {
  let score = 0;

  // Basic info (20 points)
  if (this.communicationStyle !== 'balanced') score += 5;
  if (this.responseLength !== 'balanced') score += 5;
  if (this.preferredGreeting !== 'Hey Boss!') score += 5;
  if (this.proactivityLevel !== 3) score += 5;

  // Behavioral patterns (30 points)
  if (this.workHours.enabled) score += 10;
  if (this.sleepSchedule.enabled) score += 10;
  if (this.lunchTime.enabled) score += 10;

  // Relationships (20 points)
  score += Math.min(this.relationships.length * 4, 20);

  // Common tasks & habits (15 points)
  score += Math.min(this.commonTasks.length * 3, 15);

  // Interests & context (15 points)
  score += Math.min(this.interests.length * 2, 10);
  score += Math.min(this.projects.length * 2, 5);

  return Math.min(score, 100);
};

// Generate summary for AI prompt injection
UserProfileSchema.methods.generateAIPromptSummary = function(): string {
  const parts: string[] = [];

  // Communication style
  if (this.communicationStyle !== 'balanced') {
    parts.push(`- Communication: ${this.communicationStyle}, ${this.responseLength} responses`);
  }

  // Work hours
  if (this.workHours.enabled) {
    parts.push(`- Works ${this.workHours.start}-${this.workHours.end} on weekdays`);
  }

  // Sleep schedule
  if (this.sleepSchedule.enabled) {
    parts.push(`- Sleeps ${this.sleepSchedule.bedtime}-${this.sleepSchedule.wakeTime}`);
  }

  // Important relationships
  const importantRelations = this.relationships.filter((r: any) => r.importanceLevel >= 4);
  if (importantRelations.length > 0) {
    const relationSummary = importantRelations.map((r: any) => `${r.name} (${r.relation})`).join(', ');
    parts.push(`- Important people: ${relationSummary}`);
  }

  // Common activities
  const dailyTasks = this.commonTasks.filter((t: any) => t.frequency === 'daily');
  if (dailyTasks.length > 0) {
    const taskSummary = dailyTasks.map((t: any) => `${t.title} at ${t.preferredTime}`).join(', ');
    parts.push(`- Daily routine: ${taskSummary}`);
  }

  // Forbidden topics
  if (this.forbiddenTopics.length > 0) {
    parts.push(`- DON'T suggest: ${this.forbiddenTopics.join(', ')}`);
  }

  // Current projects
  const activeProjects = this.projects.filter((p: any) => p.status === 'active');
  if (activeProjects.length > 0) {
    parts.push(`- Working on: ${activeProjects.map((p: any) => p.name).join(', ')}`);
  }

  return parts.length > 0 ? parts.join('\n') : '';
};

export default mongoose.model<IUserProfile>('UserProfile', UserProfileSchema);
