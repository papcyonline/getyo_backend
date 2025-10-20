/**
 * PA GUARDRAILS SERVICE
 *
 * Implements comprehensive safety, privacy, and ethical guardrails for the PA.
 * This service intercepts and validates all PA actions before execution.
 *
 * Key Responsibilities:
 * 1. Sensitive data detection and protection
 * 2. Action validation and rate limiting
 * 3. Privacy compliance
 * 4. User safety checks
 * 5. Content moderation
 * 6. Permission verification
 */

interface GuardrailResult {
  allowed: boolean;
  reason?: string;
  suggestion?: string;
  severity?: 'info' | 'warning' | 'error' | 'critical';
  modifiedContent?: string;
}

interface ActionContext {
  userId: string;
  actionType: string;
  content: string;
  metadata?: any;
}

class PAGuardrailsService {
  // Sensitive patterns to detect
  private sensitivePatterns = {
    creditCard: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
    ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
    password: /\b(password|pwd|pass|passphrase)[\s:=]+[\w!@#$%^&*()]+/gi,
    apiKey: /\b(api[_-]?key|api[_-]?secret|bearer|token)[\s:=]+[\w\-]+/gi,
    privateKey: /-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----/g,
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    phone: /\b(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    ipAddress: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
  };

  // Dangerous action patterns
  private dangerousPatterns = {
    deletion: /\b(delete|remove|erase|clear|wipe|destroy)\s+(all|everything|entire|complete)/gi,
    mass: /\b(send|email|message|notify)\s+(all|everyone|everybody|all contacts)/gi,
    financial: /\b(transfer|send|wire|pay)\s+\$?\d+/gi,
    account: /\b(close|delete|deactivate|remove)\s+(account|profile)/gi,
  };

  // Rate limiting tracking
  private actionCounts: Map<string, { count: number; resetTime: number }> = new Map();

  /**
   * ============================================================
   * PRIMARY GUARDRAIL CHECK
   * ============================================================
   */
  async checkAction(context: ActionContext): Promise<GuardrailResult> {
    console.log(`🛡️ Guardrails checking action: ${context.actionType}`);

    // 1. Sensitive Data Check
    const sensitiveCheck = this.checkSensitiveData(context.content);
    if (!sensitiveCheck.allowed) {
      return sensitiveCheck;
    }

    // 2. Dangerous Action Check
    const dangerCheck = this.checkDangerousActions(context);
    if (!dangerCheck.allowed) {
      return dangerCheck;
    }

    // 3. Rate Limiting Check
    const rateLimitCheck = this.checkRateLimit(context.userId, context.actionType);
    if (!rateLimitCheck.allowed) {
      return rateLimitCheck;
    }

    // 4. Permission Check
    const permissionCheck = await this.checkPermissions(context);
    if (!permissionCheck.allowed) {
      return permissionCheck;
    }

    // 5. Content Moderation
    const moderationCheck = this.checkContentModeration(context.content);
    if (!moderationCheck.allowed) {
      return moderationCheck;
    }

    // 6. Privacy Compliance
    const privacyCheck = this.checkPrivacyCompliance(context);
    if (!privacyCheck.allowed) {
      return privacyCheck;
    }

    console.log(`✅ Guardrails passed for action: ${context.actionType}`);
    return { allowed: true };
  }

  /**
   * ============================================================
   * SENSITIVE DATA DETECTION
   * ============================================================
   */
  private checkSensitiveData(content: string): GuardrailResult {
    const detected: string[] = [];

    // Check for credit cards
    if (this.sensitivePatterns.creditCard.test(content)) {
      detected.push('credit card numbers');
    }

    // Check for SSN
    if (this.sensitivePatterns.ssn.test(content)) {
      detected.push('social security numbers');
    }

    // Check for passwords
    if (this.sensitivePatterns.password.test(content)) {
      detected.push('passwords');
    }

    // Check for API keys/tokens
    if (this.sensitivePatterns.apiKey.test(content)) {
      detected.push('API keys or tokens');
    }

    // Check for private keys
    if (this.sensitivePatterns.privateKey.test(content)) {
      detected.push('private cryptographic keys');
    }

    if (detected.length > 0) {
      return {
        allowed: false,
        reason: `Sensitive information detected: ${detected.join(', ')}`,
        suggestion: `For your security, I cannot store ${detected.join(', ')}. Please use a secure password manager or encrypted storage instead.`,
        severity: 'critical',
      };
    }

    return { allowed: true };
  }

  /**
   * ============================================================
   * DANGEROUS ACTION DETECTION
   * ============================================================
   */
  private checkDangerousActions(context: ActionContext): GuardrailResult {
    const { content, actionType } = context;

    // Mass deletion check
    if (this.dangerousPatterns.deletion.test(content)) {
      return {
        allowed: false,
        reason: 'Bulk deletion detected',
        suggestion: 'This action would delete a large amount of data. Please be more specific about what you want to delete, or use the app interface to manually delete items for safety.',
        severity: 'critical',
      };
    }

    // Mass communication check
    if (this.dangerousPatterns.mass.test(content)) {
      return {
        allowed: false,
        reason: 'Mass communication detected',
        suggestion: 'Sending messages to all contacts requires manual confirmation. Please use the app to review and send bulk messages.',
        severity: 'warning',
      };
    }

    // Financial transaction check
    if (this.dangerousPatterns.financial.test(content)) {
      return {
        allowed: false,
        reason: 'Financial transaction detected',
        suggestion: 'I cannot process financial transactions for your safety. Please handle money transfers directly through your banking app.',
        severity: 'critical',
      };
    }

    // Account closure check
    if (this.dangerousPatterns.account.test(content)) {
      return {
        allowed: false,
        reason: 'Account closure detected',
        suggestion: 'I cannot close accounts or delete profiles. Please use the app settings if you wish to make account changes.',
        severity: 'warning',
      };
    }

    return { allowed: true };
  }

  /**
   * ============================================================
   * RATE LIMITING
   * ============================================================
   */
  private checkRateLimit(userId: string, actionType: string): GuardrailResult {
    const key = `${userId}:${actionType}`;
    const now = Date.now();
    const limits = {
      assignment: { max: 10, window: 60 * 60 * 1000 }, // 10 assignments per hour
      email_draft: { max: 20, window: 60 * 60 * 1000 }, // 20 emails per hour
      task: { max: 50, window: 60 * 60 * 1000 }, // 50 tasks per hour
      reminder: { max: 30, window: 60 * 60 * 1000 }, // 30 reminders per hour
      note: { max: 100, window: 60 * 60 * 1000 }, // 100 notes per hour
      calendar_event: { max: 20, window: 60 * 60 * 1000 }, // 20 events per hour
    };

    const limit = limits[actionType as keyof typeof limits];
    if (!limit) {
      return { allowed: true }; // No limit for this action type
    }

    const tracker = this.actionCounts.get(key);

    // Reset if window expired
    if (!tracker || now > tracker.resetTime) {
      this.actionCounts.set(key, {
        count: 1,
        resetTime: now + limit.window,
      });
      return { allowed: true };
    }

    // Check if limit exceeded
    if (tracker.count >= limit.max) {
      const resetIn = Math.ceil((tracker.resetTime - now) / 1000 / 60); // minutes
      return {
        allowed: false,
        reason: 'Rate limit exceeded',
        suggestion: `You've reached the limit of ${limit.max} ${actionType}s per hour. Please try again in ${resetIn} minutes, or contact support if you need a higher limit.`,
        severity: 'warning',
      };
    }

    // Increment count
    tracker.count++;
    this.actionCounts.set(key, tracker);
    return { allowed: true };
  }

  /**
   * ============================================================
   * PERMISSION VERIFICATION
   * ============================================================
   */
  private async checkPermissions(context: ActionContext): Promise<GuardrailResult> {
    const { userId, actionType, metadata } = context;

    // Load user from database (you'll need to import User model)
    const { User } = await import('../models');
    const user = await User.findById(userId);

    if (!user) {
      return {
        allowed: false,
        reason: 'User not found',
        severity: 'error',
      };
    }

    // Check integration-specific permissions
    if (actionType === 'email_draft') {
      const hasEmailIntegration = user.integrations?.gmail?.connected ||
                                   user.integrations?.outlook?.connected;
      if (!hasEmailIntegration) {
        return {
          allowed: false,
          reason: 'Email integration not connected',
          suggestion: 'Please connect your Gmail or Outlook account to send emails.',
          severity: 'info',
        };
      }
    }

    if (actionType === 'calendar_event') {
      const hasCalendarIntegration = user.integrations?.googleCalendar?.connected ||
                                      user.integrations?.outlookCalendar?.connected;
      if (!hasCalendarIntegration) {
        return {
          allowed: false,
          reason: 'Calendar integration not connected',
          suggestion: 'Please connect your Google Calendar or Outlook Calendar to create events.',
          severity: 'info',
        };
      }
    }

    // Additional permission checks can be added here

    return { allowed: true };
  }

  /**
   * ============================================================
   * CONTENT MODERATION
   * ============================================================
   */
  private checkContentModeration(content: string): GuardrailResult {
    const lowerContent = content.toLowerCase();

    // Offensive language check (basic - expand as needed)
    const offensivePatterns = [
      /\b(fuck|shit|bitch|asshole|damn|hell)\b/gi,
      // Add more patterns as needed, but be careful not to be overly restrictive
    ];

    const hasOffensive = offensivePatterns.some(pattern => pattern.test(content));

    if (hasOffensive) {
      return {
        allowed: true, // Allow but warn
        reason: 'Potentially offensive language detected',
        suggestion: 'I noticed some potentially strong language. I\'ll still process this, but just wanted to check if that was intentional.',
        severity: 'info',
      };
    }

    // Spam detection (repetitive content)
    const words = content.split(/\s+/);
    const wordCounts = new Map<string, number>();
    words.forEach(word => {
      const count = wordCounts.get(word) || 0;
      wordCounts.set(word, count + 1);
    });

    const maxRepetition = Math.max(...Array.from(wordCounts.values()));
    const repetitionRatio = maxRepetition / words.length;

    if (repetitionRatio > 0.5 && words.length > 10) {
      return {
        allowed: false,
        reason: 'Spam detected',
        suggestion: 'This message appears to be spam or repetitive content. Please provide a clearer message.',
        severity: 'warning',
      };
    }

    return { allowed: true };
  }

  /**
   * ============================================================
   * PRIVACY COMPLIANCE
   * ============================================================
   */
  private checkPrivacyCompliance(context: ActionContext): GuardrailResult {
    const { actionType, content, metadata } = context;

    // Check for sharing of personal information
    const hasEmail = this.sensitivePatterns.email.test(content);
    const hasPhone = this.sensitivePatterns.phone.test(content);
    const hasIP = this.sensitivePatterns.ipAddress.test(content);

    if ((hasEmail || hasPhone || hasIP) && actionType === 'email_draft') {
      return {
        allowed: true, // Allow but warn
        reason: 'Personal information in email',
        suggestion: 'I noticed this email contains personal contact information. Please double-check the recipients before sending.',
        severity: 'info',
      };
    }

    // GDPR/CCPA compliance checks
    if (actionType === 'note' && content.length > 10000) {
      return {
        allowed: true,
        reason: 'Large data storage',
        suggestion: 'This is a large amount of data. Just to confirm - you have the right to request deletion of this data at any time.',
        severity: 'info',
      };
    }

    return { allowed: true };
  }

  /**
   * ============================================================
   * SANITIZE CONTENT
   * ============================================================
   */
  sanitizeContent(content: string, mode: 'strict' | 'moderate' | 'lenient' = 'moderate'): string {
    let sanitized = content;

    if (mode === 'strict') {
      // Remove all potential sensitive data
      sanitized = sanitized
        .replace(this.sensitivePatterns.creditCard, '[CREDIT CARD REDACTED]')
        .replace(this.sensitivePatterns.ssn, '[SSN REDACTED]')
        .replace(this.sensitivePatterns.password, '[PASSWORD REDACTED]')
        .replace(this.sensitivePatterns.apiKey, '[API KEY REDACTED]')
        .replace(this.sensitivePatterns.privateKey, '[PRIVATE KEY REDACTED]');
    } else if (mode === 'moderate') {
      // Redact only highly sensitive data
      sanitized = sanitized
        .replace(this.sensitivePatterns.creditCard, '[CARD NUMBER]')
        .replace(this.sensitivePatterns.ssn, '[SSN]')
        .replace(this.sensitivePatterns.password, '[PASSWORD]');
    }

    // Always remove excessive whitespace
    sanitized = sanitized.replace(/\s+/g, ' ').trim();

    return sanitized;
  }

  /**
   * ============================================================
   * VALIDATE EMAIL RECIPIENTS
   * ============================================================
   */
  validateEmailRecipients(recipients: string[]): GuardrailResult {
    if (recipients.length > 50) {
      return {
        allowed: false,
        reason: 'Too many recipients',
        suggestion: 'Sending to more than 50 recipients at once requires manual confirmation. Please use your email client directly for bulk sends.',
        severity: 'warning',
      };
    }

    // Check for valid email format
    const invalidEmails = recipients.filter(email =>
      !this.sensitivePatterns.email.test(email)
    );

    if (invalidEmails.length > 0) {
      return {
        allowed: false,
        reason: 'Invalid email addresses',
        suggestion: `These email addresses appear invalid: ${invalidEmails.join(', ')}. Please double-check and try again.`,
        severity: 'error',
      };
    }

    return { allowed: true };
  }

  /**
   * ============================================================
   * VALIDATE TIME/DATE
   * ============================================================
   */
  validateDateTime(dateTime: string | Date): GuardrailResult {
    try {
      const date = new Date(dateTime);
      const now = new Date();

      // Check if date is valid
      if (isNaN(date.getTime())) {
        return {
          allowed: false,
          reason: 'Invalid date/time',
          suggestion: 'The date or time format is not recognized. Please try using a format like "tomorrow at 3pm" or "2025-02-15 14:00".',
          severity: 'error',
        };
      }

      // Warn if date is too far in the past
      const daysDifference = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
      if (daysDifference > 30) {
        return {
          allowed: true,
          reason: 'Date is in the past',
          suggestion: `This date is ${Math.floor(daysDifference)} days in the past. Is this correct?`,
          severity: 'warning',
        };
      }

      // Warn if date is too far in the future
      if (daysDifference < -365) {
        return {
          allowed: true,
          reason: 'Date is far in the future',
          suggestion: `This date is more than a year away. Is this correct?`,
          severity: 'info',
        };
      }

      return { allowed: true };
    } catch (error) {
      return {
        allowed: false,
        reason: 'Invalid date/time format',
        severity: 'error',
      };
    }
  }

  /**
   * ============================================================
   * CHECK FOR CONFLICTING ACTIONS
   * ============================================================
   */
  async checkConflicts(context: ActionContext): Promise<GuardrailResult> {
    const { userId, actionType, metadata } = context;

    // Example: Check if trying to create event at conflicting time
    if (actionType === 'calendar_event' && metadata?.startTime) {
      const Event = (await import('../models/Event')).default;
      const conflictingEvents = await Event.find({
        userId,
        startTime: {
          $lte: new Date(metadata.endTime || metadata.startTime),
        },
        endTime: {
          $gte: new Date(metadata.startTime),
        },
      });

      if (conflictingEvents.length > 0) {
        return {
          allowed: true,
          reason: 'Calendar conflict detected',
          suggestion: `You already have an event scheduled at this time: "${conflictingEvents[0].title}". Would you like to proceed anyway?`,
          severity: 'warning',
        };
      }
    }

    return { allowed: true };
  }

  /**
   * ============================================================
   * USAGE ANALYTICS
   * ============================================================
   */
  logGuardrailAction(userId: string, result: GuardrailResult, context: ActionContext): void {
    // Log guardrail actions for analytics and improvement
    console.log(`📊 Guardrail Action:`, {
      userId,
      actionType: context.actionType,
      allowed: result.allowed,
      reason: result.reason,
      severity: result.severity,
      timestamp: new Date().toISOString(),
    });

    // In production, you'd want to store this in a database for analysis
  }
}

export default new PAGuardrailsService();
