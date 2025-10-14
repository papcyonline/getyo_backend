# Yo! Personal Assistant - Backend API

A powerful Node.js/TypeScript backend for the Yo! Personal Assistant mobile application. Features include AI-powered conversations, task management, voice processing, and real-time communication.

## 🚀 Features

### Authentication & Security
- JWT-based authentication (7-day expiration)
- Email & Password registration
- Google OAuth Sign-In
- Apple OAuth Sign-In
- Email OTP for password reset (expires in 10 minutes, max 3 attempts)
- Secure password hashing with bcrypt (12 salt rounds)
- Protected API routes with middleware

### Core Functionality
- **Task Management**: Create, read, update, delete tasks with priorities and reminders
- **Event Management**: Calendar events with attendees and location tracking
- **Note Management**: Rich text notes with metadata
- **Reminder System**: Smart reminders for tasks and events
- **AI Conversations**: Integration with Claude AI (Anthropic) for intelligent responses
- **Voice Processing**: Audio transcription and text-to-speech (OpenAI)
- **Real-time Communication**: WebSocket support via Socket.IO

### User Personalization
- Assistant name customization
- Voice selection (6 voice options)
- Gender preference for assistant
- User profile management
- Preference settings

### Integrations
- **AI Services**: OpenAI GPT & Anthropic Claude
- **SMS**: Twilio for phone verification
- **Email**: Resend for email notifications
- **Image Storage**: Cloudinary for profile images
- **Database**: MongoDB with Mongoose ODM

## 📋 Prerequisites

- Node.js 16+ and npm
- MongoDB (local or cloud instance)
- API keys for:
  - OpenAI
  - Anthropic (Claude)
  - Twilio
  - Resend
  - Cloudinary

## 🛠 Installation

1. **Clone the repository**
```bash
git clone https://github.com/papcyonline/getyo_backend.git
cd getyo_backend
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**

Copy `.env.example` to `.env` and fill in your API keys:

```bash
cp .env.example .env
```

Required environment variables:
```env
# Server
PORT=3000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/yo_app

# JWT
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=7d

# AI Services
ANTHROPIC_API_KEY=your-anthropic-key
OPENAI_API_KEY=your-openai-key

# SMS (Twilio)
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_PHONE_NUMBER=your-twilio-number

# Email (Resend)
RESEND_API_KEY=your-resend-key
RESEND_FROM_EMAIL=noreply@yourdomain.com

