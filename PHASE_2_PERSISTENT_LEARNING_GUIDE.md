# Phase 2: Persistent Learning & Proactive Intelligence

## 🎯 Overview

Phase 2 transforms your PA from a reactive assistant into a **self-improving, proactive companion** that learns from every interaction and gets smarter over time.

**What Changed:**
- ✅ **Persistent Learning**: PA remembers preferences, work hours, common tasks, relationships
- ✅ **Feedback System**: Users can rate responses (1-5 stars) to improve quality
- ✅ **Proactive Intelligence**: PA detects patterns and sends timely reminders
- ✅ **Personalized Responses**: Communication style adapts to each user

---

## 📊 Key Metrics & Improvements

### Learning Capabilities

| Feature | Before | After | Improvement |
|---------|--------|-------|-------------|
| **Memory** | Session-only | Persistent across sessions | ∞ |
| **Personalization** | Generic responses | Learned preferences | High |
| **Proactivity** | Reactive only | Detects forgotten activities | New feature |
| **Quality Tracking** | None | 1-5 star ratings + analytics | New feature |

### Performance

- **Initial Response**: Same as Phase 1 (single AI call, ~1500 tokens)
- **Learning Overhead**: +50-100ms per request (background learning)
- **Storage**: ~5KB per user profile

---

## 🧠 How Learning Works

### 1. UserProfile Model

The PA builds a comprehensive profile for each user:

```typescript
interface UserProfile {
  // Communication preferences
  communicationStyle: 'casual' | 'formal' | 'balanced';
  responseLength: 'brief' | 'balanced' | 'detailed';
  preferredGreeting: string;

  // Work patterns
  workHours: {
    enabled: boolean;
    start: string; // "09:00"
    end: string;   // "17:00"
    workDays: number[]; // [1, 2, 3, 4, 5] = Mon-Fri
  };

  // Relationships
  relationships: Array<{
    name: string;
    relation: 'spouse' | 'partner' | 'family' | 'friend' | 'colleague';
    importanceLevel: 1-5;
    notes: string;
  }>;

  // Common tasks
  commonTasks: Array<{
    title: string;
    frequency: 'daily' | 'weekly' | 'monthly';
    preferredTime: string;
    automationOffered: boolean;
  }>;

  // Learning metadata
  successfulActions: number;
  failedActions: number;
  interactionCount: number;
  learningScore: number; // 0-100

  // User preferences
  likedSuggestions: string[];
  dislikedSuggestions: string[];
  forbiddenTopics: string[];
}
```

### 2. Automatic Learning

The PA learns automatically from:

#### A. Message Analysis (Real-time)
- **Formality detection**: Detects "please", "kindly", "thank you" → adjusts to formal style
- **Message length**: Short messages → brief responses, Long messages → detailed responses
- **Mood detection**: "urgent", "asap" → direct tone; "frustrated" → patient tone

#### B. Task Completion Patterns (Daily Job)
- **Work hours**: Analyzes task completion times over 30 days
- **Work days**: Detects which days user is most active
- **Common tasks**: Identifies recurring activities from Pattern model

#### C. User Feedback (Manual)
- **Star ratings**: 1-5 stars on each response
- **Specific issues**: incorrect_action, wrong_tone, missing_info, etc.
- **Corrections**: User can specify what they expected vs. what they got

---

## 🔄 Learning Flow Diagram

```
User sends message
       ↓
[Optimized Controller]
       ↓
Fetch UserProfile → Inject learned preferences into AI prompt
       ↓
[Single AI Call] → Personalized response (uses learned style, greetings, etc.)
       ↓
Execute actions → Record success/failure
       ↓
Update profile:
  - Record interaction count
  - Learn formality from message
  - Learn message length preference
       ↓
Return response to user
       ↓
[Optional] User rates response → Update Feedback model
       ↓
[Background Jobs]
  - Daily: Analyze task patterns → Update work hours, common tasks
  - Every 15 min: Check forgotten activities → Send reminders
```

---

## 📡 API Endpoints

