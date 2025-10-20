import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import os from 'os';
import { generalLimiter, authLimiter } from './middleware/rateLimiter';

// Load environment variables
dotenv.config();

console.log('Starting Yo! Backend Server...');
console.log('Node version:', process.version);
console.log('Environment:', process.env.NODE_ENV);
console.log('Port:', process.env.PORT);

// Import services and utilities
import DatabaseConnection from './utils/database';
import SocketService from './services/SocketService';
import LegalService from './services/LegalService';
import JobScheduler from './jobs';
import RedisCacheService from './services/RedisCacheService';

// Import routes
import authRoutes from './routes/auth';
import refreshTokenRoutes from './routes/refreshToken';
import sessionRoutes from './routes/sessions';
import userRoutes from './routes/users';
import voiceRoutes from './routes/voice';
import taskRoutes from './routes/tasks';
import assignmentRoutes from './routes/assignments';
import eventRoutes from './routes/events';
import reminderRoutes from './routes/reminders';
import noteRoutes from './routes/notes';
import voiceNoteRoutes from './routes/voiceNotes';
import notificationRoutes from './routes/notifications';
import conversationRoutes from './routes/conversations';
import feedbackRoutes from './routes/feedback';
import aiRoutes from './routes/ai';
import integrationRoutes from './routes/integrations';
import assistantRoutes from './routes/assistant';
import agentConfigRoutes from './routes/agentConfig';
import legalRoutes from './routes/legal';
import transcriptionRoutes from './routes/transcription';
import onboardingRoutes from './routes/onboarding';
import dataManagementRoutes from './routes/dataManagement';
import searchRoutes from './routes/search';
import emailRoutes from './routes/email';
import meetingRoutes from './routes/meetings';
import googleOAuthRoutes from './routes/googleOAuth';
import gmailRoutes from './routes/gmail';
import googleCalendarRoutes from './routes/googleCalendar';
import patternRoutes from './routes/patterns';

const app = express();
const server = http.createServer(app);

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for development
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: true, // Allow all origins (mobile apps need this)
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

app.use(morgan('combined'));
app.use(express.json({ limit: '50mb' })); // Large limit for audio data
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Apply general rate limiting to all API routes
app.use('/api/', generalLimiter);

// Serve static files (audio uploads)
app.use('/uploads', express.static('uploads'));

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const dbHealth = await DatabaseConnection.healthCheck();

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbHealth,
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// API routes
app.get('/', (req, res) => {
  res.json({
    name: 'Yo! Personal Assistant API',
    version: '1.0.0',
    description: 'AI-powered personal assistant backend',
    documentation: '/api/docs',
  });
});

// Mount API routes (with specific rate limiters)
app.use('/api/auth', authLimiter, authRoutes); // Stricter rate limit for auth
app.use('/api/auth', refreshTokenRoutes);
app.use('/api/auth/sessions', sessionRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/users', userRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/reminders', reminderRoutes);
// Voice notes must be registered BEFORE regular notes to avoid route conflicts
app.use('/api/notes/voice', voiceNoteRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/integrations', integrationRoutes);
app.use('/api/assistant', assistantRoutes);
app.use('/api/agent-config', agentConfigRoutes);
app.use('/api/legal', legalRoutes);
app.use('/api/transcription', transcriptionRoutes);
app.use('/api/data-management', dataManagementRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/oauth/google', googleOAuthRoutes);
app.use('/api/gmail', gmailRoutes);
app.use('/api/google-calendar', googleCalendarRoutes);
app.use('/api/patterns', patternRoutes);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);

  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// Handle 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
  });
});

// Server startup
const PORT = Number(process.env.PORT) || 3000;

// Get the local network IP address
function getNetworkIP(): string {
  const interfaces = os.networkInterfaces();

  // Look for WiFi adapter first (most common for laptops)
  for (const name of Object.keys(interfaces)) {
    if (name.toLowerCase().includes('wi-fi') || name.toLowerCase().includes('wireless')) {
      const iface = interfaces[name];
      if (iface) {
        for (const addr of iface) {
          if (addr.family === 'IPv4' && !addr.internal) {
            return addr.address;
          }
        }
      }
    }
  }

  // Fallback: look for any non-internal IPv4 address
  for (const name of Object.keys(interfaces)) {
    const iface = interfaces[name];
    if (iface) {
      for (const addr of iface) {
        if (addr.family === 'IPv4' && !addr.internal) {
          return addr.address;
        }
      }
    }
  }

  return 'localhost';
}

async function startServer() {
  try {
    // Connect to database
    console.log('Connecting to database...');
    await DatabaseConnection.connect();

    // Initialize Redis cache (optional - continues without it if not configured)
    console.log('Initializing Redis cache...');
    await RedisCacheService.initialize();

    // Initialize WebSocket service
    console.log('Initializing WebSocket service...');
    SocketService.initialize(server);

    // Initialize default legal content
    console.log('Initializing legal content...');
    await LegalService.initializeDefaultContent();

    // Initialize background jobs
    console.log('Initializing background jobs...');
    await JobScheduler.initialize();

    // Start the server on all network interfaces (0.0.0.0)
    server.listen({
      port: PORT,
      host: '0.0.0.0'
    }, () => {
      const networkIP = getNetworkIP();
      console.log(`
🚀 Yo! Personal Assistant API Server Started
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📡 Server running on: http://0.0.0.0:${PORT}
🌐 Local: http://localhost:${PORT}
📱 Network: http://${networkIP}:${PORT}
🌍 Environment: ${process.env.NODE_ENV || 'development'}
💾 Database: ${DatabaseConnection.getConnectionStatus() ? '✅ Connected' : '❌ Disconnected'}
⚡ WebSocket: ✅ Active
⏰ Jobs: ✅ Running (Pattern Detection, Forgotten Activity Check)
📱 CORS Origins: ${process.env.CORS_ORIGINS || 'http://localhost:8081'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      `);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(`\n${signal} received. Shutting down gracefully...`);

      server.close(async () => {
        try {
          // Stop background jobs first
          await JobScheduler.shutdown();
          // Disconnect from Redis
          await RedisCacheService.disconnect();
          // Then disconnect from database
          await DatabaseConnection.disconnect();
          console.log('Server shut down successfully');
          process.exit(0);
        } catch (error) {
          console.error('Error during shutdown:', error);
          process.exit(1);
        }
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        console.error('Force shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Start the server
startServer();