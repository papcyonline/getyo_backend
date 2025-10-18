# Database Query Scripts

These scripts allow you to query and manage your MongoDB database directly.

## Prerequisites

Make sure your backend `.env` file has the correct `MONGODB_URI` configured.

## Available Scripts

### 1. List All Users

Lists all users in the database with their key information.

```bash
cd C:\Users\papcy\Desktop\yofam\getyo_backend
npx ts-node scripts/listUsers.ts
```

**Output:**
- Email addresses
- Full names
- Assistant names
- Onboarding completion status
- Account creation dates

---

### 2. Check Specific User

Shows detailed information about a specific user.

```bash
cd C:\Users\papcy\Desktop\yofam\getyo_backend
npx ts-node scripts/checkUser.ts <email>
```

**Example:**
```bash
npx ts-node scripts/checkUser.ts user@example.com
```

**Output:**
- User profile details
- Onboarding status (hasCompletedOnboarding + agentConfiguration.setupCompleted)
- Agent configuration (personality, availability, task categories)
- Privacy settings
- User preferences
- Account timestamps

---

### 3. Update Onboarding Status

Manually update a user's onboarding completion status.

```bash
cd C:\Users\papcy\Desktop\yofam\getyo_backend
npx ts-node scripts/updateOnboarding.ts <email> <true|false>
```

**Examples:**
```bash
# Mark onboarding as complete
npx ts-node scripts/updateOnboarding.ts user@example.com true

# Mark onboarding as incomplete
npx ts-node scripts/updateOnboarding.ts user@example.com false
```

---

## Common Use Cases

### Find your account
```bash
npx ts-node scripts/listUsers.ts
```

### Check if onboarding is set correctly
```bash
npx ts-node scripts/checkUser.ts your@email.com
```

### Fix onboarding flag if stuck
```bash
# If you completed onboarding but app sends you back to onboarding screens:
npx ts-node scripts/updateOnboarding.ts your@email.com true
```

---

## Troubleshooting

**Error: Cannot connect to database**
- Make sure your backend `.env` file has `MONGODB_URI` set correctly
- Verify MongoDB is running (if using local MongoDB)
- Check network connection (if using cloud MongoDB like Atlas)

**Error: User not found**
- Double-check the email address (case doesn't matter)
- Use `listUsers.ts` to see all registered emails
