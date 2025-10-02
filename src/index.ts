import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import services and utilities
import DatabaseConnection from './utils/database';
import SocketService from './services/SocketService';
import LegalService from './services/LegalService';

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

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for development
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? (process.env.CORS_ORIGINS?.split(',') || '*')
    : (process.env.CORS_ORIGINS?.split(',') || ['http://localhost:8081']),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(morgan('combined'));
app.use(express.json({ limit: '50mb' })); // Large limit for audio data
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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

// Mount API routes
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

async function startServer() {
  try {
    // Connect to database
    console.log('Connecting to database...');
    await DatabaseConnection.connect();

    // Initialize WebSocket service
    console.log('Initializing WebSocket service...');
    SocketService.initialize(server);

    // Initialize default legal content
    console.log('Initializing legal content...');
    await LegalService.initializeDefaultContent();

    // Start the server on all network interfaces (0.0.0.0)
    server.listen({
      port: PORT,
      host: '0.0.0.0'
    }, () => {
      console.log(`
🚀 Yo! Personal Assistant API Server Started
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📡 Server running on: http://0.0.0.0:${PORT}
🌐 Local: http://localhost:${PORT}
📱 Network: http://192.168.1.231:${PORT}
🌍 Environment: ${process.env.NODE_ENV || 'development'}
💾 Database: ${DatabaseConnection.getConnectionStatus() ? '✅ Connected' : '❌ Disconnected'}
⚡ WebSocket: ✅ Active
📱 CORS Origins: ${process.env.CORS_ORIGINS || 'http://localhost:8081'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      `);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(`\n${signal} received. Shutting down gracefully...`);

      server.close(async () => {
        try {
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