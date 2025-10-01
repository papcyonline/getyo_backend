import * as Sentry from '@sentry/node';
import { Express, Request, Response, NextFunction } from 'express';

class SentryService {
  private initialized: boolean = false;

  initialize(app: Express): void {
    if (this.initialized) {
      console.warn('⚠️ Sentry already initialized');
      return;
    }

    const sentryDSN = process.env.SENTRY_DSN;
    const environment = process.env.NODE_ENV || 'development';

    // Only initialize if DSN is provided
    if (!sentryDSN) {
      console.log('⚠️ Sentry DSN not provided - error monitoring disabled');
      return;
    }

    try {
      Sentry.init({
        dsn: sentryDSN,
        environment,
        tracesSampleRate: environment === 'production' ? 0.1 : 1.0, // 10% in prod, 100% in dev
        integrations: [
          // Automatically create spans for database queries
          new Sentry.Integrations.Mongo({
            useMongoose: true,
          }),
          // HTTP request tracking
          new Sentry.Integrations.Http({ tracing: true }),
        ],
        beforeSend(event, hint) {
          // Filter out non-critical errors in production
          if (environment === 'production') {
            // Don't send 400-level errors (client errors)
            if (event.request?.headers?.['x-status-code']?.toString().startsWith('4')) {
              return null;
            }
          }

          // Add custom context
          if (event.request) {
            event.request.headers = {
              ...event.request.headers,
              // Remove sensitive headers
              authorization: '[Redacted]',
              cookie: '[Redacted]',
            };
          }

          return event;
        },
      });

      // Request handler must be the first middleware
      app.use(Sentry.Handlers.requestHandler());

      // TracingHandler creates a trace for every incoming request
      app.use(Sentry.Handlers.tracingHandler());

      this.initialized = true;
      console.log('✅ Sentry error monitoring initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Sentry:', error);
    }
  }

  // Error handler middleware (must be added after all routes)
  errorHandler() {
    return Sentry.Handlers.errorHandler({
      shouldHandleError(error) {
        // Capture all errors with status >= 500
        return true;
      },
    });
  }

  // Custom error logging
  captureException(error: Error, context?: Record<string, any>): void {
    if (!this.initialized) {
      console.error('Sentry not initialized, logging error:', error);
      return;
    }

    Sentry.captureException(error, {
      extra: context,
    });
  }

  // Log custom messages
  captureMessage(message: string, level: Sentry.SeverityLevel = 'info', context?: Record<string, any>): void {
    if (!this.initialized) {
      console.log(`Sentry not initialized, logging message [${level}]:`, message);
      return;
    }

    Sentry.captureMessage(message, {
      level,
      extra: context,
    });
  }

  // Set user context
  setUser(user: { id: string; email?: string; username?: string }): void {
    if (!this.initialized) return;

    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.username,
    });
  }

  // Clear user context
  clearUser(): void {
    if (!this.initialized) return;
    Sentry.setUser(null);
  }

  // Set custom context/tags
  setContext(key: string, context: Record<string, any>): void {
    if (!this.initialized) return;
    Sentry.setContext(key, context);
  }

  setTag(key: string, value: string): void {
    if (!this.initialized) return;
    Sentry.setTag(key, value);
  }

  // Create a transaction for performance monitoring
  startTransaction(name: string, op: string): any {
    if (!this.initialized) return null;

    return Sentry.startTransaction({
      name,
      op,
    });
  }

  // Add breadcrumb for debugging
  addBreadcrumb(breadcrumb: {
    message: string;
    category?: string;
    level?: Sentry.SeverityLevel;
    data?: Record<string, any>;
  }): void {
    if (!this.initialized) return;

    Sentry.addBreadcrumb({
      message: breadcrumb.message,
      category: breadcrumb.category || 'custom',
      level: breadcrumb.level || 'info',
      data: breadcrumb.data,
      timestamp: Date.now() / 1000,
    });
  }

  // Middleware to set user context from JWT
  setUserContextMiddleware() {
    return (req: any, res: Response, next: NextFunction) => {
      if (req.user && req.user.userId) {
        this.setUser({
          id: req.user.userId,
          email: req.user.email,
        });
      }
      next();
    };
  }

  // Custom error handler middleware with Sentry integration
  customErrorMiddleware() {
    return (err: any, req: Request, res: Response, next: NextFunction) => {
      // Add request context
      this.setContext('request', {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      // Capture error with context
      this.captureException(err, {
        route: req.path,
        method: req.method,
        body: req.body,
        query: req.query,
        params: req.params,
      });

      // Log error
      console.error('🔥 Unhandled error:', {
        message: err.message,
        stack: err.stack,
        route: req.path,
      });

      // Send response
      const statusCode = err.status || err.statusCode || 500;
      res.status(statusCode).json({
        success: false,
        error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
      });
    };
  }

  // Flush events and close Sentry
  async close(timeout: number = 2000): Promise<void> {
    if (!this.initialized) return;

    try {
      await Sentry.close(timeout);
      console.log('✅ Sentry closed successfully');
    } catch (error) {
      console.error('❌ Error closing Sentry:', error);
    }
  }
}

export default new SentryService();