# Advanced PA Training & Guardrails - Integration Guide

## 📋 Overview

This guide shows you how to integrate the advanced PA training scenarios, guardrails, memory management, and system prompts into your existing application.

## 🎯 What's Been Created

### 1. **Comprehensive Training Scenarios** (`src/prompts/comprehensiveTrainingScenarios.ts`)
   - 100+ training scenarios covering:
     - Multi-step task execution
     - Ambiguity resolution
     - Error handling and recovery
     - Context switching
     - Proactive suggestions
     - Privacy and security
     - Integration-aware responses
     - Time-sensitive scenarios
     - Multi-intent handling
     - Clarification requests

### 2. **Safety Guardrails Service** (`src/services/paGuardrailsService.ts`)
   - Sensitive data detection (credit cards, SSN, passwords, API keys)
   - Dangerous action prevention (mass deletion, bulk communications, financial transactions)
   - Rate limiting (prevents abuse)
   - Permission verification
   - Content moderation
   - Privacy compliance checks

### 3. **Memory & Context Service** (`src/services/paMemoryService.ts`)
   - User preference learning
   - Pattern detection
   - Conversation context management
   - Long-term memory storage
   - Feedback learning
   - Memory consolidation

### 4. **Advanced System Prompt** (`src/prompts/advancedPASystemPrompt.ts`)
   - Dynamic prompt generation based on context
   - User personalization
   - Mood-aware responses
   - Memory-enhanced conversations

---

## 🚀 Integration Steps

### Step 1: Install Dependencies (if needed)

No additional dependencies are required - everything uses your existing stack.

### Step 2: Update Conversation Controller

Update `src/controllers/conversationController.ts` to integrate guardrails and memory:

```typescript
import paGuardrailsService from '../services/paGuardrailsService';
import paMemoryService from '../services/paMemoryService';
import generateAdvancedSystemPrompt from '../prompts/advancedPASystemPrompt';

// In the sendMessage function, BEFORE executing actions:
export const sendMessage = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { message, conversationId } = req.body;

    // Initialize or get conversation context
    let context = paMemoryService.getContext(conversationId);
    if (!context) {
      context = paMemoryService.initializeContext(userId!, conversationId);
    }

    // Detect user mood
    const mood = paMemoryService.detectMood(message);
    paMemoryService.updateContext(conversationId, { userMood: mood });

    // Run guardrail check on user message
    const guardrailCheck = await paGuardrailsService.checkAction({
      userId: userId!,
      actionType: 'message',
      content: message,
      metadata: { conversationId }
    });

    if (!guardrailCheck.allowed) {
      return res.status(400).json({
        success: false,
        error: guardrailCheck.reason,
        suggestion: guardrailCheck.suggestion,
        severity: guardrailCheck.severity
      });
    }

    // Generate enhanced context for AI
    const enhancedContext = await paMemoryService.generateEnhancedContext(
      userId!,
      conversationId
    );

    // Get user preferences
    const assistantName = await paMemoryService.getPreference(userId!, 'assistantName', 'Yo!');

    // Generate advanced system prompt
    const systemPrompt = generateAdvancedSystemPrompt({
      assistantName,
      userName: user?.name,
      userContext: enhancedContext,
      conversationPhase: context.conversationPhase,
      userMood: mood
    });

    // Use this systemPrompt in your OpenAI call
    const chatMessages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...conversation.messages.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      }))
    ];

    // ... rest of your existing code ...

    // After actions are executed, check guardrails for each action
    for (const action of actionsExecuted) {
      const actionCheck = await paGuardrailsService.checkAction({
        userId: userId!,
        actionType: action.type,
        content: JSON.stringify(action.data),
        metadata: { conversationId }
      });

      if (!actionCheck.allowed) {
        console.warn(`⚠️ Guardrail blocked action: ${action.type}`, actionCheck);
        // Optionally inform user
      }
    }

    // Remember this interaction
    await paMemoryService.rememberFact(
      userId!,
      'interaction',
      `User asked: ${message.substring(0, 100)}`,
      0.5
    );

    // ... return response ...
  } catch (error) {
    // ... error handling ...
  }
};
```

### Step 3: Add Guardrails to Action Execution

Before creating any task, assignment, note, reminder, or event:

