import AgendaService from '../services/AgendaService';
import patternDetectionJob from './patternDetectionJob';
import forgottenActivityJob from './forgottenActivityJob';
import conversationMaintenanceJob from './conversationMaintenanceJob';
import assignmentProcessingJob from './assignmentProcessingJob';
import profileLearningJob from './profileLearningJob';
import logger from '../utils/logger';

/**
 * Initialize all background jobs
 */
export async function initializeJobs(): Promise<void> {
  try {
    logger.info('[Jobs] Initializing background jobs...');

    // Initialize Agenda service first
    await AgendaService.initialize();

    // Define and schedule all jobs
    await patternDetectionJob.init();
    await forgottenActivityJob.init();
    await conversationMaintenanceJob.init();
    await assignmentProcessingJob.init();
    await profileLearningJob.init();

    // Start the Agenda processor
    await AgendaService.start();

    logger.info('[Jobs] ✅ All background jobs initialized and started (including profile learning)');
  } catch (error) {
    logger.error('[Jobs] ❌ Failed to initialize jobs:', error);
    throw error;
  }
}

/**
 * Gracefully shutdown all jobs
 */
export async function shutdownJobs(): Promise<void> {
  try {
    logger.info('[Jobs] Shutting down background jobs...');
    await AgendaService.stop();
    logger.info('[Jobs] ✅ Background jobs shut down gracefully');
  } catch (error) {
    logger.error('[Jobs] ❌ Error shutting down jobs:', error);
    throw error;
  }
}

/**
 * Get status of all jobs
 */
export async function getJobsStatus(): Promise<any> {
  try {
    return await AgendaService.getJobs();
  } catch (error) {
    logger.error('[Jobs] Error getting jobs status:', error);
    throw error;
  }
}

export default {
  initialize: initializeJobs,
  shutdown: shutdownJobs,
  getStatus: getJobsStatus,
};
