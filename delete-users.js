const mongoose = require('mongoose');

async function deleteAllUsers() {
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

    // First, show all users before deletion
    console.log('\n=== Users Before Deletion ===');
    const usersBefore = await User.find({}, 'email name fullName').sort({ email: 1 });
    usersBefore.forEach((user, index) => {
      console.log(`${index + 1}. Email: ${user.email} | Name: ${user.name}`);
    });

    // Delete all users
    const deleteResult = await User.deleteMany({});
    console.log(`\n✅ Deleted ${deleteResult.deletedCount} users`);

    // Verify deletion
    console.log('\n=== Users After Deletion ===');
    const usersAfter = await User.find({});
    if (usersAfter.length === 0) {
      console.log('✅ No users remaining - database is clean');
    } else {
      console.log(`❌ ${usersAfter.length} users still exist`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

deleteAllUsers();