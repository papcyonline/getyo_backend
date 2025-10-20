import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import { IUser } from '../types';

// Agent Personality Configuration
const AgentPersonalitySchema = new Schema({
  traits: [{ type: String, enum: ['professional', 'friendly', 'concise', 'detailed', 'encouraging', 'analytical'] }],
  communicationStyle: { type: String, enum: ['casual', 'formal', 'professional'], default: 'casual' },
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
  // Data Processing & Storage
  localProcessing: { type: Boolean, default: true },
  encryptedStorage: { type: Boolean, default: true },
  dataMinimization: { type: Boolean, default: true },
  conversationHistory: { type: Boolean, default: true },
  autoDelete: { type: Boolean, default: false },
  dataRetentionDays: { type: Number, default: 90 },

  // Security Features
  biometricLock: { type: Boolean, default: false },

  // Permissions
  locationAccess: { type: Boolean, default: false },
  contactsAccess: { type: Boolean, default: false },
  calendarAccess: { type: Boolean, default: true },

  // Analytics & Personalization
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
  // ============================================================================
  // GOOGLE SERVICES
  // ============================================================================
  // Google Services - Single OAuth for all Google services
  google: {
    connected: { type: Boolean, default: false },
    email: { type: String }, // Google account email
    accessToken: { type: String },
    refreshToken: { type: String },
    expiresAt: { type: Date },
    scope: { type: String }, // Granted scopes
    connectedAt: { type: Date },
    lastSyncedAt: { type: Date },
    // Service-specific settings
    services: {
      gmail: { type: Boolean, default: false },
      calendar: { type: Boolean, default: false },
      drive: { type: Boolean, default: false },
      meet: { type: Boolean, default: false },
      contacts: { type: Boolean, default: false },
      photos: { type: Boolean, default: false },
      maps: { type: Boolean, default: false },
    },
  },
  googleCalendar: {
    connected: { type: Boolean, default: false },
    accessToken: { type: String },
    refreshToken: { type: String },
    expiresAt: { type: Date },
    calendarId: { type: String },
    connectedAt: { type: Date },
  },

  // ============================================================================
  // MICROSOFT SERVICES
  // ============================================================================
  microsoft: {
    connected: { type: Boolean, default: false },
    email: { type: String },
    accessToken: { type: String },
    refreshToken: { type: String },
    expiresAt: { type: Date },
    scope: { type: String },
    connectedAt: { type: Date },
    lastSyncedAt: { type: Date },
    services: {
      outlook: { type: Boolean, default: false },
      calendar: { type: Boolean, default: false },
      oneDrive: { type: Boolean, default: false },
      teams: { type: Boolean, default: false },
      contacts: { type: Boolean, default: false },
      todo: { type: Boolean, default: false },
    },
  },
  outlookCalendar: {
    connected: { type: Boolean, default: false },
    accessToken: { type: String },
    refreshToken: { type: String },
    expiresAt: { type: Date },
    email: { type: String },
    name: { type: String },
    connectedAt: { type: Date },
  },

  // ============================================================================
  // APPLE SERVICES (Device-Level)
  // ============================================================================
  appleCalendar: {
    connected: { type: Boolean, default: false },
    connectedAt: { type: Date },
    calendarSource: { type: String },
    permissionGranted: { type: Boolean, default: false },
  },

  // ============================================================================
  // SOCIAL MEDIA INTEGRATIONS
  // ============================================================================
  twitter: {
    connected: { type: Boolean, default: false },
    username: { type: String },
    userId: { type: String },
    accessToken: { type: String },
    refreshToken: { type: String },
    expiresAt: { type: Date },
    connectedAt: { type: Date },
    lastSyncedAt: { type: Date },
    permissions: { type: [String], default: [] }, // ['read', 'write', 'dm']
  },
  linkedin: {
    connected: { type: Boolean, default: false },
    userId: { type: String },
    name: { type: String },
    email: { type: String },
    profileUrl: { type: String },
    accessToken: { type: String },
    refreshToken: { type: String },
    expiresAt: { type: Date },
    connectedAt: { type: Date },
    lastSyncedAt: { type: Date },
    permissions: { type: [String], default: [] },
  },
  facebook: {
    connected: { type: Boolean, default: false },
    userId: { type: String },
    name: { type: String },
    email: { type: String },
    accessToken: { type: String },
    expiresAt: { type: Date },
    connectedAt: { type: Date },
    lastSyncedAt: { type: Date },
    permissions: { type: [String], default: [] },
  },
  instagram: {
    connected: { type: Boolean, default: false },
    userId: { type: String },
    username: { type: String },
    accessToken: { type: String },
    refreshToken: { type: String },
    expiresAt: { type: Date },
    connectedAt: { type: Date },
    lastSyncedAt: { type: Date },
    permissions: { type: [String], default: [] },
  },

  // ============================================================================
  // COMMUNICATION PLATFORMS
  // ============================================================================
  slack: {
    connected: { type: Boolean, default: false },
    teamId: { type: String },
    teamName: { type: String },
    userId: { type: String },
    accessToken: { type: String },
    refreshToken: { type: String },
    botAccessToken: { type: String },
    webhookUrl: { type: String },
    connectedAt: { type: Date },
    lastSyncedAt: { type: Date },
    permissions: { type: [String], default: [] },
  },
  discord: {
    connected: { type: Boolean, default: false },
    userId: { type: String },
    username: { type: String },
    discriminator: { type: String },
    accessToken: { type: String },
    refreshToken: { type: String },
    expiresAt: { type: Date },
    connectedAt: { type: Date },
    lastSyncedAt: { type: Date },
    guilds: [{ type: String }], // Server IDs
  },
  teams: {
    connected: { type: Boolean, default: false },
    userId: { type: String },
    accessToken: { type: String },
    refreshToken: { type: String },
    expiresAt: { type: Date },
    connectedAt: { type: Date },
    lastSyncedAt: { type: Date },
  },
  zoom: {
    connected: { type: Boolean, default: false },
    userId: { type: String },
    email: { type: String },
    accessToken: { type: String },
    refreshToken: { type: String },
    expiresAt: { type: Date },
    connectedAt: { type: Date },
    lastSyncedAt: { type: Date },
    permissions: { type: [String], default: [] },
  },

  // ============================================================================
  // DEVICE INTEGRATIONS (Permissions-based)
  // ============================================================================
  device: {
    // Contacts
    contacts: {
      enabled: { type: Boolean, default: false },
      permissionGranted: { type: Boolean, default: false },
      lastSyncedAt: { type: Date },
      totalContacts: { type: Number, default: 0 },
    },
    // Location
    location: {
      enabled: { type: Boolean, default: false },
      permissionGranted: { type: Boolean, default: false },
      trackingMode: { type: String, enum: ['always', 'whenInUse', 'never'], default: 'never' },
      lastKnownLocation: {
        latitude: { type: Number },
        longitude: { type: Number },
        timestamp: { type: Date },
        accuracy: { type: Number },
      },
    },
    // Photos/Media
    photos: {
      enabled: { type: Boolean, default: false },
      permissionGranted: { type: Boolean, default: false },
      lastSyncedAt: { type: Date },
      totalPhotos: { type: Number, default: 0 },
    },
    // Calendar (Native)
    calendar: {
      enabled: { type: Boolean, default: false },
      permissionGranted: { type: Boolean, default: false },
      lastSyncedAt: { type: Date },
      totalEvents: { type: Number, default: 0 },
    },
    // Microphone
    microphone: {
      enabled: { type: Boolean, default: false },
      permissionGranted: { type: Boolean, default: false },
    },
    // Camera
    camera: {
      enabled: { type: Boolean, default: false },
      permissionGranted: { type: Boolean, default: false },
    },
    // Notifications
    notifications: {
      enabled: { type: Boolean, default: true },
      permissionGranted: { type: Boolean, default: false },
    },
  },

  // ============================================================================
  // EMAIL ACCOUNTS (Multi-provider support)
  // ============================================================================
  emailAccounts: [{
    id: { type: String, required: true },
    provider: { type: String, enum: ['gmail', 'outlook', 'icloud', 'yahoo', 'custom'], required: true },
    email: { type: String, required: true },
    name: { type: String },
    accessToken: { type: String, required: true },
    refreshToken: { type: String },
    expiresAt: { type: Date },
    connectedAt: { type: Date, default: Date.now },
    lastSyncedAt: { type: Date },
    isDefault: { type: Boolean, default: false },
    // Email stats
    stats: {
      totalEmails: { type: Number, default: 0 },
      unreadCount: { type: Number, default: 0 },
      lastEmailAt: { type: Date },
    },
  }],

  // ============================================================================
  // CLOUD STORAGE
  // ============================================================================
  cloudStorage: [{
    id: { type: String, required: true },
    provider: { type: String, enum: ['google_drive', 'onedrive', 'dropbox', 'icloud', 'box'], required: true },
    email: { type: String },
    accessToken: { type: String, required: true },
    refreshToken: { type: String },
    expiresAt: { type: Date },
    connectedAt: { type: Date, default: Date.now },
    lastSyncedAt: { type: Date },
    stats: {
      totalFiles: { type: Number, default: 0 },
      totalSize: { type: Number, default: 0 }, // in bytes
      quotaUsed: { type: Number, default: 0 },
      quotaTotal: { type: Number, default: 0 },
    },
  }],
}, { _id: false });

