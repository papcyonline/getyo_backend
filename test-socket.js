const io = require('socket.io-client');
const jwt = require('jsonwebtoken');

// Configuration
const SERVER_URL = 'http://192.168.1.206:3000';
const JWT_SECRET = 'your-super-secret-jwt-key-here-for-development-only';

// Create a test token
const testToken = jwt.sign(
  {
    userId: 'test-user-123',
    email: 'test@example.com'
  },
  JWT_SECRET,
  { expiresIn: '7d' }
);

console.log('Testing WebSocket connection to:', SERVER_URL);
console.log('Using test token:', testToken.substring(0, 50) + '...');

// Connect with authentication
const socket = io(SERVER_URL, {
  auth: {
    token: testToken
  },
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 3,
  reconnectionDelay: 1000,
  timeout: 5000
});

// Connection events
socket.on('connect', () => {
  console.log('✅ Connected successfully!');
  console.log('Socket ID:', socket.id);

  // Test sending a message
  socket.emit('conversation:start', { context: { test: true } });
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error.message);
  console.error('Error type:', error.type);
  console.error('Error details:', error);
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
});

socket.on('error', (error) => {
  console.error('Socket error:', error);
});

// Listen for responses
socket.on('conversation:created', (data) => {
  console.log('Conversation created:', data);
});

socket.on('conversation:error', (error) => {
  console.error('Conversation error:', error);
});

// Timeout after 10 seconds
setTimeout(() => {
  console.log('\nClosing connection...');
  socket.close();
  process.exit(0);
}, 10000);