const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function setExactPassword() {
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

    // The password you're trying to use
    const yourPassword = 'Yadah@2023!';

    // Hash it
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(yourPassword, saltRounds);

    // Update the user
    const result = await User.findOneAndUpdate(
      { email: 'papcyai@gmail.com' },
      { password: hashedPassword },
      { new: true }
    );

    if (result) {
      console.log('✅ Password updated successfully');
      console.log('Email:', result.email);
      console.log('PASSWORD SET TO:', yourPassword);

      // Verify it works
      const isValid = await bcrypt.compare(yourPassword, result.password);
      console.log('Password verification:', isValid ? '✅ VALID' : '❌ INVALID');
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

setExactPassword();