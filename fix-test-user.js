const mongoose = require('mongoose');

async function fixTestUser() {
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
    });

    const User = mongoose.model('User', userSchema);

    // Update the test user to have required fields
    const result = await User.findOneAndUpdate(
      { email: 'test@test.com' },
      {
        fullName: 'Test User',
        preferredName: 'Test',
        name: 'Test'
      },
      { new: true }
    );

    if (result) {
      console.log('✅ Test user updated successfully');
      console.log('Email:', result.email);
      console.log('Name:', result.name);
      console.log('Full Name:', result.fullName);
      console.log('Preferred Name:', result.preferredName);
    } else {
      console.log('❌ Test user not found');
    }

    // Also fix the main user account
    const mainUserResult = await User.findOneAndUpdate(
      { email: 'papcynfor@gmail.com' },
      {
        fullName: 'Bah Charles',
        preferredName: 'Nfor',
        name: 'Nfor'
      },
      { new: true }
    );

    if (mainUserResult) {
      console.log('✅ Main user updated successfully');
      console.log('Email:', mainUserResult.email);
      console.log('Name:', mainUserResult.name);
      console.log('Full Name:', mainUserResult.fullName);
      console.log('Preferred Name:', mainUserResult.preferredName);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

fixTestUser();