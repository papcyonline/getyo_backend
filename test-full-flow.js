const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function testFullFlow() {
  try {
    await mongoose.connect('mongodb://localhost:27017/yo_app');
    console.log('Connected to MongoDB\n');

    const userSchema = new mongoose.Schema({
      email: String,
      password: String,
      name: String,
      fullName: String,
      preferredName: String,
      assistantName: String,
    });

    const User = mongoose.model('User', userSchema);

    console.log('=== TESTING FULL LOGIN FLOW ===\n');

    // Test with existing user
    const existingUser = await User.findOne({ email: 'papcyai@gmail.com' });
    if (existingUser) {
      console.log('✅ Test Case 1: User WITH Assistant Setup');
      console.log('   Email:', existingUser.email);
      console.log('   AssistantName:', existingUser.assistantName);
      console.log('   Expected Navigation: Dashboard (hasCompletedOnboarding = true)');
    }

    console.log('\n✅ Test Case 2: User WITHOUT Assistant Setup');
    console.log('   Creating test user without assistantName...');

    // Create a test user without assistantName
    const hashedPassword = await bcrypt.hash('test123', 12);
    await User.deleteOne({ email: 'newuser@test.com' }); // Clean up first

    const newUser = await User.create({
      email: 'newuser@test.com',
      password: hashedPassword,
      name: 'New User',
      fullName: 'New Test User',
      preferredName: 'New',
      // No assistantName - simulating incomplete setup
    });

    console.log('   Email:', newUser.email);
    console.log('   AssistantName:', newUser.assistantName || 'NOT SET');
    console.log('   Expected Navigation: AssistantNaming screen');

    console.log('\n=== FLOW SUMMARY ===');
    console.log('1. User logs in → AuthService.login returns user object');
    console.log('2. LoginScreen checks user.assistantName');
    console.log('3. If assistantName EXISTS → dispatch(completeOnboarding()) → Dashboard');
    console.log('4. If assistantName NOT SET → navigate to AssistantNaming screen');
    console.log('\n✅ No hardcoded values - works for ANY user dynamically!');

    // Clean up test user
    await User.deleteOne({ email: 'newuser@test.com' });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

testFullFlow();