const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function resetPasswords() {
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

    // Hash the new passwords
    const saltRounds = 12;
    const testPassword = await bcrypt.hash('password123', saltRounds);
    const userPassword = await bcrypt.hash('newpass123', saltRounds);

    // Update test user password
    const testResult = await User.findOneAndUpdate(
      { email: 'test@test.com' },
      { password: testPassword },
      { new: true }
    );

    if (testResult) {
      console.log('✅ Test user password updated to: password123');
    } else {
      console.log('❌ Test user not found');
    }

    // Update main user password
    const mainResult = await User.findOneAndUpdate(
      { email: 'papcynfor@gmail.com' },
      { password: userPassword },
      { new: true }
    );

    if (mainResult) {
      console.log('✅ Main user password updated to: newpass123');
    } else {
      console.log('❌ Main user not found');
    }

    // Test password verification
    console.log('\n=== Testing Password Verification ===');

    const testUser = await User.findOne({ email: 'test@test.com' });
    if (testUser) {
      const testValid = await bcrypt.compare('password123', testUser.password);
      console.log('Test user password123 valid:', testValid);
    }

    const mainUser = await User.findOne({ email: 'papcynfor@gmail.com' });
    if (mainUser) {
      const mainValid = await bcrypt.compare('newpass123', mainUser.password);
      console.log('Main user newpass123 valid:', mainValid);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

resetPasswords();