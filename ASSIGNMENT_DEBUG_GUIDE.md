# Assignment Processing Debug Guide

## 🐛 Issue: Assignments Not Showing Up or Completing

You reported: *"Find me 10 best affordable hotels in Dubai"* - PA says it will find them, but no assignment appears and no notifications show up.

This guide will help you debug the assignment processing flow step-by-step.

---

## 🔍 Diagnostic Steps

### Step 1: Check If Assignment Is Created

**Test the endpoint:**
```bash
# Send message asking for hotel research
curl -X POST http://localhost:3000/api/conversations/send-message-optimized \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "Find me 10 best affordable hotels in Dubai"}'
```

**Look for in the response:**
```json
{
  "success": true,
  "data": {
    "aiResponse": "On it Boss! I'm researching the 10 best affordable hotels in Dubai...",
    "actionsExecuted": [
      {
        "type": "assignment",
        "data": {
          "_id": "ASSIGNMENT_ID_HERE",
          "title": "Find 10 best affordable hotels in Dubai",
          "status": "in_progress"
        }
      }
    ]
  }
}
```

**✅ If you see assignment in `actionsExecuted`:** Assignment was created! Continue to Step 2.

**❌ If no assignment in response:** The AI didn't detect it as an assignment. Check server logs for:
```
[OptimizedController] AI response received: { hasActions: false, assignments: [] }
```

**Possible fixes:**
- AI might not be recognizing the pattern → Prompts have been updated with hotel example
- Check that `/send-message-optimized` is being used (not the old `/send-message` endpoint)

---

### Step 2: Verify Assignment in Database

**Check database:**
```bash
# Get all assignments
curl -X GET "http://localhost:3000/api/assignments?status=in_progress" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "ASSIGNMENT_ID",
      "title": "Find 10 best affordable hotels in Dubai",
      "query": "Find 10 best affordable hotels in Dubai with prices...",
      "type": "research",
      "status": "in_progress",
      "findings": "",
      "notificationSent": false
    }
  ],
  "count": 1
}
```

**✅ If assignment exists with `status: "in_progress"`:** Assignment is in database! Continue to Step 3.

**❌ If no assignments found:** Assignment wasn't saved. Check server logs for:
```
[OptimizedController] Failed to create assignment: [error]
```

---

### Step 3: Check If Job Was Queued

**Look at server logs when you send the message:**

**Expected logs:**
```
[OptimizedController] Assignment created: Find 10 best affordable hotels in Dubai
[OptimizedController] Assignment queued: 67a1234567890abcdef12345
[AssignmentProcessing] ⏰ Queued assignment for processing: 67a1234567890abcdef12345
```

**✅ If you see "Assignment queued":** Job was queued! Continue to Step 4.

**❌ If no "Assignment queued" log:** Job wasn't queued. Check for Agenda errors:
```
[AgendaService] Error scheduling job assignment-processing: [error]
```

**Possible fixes:**
- Agenda service not initialized properly
- MongoDB connection issue
- Check that `JobScheduler.initialize()` was called on server startup

---

### Step 4: Check If Agenda Is Running the Job

**Look for these logs within 30 seconds of creating assignment:**

**Expected logs:**
```
[AgendaService] 🔄 Job starting: assignment-processing
[AssignmentProcessing] Starting assignment: 67a1234567890abcdef12345
[AssignmentProcessing] Researching: Find 10 best affordable hotels in Dubai
[AssignmentProcessing] ✅ Research completed in 3456ms
[AssignmentProcessing] 📝 Auto-created note: 67a9876543210fedcba09876
[AssignmentProcessing] 🔔 Notification created: 67a5555555555555555555555
[AssignmentProcessing] ✅✅✅ Assignment completed successfully
[AgendaService] ✅ Job completed: assignment-processing
```

**✅ If you see these logs:** Job ran successfully! Continue to Step 5.

**❌ If no job starting logs:** Agenda isn't processing jobs. Check:
```bash
# Check if Agenda is running
# Look for this log on server startup:
[AgendaService] ⚡ Agenda job processor started successfully
```

