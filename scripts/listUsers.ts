import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../src/models/User';

dotenv.config();

async function listUsers() {
  try {
    // Connect to database
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/yo_assistant';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to database\n');

    // Find all users
    const users = await User.find({}).select('email fullName preferredName assistantName hasCompletedOnboarding createdAt').sort({ createdAt: -1 });

    console.log(`📊 Total Users: ${users.length}\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    users.forEach((user, index) => {
      console.log(`\n${index + 1}. ${user.email}`);
      console.log(`   Full Name: ${user.fullName}`);
      console.log(`   Preferred Name: ${user.preferredName}`);
      console.log(`   Assistant Name: ${user.assistantName || 'Not set'}`);
      console.log(`   Onboarding Complete: ${user.hasCompletedOnboarding ? '✅ Yes' : '❌ No'}`);
      console.log(`   Created: ${user.createdAt}`);
    });

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from database');
    process.exit(0);
  }
}

listUsers();
