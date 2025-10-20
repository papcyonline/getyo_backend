/**
 * CENTRALIZED LOGGING SERVICE
 *
 * Provides structured logging throughout the application using Winston.
 *
 * Features:
 * - Multiple log levels (error, warn, info, http, debug)
 * - File-based logging with rotation
 * - Console logging with colors (development)
 * - Structured JSON format for production
 * - Request ID tracking
 * - Timestamp on all logs
 *
 * Usage:
 * ```typescript
 * import logger from './utils/logger';
 *
 * logger.info('User logged in', { userId: '123', email: 'user@example.com' });
 * logger.error('Failed to send email', { error: err.message, stack: err.stack });
 * logger.warn('High memory usage', { usage: '85%' });
 * ```
 */

import winston from 'winston';
import path from 'path';
import fs from 'fs';

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

// Tell winston about our colors
winston.addColors(colors);

// Determine log level based on environment
const level = () => {
  const env = process.env.NODE_ENV || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : 'info';
};

// Custom format for console output (development)
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...meta } = info;

    let metaStr = '';
    if (Object.keys(meta).length > 0) {
      // Remove internal winston properties
      const { splat, ...cleanMeta } = meta;
      if (Object.keys(cleanMeta).length > 0) {
        metaStr = '\n' + JSON.stringify(cleanMeta, null, 2);
      }
    }

    return `[${timestamp}] ${level}: ${message}${metaStr}`;
  })
);

// Custom format for file output (production)
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create the logger instance
const logger = winston.createLogger({
  level: level(),
  levels,
  transports: [
    // Error log file - only errors
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),

    // Combined log file - all logs
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),

    // HTTP requests log (useful for debugging API calls)
    new winston.transports.File({
      filename: path.join(logsDir, 'http.log'),
      level: 'http',
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 3,
    }),
  ],

  // Handle exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log'),
      format: fileFormat,
    }),
  ],

  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log'),
      format: fileFormat,
    }),
  ],
});

// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
  }));
}

// Create a stream object for Morgan HTTP logger integration
export const morganStream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

// Helper methods for common logging patterns

/**
 * Log user activity
 */
export const logUserActivity = (userId: string, action: string, metadata?: any) => {
  logger.info(`User Activity: ${action}`, {
    userId,
    action,
    ...metadata,
  });
};

/**
 * Log API requests
 */
export const logApiRequest = (method: string, path: string, userId?: string, metadata?: any) => {
  logger.http(`${method} ${path}`, {
    method,
    path,
    userId,
    ...metadata,
  });
};

/**
 * Log errors with stack trace
 */
export const logError = (message: string, error: Error, context?: any) => {
  logger.error(message, {
    error: error.message,
    stack: error.stack,
    ...context,
  });
};

/**
 * Log integration events
 */
export const logIntegration = (integration: string, event: string, metadata?: any) => {
  logger.info(`Integration: ${integration} - ${event}`, {
    integration,
    event,
    ...metadata,
  });
};

/**
 * Log database operations
 */
export const logDatabase = (operation: string, collection: string, metadata?: any) => {
  logger.debug(`Database: ${operation} on ${collection}`, {
    operation,
    collection,
    ...metadata,
  });
};

/**
 * Log PA (Personal Assistant) interactions
 */
export const logPAInteraction = (userId: string, query: string, response?: string, metadata?: any) => {
  logger.info('PA Interaction', {
    userId,
    query: query.substring(0, 100), // Limit query length
    responseLength: response?.length,
    ...metadata,
  });
};

/**
 * Log performance metrics
 */
export const logPerformance = (operation: string, duration: number, metadata?: any) => {
  const level = duration > 1000 ? 'warn' : 'debug';
  logger.log(level, `Performance: ${operation} took ${duration}ms`, {
    operation,
    duration,
    ...metadata,
  });
};

/**
 * Log security events
 */
export const logSecurity = (event: string, severity: 'low' | 'medium' | 'high' | 'critical', metadata?: any) => {
  const level = severity === 'critical' || severity === 'high' ? 'error' : 'warn';
  logger.log(level, `Security: ${event}`, {
    event,
    severity,
    ...metadata,
  });
};

// Export logger as default
export default logger;
