import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';

// Validation middleware factory
export const validateRequest = (schema: {
  body?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
  params?: Joi.ObjectSchema;
}) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: any = {};

    // Validate body
    if (schema.body) {
      const { error } = schema.body.validate(req.body, { abortEarly: false });
      if (error) {
        errors.body = error.details.map((detail) => ({
          field: detail.path.join('.'),
          message: detail.message,
        }));
      }
    }

    // Validate query
    if (schema.query) {
      const { error } = schema.query.validate(req.query, { abortEarly: false });
      if (error) {
        errors.query = error.details.map((detail) => ({
          field: detail.path.join('.'),
          message: detail.message,
        }));
      }
    }

    // Validate params
    if (schema.params) {
      const { error } = schema.params.validate(req.params, { abortEarly: false });
      if (error) {
        errors.params = error.details.map((detail) => ({
          field: detail.path.join('.'),
          message: detail.message,
        }));
      }
    }

    // If there are errors, return 400
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors,
      });
    }

    next();
  };
};

// Common validation schemas
export const ValidationSchemas = {
  // Auth schemas
  register: Joi.object({
    name: Joi.string().min(2).max(50).required().messages({
      'string.empty': 'Name is required',
      'string.min': 'Name must be at least 2 characters',
      'string.max': 'Name must not exceed 50 characters',
    }),
    email: Joi.string().email().required().messages({
      'string.empty': 'Email is required',
      'string.email': 'Email must be a valid email address',
    }),
    password: Joi.string().min(6).max(100).required().messages({
      'string.empty': 'Password is required',
      'string.min': 'Password must be at least 6 characters',
      'string.max': 'Password must not exceed 100 characters',
    }),
    phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional().messages({
      'string.pattern.base': 'Phone number must be a valid international format',
    }),
  }),

  registerEnhanced: Joi.object({
    userDetails: Joi.object({
      fullName: Joi.string().min(2).max(100).required(),
      preferredName: Joi.string().min(2).max(50).required(),
      title: Joi.string().max(50).optional().allow(''),
    }).required(),
    email: Joi.string().email().required(),
    phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required(),
    assistantName: Joi.string().min(2).max(50).required(),
    password: Joi.string().min(6).max(100).optional(),
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  }),

  sendOTP: Joi.object({
    phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional(),
    email: Joi.string().email().optional(),
  }).or('phone', 'email'),

  verifyOTP: Joi.object({
    identifier: Joi.string().required(),
    otp: Joi.string().length(6).pattern(/^\d{6}$/).required().messages({
      'string.length': 'OTP must be exactly 6 digits',
      'string.pattern.base': 'OTP must contain only digits',
    }),
    type: Joi.string().valid('phone', 'email').required(),
  }),

  forgotPassword: Joi.object({
    email: Joi.string().email().required(),
  }),

  resetPassword: Joi.object({
    email: Joi.string().email().required(),
    code: Joi.string().length(6).pattern(/^\d{6}$/).required(),
    newPassword: Joi.string().min(6).max(100).required(),
  }),

  changePassword: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().min(6).max(100).required(),
  }),

  // Task schemas
  createTask: Joi.object({
    title: Joi.string().min(1).max(200).required(),
    description: Joi.string().max(1000).optional().allow(''),
    priority: Joi.string().valid('low', 'medium', 'high').default('medium'),
    status: Joi.string().valid('pending', 'in_progress', 'completed').default('pending'),
    dueDate: Joi.date().iso().optional(),
    reminders: Joi.array().items(Joi.date().iso()).optional(),
    tags: Joi.array().items(Joi.string().max(30)).optional(),
  }),

  updateTask: Joi.object({
    title: Joi.string().min(1).max(200).optional(),
    description: Joi.string().max(1000).optional().allow(''),
    priority: Joi.string().valid('low', 'medium', 'high').optional(),
    status: Joi.string().valid('pending', 'in_progress', 'completed').optional(),
    dueDate: Joi.date().iso().optional().allow(null),
    reminders: Joi.array().items(Joi.date().iso()).optional(),
    tags: Joi.array().items(Joi.string().max(30)).optional(),
  }).min(1),

  // Event schemas
  createEvent: Joi.object({
    title: Joi.string().min(1).max(200).required(),
    description: Joi.string().max(1000).optional().allow(''),
    startTime: Joi.date().iso().required(),
    endTime: Joi.date().iso().greater(Joi.ref('startTime')).required().messages({
      'date.greater': 'End time must be after start time',
    }),
    location: Joi.string().max(200).optional().allow(''),
    attendees: Joi.array().items(Joi.string().email()).optional(),
    reminders: Joi.array().items(Joi.date().iso()).optional(),
  }),

  updateEvent: Joi.object({
    title: Joi.string().min(1).max(200).optional(),
    description: Joi.string().max(1000).optional().allow(''),
    startTime: Joi.date().iso().optional(),
    endTime: Joi.date().iso().optional(),
    location: Joi.string().max(200).optional().allow(''),
    attendees: Joi.array().items(Joi.string().email()).optional(),
    reminders: Joi.array().items(Joi.date().iso()).optional(),
  }).min(1),

  // Conversation schemas
  sendMessage: Joi.object({
    message: Joi.string().min(1).max(5000).required(),
    conversationId: Joi.string().optional(),
  }),

  // User schemas
  updateProfile: Joi.object({
    name: Joi.string().min(2).max(50).optional(),
    fullName: Joi.string().min(2).max(100).optional(),
    preferredName: Joi.string().min(2).max(50).optional(),
    title: Joi.string().max(50).optional().allow(''),
    phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional(),
    assistantName: Joi.string().min(2).max(50).optional(),
    assistantGender: Joi.string().valid('male', 'female', 'non-binary').optional(),
    assistantVoice: Joi.string().valid('alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer').optional(),
  }).min(1),

  updatePreferences: Joi.object({
    preferences: Joi.object({
      voiceEnabled: Joi.boolean().optional(),
      reminderStyle: Joi.string().valid('casual', 'formal', 'friendly').optional(),
      dailyBriefingTime: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
      theme: Joi.string().valid('dark', 'light').optional(),
      wakeWord: Joi.string().min(2).max(20).optional(),
      conversationStyle: Joi.string().valid('casual', 'formal').optional(),
      language: Joi.string().length(2).optional(),
    }).required(),
  }),

  // Agent configuration schemas
  updateAgentPersonality: Joi.object({
    traits: Joi.array().items(
      Joi.string().valid('professional', 'friendly', 'concise', 'detailed', 'encouraging', 'analytical')
    ).min(1).required(),
    communicationStyle: Joi.string().valid('casual', 'formal').optional(),
    responseStyle: Joi.string().valid('brief', 'detailed', 'balanced').optional(),
  }),

  updateAgentAvailability: Joi.object({
    alwaysAvailable: Joi.boolean().optional(),
    workingHours: Joi.object({
      enabled: Joi.boolean().required(),
      startTime: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).required(),
      endTime: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).required(),
      timezone: Joi.string().required(),
    }).optional(),
    availableDays: Joi.array().items(
      Joi.string().valid('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')
    ).optional(),
    quietHours: Joi.object({
      enabled: Joi.boolean().required(),
      startTime: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).required(),
      endTime: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).required(),
    }).optional(),
    urgentOnly: Joi.boolean().optional(),
  }),

  // MongoDB ObjectId validation
  objectId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).messages({
    'string.pattern.base': 'Invalid ID format',
  }),
};

// Helper to create param validation
export const validateObjectIdParam = (paramName: string = 'id') => {
  return validateRequest({
    params: Joi.object({
      [paramName]: ValidationSchemas.objectId,
    }),
  });
};