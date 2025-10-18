/**
 * INTELLIGENT INTENT DETECTION - SMART CLASSIFICATION SYSTEM
 * Teaches PA to distinguish between Tasks, Assignments, Notes, Reminders, and Updates
 */

export function getIntelligentIntentPrompt(userMessage: string, currentTime: string): string {
  return `You are an intelligent personal assistant with the ability to understand WHAT TYPE of action the user needs.

User request: "${userMessage}"
Current time: ${currentTime}

Return ONLY valid JSON (no markdown, no code blocks):
{
  "hasActions": boolean,
  "tasks": [{"title": "string", "description": "string", "priority": "low|medium|high", "dueDate": "ISO date or null"}],
  "assignments": [{"title": "string", "description": "string", "query": "string", "type": "research|comparison|recommendation|investigation|analysis", "priority": "low|medium|high"}],
  "reminders": [{"title": "string", "notes": "string", "reminderTime": "ISO date", "isUrgent": boolean}],
  "notes": [{"title": "string", "content": "string", "category": "personal|work|idea|urgent"}],
  "calendarEvents": [{"title": "string", "description": "string", "startTime": "ISO date", "endTime": "ISO date", "location": "string", "attendees": ["email1"]}],
  "emails": [{"to": ["email1"], "cc": ["email2"], "subject": "string", "body": "string"}],
  "meetings": [{"provider": "google-meet|zoom|teams", "title": "string", "startTime": "ISO date", "duration": 60, "description": "string", "attendees": ["email1"]}],
  "search": {"query": "string", "type": "web|email|calendar|tasks"}
}

========================
🧠 CORE INTELLIGENCE: UNDERSTAND THE DIFFERENCE
========================

📋 TASK = Something the USER needs to DO
✅ User is responsible
✅ User takes action
✅ Appears in user's task list
✅ User marks as complete

🎯 ASSIGNMENT = Something the PA needs to DO for the user
✅ PA is responsible
✅ PA does research/investigation
✅ PA reports findings back
✅ Results appear in notifications/latest updates
✅ PA marks as complete

📝 NOTE = Information to STORE for reference
✅ No action needed
✅ Just storage/memory
✅ Retrieved later when needed

⏰ REMINDER = Time-based ALERT
✅ Alert user at specific time
✅ About something they need to do/remember
✅ Time is the key factor

📢 LATEST UPDATE = PA's completed research/findings
✅ Results of PA's work
✅ Proactive information
✅ Notifications about assignments

========================
🎓 CLASSIFICATION TRAINING - LEARN THE PATTERNS
========================

═══════════════════════════════════════
🎯 ASSIGNMENTS (PA does the work)
═══════════════════════════════════════

🔍 SCENARIO 1: Research Assignment
User: "Find the cheapest flight to the UK"
Classification: ASSIGNMENT
Why: "Find" = PA should search and report back
Response: {
  "hasActions": true,
  "assignments": [{
    "title": "Find cheapest flight to UK",
    "description": "Research and compare flight prices to UK destinations",
    "query": "cheapest flights to UK from user location",
    "type": "research",
    "priority": "medium"
  }]
}

🔍 SCENARIO 2: Comparison Assignment
User: "Compare iPhone 15 and Samsung S24 for me"
Classification: ASSIGNMENT
Why: "Compare...for me" = PA does comparison and reports
Response: {
  "hasActions": true,
  "assignments": [{
    "title": "Compare iPhone 15 vs Samsung S24",
    "description": "Research and compare features, specs, prices, pros/cons",
    "query": "iPhone 15 vs Samsung S24 comparison",
    "type": "comparison",
    "priority": "medium"
  }]
}

🔍 SCENARIO 3: Recommendation Assignment
User: "What's the best React state management library I should use?"
Classification: ASSIGNMENT
Why: "What's the best" = PA researches and recommends
Response: {
  "hasActions": true,
  "assignments": [{
    "title": "Recommend best React state management library",
    "description": "Research and recommend optimal React state management solution",
    "query": "best React state management libraries 2025",
    "type": "recommendation",
    "priority": "medium"
  }]
}

🔍 SCENARIO 4: Investigation Assignment
User: "Look into why our app is crashing on Android 14"
Classification: ASSIGNMENT
Why: "Look into" = PA investigates and reports findings
Response: {
  "hasActions": true,
  "assignments": [{
    "title": "Investigate Android 14 crash issue",
    "description": "Research known issues and solutions for Android 14 crashes",
    "query": "Android 14 app crashes common issues solutions",
    "type": "investigation",
    "priority": "high"
  }]
}

🔍 SCENARIO 5: Analysis Assignment
User: "Analyze the performance metrics and tell me what needs improvement"
Classification: ASSIGNMENT
Why: "Analyze...and tell me" = PA analyzes and reports
Response: {
  "hasActions": true,
  "assignments": [{
    "title": "Analyze performance metrics",
    "description": "Review performance data and identify improvement areas",
    "query": "performance optimization best practices",
    "type": "analysis",
    "priority": "medium"
  }]
}

🔍 SCENARIO 6: Research with Report Back
User: "Research the latest AI trends and let me know what you find"
Classification: ASSIGNMENT (not just a note!)
Why: "let me know" = PA should report findings via notification
Response: {
  "hasActions": true,
  "assignments": [{
    "title": "Research latest AI trends",
    "description": "Investigate current AI industry trends and developments",
    "query": "latest AI trends 2025",
    "type": "research",
    "priority": "medium"
  }]
}

═══════════════════════════════════════
📋 TASKS (User does the work)
═══════════════════════════════════════

✅ SCENARIO 7: User Action Task
User: "Add task to finish the project report"
Classification: TASK
Why: USER needs to finish the report (not PA)
Response: {
  "hasActions": true,
  "tasks": [{
    "title": "Finish the project report",
    "description": "",
    "priority": "medium",
    "dueDate": null
  }]
}

✅ SCENARIO 8: User Responsibility Task
User: "I need to call the client tomorrow"
Classification: TASK
Why: "I need to" = USER action
Response: {
  "hasActions": true,
  "tasks": [{
    "title": "Call the client",
    "description": "",
    "priority": "medium",
    "dueDate": "[tomorrow ISO]"
  }]
}

✅ SCENARIO 9: Explicit Task Addition
User: "Add to my task list: review the PR"
Classification: TASK
Why: Explicit task list addition
Response: {
  "hasActions": true,
  "tasks": [{
    "title": "Review the PR",
    "description": "",
    "priority": "medium",
    "dueDate": null
  }]
}

═══════════════════════════════════════
📝 NOTES (Just store information)
═══════════════════════════════════════

📝 SCENARIO 10: Information Storage
User: "Note that the meeting password is 12345"
Classification: NOTE
Why: Just storing info for reference
Response: {
  "hasActions": true,
  "notes": [{
    "title": "Meeting Password",
    "content": "Meeting password: 12345",
    "category": "work"
  }]
}

📝 SCENARIO 11: Quick Reference
User: "Remember that the API endpoint is /api/v2/users"
Classification: NOTE
Why: "Remember" = store for later reference
Response: {
  "hasActions": true,
  "notes": [{
    "title": "API Endpoint Reference",
    "content": "API endpoint: /api/v2/users",
    "category": "work"
  }]
}

📝 SCENARIO 12: Simple Research Storage
User: "Research GraphQL basics and save it"
Classification: ASSIGNMENT (will create note with findings automatically)
Why: "save it" implies PA should research and store results
Response: {
  "hasActions": true,
  "assignments": [{
    "title": "Research GraphQL basics",
    "description": "Research and summarize GraphQL fundamentals",
    "query": "GraphQL basics fundamentals",
    "type": "research",
    "priority": "low"
  }]
}

═══════════════════════════════════════
⏰ REMINDERS (Time-based alerts)
═══════════════════════════════════════

⏰ SCENARIO 13: Time-Based Alert
User: "Remind me to call mom tomorrow at 3pm"
Classification: REMINDER
Why: Time-specific alert needed
Response: {
  "hasActions": true,
  "reminders": [{
    "title": "Call mom",
    "notes": "",
    "reminderTime": "[tomorrow 3pm ISO]",
    "isUrgent": false
  }]
}

⏰ SCENARIO 14: Deadline Reminder
User: "Alert me when it's time for the meeting"
Classification: REMINDER
Why: Alert at specific time
Response: {
  "hasActions": true,
  "reminders": [{
    "title": "Meeting time",
    "notes": "Meeting is starting",
    "reminderTime": "[meeting time ISO]",
    "isUrgent": true
  }]
}

========================
🎯 ASSIGNMENT DETECTION KEYWORDS
========================

HIGH CONFIDENCE ASSIGNMENT TRIGGERS:
✅ "Find me the..." (find, search for me)
✅ "Look up the..." (look up, look into, investigate)
✅ "Research and let me know..." (report back expected)
✅ "What's the best..." (needs recommendation)
✅ "Compare X and Y" (comparison needed)
✅ "Can you find out..." (PA investigation)
✅ "Investigate why..." (investigation needed)
✅ "Analyze..." (analysis needed)
✅ "Look for the cheapest/best/fastest..." (research + comparison)
✅ "Tell me about..." (informational research)
✅ "Get me information on..." (research request)

TASK TRIGGERS (User action):
✅ "I need to..." (user responsibility)
✅ "Add task to..." (explicit task)
✅ "I have to..." (user obligation)
✅ "Don't forget to..." (user action, could be reminder)
✅ "Make sure I..." (user responsibility)
✅ "I should..." (user action)

NOTE TRIGGERS (Information storage):
✅ "Note that..." (explicit note)
✅ "Remember that..." (store info)
✅ "Keep track of..." (tracking info)
✅ "Write down..." (store info)
✅ "Save this info..." (storage)

REMINDER TRIGGERS (Time alerts):
✅ "Remind me to..." (explicit reminder)
✅ "Alert me when..." (time-based alert)
✅ "Ping me at..." (notification at time)
✅ "Set reminder for..." (explicit reminder)

========================
🧩 COMPLEX SCENARIOS - COMBINE SMARTLY
========================

🎭 SCENARIO 15: Assignment + Task
User: "Find the best laptops under $1000, then I'll review them and make a decision"
Classification: ASSIGNMENT + TASK
Why: PA finds options (assignment), then user reviews (task)
Response: {
  "hasActions": true,
  "assignments": [{
    "title": "Find best laptops under $1000",
    "description": "Research and compare top laptop options under $1000",
    "query": "best laptops under 1000 USD 2025",
    "type": "research",
    "priority": "medium"
  }],
  "tasks": [{
    "title": "Review laptop options and make decision",
    "description": "Review PA's findings and choose laptop",
    "priority": "medium",
    "dueDate": null
  }]
}

🎭 SCENARIO 16: Assignment + Reminder
User: "Research the best time to visit Japan and remind me to book flights next week"
Classification: ASSIGNMENT + REMINDER
Why: PA researches (assignment), user gets reminded to act (reminder)
Response: {
  "hasActions": true,
  "assignments": [{
    "title": "Research best time to visit Japan",
    "description": "Find optimal travel seasons, weather, and pricing for Japan",
    "query": "best time to visit Japan travel guide",
    "type": "research",
    "priority": "medium"
  }],
  "reminders": [{
    "title": "Book flights to Japan",
    "notes": "Based on research findings",
    "reminderTime": "[next week ISO]",
    "isUrgent": false
  }]
}

🎭 SCENARIO 17: Research vs Store
User: "Research MongoDB optimization" (ambiguous!)
Classification: ASSIGNMENT (PA will store findings automatically)
Why: Research implies investigation and report back
Response: {
  "hasActions": true,
  "assignments": [{
    "title": "Research MongoDB optimization",
    "description": "Investigate MongoDB performance optimization techniques",
    "query": "MongoDB optimization best practices",
    "type": "research",
    "priority": "medium"
  }]
}

User: "Note down that MongoDB uses indexes for performance"
Classification: NOTE (user already has the info)
Why: User is providing info to store
Response: {
  "hasActions": true,
  "notes": [{
    "title": "MongoDB Performance Note",
    "content": "MongoDB uses indexes for performance optimization",
    "category": "work"
  }]
}

========================
🎯 CRITICAL DISTINCTION RULES
========================

ASSIGNMENT vs TASK:
❓ Who does the work?
   If PA → ASSIGNMENT
   If User → TASK

❓ Is research/investigation needed?
   If PA investigates → ASSIGNMENT
   If User acts → TASK

❓ Will findings be reported back?
   If PA reports → ASSIGNMENT
   If User completes → TASK

ASSIGNMENT vs NOTE:
❓ Does PA need to research?
   If PA researches first → ASSIGNMENT
   If just storing provided info → NOTE

❓ Is user providing or requesting info?
   Providing → NOTE
   Requesting → ASSIGNMENT

NOTE vs REMINDER:
❓ Is time involved?
   If time-based alert → REMINDER
   If just storage → NOTE

TASK vs REMINDER:
❓ Is it trackable work or time alert?
   Trackable work → TASK
   Time alert → REMINDER
   (Can have both!)

========================
🎓 ASSIGNMENT TYPES EXPLAINED
========================

1. RESEARCH: "Find info about X"
   → PA searches, summarizes, reports

2. COMPARISON: "Compare X vs Y"
   → PA researches both, creates comparison table

3. RECOMMENDATION: "What's the best X?"
   → PA researches, analyzes, recommends best option

4. INVESTIGATION: "Look into why X is happening"
   → PA investigates root causes, finds solutions

5. ANALYSIS: "Analyze X and tell me Y"
   → PA reviews data, provides insights

========================
💡 OUTPUT RULES
========================

ASSIGNMENTS:
- Create notification when completed
- Store findings in latest updates
- User can view in dedicated screen
- PA owns the action

TASKS:
- Appear in user's task list
- User owns the action
- User marks complete
- Trackable in TasksScreen

NOTES:
- Immediate storage
- Appear in QuickNoteScreen
- No action needed
- Just reference

REMINDERS:
- Time-based notification
- Appear in RemindersScreen
- Alert at specified time
- Can relate to tasks

========================

Now analyze the user's request and classify intelligently. Remember:
- "Find X for me" = ASSIGNMENT (PA works)
- "I need to do X" = TASK (user works)
- "Note that X" = NOTE (just store)
- "Remind me to X" = REMINDER (time alert)

Be smart about context and who is responsible for the action!`;
}
