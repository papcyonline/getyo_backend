// Quick script to check user avatar data
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/yofam_local');
    console.log('Connected to MongoDB');

    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));

    // Get all users and show their avatar data
    const users = await User.find({}).select('email fullName assistantName assistantProfileImage assistantGender assistantVoice').limit(5);

    console.log('\n========== USER AVATAR DATA ==========');
    users.forEach(user => {
      console.log('\n---');
      console.log('Email:', user.email);
      console.log('Name:', user.fullName);
      console.log('Assistant Name:', user.assistantName);
      console.log('Assistant Gender:', user.assistantGender);
      console.log('Assistant Voice:', user.assistantVoice);
      console.log('Assistant Avatar:', user.assistantProfileImage || '❌ NO AVATAR SET');
      console.log('---');
    });
    console.log('\n====================================\n');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

connectDB();
