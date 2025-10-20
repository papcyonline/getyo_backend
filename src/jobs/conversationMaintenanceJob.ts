import AgendaService from '../services/AgendaService';
import Conversation from '../models/Conversation';
import ConversationMemoryService from '../services/ConversationMemoryService';
import logger from '../utils/logger';

/**
 * Conversation Maintenance Job
 * Summarizes long conversations and archives old ones
 * Default: Runs every 12 hours
 */

const JOB_NAME = 'conversation-maintenance';
const INTERVAL = '12 hours'; // Run every 12 hours

/**
 * Job handler function
 */
async function conversationMaintenanceHandler(job: any): Promise<void> {
  const startTime = Date.now();
  logger.info('[ConversationMaintenance] Starting conversation maintenance job');

  try {
    let totalSummarized = 0;
    let totalArchived = 0;

    // ========================================
    // PART 1: Summarize long conversations
    // ========================================
    const longConversations = await Conversation.find({
      $expr: { $gte: [{ $size: '$messages' }, 20] }, // 20+ messages
      'context.lastSummarized': { $exists: false }, // Not summarized yet
    }).limit(100); // Process up to 100 at a time

    logger.info(`[ConversationMaintenance] Found ${longConversations.length} conversations to summarize`);

    for (const conversation of longConversations) {
      try {
        const summary = await ConversationMemoryService.summarizeConversation(
          conversation._id.toString()
        );
        if (summary) {
          totalSummarized++;
        }
      } catch (error) {
        logger.error(
          `[ConversationMaintenance] Error summarizing conversation ${conversation._id}:`,
          error
        );
      }
    }

    // ========================================
    // PART 2: Re-summarize conversations that have grown since last summary
    // ========================================
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const grownConversations = await Conversation.find({
      $expr: { $gte: [{ $size: '$messages' }, 20] },
      'context.lastSummarized': { $lt: sevenDaysAgo, $exists: true },
      updatedAt: { $gt: { $toDate: '$context.lastSummarized' } },
    }).limit(50); // Process up to 50 at a time

    logger.info(`[ConversationMaintenance] Found ${grownConversations.length} conversations to re-summarize`);

    for (const conversation of grownConversations) {
      try {
        const summary = await ConversationMemoryService.summarizeConversation(
          conversation._id.toString()
        );
        if (summary) {
          totalSummarized++;
        }
      } catch (error) {
        logger.error(
          `[ConversationMaintenance] Error re-summarizing conversation ${conversation._id}:`,
          error
        );
      }
    }

    // ========================================
    // PART 3: Archive old conversations (90+ days)
    // ========================================
    // Get unique user IDs from old conversations
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const usersWithOldConversations = await Conversation.distinct('userId', {
      updatedAt: { $lt: ninetyDaysAgo },
      'context.archived': { $ne: true },
    });

    logger.info(`[ConversationMaintenance] Found ${usersWithOldConversations.length} users with old conversations`);

    for (const userId of usersWithOldConversations) {
      try {
        const archivedCount = await ConversationMemoryService.archiveOldConversations(userId, 90);
        totalArchived += archivedCount;
      } catch (error) {
        logger.error(
          `[ConversationMaintenance] Error archiving conversations for user ${userId}:`,
          error
        );
      }
    }

    const duration = Date.now() - startTime;
    logger.info(
      `[ConversationMaintenance] ✅ Completed in ${duration}ms. ` +
      `Summarized: ${totalSummarized}, Archived: ${totalArchived}`
    );
  } catch (error) {
    logger.error('[ConversationMaintenance] ❌ Job failed:', error);
    throw error;
  }
}

/**
 * Initialize and schedule the conversation maintenance job
 */
export async function initConversationMaintenanceJob(): Promise<void> {
  try {
    // Define the job
    AgendaService.defineJob(JOB_NAME, conversationMaintenanceHandler);

    // Schedule recurring job
    await AgendaService.scheduleRecurring(JOB_NAME, INTERVAL);

    logger.info(`[ConversationMaintenance] ✅ Initialized and scheduled (every ${INTERVAL})`);
  } catch (error) {
    logger.error('[ConversationMaintenance] ❌ Failed to initialize:', error);
    throw error;
  }
}

/**
 * Manually trigger conversation maintenance job
 */
export async function triggerConversationMaintenanceNow(): Promise<void> {
  try {
    await AgendaService.scheduleOnce(JOB_NAME, {}, 'now');
    logger.info('[ConversationMaintenance] ⚡ Manually triggered');
  } catch (error) {
    logger.error('[ConversationMaintenance] ❌ Failed to trigger manually:', error);
    throw error;
  }
}

export default {
  init: initConversationMaintenanceJob,
  triggerNow: triggerConversationMaintenanceNow,
  jobName: JOB_NAME,
};
