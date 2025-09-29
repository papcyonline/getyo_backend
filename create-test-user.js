const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function createTestUser() {
  try {
    await mongoose.connect('mongodb://localhost:27017/yo_app');
    console.log('Connected to MongoDB');

    // Define User schema
    const userSchema = new mongoose.Schema({
      email: String,
      password: String,
      name: String,
      fullName: String,
      preferredName: String,
      assistantName: String,
      phone: String,
      preferences: Object,
      integrations: Object,
    });

    const User = mongoose.model('User', userSchema);

    // Create a test user WITHOUT assistantName (incomplete setup)
    const testEmail = 'testuser@incomplete.com';
    const testPassword = 'Test123!';

    // Clean up first
    await User.deleteOne({ email: testEmail });

    const hashedPassword = await bcrypt.hash(testPassword, 12);

    const newUser = await User.create({
      email: testEmail,
      password: hashedPassword,
      name: 'Test User',
      fullName: 'Test User Full',
      preferredName: 'Test',
      phone: '+1234567890',
      // NO assistantName - this simulates incomplete setup
      preferences: {
        voiceEnabled: true,
        reminderStyle: 'friendly',
        theme: 'dark',
      },
      integrations: {},
    });

    console.log('\n✅ Test user created successfully:');
    console.log('Email:', newUser.email);
    console.log('Password:', testPassword);
    console.log('AssistantName:', newUser.assistantName || '❌ NOT SET (as expected)');
    console.log('Should navigate to AssistantNaming screen after login');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

createTestUser();