// Legal Acceptance Schema for Terms & Privacy tracking
const LegalAcceptanceSchema = new Schema({
  termsOfService: {
    accepted: { type: Boolean, default: false },
    version: { type: String }, // e.g., "1.0", "1.1", "2.0"
    acceptedAt: { type: Date },
    ipAddress: { type: String }, // For legal record keeping
  },
  privacyPolicy: {
    accepted: { type: Boolean, default: false },
    version: { type: String },
    acceptedAt: { type: Date },
    ipAddress: { type: String },
  },
  // History of all acceptances (for audit trail)
  acceptanceHistory: [{
    documentType: { type: String, enum: ['terms', 'privacy'] },
    version: String,
    acceptedAt: Date,
    ipAddress: String,
  }],
}, { _id: false });

const UserSchema = new Schema<any>({
  // Enhanced user identity fields
  fullName: { type: String, required: true, trim: true },
  preferredName: { type: String, required: true, trim: true },
  title: { type: String, trim: true },
  name: { type: String, required: true, trim: true }, // Legacy field (set to preferredName for compatibility)
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6 },
  phone: { type: String, trim: true }, // Optional field - not required for registration
  phoneVerified: { type: Boolean, default: false }, // Track if phone number is verified
  profileImage: { type: String, trim: true }, // URL or base64 data for user's profile image
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
  legalAcceptance: { type: LegalAcceptanceSchema, default: () => ({}) },
  // Onboarding status
  hasCompletedOnboarding: { type: Boolean, default: false },
  // Password reset fields
  resetPasswordCode: { type: String },
  resetPasswordExpiry: { type: Date },
  // Two-Factor Authentication
  twoFactorAuth: {
    enabled: { type: Boolean, default: false },
    method: { type: String, enum: ['email', 'sms'], default: 'email' },
    verifiedAt: { type: Date },
  },
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
    phoneVerified: this.phoneVerified,
    profileImage: this.profileImage,
    assistantName: this.assistantName,
    assistantGender: this.assistantGender,
    assistantProfileImage: this.assistantProfileImage,
    preferences: this.preferences,
    integrations: this.integrations,
    legalAcceptance: this.legalAcceptance,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export default mongoose.model<any>('User', UserSchema);