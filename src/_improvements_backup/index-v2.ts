import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import services and utilities
import DatabaseConnection from './utils/database';
import SocketService from './services/SocketService';
import LegalService from './services/LegalService';
import redisService from './services/redisService';
import sentryService from './services/sentryService';

// Import middleware
import { apiLimiter } from './middleware/rateLimiter';

// Import routes
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import voiceRoutes from './routes/voice';
import taskRoutes from './routes/tasks';
import eventRoutes from './routes/events';
import reminderRoutes from './routes/reminders';
import noteRoutes from './routes/notes';
import conversationRoutes from './routes/conversations';
import aiRoutes from './routes/ai';
import integrationRoutes from './routes/integrations';
import assistantRoutes from './routes/assistant';
import agentConfigRoutes from './routes/agentConfig';
import legalRoutes from './routes/legal';
import transcriptionRoutes from './routes/transcription';

const app = express();
const server = http.createServer(app);

// Initialize Sentry first (must be before other middleware)
sentryService.initialize(app);

// Compression middleware for response optimization
app.use(compression());

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for development
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:8081'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Logging middleware
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Body parsing middleware
app.use(express.json({ limit: '50mb' })); // Large limit for audio data
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Apply general rate limiting to all routes
app.use(apiLimiter);

// Sentry user context middleware (after auth)
app.use(sentryService.setUserContextMiddleware());

// Health check endpoint (no rate limit)
app.get('/health', async (req, res) => {
  try {
    const dbHealth = await DatabaseConnection.healthCheck();
    const redisHealth = await redisService.healthCheck();

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbHealth,
      redis: redisHealth,
      environment: process.env.NODE_ENV || 'development',
      version: '2.0.0',
    });
  } catch (error) {
    sentryService.captureException(error as Error);
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Yo! Personal Assistant API',
    version: '2.0.0',
    description: 'AI-powered personal assistant backend',
    improvements: [
      'Redis-based OTP storage',
      'Token blacklist for secure logout',
      'Rate limiting on all endpoints',
      'Request validation with Joi',
      'Sentry error monitoring',
      'Compression middleware',
    ],
    documentation: '/api/docs',
  });
});

// API v1 routes
const API_V1_PREFIX = '/api/v1';

// Mount API routes with versioning
app.use(`${API_V1_PREFIX}/auth`, authRoutes);
app.use(`${API_V1_PREFIX}/users`, userRoutes);
app.use(`${API_V1_PREFIX}/voice`, voiceRoutes);
app.use(`${API_V1_PREFIX}/tasks`, taskRoutes);
app.use(`${API_V1_PREFIX}/events`, eventRoutes);
app.use(`${API_V1_PREFIX}/reminders`, reminderRoutes);
app.use(`${API_V1_PREFIX}/notes`, noteRoutes);
app.use(`${API_V1_PREFIX}/conversations`, conversationRoutes);
app.use(`${API_V1_PREFIX}/ai`, aiRoutes);
app.use(`${API_V1_PREFIX}/integrations`, integrationRoutes);
app.use(`${API_V1_PREFIX}/assistant`, assistantRoutes);
app.use(`${API_V1_PREFIX}/agent-config`, agentConfigRoutes);
app.use(`${API_V1_PREFIX}/legal`, legalRoutes);
app.use(`${API_V1_PREFIX}/transcription`, transcriptionRoutes);

// Legacy routes (backward compatibility - no versioning)
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/integrations', integrationRoutes);
app.use('/api/assistant', assistantRoutes);
app.use('/api/agent-config', agentConfigRoutes);
app.use('/api/legal', legalRoutes);
app.use('/api/transcription', transcriptionRoutes);

// Sentry error handler must be before other error handlers
app.use(sentryService.errorHandler());

// Custom error handling middleware
app.use(sentryService.customErrorMiddleware());

// Handle 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    suggestion: 'Check API documentation or use /api/v1 prefix for versioned endpoints',
  });
});

// Server startup
const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    console.log('🚀 Starting Yo! Personal Assistant API Server v2.0...\n');

    // Connect to database
    console.log('📊 Connecting to database...');
    await DatabaseConnection.connect();
    console.log('✅ Database connected\n');

    // Initialize Redis (will fallback to in-memory if unavailable)
    console.log('🔴 Initializing Redis...');
    const redisHealth = await redisService.healthCheck();
    if (redisHealth.connected) {
      console.log('✅ Redis connected\n');
    } else {
      console.log('⚠️  Redis unavailable - using in-memory fallback\n');
    }

    // Initialize WebSocket service
    console.log('🔌 Initializing WebSocket service...');
    SocketService.initialize(server);
    console.log('✅ WebSocket service initialized\n');

    // Initialize default legal content
    console.log('📜 Initializing legal content...');
    await LegalService.initializeDefaultContent();
    console.log('✅ Legal content initialized\n');

    // Start the server
    server.listen(PORT, () => {
      console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 Yo! Personal Assistant API Server v2.0 Started
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📡 Server:        http://localhost:${PORT}
🌍 Environment:   ${process.env.NODE_ENV || 'development'}
💾 Database:      ${DatabaseConnection.getConnectionStatus() ? '✅ Connected' : '❌ Disconnected'}
🔴 Redis:         ${redisHealth.connected ? '✅ Connected' : '⚠️  In-Memory Fallback'}
⚡ WebSocket:     ✅ Active
📱 CORS Origins:  ${process.env.CORS_ORIGINS || 'http://localhost:8081'}
🔐 Rate Limiting: ✅ Enabled
📊 Sentry:        ${process.env.SENTRY_DSN ? '✅ Enabled' : '⚠️  Disabled'}

🆕 New Features:
   • Redis-based OTP storage with fallback
   • Token blacklist for secure logout
   • Comprehensive rate limiting
   • Request validation (Joi)
   • Error monitoring (Sentry)
   • Response compression
   • API versioning (v1)

📖 API Versions:
   • Legacy:  /api/*
   • v1:      /api/v1/*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      `);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(`\n${signal} received. Shutting down gracefully...`);

      server.close(async () => {
        try {
          // Close Sentry
          await sentryService.close();
          console.log('✅ Sentry closed');

          // Disconnect Redis
          await redisService.disconnect();
          console.log('✅ Redis disconnected');

          // Disconnect database
          await DatabaseConnection.disconnect();
          console.log('✅ Database disconnected');

          console.log('✅ Server shut down successfully');
          process.exit(0);
        } catch (error) {
          console.error('❌ Error during shutdown:', error);
          process.exit(1);
        }
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        console.error('⚠️  Force shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    sentryService.captureException(error as Error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('🔥 Unhandled Rejection at:', promise, 'reason:', reason);
  sentryService.captureException(new Error(`Unhandled Rejection: ${reason}`));
});

process.on('uncaughtException', (error) => {
  console.error('🔥 Uncaught Exception:', error);
  sentryService.captureException(error);
  process.exit(1);
});

// Start the server
startServer();