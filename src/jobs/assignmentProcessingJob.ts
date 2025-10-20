import AgendaService from '../services/AgendaService';
import Assignment from '../models/Assignment';
import Task from '../models/Task';
import Note from '../models/Note';
import Notification from '../models/Notification';
import User from '../models/User';
import PushNotificationService from '../services/PushNotificationService';
import { openaiService } from '../services/openaiService';
import logger from '../utils/logger';
import { TaskStatus, AssignmentStatus } from '../constants/statuses';

/**
 * Assignment Processing Job
 * Processes research/comparison/calculation assignments asynchronously
 * Allows users to close the app while PA works in background
 */

const JOB_NAME = 'assignment-processing';

/**
 * Process a single assignment
 */
async function processAssignment(assignmentId: string): Promise<void> {
  const startTime = Date.now();
  logger.info(`[AssignmentProcessing] Starting assignment: ${assignmentId}`);

  try {
    // Get assignment
    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      logger.error(`[AssignmentProcessing] Assignment not found: ${assignmentId}`);
      return;
    }

    // Get user for assistant name and push token
    const user = await User.findById(assignment.userId);
    const assistantName = user?.assistantName || 'Yo!';
    const pushToken = user?.pushNotificationToken;

    // Build research prompt based on assignment type
    let researchPrompt = '';

    if (assignment.type === 'research') {
      researchPrompt = `You are a research assistant. The user asked: "${assignment.query}"

Perform comprehensive research and provide:
1. A clear, concise summary (2-3 sentences)
2. Key findings (3-5 bullet points with specific details)
3. Relevant data, prices, or recommendations
4. Sources or references if applicable

Be specific and actionable. Include numbers, prices, names, and details.

Format your response as structured information that can be displayed in a notification.`;
    } else if (assignment.type === 'comparison') {
      researchPrompt = `You are a comparison assistant. The user asked: "${assignment.query}"

Provide a detailed comparison including:
1. Brief overview of what's being compared
2. Key differences (3-5 main points)
3. Pros and cons for each option
4. Clear recommendation based on the comparison

Be specific with prices, features, and details.`;
    } else if (assignment.type === 'recommendation') {
      researchPrompt = `You are a recommendation assistant. The user asked: "${assignment.query}"

Provide:
1. Top recommendations with reasoning
2. Key criteria used for recommendations
3. Pros and cons for each option
4. Clear final recommendation

Be specific with details, prices, and features.`;
    } else if (assignment.type === 'investigation' || assignment.type === 'analysis') {
      researchPrompt = `You are an analysis assistant. The user asked: "${assignment.query}"

Provide:
1. Thorough investigation of the topic
2. Key findings and insights
3. Supporting data and evidence
4. Clear conclusions and recommendations

Be specific and comprehensive.`;
    } else {
      // Generic query
      researchPrompt = `You are an intelligent assistant. The user asked: "${assignment.query}"

Provide a comprehensive answer including:
1. Direct answer to the question
2. Supporting details and context
3. Relevant examples or data
4. Any helpful recommendations

Be specific and thorough.`;
    }

    // Perform research using OpenAI
    logger.info(`[AssignmentProcessing] Researching: ${assignment.title}`);
    const researchResponse = await openaiService.generateChatCompletion(
      [{ role: 'user', content: researchPrompt }],
      assignment.userId.toString(),
      assistantName
    );

    if (!researchResponse.success || !researchResponse.message) {
      throw new Error('Research failed: No response from AI');
    }

    const findings = researchResponse.message;
    const duration = Date.now() - startTime;

    logger.info(`[AssignmentProcessing] ✅ Research completed in ${duration}ms`);

    // Update assignment with findings
    assignment.findings = findings;
    assignment.status = AssignmentStatus.COMPLETED;
    assignment.completedAt = new Date();
    await assignment.save();

    // Update the visible task to show it's complete
    const relatedTask = await Task.findOne({
      userId: assignment.userId,
      'metadata.assignmentId': String(assignment._id),
    });

    if (relatedTask) {
      relatedTask.status = TaskStatus.COMPLETED;
      relatedTask.description = `✅ Research complete! Check notifications for full results.\n\n${findings.substring(0, 200)}...`;
      relatedTask.completedAt = new Date();
      await relatedTask.save();
      logger.info(`[AssignmentProcessing] ✅ Updated related task: ${relatedTask._id}`);
    }

    // Auto-create note with research findings
    const note = new Note({
      userId: assignment.userId,
      title: `Research: ${assignment.title}`,
      content: findings,
      category: assignment.type === 'research' ? 'work' : 'personal',
      tags: [assignment.type, 'pa-research', 'auto-generated'],
      metadata: {
        assignmentId: String(assignment._id),
        query: assignment.query,
        completedAt: new Date(),
        source: 'assignment',
        processingTime: duration,
      },
    });
    await note.save();
    logger.info(`[AssignmentProcessing] 📝 Auto-created note: ${note._id}`);

    // Create notification in database
    const notification = await Notification.createNotification({
      userId: assignment.userId.toString(),
      type: 'ai_suggestion',
      title: `Research Complete: ${assignment.title}`,
      message: `${findings.substring(0, 200)}${findings.length > 200 ? '...' : ''}`,
      priority: assignment.priority === 'high' ? 'high' : 'medium',
      relatedId: String(assignment._id),
      relatedModel: 'Assignment',
      actionUrl: `/assignments/${String(assignment._id)}`,
      metadata: {
        assignmentType: assignment.type,
        query: assignment.query,
        noteId: String(note._id),
        fullFindings: findings,
      },
    });

    assignment.notificationSent = true;
    await assignment.save();

    logger.info(`[AssignmentProcessing] 🔔 Notification created: ${notification._id}`);

    // Send push notification to user's device
    if (pushToken) {
      logger.info(`[AssignmentProcessing] 📱 Sending push notification...`);

      const pushSent = await PushNotificationService.sendToDevice(
        pushToken,
        {
          title: `✅ ${assignment.title}`,
          body: `Your research is ready! Tap to view findings.`,
          data: {
            type: 'assignment_complete',
            assignmentId: String(assignment._id),
            noteId: String(note._id),
            notificationId: String(notification._id),
          },
          priority: 'high',
          sound: 'default',
          badge: 1,
        },
        String(notification._id)
      );

      if (pushSent) {
        logger.info(`[AssignmentProcessing] ✅ Push notification sent successfully`);
      } else {
        logger.warn(`[AssignmentProcessing] ⚠️ Push notification failed (service may be disabled)`);
      }
    } else {
      logger.info(`[AssignmentProcessing] ℹ️ No push token for user, skipping push notification`);
    }

    logger.info(
      `[AssignmentProcessing] ✅✅✅ Assignment completed successfully: ${assignment.title} ` +
      `(${duration}ms, note: ${note._id}, notification: ${notification._id})`
    );

  } catch (error) {
    logger.error(`[AssignmentProcessing] ❌ Error processing assignment ${assignmentId}:`, error);

    // Mark assignment as failed
    try {
      await Assignment.findByIdAndUpdate(assignmentId, {
        status: AssignmentStatus.FAILED,
        findings: `Research failed: ${(error as Error).message}`,
      });

      // Update the related task to show failure
      const assignment = await Assignment.findById(assignmentId);
      if (assignment) {
        const relatedTask = await Task.findOne({
          userId: assignment.userId,
          'metadata.assignmentId': String(assignment._id),
        });

        if (relatedTask) {
          relatedTask.status = TaskStatus.PENDING;
          relatedTask.description = `❌ Research failed. PA encountered an error. You can delete this task or ask again.`;
          await relatedTask.save();
          logger.info(`[AssignmentProcessing] Updated task to show failure: ${relatedTask._id}`);
        }

        // Still send a notification about the failure
        await Notification.createNotification({
          userId: assignment.userId.toString(),
          type: 'alert',
          title: `Research Failed: ${assignment.title}`,
          message: `I encountered an error while researching your request. Please try again.`,
          priority: 'medium',
          relatedId: String(assignment._id),
          relatedModel: 'Assignment',
        });
      }
    } catch (updateError) {
      logger.error(`[AssignmentProcessing] Error updating failed assignment:`, updateError);
    }
  }
}

