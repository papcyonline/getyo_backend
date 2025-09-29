import mongoose, { Document, Schema } from 'mongoose';

export interface ILegalContent extends Document {
  type: 'terms' | 'privacy' | 'combined';
  version: string;
  language: string;
  title: string;
  content: {
    mainTitle?: string;
    subtitle?: string;
    sections: {
      title: string;
      content: string;
      subsections?: {
        title: string;
        content: string;
      }[];
    }[];
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  effectiveDate: Date;
}

export interface IUserLegalAcceptance extends Document {
  userId?: mongoose.Types.ObjectId;
  sessionId?: string;
  legalContentId: mongoose.Types.ObjectId;
  acceptedAt: Date;
  ipAddress?: string;
  userAgent?: string;
  version: string;
  type: 'terms' | 'privacy' | 'combined';
  isAnonymous: boolean;
}

const LegalContentSchema = new Schema<ILegalContent>({
  type: {
    type: String,
    enum: ['terms', 'privacy', 'combined'],
    required: true,
  },
  version: {
    type: String,
    required: true,
  },
  language: {
    type: String,
    required: true,
    default: 'en',
  },
  title: {
    type: String,
    required: true,
  },
  content: {
    mainTitle: String,
    subtitle: String,
    sections: [{
      title: {
        type: String,
        required: true,
      },
      content: {
        type: String,
        required: true,
      },
      subsections: [{
        title: String,
        content: String,
      }],
    }],
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  effectiveDate: {
    type: Date,
    required: true,
    default: Date.now,
  },
}, {
  timestamps: true,
});

const UserLegalAcceptanceSchema = new Schema<IUserLegalAcceptance>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: false,
  },
  sessionId: {
    type: String,
    required: false,
  },
  legalContentId: {
    type: Schema.Types.ObjectId,
    ref: 'LegalContent',
    required: true,
  },
  acceptedAt: {
    type: Date,
    required: true,
    default: Date.now,
  },
  ipAddress: String,
  userAgent: String,
  version: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ['terms', 'privacy', 'combined'],
    required: true,
  },
  isAnonymous: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

// Indexes
LegalContentSchema.index({ type: 1, language: 1, isActive: 1 });
LegalContentSchema.index({ version: 1, type: 1 });
UserLegalAcceptanceSchema.index({ userId: 1, type: 1 });
UserLegalAcceptanceSchema.index({ userId: 1, legalContentId: 1 });
UserLegalAcceptanceSchema.index({ sessionId: 1, type: 1 });
UserLegalAcceptanceSchema.index({ sessionId: 1, legalContentId: 1 });

export const LegalContent = mongoose.model<ILegalContent>('LegalContent', LegalContentSchema);
export const UserLegalAcceptance = mongoose.model<IUserLegalAcceptance>('UserLegalAcceptance', UserLegalAcceptanceSchema);

export default { LegalContent, UserLegalAcceptance };