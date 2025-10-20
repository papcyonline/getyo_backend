import AgendaService from '../services/AgendaService';
import ProfileLearningService from '../services/ProfileLearningService';
import User from '../models/User';
import logger from '../utils/logger';

/**
 * Profile Learning Job
 * Runs daily to analyze user behavior and update profiles
 * Learns: work hours, common tasks, communication preferences
 * Default: Every 24 hours (runs at 2 AM)
 */

const JOB_NAME = 'profile-learning';
const INTERVAL = '0 2 * * *'; // Daily at 2:00 AM (cron format)

/**
 * Job handler function
 */
async function profileLearningHandler(job: any): Promise<void> {
  const startTime = Date.now();
  logger.info('[ProfileLearningJob] Starting profile learning analysis');

  try {
    // Get all active users with enough activity (at least 10 interactions)
    const users = await User.find({ isActive: true }).select('_id email').limit(1000);

    logger.info(`[ProfileLearningJob] Analyzing profiles for ${users.length} users`);

    let successCount = 0;
    let errorCount = 0;
    let updatedProfiles = 0;

    // Process each user
    for (const user of users) {
      try {
        logger.info(`[ProfileLearningJob] Analyzing profile for user ${user.email}`);

        // Run full profile analysis (work hours, common tasks, etc.)
        await ProfileLearningService.runFullAnalysis(user._id.toString());

        successCount++;
        updatedProfiles++;

        // Add small delay to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        errorCount++;
        logger.error(
          `[ProfileLearningJob] Error analyzing profile for user ${user.email}:`,
          error
        );
        // Continue with next user even if one fails
      }
    }

    const duration = Date.now() - startTime;
    logger.info(
      `[ProfileLearningJob] ✅ Completed in ${duration}ms. ` +
      `Processed ${successCount}/${users.length} users. ` +
      `Updated ${updatedProfiles} profiles. ` +
      `Errors: ${errorCount}`
    );
  } catch (error) {
    logger.error('[ProfileLearningJob] ❌ Job failed:', error);
    throw error; // Re-throw to mark job as failed
  }
}

/**
 * Initialize and schedule the profile learning job
 */
export async function initProfileLearningJob(): Promise<void> {
  try {
    // Define the job
    AgendaService.defineJob(JOB_NAME, profileLearningHandler);

    // Schedule recurring job (daily at 2 AM)
    await AgendaService.scheduleRecurring(JOB_NAME, INTERVAL);

    logger.info(`[ProfileLearningJob] ✅ Initialized and scheduled (cron: ${INTERVAL})`);
  } catch (error) {
    logger.error('[ProfileLearningJob] ❌ Failed to initialize:', error);
    throw error;
  }
}

/**
 * Manually trigger profile learning (for testing or on-demand)
 */
export async function triggerProfileLearningNow(): Promise<void> {
  try {
    await AgendaService.scheduleOnce(JOB_NAME, {}, 'now');
    logger.info('[ProfileLearningJob] ⚡ Manually triggered');
  } catch (error) {
    logger.error('[ProfileLearningJob] ❌ Failed to trigger manually:', error);
    throw error;
  }
}

export default {
  init: initProfileLearningJob,
  triggerNow: triggerProfileLearningNow,
  jobName: JOB_NAME,
};
