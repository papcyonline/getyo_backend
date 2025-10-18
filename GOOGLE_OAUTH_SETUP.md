# Google OAuth Setup Guide

## Step 1: Access Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Sign in with your Google account
3. Select your project (or create a new one)

## Step 2: Enable Required APIs

1. Go to **APIs & Services** → **Library**
2. Search for and enable these APIs:
   - **Gmail API**
   - **Google Calendar API**
   - **Google Drive API**
   - **Google People API** (for contacts)
   - **Google Meet API** (if available)

## Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Select **External** user type (for testing)
3. Fill in the required fields:
   - App name: **Yo Personal Assistant**
   - User support email: Your email
   - Developer contact: Your email
4. Click **Save and Continue**
5. Add scopes (click "Add or Remove Scopes"):
   - Gmail: `https://www.googleapis.com/auth/gmail.readonly`
   - Gmail: `https://www.googleapis.com/auth/gmail.send`
   - Gmail: `https://www.googleapis.com/auth/gmail.modify`
   - Calendar: `https://www.googleapis.com/auth/calendar`
   - Drive: `https://www.googleapis.com/auth/drive.readonly`
6. Add test users (your email) - **Required for testing**
7. Click **Save and Continue**

## Step 4: Configure OAuth Client ID

### Add Redirect URI:

1. Go to **APIs & Services** → **Credentials**
2. Click on your OAuth 2.0 Client ID (already created)
3. Under **Authorized redirect URIs**, add:
   ```
   http://192.168.1.231:3000/api/oauth/google/callback
   ```
4. Click **Save**

## Step 5: Test the Integration

1. Open your mobile app
2. Go to **Settings** → **Integrations**
3. Click **Connect** on Gmail (or any Google service)
4. You'll see Google sign-in screen
5. Grant permissions
6. Success message will appear

## Troubleshooting

**Error: redirect_uri_mismatch**
- Make sure redirect URI exactly matches: `http://192.168.1.231:3000/api/oauth/google/callback`

**Error: access_denied**
- Add your email as a test user in OAuth consent screen

**Backend not compiling?**
- There was a small import error that's been fixed
- Just restart your backend server
