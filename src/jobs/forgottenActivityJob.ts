import AgendaService from '../services/AgendaService';
import patternService from '../services/paPatternDetectionService';
import User from '../models/User';
import logger from '../utils/logger';

/**
 * Forgotten Activity Check Job
 * Runs frequently to check if users forgot their habitual activities
 * Default: Every 15 minutes
 */

const JOB_NAME = 'forgotten-activity-check';
const INTERVAL = '15 minutes'; // Run every 15 minutes

/**
 * Job handler function
 */
async function forgottenActivityHandler(job: any): Promise<void> {
  const startTime = Date.now();
  logger.info('[ForgottenActivityJob] Starting forgotten activity check');

  try {
    // Get all active users
    const users = await User.find({ isActive: true }).select('_id email').limit(1000);

    logger.info(`[ForgottenActivityJob] Checking forgotten activities for ${users.length} users`);

    let totalReminders = 0;
    let successCount = 0;
    let errorCount = 0;

    // Process each user
    for (const user of users) {
      try {
        const forgottenActivities = await patternService.checkForgottenActivities(
          user._id.toString()
        );

        if (forgottenActivities.length > 0) {
          logger.info(
            `[ForgottenActivityJob] Found ${forgottenActivities.length} forgotten activities for user ${user.email}`
          );

          // Send reminders for each forgotten activity
          for (const activity of forgottenActivities) {
            try {
              await patternService.sendForgottenReminder(activity);
              totalReminders++;
            } catch (reminderError) {
              logger.error(
                `[ForgottenActivityJob] Error sending reminder for ${activity.pattern.title}:`,
                reminderError
              );
            }
          }
        }

        successCount++;
      } catch (error) {
        errorCount++;
        logger.error(
          `[ForgottenActivityJob] Error checking forgotten activities for user ${user.email}:`,
          error
        );
        // Continue with next user even if one fails
      }
    }

    const duration = Date.now() - startTime;
    logger.info(
      `[ForgottenActivityJob] ✅ Completed in ${duration}ms. ` +
      `Processed ${successCount}/${users.length} users. ` +
      `Sent ${totalReminders} reminders. ` +
      `Errors: ${errorCount}`
    );
  } catch (error) {
    logger.error('[ForgottenActivityJob] ❌ Job failed:', error);
    throw error; // Re-throw to mark job as failed
  }
}

/**
 * Initialize and schedule the forgotten activity check job
 */
export async function initForgottenActivityJob(): Promise<void> {
  try {
    // Define the job
    AgendaService.defineJob(JOB_NAME, forgottenActivityHandler);

    // Schedule recurring job
    await AgendaService.scheduleRecurring(JOB_NAME, INTERVAL);

    logger.info(`[ForgottenActivityJob] ✅ Initialized and scheduled (every ${INTERVAL})`);
  } catch (error) {
    logger.error('[ForgottenActivityJob] ❌ Failed to initialize:', error);
    throw error;
  }
}

/**
 * Manually trigger forgotten activity check (for testing or on-demand)
 */
export async function triggerForgottenActivityCheckNow(): Promise<void> {
  try {
    await AgendaService.scheduleOnce(JOB_NAME, {}, 'now');
    logger.info('[ForgottenActivityJob] ⚡ Manually triggered');
  } catch (error) {
    logger.error('[ForgottenActivityJob] ❌ Failed to trigger manually:', error);
    throw error;
  }
}

export default {
  init: initForgottenActivityJob,
  triggerNow: triggerForgottenActivityCheckNow,
  jobName: JOB_NAME,
};
