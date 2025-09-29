const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function deleteAndPrepare() {
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
    });

    const User = mongoose.model('User', userSchema);

    // First show existing user
    const existingUser = await User.findOne({ email: 'papcyai@gmail.com' });
    if (existingUser) {
      console.log('\n=== Existing User Found ===');
      console.log('Email:', existingUser.email);
      console.log('Has Password:', !!existingUser.password);
      console.log('Password hash length:', existingUser.password?.length);
      console.log('Full Name:', existingUser.fullName);
      console.log('Preferred Name:', existingUser.preferredName);

      // Delete the user
      await User.deleteOne({ email: 'papcyai@gmail.com' });
      console.log('\n✅ User deleted. You can now register fresh from the app.');
    } else {
      console.log('❌ No user found with email papcyai@gmail.com');
    }

    // Show all remaining users
    console.log('\n=== All Remaining Users ===');
    const allUsers = await User.find({}, 'email fullName preferredName');
    if (allUsers.length === 0) {
      console.log('✅ Database is empty - ready for fresh registration');
    } else {
      allUsers.forEach((user, index) => {
        console.log(`${index + 1}. ${user.email} - ${user.fullName}`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

deleteAndPrepare();