// Migration script to fix missing avatar URLs for existing users
const mongoose = require('mongoose');

// Voice to Avatar URL mapping (from AssistantGenderScreen.tsx)
const AVATAR_MAPPING = {
  'nova': 'https://models.readyplayer.me/68f602160f9f862ffe313e8e.glb',      // Female - Warm and friendly
  'shimmer': 'https://models.readyplayer.me/68f601379225c19d581f10c4.glb',   // Female - Professional and clear
  'echo': 'https://models.readyplayer.me/68f601b0992c9fb50ce485f0.glb',      // Male - Sharp and authoritative
  'onyx': 'https://models.readyplayer.me/68f5fe3c0401b1cdf5913710.glb',      // Male - Deep and powerful
  'alloy': 'https://models.readyplayer.me/68f602160f9f862ffe313e8e.glb',     // Neutral - default to Nova
  'fable': 'https://models.readyplayer.me/68f601b0992c9fb50ce485f0.glb',     // British male - use Echo
};

const fixMissingAvatars = async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/yofam_local');
    console.log('✅ Connected to MongoDB\n');

    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));

    // Find users who have a voice selected but no avatar
    const usersWithoutAvatar = await User.find({
      assistantVoice: { $exists: true, $ne: null },
      $or: [
        { assistantProfileImage: { $exists: false } },
        { assistantProfileImage: null },
        { assistantProfileImage: '' }
      ]
    }).select('email fullName assistantName assistantVoice assistantGender');

    console.log(`Found ${usersWithoutAvatar.length} users with missing avatars\n`);

    if (usersWithoutAvatar.length === 0) {
      console.log('✅ All users already have avatars set!');
      await mongoose.connection.close();
      process.exit(0);
      return;
    }

    console.log('========== FIXING AVATARS ==========\n');

    let fixedCount = 0;
    for (const user of usersWithoutAvatar) {
      const voice = user.assistantVoice;
      const avatarUrl = AVATAR_MAPPING[voice];

      if (avatarUrl) {
        console.log(`📝 Updating user: ${user.email}`);
        console.log(`   Name: ${user.fullName}`);
        console.log(`   Assistant: ${user.assistantName}`);
        console.log(`   Voice: ${voice}`);
        console.log(`   Setting Avatar: ${avatarUrl}`);

        await User.findByIdAndUpdate(user._id, {
          $set: { assistantProfileImage: avatarUrl }
        });

        console.log(`   ✅ Updated!\n`);
        fixedCount++;
      } else {
        console.log(`⚠️  No avatar mapping for voice: ${voice} (user: ${user.email})\n`);
      }
    }

    console.log('====================================');
    console.log(`\n✅ Successfully updated ${fixedCount} users!`);
    console.log('\n🔍 Verifying updates...\n');

    // Verify the updates
    const verifyUsers = await User.find({
      email: { $in: usersWithoutAvatar.map(u => u.email) }
    }).select('email assistantName assistantVoice assistantProfileImage');

    verifyUsers.forEach(user => {
      console.log(`${user.email}:`);
      console.log(`  Voice: ${user.assistantVoice}`);
      console.log(`  Avatar: ${user.assistantProfileImage ? '✅ SET' : '❌ MISSING'}`);
      console.log();
    });

    await mongoose.connection.close();
    console.log('✅ Migration complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

fixMissingAvatars();
