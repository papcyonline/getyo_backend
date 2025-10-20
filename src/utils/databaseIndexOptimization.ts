import mongoose from 'mongoose';
import logger from './logger';

/**
 * Database Index Optimization
 *
 * Ensures all collections have optimal indexes for common query patterns
 * Run this once during deployment or when schema changes
 */

export async function optimizeDatabaseIndexes(): Promise<void> {
  try {
    logger.info('[DB Optimization] Starting database index optimization...');

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not established');
    }

    // Helper function to create indexes safely
    const createIndexesSafely = async (collectionName: string, indexes: any[]) => {
      try {
        await db.collection(collectionName).createIndexes(indexes);
        logger.info(`[DB Optimization] ✅ ${collectionName} indexes optimized`);
      } catch (error: any) {
        // Ignore index already exists errors (code 85/86)
        if (error.code === 85 || error.code === 86 || error.codeName === 'IndexOptionsConflict') {
          logger.info(`[DB Optimization] ℹ️ ${collectionName} indexes already exist, skipping`);
        } else {
          logger.error(`[DB Optimization] ⚠️ Error creating indexes for ${collectionName}:`, error.message);
        }
      }
    };

    // ==========================================
    // USERS COLLECTION
    // ==========================================
    await createIndexesSafely('users', [
      { key: { email: 1 }, unique: true, name: 'email_unique' },
      { key: { phoneNumber: 1 }, sparse: true, name: 'phone_number_sparse' },
      { key: { isActive: 1, createdAt: -1 }, name: 'active_users_recent' },
      // Text search on name and email
      { key: { fullName: 'text', email: 'text' }, name: 'user_text_search' },
    ]);

    // ==========================================
    // CONVERSATIONS COLLECTION
    // ==========================================
    await createIndexesSafely('conversations', [
      { key: { userId: 1, updatedAt: -1 }, name: 'user_conversations_recent' },
      { key: { userId: 1, createdAt: -1 }, name: 'user_conversations_chronological' },
      { key: { userId: 1, 'context.archived': 1 }, name: 'user_archived_status' },
      { key: { updatedAt: 1 }, name: 'updated_at_asc' }, // For archival jobs
      { key: { 'context.mainTopics': 1 }, name: 'topics_lookup' },
      // Compound index for long conversations needing summarization
      { key: { 'context.lastSummarized': 1, updatedAt: -1 }, name: 'summarization_candidates' },
    ]);

    // ==========================================
    // TASKS COLLECTION
    // ==========================================
    await createIndexesSafely('tasks', [
      { key: { userId: 1, status: 1, dueDate: 1 }, name: 'user_tasks_status_due' },
      { key: { userId: 1, priority: 1 }, name: 'user_tasks_priority' },
      { key: { userId: 1, createdAt: -1 }, name: 'user_tasks_recent' },
      { key: { dueDate: 1, status: 1 }, name: 'tasks_due_active' },
      { key: { userId: 1, completedAt: -1 }, sparse: true, name: 'user_completed_tasks' },
      // Text search on title and description
      { key: { title: 'text', description: 'text' }, name: 'task_text_search' },
    ]);

    // ==========================================
    // REMINDERS COLLECTION
    // ==========================================
    await createIndexesSafely('reminders', [
      { key: { userId: 1, status: 1, reminderTime: 1 }, name: 'user_reminders_active' },
      { key: { userId: 1, reminderTime: 1 }, name: 'user_reminders_time' },
      { key: { reminderTime: 1, status: 1 }, name: 'reminders_upcoming' },
      { key: { userId: 1, isUrgent: 1, status: 1 }, name: 'user_urgent_reminders' },
      { key: { userId: 1, createdAt: -1 }, name: 'user_reminders_recent' },
    ]);

    // ==========================================
    // PATTERNS COLLECTION
    // ==========================================
    await createIndexesSafely('patterns', [
      { key: { userId: 1, type: 1, frequency: 1 }, name: 'user_patterns_type_freq' },
      { key: { userId: 1, autoCreated: 1 }, name: 'user_automated_patterns' },
      { key: { userId: 1, userResponse: 1 }, name: 'user_pattern_responses' },
      { key: { userId: 1, priority: 1 }, name: 'user_patterns_priority' },
      { key: { 'timing.hour': 1, 'timing.minute': 1 }, name: 'patterns_timing' },
      { key: { userId: 1, consistency: -1 }, name: 'user_patterns_consistency' },
      // For forgotten activity detection
      { key: { userId: 1, autoCreated: 1, 'timing.hour': 1 }, name: 'automated_patterns_by_time' },
    ]);

    // ==========================================
    // NOTIFICATIONS COLLECTION
    // ==========================================
    await createIndexesSafely('notifications', [
      { key: { userId: 1, read: 1 }, name: 'user_unread_notifications' },
      { key: { userId: 1, createdAt: -1 }, name: 'user_notifications_recent' },
      { key: { userId: 1, priority: 1 }, name: 'user_notifications_priority' },
      { key: { userId: 1, type: 1, read: 1 }, name: 'user_notifications_type_status' },
      // TTL index for automatic deletion of old notifications (30 days)
      { key: { createdAt: 1 }, expireAfterSeconds: 2592000, name: 'notification_ttl' },
      // TTL index for notifications with expiresAt field
      { key: { expiresAt: 1 }, expireAfterSeconds: 0, name: 'notification_expire' },
    ]);

    // ==========================================
    // EVENTS (CALENDAR) COLLECTION
    // ==========================================
    await createIndexesSafely('events', [
      { key: { userId: 1, startTime: 1 }, name: 'user_events_chronological' },
      { key: { userId: 1, endTime: 1 }, name: 'user_events_by_end' },
      { key: { userId: 1, source: 1, startTime: 1 }, name: 'user_events_source_time' },
      { key: { startTime: 1, endTime: 1 }, name: 'events_time_range' },
      // Text search
      { key: { title: 'text', description: 'text' }, name: 'event_text_search' },
    ]);

    // ==========================================
    // NOTES COLLECTION
    // ==========================================
    await createIndexesSafely('notes', [
      { key: { userId: 1, createdAt: -1 }, name: 'user_notes_recent' },
      { key: { userId: 1, category: 1, createdAt: -1 }, name: 'user_notes_category' },
      { key: { userId: 1, tags: 1 }, name: 'user_notes_tags' },
      { key: { userId: 1, isPinned: 1, createdAt: -1 }, name: 'user_notes_pinned' },
      // Text search on title and content
      { key: { title: 'text', content: 'text' }, name: 'note_text_search' },
    ]);

    // ==========================================
    // ASSIGNMENTS COLLECTION
    // ==========================================
    await createIndexesSafely('assignments', [
      { key: { userId: 1, status: 1, createdAt: -1 }, name: 'user_assignments_status' },
      { key: { userId: 1, type: 1, status: 1 }, name: 'user_assignments_type_status' },
      { key: { userId: 1, priority: 1, status: 1 }, name: 'user_assignments_priority' },
      { key: { userId: 1, completedAt: -1 }, sparse: true, name: 'user_completed_assignments' },
    ]);

    // ==========================================
    // REFRESH TOKENS COLLECTION
    // ==========================================
    await createIndexesSafely('refreshtokens', [
      { key: { token: 1 }, unique: true, name: 'token_unique' },
      { key: { userId: 1 }, name: 'user_tokens' },
      // TTL index for automatic token cleanup
      { key: { expiresAt: 1 }, expireAfterSeconds: 0, name: 'token_expiry' },
    ]);

    // ==========================================
    // SESSIONS COLLECTION
    // ==========================================
    await createIndexesSafely('sessions', [
      { key: { userId: 1, isActive: 1, lastActivity: -1 }, name: 'user_active_sessions' },
      { key: { deviceId: 1 }, name: 'device_sessions' },
      { key: { sessionToken: 1 }, unique: true, name: 'session_token_unique' },
      // TTL index for inactive sessions (30 days)
      { key: { lastActivity: 1 }, expireAfterSeconds: 2592000, name: 'session_inactivity_ttl' },
    ]);

    // ==========================================
    // AGENDA JOBS COLLECTION (Background Jobs)
    // ==========================================
    await createIndexesSafely('jobs', [
      { key: { name: 1, nextRunAt: 1 }, name: 'job_execution_queue' },
      { key: { name: 1, lastFinishedAt: -1 }, name: 'job_history' },
      { key: { nextRunAt: 1, lockedAt: 1 }, name: 'job_locks' },
      // Cleanup old job records after 90 days
      { key: { lastFinishedAt: 1 }, expireAfterSeconds: 7776000, name: 'job_cleanup_ttl' },
    ]);

    logger.info('[DB Optimization] ✅✅✅ All database indexes optimized successfully!');
  } catch (error) {
    logger.error('[DB Optimization] ❌ Error optimizing database indexes:', error);
    throw error;
  }
}

/**
 * Get index statistics for all collections
 */
export async function getIndexStats(): Promise<any> {
  try {
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not established');
    }

    const collections = await db.listCollections().toArray();
    const stats: any = {};

    for (const collectionInfo of collections) {
      const collectionName = collectionInfo.name;
      const collection = db.collection(collectionName);

      const indexes = await collection.indexes();
      const indexStats = await (collection as any).stats();

      stats[collectionName] = {
        totalIndexes: indexes.length,
        indexes: indexes.map((idx: any) => ({
          name: idx.name,
          keys: idx.key,
          unique: idx.unique || false,
          sparse: idx.sparse || false,
          ttl: idx.expireAfterSeconds !== undefined,
        })),
        size: indexStats.size,
        count: indexStats.count,
        avgObjSize: indexStats.avgObjSize,
      };
    }

    return stats;
  } catch (error) {
    logger.error('[DB Optimization] Error getting index stats:', error);
    return null;
  }
}
