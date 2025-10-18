import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../src/models/User';

dotenv.config();

async function checkUser(email: string) {
  try {
    // Connect to database
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/yo_assistant';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to database');

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      console.log(`❌ User not found with email: ${email}`);
      return;
    }

    console.log('\n📊 User Data:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📧 Email: ${user.email}`);
    console.log(`👤 Full Name: ${user.fullName}`);
    console.log(`👤 Preferred Name: ${user.preferredName}`);
    console.log(`🤖 Assistant Name: ${user.assistantName || 'Not set'}`);
    console.log(`⚧ Assistant Gender: ${user.assistantGender || 'Not set'}`);
    console.log(`🔊 Assistant Voice: ${user.assistantVoice || 'Not set'}`);
    console.log(`🖼️  Assistant Profile Image: ${user.assistantProfileImage ? 'Set' : 'Not set'}`);
    console.log('\n🎯 Onboarding Status:');
    console.log(`✅ hasCompletedOnboarding: ${user.hasCompletedOnboarding}`);
    console.log(`✅ agentConfiguration.setupCompleted: ${user.agentConfiguration?.setupCompleted || false}`);

    console.log('\n🎨 Agent Configuration:');
    console.log(`  Personality Traits: ${user.agentConfiguration?.personality?.traits?.join(', ') || 'None'}`);
    console.log(`  Communication Style: ${user.agentConfiguration?.personality?.communicationStyle || 'Not set'}`);
    console.log(`  Response Style: ${user.agentConfiguration?.personality?.responseStyle || 'Not set'}`);
    console.log(`  Always Available: ${user.agentConfiguration?.availability?.alwaysAvailable || false}`);
    console.log(`  Enabled Task Categories: ${user.agentConfiguration?.taskCategories?.enabledCategories?.join(', ') || 'None'}`);

    console.log('\n🔐 Privacy Settings:');
    console.log(`  Local Processing: ${user.agentConfiguration?.privacy?.localProcessing ?? true}`);
    console.log(`  Encrypted Storage: ${user.agentConfiguration?.privacy?.encryptedStorage ?? true}`);
    console.log(`  Biometric Lock: ${user.agentConfiguration?.privacy?.biometricLock || false}`);

    console.log('\n📱 User Preferences:');
    console.log(`  Language: ${user.preferences?.language || 'en'}`);
    console.log(`  Theme: ${user.preferences?.theme || 'dark'}`);
    console.log(`  Wake Word: ${user.preferences?.wakeWord || 'yo'}`);
    console.log(`  Voice Enabled: ${user.preferences?.voiceEnabled ?? true}`);

    console.log('\n📅 Account Info:');
    console.log(`  Created: ${user.createdAt}`);
    console.log(`  Updated: ${user.updatedAt}`);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from database');
    process.exit(0);
  }
}

// Get email from command line arguments
const email = process.argv[2];

if (!email) {
  console.log('Usage: ts-node scripts/checkUser.ts <email>');
  console.log('Example: ts-node scripts/checkUser.ts user@example.com');
  process.exit(1);
}

checkUser(email);
