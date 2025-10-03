import mongoose, { Document, Schema } from 'mongoose';

export interface IOTP extends Document {
  identifier: string; // phone or email
  code: string;
  type: 'phone' | 'email' | 'reset';
  attempts: number;
  expiresAt: Date;
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
    enum: ['phone', 'email', 'reset'],
  },
  attempts: {
    type: Number,
    default: 0,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 600, // Auto-delete after 10 minutes (TTL index)
  },
});

// Compound index for faster lookups
OTPSchema.index({ identifier: 1, type: 1 });

const OTP = mongoose.model<IOTP>('OTP', OTPSchema);

export default OTP;