/**
 * Job handler function
 */
async function assignmentProcessingHandler(job: any): Promise<void> {
  const { assignmentId } = job.attrs.data;

  if (!assignmentId) {
    logger.error('[AssignmentProcessing] No assignmentId provided in job data');
    return;
  }

  await processAssignment(assignmentId);
}

/**
 * Initialize the assignment processing job
 */
export async function initAssignmentProcessingJob(): Promise<void> {
  try {
    // Define the job
    AgendaService.defineJob(JOB_NAME, assignmentProcessingHandler);

    logger.info('[AssignmentProcessing] ✅ Assignment processing job initialized');
  } catch (error) {
    logger.error('[AssignmentProcessing] ❌ Failed to initialize:', error);
    throw error;
  }
}

/**
 * Queue an assignment for processing
 */
export async function queueAssignment(assignmentId: string): Promise<void> {
  try {
    await AgendaService.scheduleOnce(JOB_NAME, { assignmentId }, 'now');
    logger.info(`[AssignmentProcessing] ⏰ Queued assignment for processing: ${assignmentId}`);
  } catch (error) {
    logger.error(`[AssignmentProcessing] ❌ Failed to queue assignment ${assignmentId}:`, error);
    throw error;
  }
}

export default {
  init: initAssignmentProcessingJob,
  queue: queueAssignment,
  jobName: JOB_NAME,
};