**Possible fixes:**
- Restart the server
- Check MongoDB connection
- Verify Agenda is started: Look for `AgendaService.start()` in server startup

---

### Step 5: Verify Assignment Completed

**Check assignment status:**
```bash
curl -X GET "http://localhost:3000/api/assignments/ASSIGNMENT_ID" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected response:**
```json
{
  "success": true,
  "data": {
    "_id": "ASSIGNMENT_ID",
    "status": "completed",
    "findings": "Here are the 10 best affordable hotels in Dubai:\n\n1. Hotel A...",
    "notificationSent": true,
    "completedAt": "2025-01-15T..."
  }
}
```

**✅ If `status: "completed"` and `findings` is populated:** Research completed! Continue to Step 6.

**❌ If `status: "failed"` or `findings` is empty:** Job failed. Check logs for:
```
[AssignmentProcessing] ❌ Error processing assignment: [error message]
```

**Common failures:**
- OpenAI API key missing/invalid → Check `process.env.OPENAI_API_KEY`
- OpenAI rate limit → Wait and retry
- Network error → Check internet connection

**Manual retry:**
```bash
curl -X POST "http://localhost:3000/api/assignments/ASSIGNMENT_ID/retry" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### Step 6: Check If Notification Was Created

**Get notifications:**
```bash
curl -X GET "http://localhost:3000/api/notifications?limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "NOTIFICATION_ID",
      "type": "ai_suggestion",
      "title": "Research Complete: Find 10 best affordable hotels in Dubai",
      "message": "Here are the 10 best affordable hotels in Dubai: 1. Hotel A...",
      "read": false,
      "relatedModel": "Assignment",
      "relatedId": "ASSIGNMENT_ID",
      "metadata": {
        "noteId": "NOTE_ID",
        "fullFindings": "..."
      }
    }
  ]
}
```

**✅ If notification exists:** Notification was created! Continue to Step 7.

**❌ If no notification:** Notification wasn't created. Check logs:
```
[AssignmentProcessing] Failed to create notification: [error]
```

---

### Step 7: Verify Frontend Is Fetching Notifications

**Frontend issue:**
- The backend completed everything, but the frontend isn't showing notifications

**Check:**
1. Is the notifications screen refreshing/polling for new notifications?
2. Is the API endpoint correct: `/api/notifications`?
3. Are there any errors in the app logs/console?

**Test manually:**
Use the `curl` command from Step 6 to verify notifications exist in the database.

---

## 🛠️ Quick Fixes

### Fix 1: Restart Server with Verbose Logging

```bash
# Stop server
# Start with debug logging
npm run dev
```

Watch for these critical logs:
```
✅ All background jobs initialized and started (including profile learning)
[AgendaService] ✅ Agenda connected to MongoDB
[AgendaService] ⚡ Agenda job processor started successfully
[AssignmentProcessing] ✅ Assignment processing job initialized
```

### Fix 2: Manually Trigger Assignment Processing

If Agenda isn't running jobs automatically, manually trigger:

```bash
# 1. Get assignment ID
curl -X GET "http://localhost:3000/api/assignments?status=in_progress" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 2. Manually retry the assignment
curl -X POST "http://localhost:3000/api/assignments/YOUR_ASSIGNMENT_ID/retry" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

This will re-queue the job and force processing.

### Fix 3: Check Agenda Jobs Collection

**Using MongoDB shell:**
```javascript
// Connect to your database
use yofam_local

// Check if jobs collection exists
db.getCollectionNames()

// Check if assignment job is in the queue
db.jobs.find({ name: "assignment-processing" }).pretty()

// Look for:
// - nextRunAt: should be a recent date
// - lastRunAt: when it last ran
// - failReason: if it failed, why?
```

**Common issues in jobs collection:**
- `nextRunAt` is null → Job not scheduled
- `failReason` present → Job failed, check reason
- `lockedAt` is old → Job got stuck, restart server

### Fix 4: Verify OpenAI Service

```bash
# Test OpenAI service directly
# Create a test file: test_openai.js

const { openaiService } = require('./src/services/openaiService');

