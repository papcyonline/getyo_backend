# API Testing Guide - Yo! Personal Assistant

## Overview
This guide provides comprehensive testing instructions for all API endpoints including the newly added notification system, reminder endpoints, and AI features.

---

## Base URL
```
http://localhost:3000/api
```

## Authentication
All protected endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

---

## 🔔 Notification Endpoints (NEW)

### 1. Get All Notifications
```bash
GET /api/notifications
```

**Query Parameters:**
- `read` (optional): `true` | `false` - Filter by read status
- `type` (optional): `task` | `event` | `reminder` | `system` | `ai_suggestion` | `meeting` | `alert`
- `priority` (optional): `low` | `medium` | `high` | `urgent`
- `limit` (optional): Number - Default 50

**Example:**
```bash
curl -X GET "http://localhost:3000/api/notifications?read=false&limit=10" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "60f7b3b3b3b3b3b3b3b3b3b3",
      "userId": "user123",
      "type": "task",
      "title": "Task Due Soon",
      "message": "Your task 'Review Q4 reports' is due in 1 hour",
      "read": false,
      "priority": "high",
      "relatedId": "task123",
      "relatedModel": "Task",
      "createdAt": "2025-01-15T10:00:00.000Z"
    }
  ],
  "count": 1
}
```

---

### 2. Get Notification Count (Unread)
```bash
GET /api/notifications/count
```

**Example:**
```bash
curl -X GET "http://localhost:3000/api/notifications/count" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "count": 5
}
```

---

### 3. Get Recent Notifications
```bash
GET /api/notifications/recent?limit=10
```

**Example:**
```bash
curl -X GET "http://localhost:3000/api/notifications/recent?limit=5" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### 4. Create Notification
```bash
POST /api/notifications
```

**Body:**
```json
{
  "type": "reminder",
  "title": "Meeting Reminder",
  "message": "Your meeting starts in 15 minutes",
  "priority": "high",
  "relatedId": "event123",
  "relatedModel": "Event",
  "actionUrl": "/events/event123"
}
```

**Example:**
```bash
curl -X POST "http://localhost:3000/api/notifications" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "meeting",
    "title": "Meeting Starting Soon",
    "message": "Executive Team Meeting in 10 minutes",
    "priority": "urgent"
  }'
```

---

### 5. Mark Notification as Read
```bash
POST /api/notifications/:id/read
```

**Example:**
```bash
curl -X POST "http://localhost:3000/api/notifications/60f7b3b3b3b3b3b3b3b3b3b3/read" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### 6. Mark All Notifications as Read
```bash
POST /api/notifications/read-all
```

**Example:**
```bash
curl -X POST "http://localhost:3000/api/notifications/read-all" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "message": "All notifications marked as read",
  "modifiedCount": 5
}
```

---

### 7. Delete Notification
```bash
DELETE /api/notifications/:id
```

**Example:**
```bash
curl -X DELETE "http://localhost:3000/api/notifications/60f7b3b3b3b3b3b3b3b3b3b3" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### 8. Clear All Read Notifications
```bash
DELETE /api/notifications/read/clear
```

**Example:**
```bash
curl -X DELETE "http://localhost:3000/api/notifications/read/clear" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "message": "All read notifications cleared",
  "deletedCount": 3
}
```

---

## ⏰ Reminder Endpoints (ENHANCED)

### 1. Get All Reminders
```bash
GET /api/reminders
```

**Query Parameters:**
- `status` (optional): `active` | `completed` | `snoozed` | `cancelled`
- `isUrgent` (optional): `true` | `false`

**Example:**
```bash
curl -X GET "http://localhost:3000/api/reminders?status=active" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### 2. Get Upcoming Reminders
```bash
GET /api/reminders/upcoming?hours=24
```

**Example:**
```bash
curl -X GET "http://localhost:3000/api/reminders/upcoming?hours=12" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### 3. Get Overdue Reminders
```bash
GET /api/reminders/overdue
```

**Example:**
```bash
curl -X GET "http://localhost:3000/api/reminders/overdue" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### 4. Create Reminder
```bash
POST /api/reminders
```

**Body:**
```json
{
  "title": "Call dentist",
  "notes": "Schedule appointment for checkup",
  "reminderTime": "2025-01-16T14:00:00.000Z",
  "repeatType": "none",
  "isUrgent": false
}
```

---

### 5. Update Reminder
```bash
PUT /api/reminders/:id
```

**Body:**
```json
{
  "title": "Updated reminder title",
  "reminderTime": "2025-01-17T10:00:00.000Z",
  "isUrgent": true
}
```

---

### 6. Snooze Reminder
```bash
POST /api/reminders/:id/snooze
```

**Body:**
```json
{
  "minutes": 15
}
```

**Example:**
```bash
curl -X POST "http://localhost:3000/api/reminders/60f7b3b3b3b3b3b3b3b3b3b3/snooze" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"minutes": 30}'
```

---

### 7. Toggle Reminder Status
```bash
POST /api/reminders/:id/toggle-status
```

**Body:**
```json
{
  "status": "completed"
}
```

**Valid statuses:** `active`, `completed`, `cancelled`

---

### 8. Delete Reminder
```bash
DELETE /api/reminders/:id
```

---

## 🤖 AI Endpoints (ENHANCED)

### 1. Get Daily Briefing
```bash
GET /api/ai/daily-briefing
```

