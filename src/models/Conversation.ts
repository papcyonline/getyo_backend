import mongoose, { Schema } from 'mongoose';
import { IConversation, IMessage } from '../types';

const MessageSchema = new Schema<IMessage>({
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  audioUrl: { type: String },
  metadata: {
    duration: { type: Number },
    confidence: { type: Number },
    actionItems: [{ type: String }],
  },
}, { _id: true });

const ConversationSchema = new Schema<IConversation>({
  userId: { type: String, required: true, index: true },
  title: { type: String },
  messages: [MessageSchema],
  context: { type: Schema.Types.Mixed, default: {} },
}, {
  timestamps: true,
});

// Index for efficient querying
ConversationSchema.index({ userId: 1, updatedAt: -1 });

// Virtual for last message
ConversationSchema.virtual('lastMessage').get(function() {
  return this.messages[this.messages.length - 1];
});

// Virtual for message count
ConversationSchema.virtual('messageCount').get(function() {
  return this.messages.length;
});

// Method to add a message
ConversationSchema.methods.addMessage = function(
  role: 'user' | 'assistant',
  content: string,
  audioUrl?: string,
  metadata?: any
) {
  const message = {
    role,
    content,
    audioUrl,
    metadata,
    timestamp: new Date(),
  };
  this.messages.push(message);
  return this.save();
};

// Method to update context
ConversationSchema.methods.updateContext = function(newContext: Record<string, any>) {
  this.context = { ...this.context, ...newContext };
  return this.save();
};

// Static method to get user's conversations
ConversationSchema.statics.getUserConversations = function(userId: string, limit: number = 20) {
  return this.find({ userId })
    .sort({ updatedAt: -1 })
    .limit(limit);
};

// Static method to create a new conversation
ConversationSchema.statics.createConversation = function(
  userId: string,
  initialMessage?: { role: 'user' | 'assistant'; content: string; audioUrl?: string }
) {
  const conversation = new this({ userId, messages: [] });

  if (initialMessage) {
    conversation.messages.push({
      ...initialMessage,
      timestamp: new Date(),
    } as any);
  }

  return conversation.save();
};

// Pre-save middleware to update timestamps
ConversationSchema.pre('save', function(next) {
  if (this.isModified('messages')) {
    this.updatedAt = new Date();
  }
  next();
});

export default mongoose.model<IConversation>('Conversation', ConversationSchema);