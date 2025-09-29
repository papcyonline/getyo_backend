const mongoose = require('mongoose');

async function checkAssistantName() {
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
    });

    const User = mongoose.model('User', userSchema);

    // Check the user
    const user = await User.findOne({ email: 'papcyai@gmail.com' });

    if (user) {
      console.log('\n=== User Details ===');
      console.log('Email:', user.email);
      console.log('Name:', user.name);
      console.log('Full Name:', user.fullName);
      console.log('Preferred Name:', user.preferredName);
      console.log('Assistant Name:', user.assistantName || '❌ NOT SET');
      console.log('\nHas completed PA setup:', !!user.assistantName);
    } else {
      console.log('❌ User not found');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

checkAssistantName();