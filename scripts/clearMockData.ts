import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/yofam_local';

async function clearMockData() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;

    if (!db) {
      throw new Error('Database connection not established');
    }

    // Clear all collections with mock/test data
    const collections = [
      'voicenotes',
      'tasks',
      'notes',
      'reminders',
      'notifications',
      'transcripts'
    ];

    for (const collectionName of collections) {
      try {
        const collection = db.collection(collectionName);
        const count = await collection.countDocuments();

        if (count > 0) {
          const result = await collection.deleteMany({});
          console.log(`✅ Cleared ${result.deletedCount} documents from ${collectionName}`);
        } else {
          console.log(`ℹ️  ${collectionName} was already empty`);
        }
      } catch (error) {
        console.log(`⚠️  Collection ${collectionName} does not exist, skipping...`);
      }
    }

    console.log('\n✅ All mock data cleared successfully!');
    console.log('🔄 Your app will now start with a clean slate.');

  } catch (error) {
    console.error('❌ Error clearing mock data:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

clearMockData();
