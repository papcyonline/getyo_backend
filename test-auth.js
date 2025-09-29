const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

// Test password hashing and comparison
async function testPasswordHashing() {
  const password = 'testpass123';

  // Hash password (like during registration)
  const hashedPassword = await bcrypt.hash(password, 12);
  console.log('Original password:', password);
  console.log('Hashed password:', hashedPassword);

  // Test comparison (like during login)
  const isValid = await bcrypt.compare(password, hashedPassword);
  console.log('Password comparison result:', isValid);

  // Test with wrong password
  const isInvalid = await bcrypt.compare('wrongpass', hashedPassword);
  console.log('Wrong password comparison:', isInvalid);
}

// Connect to MongoDB and check a user
async function checkUserInDB() {
  try {
    await mongoose.connect('mongodb://localhost:27017/yo_app');
    console.log('\nConnected to MongoDB');

    const User = mongoose.model('User', new mongoose.Schema({
      email: String,
      password: String,
      name: String,
    }));

    // Find a user by email
    const email = 'test@example.com'; // Change this to your test email
    const user = await User.findOne({ email: email.toLowerCase() });

    if (user) {
      console.log('\nUser found:', {
        email: user.email,
        name: user.name,
        hasPassword: !!user.password,
        passwordLength: user.password?.length
      });

      // Test password
      const testPassword = 'testpass123'; // Change this to your test password
      const isValid = await bcrypt.compare(testPassword, user.password);
      console.log('Password valid:', isValid);
    } else {
      console.log('\nUser not found with email:', email);
    }

    // List all users (just emails)
    const allUsers = await User.find({}, 'email name').limit(5);
    console.log('\nUsers in database:');
    allUsers.forEach(u => console.log('-', u.email, '/', u.name));

  } catch (error) {
    console.error('Database error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

// Run tests
async function main() {
  console.log('=== Testing Password Hashing ===');
  await testPasswordHashing();

  console.log('\n=== Checking Database ===');
  await checkUserInDB();
}

main();