### Feedback Collection

#### POST `/api/feedback`
Submit feedback on a PA response.

**Request:**
```json
{
  "conversationId": "507f1f77bcf86cd799439011",
  "messageId": "507f191e810c19729de860ea",
  "userMessage": "Remind me to call mom",
  "paResponse": "What time should I remind you, Boss?",
  "rating": 5,
  "specificIssue": null,
  "expectedResponse": null,
  "actionsCreated": [],
  "responseTimeMs": 1234
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "userId": "...",
    "rating": 5,
    "feedbackType": "positive"
  },
  "message": "Feedback submitted successfully"
}
```

**Rating Scale:**
- ⭐ 1-2: Negative (triggers learning adjustment)
- ⭐ 3: Neutral
- ⭐ 4-5: Positive (reinforces current approach)

**Specific Issues (optional):**
- `incorrect_action`: PA created wrong task/reminder
- `wrong_tone`: Too formal/casual
- `missing_info`: Response lacked important details
- `too_long`: Response was too verbose
- `too_short`: Response was too brief
- `misunderstood`: PA misinterpreted user intent
- `other`: General feedback

#### GET `/api/feedback/history`
Get user's feedback history.

**Query params:**
- `limit`: Number of records (default: 20)
- `offset`: Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "rating": 5,
      "feedbackType": "positive",
      "userMessage": "...",
      "paResponse": "...",
      "createdAt": "2025-01-15T10:30:00Z"
    }
  ],
  "count": 15
}
```

#### GET `/api/feedback/stats`
Get user's average rating and statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "average": 4.2,
    "total": 50
  }
}
```

---

## 🤖 Background Jobs

### 1. Profile Learning Job
**Schedule**: Daily at 2:00 AM
**Purpose**: Analyze user behavior and update profiles

**What it learns:**
- Work hours (from task completion patterns)
- Common tasks (from recurring patterns)
- Preferred activity times

**Process:**
1. Get all active users
2. For each user:
   - Run `ProfileLearningService.runFullAnalysis()`
   - Update work hours (if 20+ completed tasks in last 30 days)
   - Update common tasks (from Pattern model)
3. Log results

**Manual trigger:**
```typescript
import profileLearningJob from './jobs/profileLearningJob';
await profileLearningJob.triggerNow();
```

### 2. Forgotten Activity Job (Already exists)
**Schedule**: Every 15 minutes
**Purpose**: Remind users about forgotten habitual activities

**Example:**
- User usually completes "Daily standup notes" at 9:00 AM every weekday
- It's now 10:00 AM on a weekday and they haven't done it
- PA sends notification: "Hey Boss! Did you forget your daily standup notes?"

---

## 🎨 Frontend Integration Guide

### 1. Feedback UI Component

Create a rating component after each PA response:

```typescript
// FeedbackRating.tsx
import React, { useState } from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import ApiService from '../services/api';

interface Props {
  conversationId: string;
  messageId: string;
  userMessage: string;
  paResponse: string;
  responseTimeMs: number;
}

export default function FeedbackRating({
  conversationId,
  messageId,
  userMessage,
  paResponse,
  responseTimeMs
}: Props) {
  const [rating, setRating] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const submitRating = async (stars: number) => {
    try {
      setRating(stars);
      await ApiService.submitFeedback({
        conversationId,
        messageId,
        userMessage,
        paResponse,
        rating: stars,
        responseTimeMs,
      });
      setSubmitted(true);
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    }
  };

  if (submitted) {
    return (
      <Text style={{ color: '#4CAF50', fontSize: 12, marginTop: 5 }}>
        Thanks for your feedback! 🎉
      </Text>
    );
  }

  return (
    <View style={{ flexDirection: 'row', marginTop: 8 }}>
      <Text style={{ fontSize: 12, marginRight: 8 }}>Rate this response:</Text>
      {[1, 2, 3, 4, 5].map((stars) => (
        <TouchableOpacity
          key={stars}
          onPress={() => submitRating(stars)}
          style={{ marginHorizontal: 2 }}
        >
          <Text style={{ fontSize: 18 }}>
            {rating && stars <= rating ? '⭐' : '☆'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
```

