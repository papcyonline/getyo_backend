import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../src/models/User';

dotenv.config();

async function updateOnboarding(email: string, completed: boolean) {
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

    console.log(`\n📧 Found user: ${user.email}`);
    console.log(`Current onboarding status: ${user.hasCompletedOnboarding ? '✅ Completed' : '❌ Not completed'}`);

    // Update onboarding status
    user.hasCompletedOnboarding = completed;
    await user.save();

    console.log(`Updated onboarding status: ${user.hasCompletedOnboarding ? '✅ Completed' : '❌ Not completed'}`);
    console.log('✅ User updated successfully\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from database');
    process.exit(0);
  }
}

// Get email and status from command line arguments
const email = process.argv[2];
const status = process.argv[3];

if (!email || !status) {
  console.log('Usage: ts-node scripts/updateOnboarding.ts <email> <true|false>');
  console.log('Example: ts-node scripts/updateOnboarding.ts user@example.com true');
  process.exit(1);
}

const completed = status.toLowerCase() === 'true';
updateOnboarding(email, completed);
