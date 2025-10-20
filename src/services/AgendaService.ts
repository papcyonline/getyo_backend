import Agenda from 'agenda';
import mongoose from 'mongoose';
import logger from '../utils/logger';

class AgendaService {
  private agenda: Agenda | null = null;
  private isInitialized = false;

  /**
   * Initialize Agenda with MongoDB connection
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('[AgendaService] Already initialized');
      return;
    }

    try {
      // Use existing Mongoose connection instead of creating new one
      if (!mongoose.connection.db) {
        throw new Error('Mongoose connection not established. Connect to MongoDB first.');
      }

      // Get MongoDB connection string from environment or use default
      const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/yofam_local';

      // Create Agenda instance using MongoDB connection string
      this.agenda = new Agenda({
        db: {
          address: mongoUri,
          collection: 'jobs',
        },
        processEvery: '30 seconds', // Check for jobs every 30 seconds
        maxConcurrency: 20, // Max 20 concurrent jobs
        defaultConcurrency: 5, // Default concurrency per job
        lockLimit: 0, // No limit on locks
        defaultLockLimit: 0,
        defaultLockLifetime: 10 * 60 * 1000, // 10 minutes
      });

      // Event listeners for debugging
      this.agenda.on('ready', () => {
        logger.info('[AgendaService] ✅ Agenda connected to MongoDB');
      });

      this.agenda.on('start', (job) => {
        logger.info(`[AgendaService] 🔄 Job starting: ${job.attrs.name}`);
      });

      this.agenda.on('complete', (job) => {
        logger.info(`[AgendaService] ✅ Job completed: ${job.attrs.name}`);
      });

      this.agenda.on('success', (job) => {
        logger.info(`[AgendaService] ✅ Job succeeded: ${job.attrs.name}`);
      });

      this.agenda.on('fail', (err, job) => {
        logger.error(`[AgendaService] ❌ Job failed: ${job.attrs.name}`, err);
      });

      // Wait for Agenda to be ready before marking as initialized
      await new Promise<void>((resolve, reject) => {
        this.agenda!.once('ready', () => resolve());
        this.agenda!.once('error', (err) => reject(err));
        // Timeout after 10 seconds
        setTimeout(() => reject(new Error('Agenda connection timeout')), 10000);
      });

      this.isInitialized = true;
      logger.info('[AgendaService] Agenda service initialized and connected');
    } catch (error) {
      logger.error('[AgendaService] Failed to initialize Agenda:', error);
      throw error;
    }
  }

  /**
   * Start the Agenda job processor
   * Note: When using existing Mongoose connection, we start in background
   */
  async start(): Promise<void> {
    if (!this.agenda) {
      throw new Error('Agenda not initialized. Call initialize() first.');
    }

    try {
      logger.info('[AgendaService] Starting Agenda job processor...');

      // Start Agenda in background - don't await as it may hang with existing connection
      // The processor will start and jobs will be processed normally
      this.agenda.start().then(() => {
        logger.info('[AgendaService] ⚡ Agenda job processor started successfully');
      }).catch((error) => {
        logger.error('[AgendaService] Agenda processor error:', error);
      });

      // Return immediately - Agenda will process jobs in background
      logger.info('[AgendaService] ⚡ Agenda job processor starting in background');
    } catch (error) {
      logger.error('[AgendaService] Failed to start Agenda:', error);
      throw error;
    }
  }

  /**
   * Stop the Agenda job processor (graceful shutdown)
   */
  async stop(): Promise<void> {
    if (!this.agenda) {
      logger.warn('[AgendaService] Agenda not initialized, nothing to stop');
      return;
    }

    try {
      await this.agenda.stop();
      logger.info('[AgendaService] 🛑 Agenda job processor stopped gracefully');
    } catch (error) {
      logger.error('[AgendaService] Error stopping Agenda:', error);
      throw error;
    }
  }

  /**
   * Get the Agenda instance
   */
  getAgenda(): Agenda {
    if (!this.agenda) {
      throw new Error('Agenda not initialized. Call initialize() first.');
    }
    return this.agenda;
  }

  /**
   * Check if Agenda is initialized
   */
  isReady(): boolean {
    return this.isInitialized && this.agenda !== null;
  }

  /**
   * Cancel all jobs (useful for testing or maintenance)
   */
  async cancelAllJobs(): Promise<void> {
    if (!this.agenda) {
      throw new Error('Agenda not initialized');
    }

    try {
      const numRemoved = await this.agenda.cancel({});
      logger.info(`[AgendaService] Cancelled ${numRemoved} jobs`);
    } catch (error) {
      logger.error('[AgendaService] Error cancelling jobs:', error);
      throw error;
    }
  }

  /**
   * Get all scheduled jobs
   */
  async getJobs(): Promise<any[]> {
    if (!this.agenda) {
      throw new Error('Agenda not initialized');
    }

    try {
      const jobs = await this.agenda.jobs({});
      return jobs.map(job => ({
        name: job.attrs.name,
        type: job.attrs.type,
        nextRunAt: job.attrs.nextRunAt,
        lastRunAt: job.attrs.lastRunAt,
        lastFinishedAt: job.attrs.lastFinishedAt,
        failCount: job.attrs.failCount,
        failReason: job.attrs.failReason,
        lockedAt: job.attrs.lockedAt,
      }));
    } catch (error) {
      logger.error('[AgendaService] Error getting jobs:', error);
      throw error;
    }
  }

  /**
   * Schedule a one-time job
   */
  async scheduleOnce(jobName: string, data: any, when: string | Date): Promise<void> {
    if (!this.agenda) {
      throw new Error('Agenda not initialized');
    }

    try {
      await this.agenda.schedule(when, jobName, data);
      logger.info(`[AgendaService] Scheduled one-time job: ${jobName} at ${when}`);
    } catch (error) {
      logger.error(`[AgendaService] Error scheduling job ${jobName}:`, error);
      throw error;
    }
  }

  /**
   * Schedule a recurring job
   */
  async scheduleRecurring(jobName: string, interval: string, data?: any): Promise<void> {
    if (!this.agenda) {
      throw new Error('Agenda not initialized');
    }

    try {
      await this.agenda.every(interval, jobName, data);
      logger.info(`[AgendaService] Scheduled recurring job: ${jobName} every ${interval}`);
    } catch (error) {
      logger.error(`[AgendaService] Error scheduling recurring job ${jobName}:`, error);
      throw error;
    }
  }

  /**
   * Define a job handler
   */
  defineJob(jobName: string, handler: (job: any) => Promise<void>): void {
    if (!this.agenda) {
      throw new Error('Agenda not initialized');
    }

    this.agenda.define(jobName, async (job: any) => {
      try {
        await handler(job);
      } catch (error) {
        logger.error(`[AgendaService] Error in job ${jobName}:`, error);
        throw error;
      }
    });

    logger.info(`[AgendaService] Defined job: ${jobName}`);
  }
}

// Export singleton instance
export default new AgendaService();