### 2. API Service Methods

Add to `src/services/api.ts`:

```typescript
// Submit feedback
async submitFeedback(data: {
  conversationId: string;
  messageId: string;
  userMessage: string;
  paResponse: string;
  rating: number;
  specificIssue?: string;
  expectedResponse?: string;
  actionsCreated?: any[];
  responseTimeMs: number;
}) {
  const response = await this.api.post('/api/feedback', data);
  return response.data;
}

// Get feedback history
async getFeedbackHistory(limit = 20, offset = 0) {
  const response = await this.api.get('/api/feedback/history', {
    params: { limit, offset }
  });
  return response.data;
}

// Get feedback stats
async getFeedbackStats() {
  const response = await this.api.get('/api/feedback/stats');
  return response.data;
}
```

### 3. Integration in Chat Screen

```typescript
// ChatScreen.tsx
import FeedbackRating from '../components/FeedbackRating';

// In your message rendering:
{message.role === 'assistant' && (
  <FeedbackRating
    conversationId={conversationId}
    messageId={message._id}
    userMessage={previousUserMessage}
    paResponse={message.content}
    responseTimeMs={message.responseTimeMs || 0}
  />
)}
```

---

## 📈 Learning Quality Metrics

### Measuring PA Intelligence

The `learningScore` (0-100) is calculated based on:

```typescript
learningScore = (
  (successfulActions / totalInteractions) * 40 +  // 40% weight: accuracy
  (Math.min(interactionCount / 100, 1)) * 20 +    // 20% weight: experience
  (likedSuggestions.length * 2) +                  // 2 points per liked suggestion
  (commonTasks.length * 5) +                       // 5 points per learned task
  (relationships.length * 3) +                     // 3 points per relationship
  (hasWorkHours ? 10 : 0)                          // 10 points for work hours
)
```

**Score Interpretation:**
- 0-20: **Novice** - Just started learning
- 21-40: **Learning** - Building knowledge
- 41-60: **Competent** - Good understanding
- 61-80: **Proficient** - Strong personalization
- 81-100: **Expert** - Highly personalized and proactive

### Dashboard Analytics (Future Feature)

Show users their PA's learning progress:

```typescript
// Profile screen
const profile = await ApiService.getProfile();
const learningScore = profile.learningScore;

<View>
  <Text>PA Intelligence: {learningScore}/100</Text>
  <ProgressBar progress={learningScore / 100} />
  <Text>
    Your PA has learned:
    - {profile.commonTasks.length} common tasks
    - {profile.relationships.length} important relationships
    - {profile.successfulActions} successful actions
  </Text>
</View>
```

---

## 🔧 Configuration

### Environment Variables

No new environment variables needed! All learning happens automatically.

### Disable Learning (Optional)

To disable learning for specific users:

```typescript
// In UserProfile model
const profile = await UserProfile.findOne({ userId });
profile.learningEnabled = false;
await profile.save();
```

---

## 🚀 Benefits Summary

### For Users

1. **Personalized Experience**
   - PA greets you the way you like
   - Responses match your communication style
   - No need to repeat preferences

2. **Time Savings**
   - PA reminds you about forgotten habits
   - Suggests actions based on your patterns
   - Adapts to your work schedule

3. **Quality Improvement**
   - Your feedback directly improves PA
   - Learns what you like/dislike
   - Gets smarter over time

### For Developers

1. **Better AI Quality**
   - Collect training data from feedback
   - Fine-tune models with high-quality examples
   - Identify common failure patterns

2. **User Insights**
   - Understand user behavior patterns
   - Track satisfaction metrics (average rating)
   - Detect usability issues early

3. **Reduced Support Load**
   - PA self-corrects based on feedback
   - Proactive reminders reduce user frustration
   - Personalization reduces misunderstandings

---

## 📝 Testing the Learning System

### 1. Test Profile Learning

