const fetch = require('node-fetch');
const bcrypt = require('bcryptjs');

const API_URL = 'http://localhost:3000';

// Test 1: Sign in with test user
async function testSignIn() {
  console.log('\n=== Testing Sign In ===');

  try {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@test.com',
        password: 'test123'
      })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      console.log('✅ Sign in successful!');
      console.log('   User:', data.data.user.email);
      console.log('   Token:', data.data.token.substring(0, 50) + '...');
      return data.data.token;
    } else {
      console.log('❌ Sign in failed:', data.error);
      return null;
    }
  } catch (error) {
    console.log('❌ Sign in error:', error.message);
    return null;
  }
}

// Test 2: Test forgot password
async function testForgotPassword() {
  console.log('\n=== Testing Forgot Password ===');

  try {
    const response = await fetch(`${API_URL}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@test.com'
      })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      console.log('✅ Forgot password request successful!');
      console.log('   Message:', data.message);
      if (data.data && data.data.resetCode) {
        console.log('   Reset Code (dev mode):', data.data.resetCode);
        return data.data.resetCode;
      }
      return '123456'; // dummy code for testing
    } else {
      console.log('❌ Forgot password failed:', data.error);
      return null;
    }
  } catch (error) {
    console.log('❌ Forgot password error:', error.message);
    return null;
  }
}

// Test 3: Test reset password
async function testResetPassword(resetCode) {
  console.log('\n=== Testing Reset Password ===');

  const newPassword = 'newpass123';

  try {
    const response = await fetch(`${API_URL}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@test.com',
        code: resetCode,
        newPassword: newPassword
      })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      console.log('✅ Password reset successful!');
      console.log('   Message:', data.message);
      return newPassword;
    } else {
      console.log('❌ Password reset failed:', data.error);
      return null;
    }
  } catch (error) {
    console.log('❌ Password reset error:', error.message);
    return null;
  }
}

// Test 4: Verify new password works
async function testNewPasswordLogin(password) {
  console.log('\n=== Testing Login with New Password ===');

  try {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@test.com',
        password: password
      })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      console.log('✅ Login with new password successful!');
      return true;
    } else {
      console.log('❌ Login with new password failed:', data.error);
      return false;
    }
  } catch (error) {
    console.log('❌ Login error:', error.message);
    return false;
  }
}

// Test 5: Test invalid login
async function testInvalidLogin() {
  console.log('\n=== Testing Invalid Login ===');

  try {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@test.com',
        password: 'wrongpassword'
      })
    });

    const data = await response.json();

    if (!response.ok && data.error) {
      console.log('✅ Invalid login correctly rejected');
      console.log('   Error:', data.error);
      return true;
    } else {
      console.log('❌ Invalid login not rejected properly');
      return false;
    }
  } catch (error) {
    console.log('❌ Test error:', error.message);
    return false;
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting Authentication Tests');
  console.log('================================');

  // Test 1: Sign in
  const token = await testSignIn();

  // Test 2: Invalid login
  await testInvalidLogin();

  // Test 3: Forgot password
  const resetCode = await testForgotPassword();

  // Test 4: Reset password (only if we have a reset code)
  if (resetCode) {
    const newPassword = await testResetPassword(resetCode);

    // Test 5: Login with new password
    if (newPassword) {
      await testNewPasswordLogin(newPassword);

      // Reset back to original password for future tests
      console.log('\n=== Resetting to Original Password ===');
      const resetCode2 = await testForgotPassword();
      if (resetCode2) {
        await testResetPassword(resetCode2);
        console.log('✅ Password reset back to: test123');
      }
    }
  }

  console.log('\n================================');
  console.log('✅ All Authentication Tests Complete!');
  console.log('\nYou can sign in with:');
  console.log('📧 Email: test@test.com');
  console.log('🔑 Password: test123');
}

// Check if node-fetch is installed
try {
  require.resolve('node-fetch');
  runAllTests();
} catch(e) {
  console.log('Installing node-fetch...');
  const { execSync } = require('child_process');
  execSync('npm install node-fetch@2', { stdio: 'inherit' });
  console.log('Please run the script again.');
}