import mongoose from 'mongoose';
import { LegalContent } from '../models/Legal';
import dotenv from 'dotenv';

dotenv.config();

const seedLegalContent = async () => {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/yo-assistant';
    await mongoose.connect(mongoUri);
    console.log('📦 Connected to MongoDB');

    // Clear existing legal content
    await LegalContent.deleteMany({});
    console.log('🗑️ Cleared existing legal content');

    // Create combined terms and privacy content
    const combinedContent = {
      type: 'combined',
      version: '1.0.0',
      language: 'en',
      title: 'Terms of Service & Privacy Policy',
      content: {
        mainTitle: 'Terms of Service & Privacy Policy',
        subtitle: 'Please read these terms carefully before using Yo! Personal Assistant',
        sections: [
          {
            title: '1. Acceptance of Terms',
            content: 'By using Yo! Personal Assistant, you agree to be bound by these Terms of Service and Privacy Policy. If you do not agree to these terms, please do not use our service.',
          },
          {
            title: '2. Description of Service',
            content: 'Yo! is a personal AI assistant application that helps you manage tasks, reminders, calendar events, and provides intelligent assistance for your daily activities.',
          },
          {
            title: '3. User Accounts',
            content: 'You are responsible for maintaining the confidentiality of your account credentials. You agree to accept responsibility for all activities that occur under your account.',
          },
          {
            title: '4. Privacy & Data Collection',
            content: 'We collect and process your personal information to provide our services. This includes your name, email, and usage data. We use this information to improve our services and provide personalized assistance.',
            subsections: [
              {
                title: 'Data We Collect',
                content: 'We collect information you provide directly (name, email, preferences), usage data (tasks, reminders, conversations), and device information.',
              },
              {
                title: 'How We Use Your Data',
                content: 'Your data is used to provide personalized assistance, improve our AI models, and send important service notifications.',
              },
              {
                title: 'Data Security',
                content: 'We implement industry-standard security measures to protect your data. However, no method of transmission over the internet is 100% secure.',
              },
            ],
          },
          {
            title: '5. User Conduct',
            content: 'You agree not to use the service for any unlawful purpose or in any way that could damage, disable, or impair the service.',
          },
          {
            title: '6. Intellectual Property',
            content: 'All content, features, and functionality of Yo! are owned by us and are protected by international copyright, trademark, and other intellectual property laws.',
          },
          {
            title: '7. Limitation of Liability',
            content: 'Yo! is provided "as is" without warranties of any kind. We shall not be liable for any indirect, incidental, or consequential damages arising from your use of the service.',
          },
          {
            title: '8. Changes to Terms',
            content: 'We reserve the right to modify these terms at any time. We will notify users of any material changes via email or in-app notification.',
          },
          {
            title: '9. Contact Information',
            content: 'If you have any questions about these terms, please contact us at support@getyo.app',
          },
        ],
      },
      isActive: true,
      effectiveDate: new Date(),
    };

    await LegalContent.create(combinedContent);
    console.log('✅ Created combined legal content');

    console.log('🎉 Legal content seeding completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding legal content:', error);
    process.exit(1);
  }
};

seedLegalContent();
