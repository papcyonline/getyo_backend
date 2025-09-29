import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import { IUser } from '../types';

// Agent Personality Configuration
const AgentPersonalitySchema = new Schema({
  traits: [{ type: String, enum: ['professional', 'friendly', 'concise', 'detailed', 'encouraging', 'analytical'] }],
  communicationStyle: { type: String, enum: ['casual', 'formal'], default: 'casual' },
  responseStyle: { type: String, enum: ['brief', 'detailed', 'balanced'], default: 'balanced' },
}, { _id: false });

// Agent Availability Configuration
const AgentAvailabilitySchema = new Schema({
  alwaysAvailable: { type: Boolean, default: false },
  workingHours: {
    enabled: { type: Boolean, default: false },
    startTime: { type: String, default: '09:00' },
    endTime: { type: String, default: '17:00' },
    timezone: { type: String, default: 'UTC' },
  },
  availableDays: [{ type: String, enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] }],
  quietHours: {
    enabled: { type: Boolean, default: true },
    startTime: { type: String, default: '22:00' },
    endTime: { type: String, default: '07:00' },
  },
  urgentOnly: { type: Boolean, default: false },
  preferredTimeSlots: [{
    id: { type: String, enum: ['early_morning', 'morning', 'afternoon', 'evening', 'night'] },
    label: String,
    time: String,
    selected: { type: Boolean, default: false }
  }],
}, { _id: false });

// Agent Task Categories Configuration
const AgentTaskCategoriesSchema = new Schema({
  enabledCategories: [{
    type: String,
    enum: ['scheduling', 'email_management', 'research', 'reminders', 'travel_planning', 'document_management', 'social_media', 'finance_tracking']
  }],
  priorityOrder: [String], // Ordered list of category priorities
}, { _id: false });

// Agent Learning Preferences
const AgentLearningSchema = new Schema({
  adaptToUserStyle: { type: Boolean, default: true },
  learnFromInteractions: { type: Boolean, default: true },
  suggestImprovements: { type: Boolean, default: true },
  contextualLearning: { type: Boolean, default: true },
}, { _id: false });

// Agent Privacy Settings
const AgentPrivacySchema = new Schema({
  dataRetentionDays: { type: Number, default: 90 },
  shareAnalytics: { type: Boolean, default: false },
  personalizeExperience: { type: Boolean, default: true },
  crossDeviceSync: { type: Boolean, default: true },
}, { _id: false });


// AI Assistant Settings Schema
const AIAssistantSettingsSchema = new Schema({
  // Core AI Capabilities
  coreAI: {
    proactiveMode: { type: Boolean, default: true },
    smartSuggestions: { type: Boolean, default: true },
    contextAwareness: { type: Boolean, default: true },
    learningMode: { type: Boolean, default: true },
    voiceCommands: { type: Boolean, default: true },
  },
  // Task Management
  taskManagement: {
    autoScheduling: { type: Boolean, default: true },
    priorityIntelligence: { type: Boolean, default: true },
    deadlineTracking: { type: Boolean, default: true },
    followUpReminders: { type: Boolean, default: true },
  },
  // Research & Intelligence
  research: {
    webResearch: { type: Boolean, default: true },
    marketAnalysis: { type: Boolean, default: false },
    competitorTracking: { type: Boolean, default: false },
    newsMonitoring: { type: Boolean, default: true },
  },
  // Communication & Outreach
  communication: {
    emailDrafting: { type: Boolean, default: true },
    meetingScheduling: { type: Boolean, default: true },
    contactManagement: { type: Boolean, default: true },
    socialMediaMonitoring: { type: Boolean, default: false },
  },
  // Intelligence Levels
  intelligenceLevels: {
    creativityLevel: { type: Number, default: 0.7, min: 0, max: 1 },
    formalityLevel: { type: Number, default: 0.5, min: 0, max: 1 },
    proactivityLevel: { type: Number, default: 0.8, min: 0, max: 1 },
  },
}, { _id: false });

// Complete Agent Configuration
const AgentConfigurationSchema = new Schema({
  personality: { type: AgentPersonalitySchema, default: () => ({}) },
  availability: { type: AgentAvailabilitySchema, default: () => ({}) },
  taskCategories: { type: AgentTaskCategoriesSchema, default: () => ({}) },
  learning: { type: AgentLearningSchema, default: () => ({}) },
  privacy: { type: AgentPrivacySchema, default: () => ({}) },
  aiAssistant: { type: AIAssistantSettingsSchema, default: () => ({}) },
  setupCompleted: { type: Boolean, default: false },
  conversationData: {
    messages: [{
      id: String,
      type: { type: String, enum: ['ai', 'user'] },
      message: String,
      timestamp: Date
    }],
    summary: String,
    analyzedAt: Date
  },
}, { _id: false });

// User Preferences (Basic Settings)
const UserPreferencesSchema = new Schema({
  voiceEnabled: { type: Boolean, default: true },
  reminderStyle: { type: String, enum: ['casual', 'formal', 'friendly'], default: 'friendly' },
  dailyBriefingTime: { type: String, default: '08:00' },
  theme: { type: String, enum: ['dark', 'light'], default: 'dark' },
  wakeWord: { type: String, default: 'yo' },
  conversationStyle: { type: String, enum: ['casual', 'formal'], default: 'casual' },
  language: { type: String, default: 'en' }, // ISO 639-1 language code
}, { _id: false });

const UserIntegrationsSchema = new Schema({
  googleCalendar: {
    connected: { type: Boolean, default: false },
    accessToken: { type: String },
    refreshToken: { type: String },
    expiresAt: { type: Date },
    calendarId: { type: String },
    connectedAt: { type: Date },
  },
  appleCalendar: {
    connected: { type: Boolean, default: false },
    connectedAt: { type: Date },
    calendarSource: { type: String },
    permissionGranted: { type: Boolean, default: false },
  },
}, { _id: false });

const UserSchema = new Schema<any>({
  // Enhanced user identity fields
  fullName: { type: String, required: true, trim: true },
  preferredName: { type: String, required: true, trim: true },
  title: { type: String, trim: true },
  name: { type: String, required: true, trim: true }, // Legacy field (set to preferredName for compatibility)
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6 },
  phone: { type: String, trim: true },
  assistantName: { type: String, trim: true },
  assistantGender: { type: String, enum: ['male', 'female', 'non-binary'], default: 'female' },
  assistantVoice: {
    type: String,
    enum: [
      'alloy', // Neutral
      'echo', // Male 1
      'fable', // British male
      'onyx', // Deep male
      'nova', // Female 1
      'shimmer' // Female 2
    ],
    default: 'nova'
  },
  assistantProfileImage: { type: String, trim: true }, // URL or base64 data for assistant's profile image
  preferences: { type: UserPreferencesSchema, default: () => ({}) },
  agentConfiguration: { type: AgentConfigurationSchema, default: () => ({}) },
  integrations: { type: UserIntegrationsSchema, default: () => ({}) },
  // Onboarding status
  hasCompletedOnboarding: { type: Boolean, default: false },
  // Password reset fields
  resetPasswordCode: { type: String },
  resetPasswordExpiry: { type: Date },
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc: any, ret: any) {
      const { password, ...userObject } = ret;
      return userObject;
    },
  },
});

// Hash password before saving
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    (this as any).password = await bcrypt.hash((this as any).password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

// Compare password method
UserSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, (this as any).password);
};

// Remove sensitive data when converting to JSON
UserSchema.methods.toAuthJSON = function() {
  return {
    id: this._id,
    fullName: this.fullName,
    preferredName: this.preferredName,
    title: this.title,
    name: this.name, // Legacy field
    email: this.email,
    phone: this.phone,
    assistantName: this.assistantName,
    assistantGender: this.assistantGender,
    assistantProfileImage: this.assistantProfileImage,
    preferences: this.preferences,
    integrations: this.integrations,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export default mongoose.model<any>('User', UserSchema);