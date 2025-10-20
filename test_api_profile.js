// Test the API to see what profile data is being returned
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

const testAPI = async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/yofam_local');
    console.log('✅ Connected to MongoDB\n');

    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));

    // Get a test user
    const testUser = await User.findOne({ email: 'papcyai@gmail.com' });

    if (!testUser) {
      console.log('❌ Test user not found');
      process.exit(1);
    }

    console.log('========== RAW DATABASE DATA ==========');
    console.log('User ID:', testUser._id);
    console.log('Email:', testUser.email);
    console.log('Full Name:', testUser.fullName);
    console.log('Assistant Name:', testUser.assistantName);
    console.log('Assistant Gender:', testUser.assistantGender);
    console.log('Assistant Voice:', testUser.assistantVoice);
    console.log('Assistant Profile Image:', testUser.assistantProfileImage);
    console.log('Profile Image:', testUser.profileImage);
    console.log('\n');

    // Simulate what the API returns
    console.log('========== SIMULATED API RESPONSE ==========');
    const apiResponse = {
      id: testUser._id,
      fullName: testUser.fullName,
      preferredName: testUser.preferredName,
      title: testUser.title,
      assistantName: testUser.assistantName,
      assistantProfileImage: testUser.assistantProfileImage,
      assistantGender: testUser.assistantGender,
      assistantVoice: testUser.assistantVoice,
      hasCompletedOnboarding: testUser.hasCompletedOnboarding,
      name: testUser.name,
      email: testUser.email,
      phone: testUser.phone,
      phoneVerified: testUser.phoneVerified,
      profileImage: testUser.profileImage,
      preferences: testUser.preferences,
      integrations: testUser.integrations,
      agentConfiguration: testUser.agentConfiguration,
      createdAt: testUser.createdAt,
      updatedAt: testUser.updatedAt,
    };

    console.log(JSON.stringify(apiResponse, null, 2));
    console.log('\n');

    // Check if assistantProfileImage is actually present
    console.log('========== VERIFICATION ==========');
    console.log('Has assistantProfileImage in response?', !!apiResponse.assistantProfileImage);
    console.log('Value:', apiResponse.assistantProfileImage || 'undefined/null/empty');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

testAPI();
