const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function resetUserPassword() {
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

    // Hash the new password
    const saltRounds = 12;
    const newPassword = 'password123';
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update the user password
    const result = await User.findOneAndUpdate(
      { email: 'papcyai@gmail.com' },
      { password: hashedPassword },
      { new: true }
    );

    if (result) {
      console.log('✅ User password updated successfully');
      console.log('Email:', result.email);
      console.log('Name:', result.preferredName);
      console.log('NEW PASSWORD:', newPassword);

      // Test password verification
      const testValid = await bcrypt.compare(newPassword, result.password);
      console.log('Password verification test:', testValid ? '✅ VALID' : '❌ INVALID');
    } else {
      console.log('❌ User not found');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

resetUserPassword();