# Image Storage (Cloudinary)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# CORS
CORS_ORIGINS=http://localhost:8081,exp://localhost:8081
```

4. **Start MongoDB**
```bash
# If using local MongoDB
mongod
```

5. **Run the server**

Development mode with auto-reload:
```bash
npm run dev
```

Production mode:
```bash
npm run build
npm start
```

## 📡 API Endpoints

### Authentication
- `POST /api/auth/register` - Register with email and password
- `POST /api/auth/register-enhanced` - Register with enhanced profile details
- `POST /api/auth/oauth/google` - Google OAuth login/register
- `POST /api/auth/oauth/apple` - Apple OAuth login/register
- `POST /api/auth/login` - Login with email and password
- `POST /api/auth/forgot-password` - Request password reset OTP via email
- `POST /api/auth/verify-reset-otp` - Verify password reset OTP
- `POST /api/auth/reset-password` - Reset password with OTP
- `POST /api/auth/change-password` - Change password (authenticated)
- `GET /api/auth/me` - Get current user profile

### Users
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile
- `PUT /api/users/preferences` - Update preferences
- `POST /api/users/assistant-voice` - Set assistant voice
- `GET /api/users/wake-word` - Get wake word settings
- `PUT /api/users/wake-word` - Update wake word

### Tasks
- `GET /api/tasks` - Get all tasks
- `POST /api/tasks` - Create task
- `GET /api/tasks/:id` - Get task by ID
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task

### Events
- `GET /api/events` - Get all events
- `POST /api/events` - Create event
- `GET /api/events/:id` - Get event by ID
- `PUT /api/events/:id` - Update event
- `DELETE /api/events/:id` - Delete event

### Conversations (AI)
- `GET /api/conversations` - Get conversation history
- `POST /api/conversations/send-message` - Send message to AI
- `GET /api/conversations/:id` - Get conversation by ID
- `DELETE /api/conversations/:id` - Delete conversation

### AI (Enhanced)
- `POST /api/ai/chat` - Chat with AI assistant
- `POST /api/ai/process-command` - Process natural language commands
- `GET /api/ai/suggestions` - Get AI-generated suggestions based on user data
- `GET /api/ai/daily-briefing` - Get daily briefing with tasks, events, and reminders

### Reminders
- `GET /api/reminders` - Get all reminders (query: status, isUrgent)
- `GET /api/reminders/upcoming` - Get upcoming reminders (query: hours)
- `GET /api/reminders/overdue` - Get overdue reminders
- `POST /api/reminders` - Create reminder
- `PUT /api/reminders/:id` - Update reminder
- `POST /api/reminders/:id/snooze` - Snooze reminder (body: minutes)
- `POST /api/reminders/:id/toggle-status` - Toggle status (body: status)
- `DELETE /api/reminders/:id` - Delete reminder

### Notifications (NEW)
- `GET /api/notifications` - Get all notifications (query: read, type, priority, limit)
- `GET /api/notifications/count` - Get unread notification count
- `GET /api/notifications/recent` - Get recent notifications (query: limit)
- `POST /api/notifications` - Create notification
- `POST /api/notifications/:id/read` - Mark notification as read
- `POST /api/notifications/read-all` - Mark all notifications as read
- `DELETE /api/notifications/:id` - Delete notification
- `DELETE /api/notifications/read/clear` - Clear all read notifications

### Voice
- `POST /api/voice/process` - Process voice input (transcription)
- `POST /api/voice/synthesize` - Convert text to speech
- `POST /api/voice/process-command` - Voice-first command processing (auto-create tasks/reminders/events)

### Assistant Setup
- `POST /api/assistant/setup` - Complete assistant setup

### Legal
- `GET /api/legal/terms` - Get terms of service
- `GET /api/legal/privacy` - Get privacy policy
- `POST /api/legal/accept` - Accept legal terms

## 🗂 Project Structure

```
yo-backend/
├── src/
│   ├── controllers/      # Request handlers
│   ├── models/          # MongoDB schemas
│   ├── routes/          # API routes
│   ├── services/        # Business logic & integrations
│   ├── middleware/      # Auth & validation
│   ├── types/          # TypeScript types
│   ├── utils/          # Helper functions
│   └── index.ts        # App entry point
├── .env.example        # Environment template
├── .gitignore         # Git ignore rules
├── package.json       # Dependencies
├── tsconfig.json      # TypeScript config
└── README.md         # This file
```

## 🔒 Security Features

- **Email OTP for Password Reset**: 6-digit codes with 10-minute expiration
- **Rate Limiting**: Max 3 OTP verification attempts
- **Password Hashing**: bcrypt with 12 salt rounds
- **JWT Tokens**: 7-day expiration, secure session management
- **OAuth Support**: Google and Apple Sign-In
- **Email Validation**: Format validation and normalization
- **Environment Variables**: Sensitive data stored securely
- **CORS Protection**: Configurable allowed origins
- **Input Validation**: Request data validation

## 🧪 Testing

Health check endpoint:
```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-09-29T...",
  "database": { "connected": true },
  "environment": "development"
}
```

## 🚢 Deployment

### Prerequisites for Production
1. MongoDB Atlas or production database
2. Valid SSL certificates
3. Production API keys
4. Environment variables configured

### Deployment Steps
1. Build the TypeScript code:
```bash
npm run build
```

2. Set `NODE_ENV=production` in your environment

3. Start the server:
```bash
npm start
```

### Recommended Hosting
- **Backend**: Railway, Render, Heroku, DigitalOcean
- **Database**: MongoDB Atlas
- **File Storage**: Cloudinary

## 📝 Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port | Yes |
| `NODE_ENV` | Environment (development/production) | Yes |
| `MONGODB_URI` | MongoDB connection string | Yes |
| `JWT_SECRET` | Secret for JWT signing | Yes |
| `JWT_EXPIRES_IN` | JWT expiration time | Yes |
| `ANTHROPIC_API_KEY` | Claude AI API key | Yes |
| `OPENAI_API_KEY` | OpenAI API key | Yes |
| `TWILIO_ACCOUNT_SID` | Twilio account SID | Yes |
| `TWILIO_AUTH_TOKEN` | Twilio auth token | Yes |
| `TWILIO_PHONE_NUMBER` | Twilio phone number | Yes |
| `RESEND_API_KEY` | Resend API key | Yes |
| `RESEND_FROM_EMAIL` | Sender email address | Yes |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | Yes |
| `CLOUDINARY_API_KEY` | Cloudinary API key | Yes |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | Yes |
| `CORS_ORIGINS` | Allowed CORS origins (comma-separated) | Yes |

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is proprietary software owned by Papcy Online.

## 👥 Contact

- **Email**: info@papcy.com
- **GitHub**: [@papcyonline](https://github.com/papcyonline)

## 🙏 Acknowledgments

- OpenAI for GPT and Whisper APIs
- Anthropic for Claude AI
- Twilio for SMS services
- Resend for email services
- Cloudinary for image hosting

---

Built with ❤️ by Papcy Online | Powered by Claude Code