```typescript
// Example for task creation
if (intentData.tasks && intentData.tasks.length > 0) {
  for (const taskData of intentData.tasks) {
    // Check guardrails BEFORE creating
    const guardrailCheck = await paGuardrailsService.checkAction({
      userId,
      actionType: 'task',
      content: taskData.title + ' ' + taskData.description,
      metadata: taskData
    });

    if (!guardrailCheck.allowed) {
      console.warn(`🛡️ Task creation blocked:`, guardrailCheck);
      // Optionally notify user
      continue; // Skip this task
    }

    // Sanitize content
    const sanitizedTitle = paGuardrailsService.sanitizeContent(
      taskData.title,
      'moderate'
    );

    const task = new Task({
      userId,
      title: sanitizedTitle,
      description: taskData.description || '',
      priority: taskData.priority || 'medium',
      dueDate: taskData.dueDate ? new Date(taskData.dueDate) : null,
      status: 'pending',
      createdBy: 'ai',
    });

    await task.save();
    actionsExecuted.push({ type: 'task', data: task });
  }
}
```

### Step 4: Implement Pattern Detection

Add a background job or cron task to detect patterns:

```typescript
// In a cron job or scheduled task (e.g., daily)
import paMemoryService from './services/paMemoryService';

async function detectUserPatterns(userId: string) {
  const patterns = await paMemoryService.detectPatterns(userId);

  console.log(`Detected patterns for user ${userId}:`, patterns);

  // Optionally create proactive notifications based on patterns
  if (patterns.includes('recurring_task:weekly_report')) {
    // Suggest automation
    await Notification.createNotification({
      userId,
      type: 'ai_suggestion',
      title: 'Automate Recurring Task?',
      message: 'I noticed you create a "Weekly Report" task every week. Would you like me to automatically create this for you?',
      priority: 'low'
    });
  }
}
```

### Step 5: Add User Feedback Learning

Create an endpoint for users to provide feedback:

```typescript
// In a new route: src/routes/feedback.ts
router.post('/feedback', auth, async (req: AuthRequest, res: Response) => {
  const { conversationId, messageId, feedbackType, details } = req.body;
  const userId = req.userId!;

  await paMemoryService.recordFeedback(
    userId,
    conversationId,
    messageId,
    feedbackType, // 'positive', 'negative', 'correction'
    details
  );

  res.json({ success: true, message: 'Feedback recorded' });
});
```

### Step 6: Periodic Memory Consolidation

Run memory consolidation daily to clean up old, unused memories:

```typescript
// In a cron job
import paMemoryService from './services/paMemoryService';

async function consolidateMemoriesForAllUsers() {
  const users = await User.find({});

  for (const user of users) {
    await paMemoryService.consolidateMemories(user._id.toString());
  }

  console.log(`✅ Memory consolidation complete for ${users.length} users`);
}

// Run daily
setInterval(consolidateMemoriesForAllUsers, 24 * 60 * 60 * 1000);
```

---

## 📖 Usage Examples

### Example 1: User Message with Guardrails

```typescript
// User says: "Save my credit card 1234-5678-9012-3456"

// Guardrail detects sensitive data
const result = await paGuardrailsService.checkAction({
  userId: 'user123',
  actionType: 'note',
  content: 'Save my credit card 1234-5678-9012-3456'
});

// Returns:
{
  allowed: false,
  reason: 'Sensitive information detected: credit card numbers',
  suggestion: 'For your security, I cannot store credit card numbers. Please use a secure password manager instead.',
  severity: 'critical'
}

// PA responds:
"For your security, I cannot store credit card numbers. I recommend using a secure password manager like 1Password or LastPass. Would you like me to find information about secure password managers?"
```

### Example 2: Learning User Preferences

```typescript
// User always creates tasks at 9am
// After 10+ interactions, pattern is detected:

await paMemoryService.learnPreference(
  'user123',
  'preferred_task_creation_time',
  { hour: 9 },
  'implicit',
  0.8
);

// Later, when user creates task at 2pm:
const preferredTime = await paMemoryService.getPreference(
  'user123',
  'preferred_task_creation_time'
);

// PA can suggest:
"I notice you usually create tasks in the morning around 9am. Would you like me to set the due time for 9am tomorrow?"
```

### Example 3: Context-Aware Response

```typescript
// Conversation:
User: "I need to prepare for a client meeting next week"
PA: "I'll help you prepare. What's the meeting about?"
User: "Product demo"
// Context is stored: topic = "product demo", mentioned entities = { meetingType: "product demo" }

User: "Find the best presentation templates for that"
// PA knows "that" refers to "product demo"

const context = paMemoryService.getContext(conversationId);
// context.mentionedEntities.get('meetingType') === 'product demo'

PA: "I'm researching the best presentation templates for product demos. I'll send you my findings shortly!"
```

### Example 4: Proactive Morning Briefing