**Example:**
```bash
curl -X GET "http://localhost:3000/api/ai/daily-briefing" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "date": "1/15/2025",
    "tasksCount": 5,
    "eventsCount": 3,
    "remindersCount": 2,
    "highPriorityTasks": 2,
    "firstEvent": {
      "title": "Executive Team Meeting",
      "startTime": "2025-01-15T09:00:00.000Z",
      "location": "Conference Room A"
    },
    "tasks": [...],
    "events": [...],
    "reminders": [...]
  }
}
```

---

### 2. Get AI Suggestions
```bash
GET /api/ai/suggestions
```

**Example:**
```bash
curl -X GET "http://localhost:3000/api/ai/suggestions" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "suggestions": [
      "1. Consider rescheduling your 3pm meeting - you have back-to-back events",
      "2. High priority task 'Q4 Report' is due today",
      "3. You have 3 pending reminders for this afternoon"
    ],
    "generatedAt": "2025-01-15T08:00:00.000Z"
  }
}
```

---

### 3. AI Chat
```bash
POST /api/ai/chat
```

**Body:**
```json
{
  "message": "What's on my schedule today?",
  "conversationId": "optional-conversation-id",
  "context": {
    "location": "office"
  }
}
```

---

### 4. Process Command
```bash
POST /api/ai/process-command
```

**Body:**
```json
{
  "command": "Remind me to call mom tomorrow at 3pm",
  "context": {}
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "action": "create_reminder",
    "result": {
      "type": "reminder",
      "data": {
        "_id": "...",
        "title": "Call mom",
        "reminderTime": "..."
      }
    },
    "message": "I'll remind you to call mom tomorrow at 3pm."
  }
}
```

---

## 📋 Testing Workflow

### 1. Setup Test User
```bash
# Register
POST /api/auth/register
{
  "fullName": "Test User",
  "email": "test@example.com",
  "password": "Test123!",
  "preferredName": "Test"
}

# Login
POST /api/auth/login
{
  "email": "test@example.com",
  "password": "Test123!"
}
# Save the JWT token from response
```

---

### 2. Test Notification Flow
```bash
# 1. Create a notification
POST /api/notifications
{
  "type": "system",
  "title": "Welcome!",
  "message": "Welcome to Yo! Personal Assistant",
  "priority": "medium"
}

# 2. Get notification count
GET /api/notifications/count
# Should return: { "count": 1 }

# 3. Get all notifications
GET /api/notifications

# 4. Mark as read
POST /api/notifications/{notification-id}/read

# 5. Verify count is now 0
GET /api/notifications/count
```

---

### 3. Test Reminder Flow
```bash
# 1. Create reminder
POST /api/reminders
{
  "title": "Test reminder",
  "reminderTime": "2025-01-16T10:00:00.000Z",
  "isUrgent": true
}

# 2. Get upcoming reminders
GET /api/reminders/upcoming?hours=48

# 3. Snooze reminder
POST /api/reminders/{reminder-id}/snooze
{ "minutes": 15 }

# 4. Complete reminder
POST /api/reminders/{reminder-id}/toggle-status
{ "status": "completed" }

# 5. Delete reminder
DELETE /api/reminders/{reminder-id}
```

---

### 4. Test AI Features
```bash
# 1. Get daily briefing
GET /api/ai/daily-briefing

# 2. Get AI suggestions
GET /api/ai/suggestions

# 3. Chat with AI
POST /api/ai/chat
{
  "message": "What should I focus on today?"
}

# 4. Process voice command
POST /api/ai/process-command
{
  "command": "Create a task to review the budget by Friday"
}
```

---

## 🧪 Automated Testing with Postman

### Import Collection
1. Create a new Postman collection
2. Set environment variables:
   - `BASE_URL`: http://localhost:3000
   - `JWT_TOKEN`: (obtained from login)

### Test Scripts
```javascript
// Add to Postman Tests tab
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("Response has success field", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData).to.have.property('success');
    pm.expect(jsonData.success).to.be.true;
});

pm.test("Response has data field", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData).to.have.property('data');
});
```

---

## 🐛 Common Issues & Solutions

### Issue: 401 Unauthorized
**Solution:** Ensure JWT token is valid and included in Authorization header

### Issue: 404 Not Found
**Solution:** Check endpoint URL and ensure backend server is running

### Issue: 500 Internal Server Error
**Solution:** Check backend logs for specific error. Common causes:
- Missing environment variables
- Database connection issues
- Invalid request body format

### Issue: Notification not appearing
**Solution:**
1. Check notification was created: `GET /api/notifications`
2. Verify user ID matches
3. Check notification hasn't expired (`expiresAt` field)

---

## 📊 Performance Testing

### Load Test Example (using Artillery)
```yaml
config:
  target: "http://localhost:3000"
  phases:
    - duration: 60
      arrivalRate: 10

scenarios:
  - name: "Get notifications"
    flow:
      - get:
          url: "/api/notifications/count"
          headers:
            Authorization: "Bearer {{token}}"
```

---

## ✅ Test Checklist

- [ ] All notification CRUD operations work
- [ ] Notification count updates correctly
- [ ] Mark as read updates badge count
- [ ] Reminders can be created, updated, deleted
- [ ] Snooze functionality works
- [ ] Daily briefing returns accurate data
- [ ] AI suggestions are generated
- [ ] Voice commands create proper entities
- [ ] Error handling works for invalid requests
- [ ] Authentication is enforced on protected routes

---

**Last Updated:** January 2025
**Version:** 1.0.0
