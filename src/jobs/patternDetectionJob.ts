import AgendaService from '../services/AgendaService';
import patternService from '../services/paPatternDetectionService';
import User from '../models/User';
import logger from '../utils/logger';

/**
 * Pattern Detection Job
 * Runs periodically to detect patterns in user activity
 * Default: Every 6 hours
 */

const JOB_NAME = 'pattern-detection';
const INTERVAL = '6 hours'; // Run every 6 hours

/**
 * Job handler function
 */
async function patternDetectionHandler(job: any): Promise<void> {
  const startTime = Date.now();
  logger.info('[PatternDetectionJob] Starting pattern detection job');

  try {
    // Get all active users (you might want to add pagination for large user bases)
    const users = await User.find({ isActive: true }).select('_id email').limit(1000);

    logger.info(`[PatternDetectionJob] Processing ${users.length} users`);

    let totalPatternsDetected = 0;
    let successCount = 0;
    let errorCount = 0;

    // Process each user
    for (const user of users) {
      try {
        const patterns = await patternService.detectPatternsForUser(user._id.toString());
        totalPatternsDetected += patterns.length;
        successCount++;

        if (patterns.length > 0) {
          logger.info(
            `[PatternDetectionJob] Detected ${patterns.length} patterns for user ${user.email}`
          );
        }
      } catch (error) {
        errorCount++;
        logger.error(
          `[PatternDetectionJob] Error detecting patterns for user ${user.email}:`,
          error
        );
        // Continue with next user even if one fails
      }
    }

    const duration = Date.now() - startTime;
    logger.info(
      `[PatternDetectionJob] ✅ Completed in ${duration}ms. ` +
      `Processed ${successCount}/${users.length} users. ` +
      `Detected ${totalPatternsDetected} patterns. ` +
      `Errors: ${errorCount}`
    );
  } catch (error) {
    logger.error('[PatternDetectionJob] ❌ Job failed:', error);
    throw error; // Re-throw to mark job as failed
  }
}

/**
 * Initialize and schedule the pattern detection job
 */
export async function initPatternDetectionJob(): Promise<void> {
  try {
    // Define the job
    AgendaService.defineJob(JOB_NAME, patternDetectionHandler);

    // Schedule recurring job
    await AgendaService.scheduleRecurring(JOB_NAME, INTERVAL);

    logger.info(`[PatternDetectionJob] ✅ Initialized and scheduled (every ${INTERVAL})`);
  } catch (error) {
    logger.error('[PatternDetectionJob] ❌ Failed to initialize:', error);
    throw error;
  }
}

/**
 * Manually trigger pattern detection job (for testing or on-demand)
 */
export async function triggerPatternDetectionNow(): Promise<void> {
  try {
    await AgendaService.scheduleOnce(JOB_NAME, {}, 'now');
    logger.info('[PatternDetectionJob] ⚡ Manually triggered');
  } catch (error) {
    logger.error('[PatternDetectionJob] ❌ Failed to trigger manually:', error);
    throw error;
  }
}

export default {
  init: initPatternDetectionJob,
  triggerNow: triggerPatternDetectionNow,
  jobName: JOB_NAME,
};
