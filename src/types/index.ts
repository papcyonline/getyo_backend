import { Document } from 'mongoose';
import { Request } from 'express';

export interface IUser extends Document {
  _id: string;
  // Enhanced user identity fields
  fullName: string;
  preferredName: string;
  title?: string;
  name: string; // Legacy field for backward compatibility
  email: string;
  password: string;
  phone?: string;
  assistantName?: string;
  assistantProfileImage?: string;
  preferences: UserPreferences;
  integrations: UserIntegrations;
  // Password reset fields
  resetPasswordCode?: string;
  resetPasswordExpiry?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPreferences {
  voiceEnabled: boolean;
  reminderStyle: 'casual' | 'formal' | 'friendly';
  dailyBriefingTime: string;
  theme: 'dark' | 'light';
  wakeWord: string;
  conversationStyle: 'casual' | 'formal';
  language: string; // ISO 639-1 language code (e.g., 'en', 'es', 'fr')
}

export interface UserIntegrations {
  googleCalendar?: {
    connected: boolean;
    refreshToken?: string;
    connectedAt?: Date;
  };
  appleCalendar?: {
    connected: boolean;
    connectedAt?: Date;
  };
}

export interface ITask extends Document {
  _id: string;
  userId: string;
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'completed';
  dueDate?: Date;
  reminders: Date[];
  tags: string[];
  createdBy: 'user' | 'ai_suggestion';
  createdAt: Date;
  updatedAt: Date;
}

export interface IEvent extends Document {
  _id: string;
  userId: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  attendees: string[];
  reminders: Date[];
  source: 'manual' | 'google_cal' | 'apple_cal';
  createdAt: Date;
  updatedAt: Date;
}

export interface IMessage extends Document {
  _id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  audioUrl?: string;
  metadata?: {
    duration?: number;
    confidence?: number;
    actionItems?: string[];
  };
}

export interface IConversation extends Document {
  _id: string;
  userId: string;
  title?: string;
  messages: IMessage[];
  context: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  addMessage(role: 'user' | 'assistant', content: string, audioUrl?: string, metadata?: any): Promise<IConversation>;
  updateContext(newContext: Record<string, any>): Promise<IConversation>;
}

export interface ITranscript extends Document {
  _id: string;
  userId: string;
  title: string;
  content: string;
  actionItems: string[];
  participants: string[];
  duration: number;
  recordedAt: Date;
  createdAt: Date;
}

export interface AuthPayload {
  userId: string;
  email: string;
  iat: number;
  exp: number;
}

export interface AuthRequest extends Request {
  user?: any;
  userId?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface VoiceProcessingRequest {
  audioData: Buffer;
  userId: string;
  conversationId?: string;
}

export interface VoiceProcessingResponse {
  transcription: string;
  confidence: number;
  duration: number;
  intent?: {
    type: string;
    entities?: Record<string, any>;
  };
}

export interface AIResponse {
  content: string;
  actionItems?: string[];
  suggestions?: string[];
  context?: Record<string, any>;
}

export interface NotificationPayload {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  scheduledTime?: Date;
}

// Enhanced registration interfaces
export interface UserDetailsData {
  fullName: string;
  preferredName: string;
  title?: string;
}

export interface RegistrationRequest {
  userDetails: UserDetailsData;
  email: string;
  phone: string;
  assistantName: string;
  password?: string; // Optional for now, could be generated
}

export interface PersonalAssistantContext {
  userId: string;
  fullName: string;
  preferredName: string;
  title?: string;
  assistantName: string;
  preferences: UserPreferences;
  professionalContext: {
    canMakeReservations: boolean;
    canBookMeetings: boolean;
    canHandleProfessionalEmails: boolean;
    formalCommunicationStyle: boolean;
  };
}