async function test() {
  const response = await openaiService.generateChatCompletion(
    [{ role: 'user', content: 'Say hello' }],
    'test-user-id',
    'Yo!'
  );
  console.log('OpenAI Response:', response);
}

test();
```

Run: `node test_openai.js`

**✅ If it works:** OpenAI is fine.
**❌ If it fails:** Check API key in `.env`

---

## 📊 Assignment Stats Endpoint

Get overview of all assignments:

```bash
curl -X GET "http://localhost:3000/api/assignments/stats" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 15,
    "inProgress": 2,
    "completed": 12,
    "failed": 1,
    "recentCompleted": [
      {
        "title": "Find 10 best affordable hotels in Dubai",
        "type": "research",
        "completedAt": "2025-01-15T...",
        "findings": "..."
      }
    ]
  }
}
```

This shows:
- How many assignments you've created
- How many are stuck in progress
- How many failed (and why)

---

## 🧪 Complete Test Flow

**Run this complete test:**

```bash
# 1. Send message
RESPONSE=$(curl -s -X POST http://localhost:3000/api/conversations/send-message-optimized \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "Find me 10 best affordable hotels in Dubai"}')

echo "Step 1 - AI Response:"
echo $RESPONSE | jq '.data.actionsExecuted'

# 2. Extract assignment ID
ASSIGNMENT_ID=$(echo $RESPONSE | jq -r '.data.actionsExecuted[0].data._id')
echo "\nStep 2 - Assignment ID: $ASSIGNMENT_ID"

# 3. Wait 5 seconds for job to process
echo "\nWaiting 5 seconds for job to process..."
sleep 5

# 4. Check assignment status
echo "\nStep 3 - Assignment Status:"
curl -s -X GET "http://localhost:3000/api/assignments/$ASSIGNMENT_ID" \
  -H "Authorization: Bearer YOUR_TOKEN" | jq '.data.status, .data.findings'

# 5. Check notifications
echo "\nStep 4 - Recent Notifications:"
curl -s -X GET "http://localhost:3000/api/notifications?limit=5" \
  -H "Authorization: Bearer YOUR_TOKEN" | jq '.data[].title'
```

**Expected output:**
```
Step 1 - AI Response:
[{
  "type": "assignment",
  "data": {...}
}]

Step 2 - Assignment ID: 67a1234567890abcdef12345

Waiting 5 seconds for job to process...

Step 3 - Assignment Status:
"completed"
"Here are the 10 best affordable hotels in Dubai..."

Step 4 - Recent Notifications:
"Research Complete: Find 10 best affordable hotels in Dubai"
```

---

## ❓ FAQ

**Q: How long should assignment processing take?**
A: Usually 3-10 seconds depending on OpenAI API response time.

**Q: What if assignment is stuck in "in_progress" for minutes?**
A: Either Agenda isn't running, or the job failed silently. Check logs and use the retry endpoint.

**Q: Can I see assignment results without checking notifications?**
A: Yes! Assignments auto-create notes. Check `/api/notes` for a note titled "Research: [assignment title]"

**Q: Why isn't the notification showing in my app?**
A: Backend is working. Issue is in frontend. Check if:
- Notifications screen is polling `/api/notifications`
- Notifications are being filtered out (check `read` status)
- App has permission to show notifications

---

## 🚀 Next Steps After Fixing

1. Test with various research queries:
   - "Compare iPhone vs Samsung"
   - "Find cheapest flights to Paris"
   - "Best restaurants in Tokyo"

2. Monitor assignment stats regularly

3. If assignments work but notifications don't show in app:
   - Check frontend notification fetching logic
   - Verify Redux/state management
   - Check notification permission settings

---

**Generated:** 2025-01-15
**Purpose:** Debug assignment processing issues
**Related Files:**
- `src/jobs/assignmentProcessingJob.ts` - Job processor
- `src/controllers/optimizedConversationController.ts` - Creates assignments
- `src/prompts/modularPrompts.ts` - Assignment examples
- `src/routes/assignments.ts` - Assignment endpoints