```bash
# Create a few tasks and complete them
curl -X POST http://localhost:3000/api/tasks \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"title": "Morning standup", "status": "completed", "completedAt": "2025-01-15T09:00:00Z"}'

# Wait for daily job (or trigger manually)
# Check if work hours were learned
curl http://localhost:3000/api/users/profile \
  -H "Authorization: Bearer YOUR_TOKEN"
# Should show learned work hours
```

### 2. Test Feedback System

```bash
# Submit feedback
curl -X POST http://localhost:3000/api/feedback \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "conversationId": "...",
    "messageId": "...",
    "userMessage": "Test message",
    "paResponse": "Test response",
    "rating": 5,
    "responseTimeMs": 1234
  }'

# Check stats
curl http://localhost:3000/api/feedback/stats \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. Test Personalization

```bash
# Send formal message
curl -X POST http://localhost:3000/api/conversations/send-message-optimized \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "message": "Could you please remind me about the meeting? Thank you kindly."
  }'

# PA should detect formality and respond professionally
# Check profile to see if it learned
curl http://localhost:3000/api/users/profile
# communicationStyle should move toward "formal"
```

---

## 🎓 Next Steps (Phase 3 Ideas)

1. **Advanced Analytics Dashboard**
   - Show learning score over time
   - Display most common tasks
   - Visualize work hour patterns

2. **Fine-Tuned Model**
   - Export high-quality feedback (4-5 stars)
   - Fine-tune GPT-3.5-turbo with user examples
   - Deploy custom model for better responses

3. **Smart Suggestions**
   - "You usually do X at this time, want me to create it?"
   - "I noticed you often forget Y, should I automate it?"
   - Proactive task creation based on patterns

4. **Multi-User Learning**
   - Aggregate anonymized patterns across all users
   - "90% of users do X after Y, want to try that?"
   - Improve baseline intelligence for new users

---

## 📚 Code Reference

### Key Files Created

**Models:**
- `src/models/UserProfile.ts` - Stores learned preferences
- `src/models/Feedback.ts` - Stores user ratings

**Services:**
- `src/services/ProfileLearningService.ts` - Learning logic
- `src/services/optimizedOpenAIService.ts` - Updated with learning

**Controllers:**
- `src/controllers/optimizedConversationController.ts` - Updated with learning

**Routes:**
- `src/routes/feedback.ts` - Feedback API endpoints

**Jobs:**
- `src/jobs/profileLearningJob.ts` - Daily profile analysis
- `src/jobs/forgottenActivityJob.ts` - Proactive reminders (existing)

**Prompts:**
- `src/prompts/modularPrompts.ts` - Updated to use learned preferences

---

## ❓ FAQ

**Q: How long does it take for PA to learn?**
A: Basic preferences (formality, greeting) are learned after 3-5 messages. Work hours and common tasks need 20+ completed tasks over 2+ weeks for accurate detection.

**Q: Can users see what PA has learned?**
A: Yes! The profile endpoint (`/api/users/profile`) includes learned data. You can show this in a "PA Intelligence" screen.

**Q: What if PA learns something wrong?**
A: Users can provide negative feedback (1-2 stars) with corrections. The PA will adjust based on this feedback.

**Q: Is learning data private?**
A: Yes! Each user has their own isolated profile. Learning data is never shared between users (unless you implement Phase 3 multi-user learning with anonymization).

**Q: Does learning slow down the PA?**
A: No! Learning happens in the background. Profile fetching adds only ~50ms to each request.

---

## 🎉 Conclusion

Phase 2 transforms your PA from a smart assistant into an **intelligent companion** that:
- ✅ Remembers your preferences forever
- ✅ Adapts to your communication style
- ✅ Learns your work patterns and habits
- ✅ Proactively reminds you about forgotten activities
- ✅ Gets smarter from your feedback

**Your PA is now self-improving and proactive!** 🚀

---

**Generated**: 2025-01-15
**Version**: 2.0
**Phase**: Persistent Learning & Proactive Intelligence