```typescript
// In your notification service or scheduled task:
import generateAdvancedSystemPrompt from './prompts/advancedPASystemPrompt';
import paContextService from './services/paContextService';

async function sendMorningBriefing(userId: string) {
  const context = await paContextService.getContext(userId);

  // Check if user has events or tasks today
  if (context.currentData.events.today > 0 || context.currentData.tasks.dueToday > 0) {
    const briefingPrompt = generateAdvancedSystemPrompt({
      assistantName: context.user.assistantName,
      userName: context.user.name,
      conversationPhase: 'greeting',
      userMood: 'neutral',
      userContext: await paContextService.getContextSummary(userId)
    });

    // Generate briefing with AI
    const briefing = await openaiService.generateChatCompletion(
      [
        { role: 'system', content: briefingPrompt },
        { role: 'user', content: 'Give me my morning briefing' }
      ],
      userId,
      context.user.assistantName
    );

    // Send as notification
    await Notification.createNotification({
      userId,
      type: 'daily_briefing',
      title: 'Good Morning! Here\'s your briefing',
      message: briefing.message,
      priority: 'medium'
    });
  }
}
```

---

## 🎯 Training the PA with Scenarios

To train the PA with the comprehensive scenarios:

```typescript
import trainingScenarios from './prompts/comprehensiveTrainingScenarios';

// Use scenarios in your tests or fine-tuning process
const { multiStepScenarios, ambiguityScenarios, errorHandlingScenarios } = trainingScenarios;

// Example: Test PA's handling of multi-step scenarios
for (const scenario of multiStepScenarios) {
  console.log(`Testing scenario: ${scenario.scenario}`);

  // Send the userInput to your PA
  const response = await testPAResponse(scenario.userInput);

  // Verify expected behavior
  // ... assertion logic ...
}
```

---

## 🔒 Security Best Practices

1. **Always run guardrails BEFORE executing actions**
2. **Sanitize all user input before storage**
3. **Never log sensitive data**
4. **Implement rate limiting on all endpoints**
5. **Regularly review guardrail logs for false positives/negatives**
6. **Keep sensitive patterns updated as new threats emerge**

---

## 📊 Monitoring & Analytics

Track these metrics to improve your PA:

```typescript
// Log guardrail actions
paGuardrailsService.logGuardrailAction(userId, result, context);

// Track preference accuracy
const preferenceAccuracy = (confirmedPreferences / totalLearnedPreferences) * 100;

// Monitor pattern detection success
const patternUtilization = (patternsActedUpon / patternsDetected) * 100;

// Measure response quality
const positivefeedback = (positiveFeedbackCount / totalInteractions) * 100;
```

---

## 🚦 Testing Checklist

- [ ] Sensitive data is blocked from storage
- [ ] Dangerous actions require confirmation
- [ ] Rate limits prevent abuse
- [ ] Permissions are verified before integration actions
- [ ] User preferences are learned over time
- [ ] Patterns are detected and acted upon
- [ ] Context is maintained across conversations
- [ ] Mood detection adapts responses
- [ ] Memory consolidation runs regularly
- [ ] Feedback improves future responses

---

## 🎓 Next Steps

1. **Integrate guardrails** into all action execution points
2. **Add memory service** to conversation controller
3. **Implement feedback collection** in the UI
4. **Set up pattern detection** cron jobs
5. **Create proactive notification** system
6. **Test extensively** with various scenarios
7. **Monitor and iterate** based on user feedback

---

## 📚 Reference

- **Training Scenarios**: `src/prompts/comprehensiveTrainingScenarios.ts`
- **Guardrails Service**: `src/services/paGuardrailsService.ts`
- **Memory Service**: `src/services/paMemoryService.ts`
- **System Prompt**: `src/prompts/advancedPASystemPrompt.ts`
- **Existing Context Service**: `src/services/paContextService.ts`
- **Conversation Controller**: `src/controllers/conversationController.ts`

---

## ❓ Troubleshooting

### Guardrails too restrictive?
Adjust sensitivity levels in `paGuardrailsService.ts`. Consider adding whitelist patterns.

### Memory not persisting?
Implement the database persistence methods in `paMemoryService.ts` (currently logging only).

### Patterns not detected?
Ensure sufficient data (minimum 10-20 interactions). Lower thresholds if needed.

### Context not maintained?
Check that `conversationId` is consistent across messages. Verify context cache isn't cleared prematurely.

---

## 🎉 Conclusion

You now have a sophisticated PA with:
✅ Comprehensive training scenarios
✅ Robust safety guardrails
✅ Advanced memory and learning
✅ Context-aware intelligence
✅ Proactive capabilities

The PA will continuously improve as it learns from user interactions!
