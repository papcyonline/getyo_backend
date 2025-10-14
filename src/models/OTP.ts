import mongoose, { Document, Schema } from 'mongoose';

export interface IOTP extends Document {
  identifier: string; // phone or email
  code: string;
  type: 'phone' | 'email' | 'reset' | '2fa' | '2fa-login' | 'phone-verification';
  attempts: number;
  expiresAt: Date;
  userId?: string; // Optional: link OTP to specific user
  createdAt: Date;
}

const OTPSchema = new Schema<IOTP>({
  identifier: {
    type: String,
    required: true,
    index: true,
  },
  code: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    required: true,
    enum: ['phone', 'email', 'reset', '2fa', '2fa-login', 'phone-verification'],
  },
  attempts: {
    type: Number,
    default: 0,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true,
    expires: 0, // TTL index - delete when expiresAt is reached
  },
  userId: {
    type: String,
    required: false,
    index: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Compound index for faster lookups
OTPSchema.index({ identifier: 1, type: 1 });

const OTP = mongoose.model<IOTP>('OTP', OTPSchema);

export default OTP;
