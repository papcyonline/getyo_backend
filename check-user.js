const mongoose = require('mongoose');

async function checkUser() {
  try {
    await mongoose.connect('mongodb://localhost:27017/yo_app');
    console.log('Connected to MongoDB');

    // Define User schema (just for querying)
    const userSchema = new mongoose.Schema({
      email: String,
      password: String,
      name: String,
      fullName: String,
      preferredName: String,
    });

    const User = mongoose.model('User', userSchema);

    // Check all users with emails similar to test users
    console.log('\n=== All Users in Database ===');
    const allUsers = await User.find({}, 'email name fullName preferredName').sort({ email: 1 });

    allUsers.forEach((user, index) => {
      console.log(`${index + 1}. Email: ${user.email}`);
      console.log(`   Name: ${user.name || 'undefined'}`);
      console.log(`   Full Name: ${user.fullName || 'undefined'}`);
      console.log(`   Preferred Name: ${user.preferredName || 'undefined'}`);
      console.log('');
    });

    // Check specific test user
    const testUser = await User.findOne({ email: 'test@test.com' });
    if (testUser) {
      console.log('=== Test User Details ===');
      console.log('Email:', testUser.email);
      console.log('Name:', testUser.name);
      console.log('Full Name:', testUser.fullName);
      console.log('Preferred Name:', testUser.preferredName);
      console.log('Has Password:', !!testUser.password);
      console.log('Password Length:', testUser.password?.length);
    } else {
      console.log('❌ test@test.com user not found');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkUser();