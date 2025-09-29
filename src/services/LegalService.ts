import { LegalContent, UserLegalAcceptance, ILegalContent, IUserLegalAcceptance } from '../models/Legal';
import mongoose from 'mongoose';

export class LegalService {
  // Get active legal content by type and language
  static async getContent(type: 'terms' | 'privacy' | 'combined', language: string = 'en'): Promise<ILegalContent | null> {
    try {
      const content = await LegalContent.findOne({
        type,
        language,
        isActive: true,
      }).sort({ version: -1, createdAt: -1 });

      return content;
    } catch (error) {
      console.error('Error fetching legal content:', error);
      throw error;
    }
  }

  // Get all active legal content for a language
  static async getAllContent(language: string = 'en'): Promise<ILegalContent[]> {
    try {
      const content = await LegalContent.find({
        language,
        isActive: true,
      }).sort({ type: 1, version: -1 });

      return content;
    } catch (error) {
      console.error('Error fetching all legal content:', error);
      throw error;
    }
  }

  // Create or update legal content
  static async createContent(contentData: Partial<ILegalContent>): Promise<ILegalContent> {
    try {
      // Deactivate previous version if exists
      if (contentData.type && contentData.language) {
        await LegalContent.updateMany(
          {
            type: contentData.type,
            language: contentData.language,
          },
          { isActive: false }
        );
      }

      const content = new LegalContent(contentData);
      await content.save();

      return content;
    } catch (error) {
      console.error('Error creating legal content:', error);
      throw error;
    }
  }

  // Record user acceptance
  static async recordAcceptance(
    userIdOrSessionId: string,
    type: 'terms' | 'privacy' | 'combined',
    ipAddress?: string,
    userAgent?: string,
    isAnonymous: boolean = false
  ): Promise<IUserLegalAcceptance> {
    try {
      const content = await this.getContent(type);
      if (!content) {
        throw new Error(`Legal content of type ${type} not found`);
      }

      // Check if user/session already accepted this version
      const searchCriteria = isAnonymous
        ? { sessionId: userIdOrSessionId, legalContentId: content._id, type }
        : { userId: new mongoose.Types.ObjectId(userIdOrSessionId), legalContentId: content._id, type };

      const existingAcceptance = await UserLegalAcceptance.findOne(searchCriteria);

      if (existingAcceptance) {
        return existingAcceptance;
      }

      const acceptanceData: any = {
        legalContentId: content._id,
        type,
        version: content.version,
        ipAddress,
        userAgent,
        isAnonymous,
      };

      if (isAnonymous) {
        acceptanceData.sessionId = userIdOrSessionId;
      } else {
        acceptanceData.userId = new mongoose.Types.ObjectId(userIdOrSessionId);
      }

      const acceptance = new UserLegalAcceptance(acceptanceData);

      await acceptance.save();
      return acceptance;
    } catch (error) {
      console.error('Error recording legal acceptance:', error);
      throw error;
    }
  }

  // Check if user has accepted current version
  static async hasUserAccepted(userId: string, type: 'terms' | 'privacy' | 'combined'): Promise<boolean> {
    try {
      const content = await this.getContent(type);
      if (!content) {
        return false;
      }

      const acceptance = await UserLegalAcceptance.findOne({
        userId: new mongoose.Types.ObjectId(userId),
        legalContentId: content._id,
        type,
      });

      return !!acceptance;
    } catch (error) {
      console.error('Error checking user acceptance:', error);
      return false;
    }
  }

  // Get user's acceptance history
  static async getUserAcceptanceHistory(userId: string): Promise<IUserLegalAcceptance[]> {
    try {
      const history = await UserLegalAcceptance.find({
        userId: new mongoose.Types.ObjectId(userId),
      })
        .populate('legalContentId')
        .sort({ acceptedAt: -1 });

      return history;
    } catch (error) {
      console.error('Error fetching user acceptance history:', error);
      throw error;
    }
  }

  // Initialize default legal content
  static async initializeDefaultContent(): Promise<void> {
    try {
      const existingContent = await LegalContent.findOne({ type: 'combined', language: 'en' });
      if (existingContent) {
        console.log('Legal content already exists, skipping initialization');
        return;
      }

      const defaultContent = {
        type: 'combined' as const,
        version: '1.0.0',
        language: 'en',
        title: 'Terms of Service & Privacy Policy',
        content: {
          mainTitle: 'Terms of Service & Privacy Policy',
          subtitle: 'Please read and accept our terms and privacy policy to continue using Yo! Personal Assistant.',
          sections: [
            {
              title: 'Terms of Service',
              content: 'By using Yo! Personal Assistant, you agree to these terms of service.',
              subsections: [
                {
                  title: 'Service Agreement',
                  content: 'Yo! Personal Assistant provides AI-powered personal assistance services to help you manage your daily tasks, schedule, and communications. By using our service, you acknowledge that you understand and agree to be bound by these terms.',
                },
                {
                  title: 'User Responsibilities',
                  content: 'You are responsible for maintaining the confidentiality of your account information and for all activities that occur under your account. You agree to use the service only for lawful purposes and in accordance with these terms.',
                },
                {
                  title: 'AI Technology',
                  content: 'Our service uses artificial intelligence to provide personalized assistance. While we strive for accuracy, AI responses may not always be perfect. You should verify important information and decisions.',
                },
                {
                  title: 'Service Availability',
                  content: 'We aim to provide continuous service availability, but we do not guarantee uninterrupted access. We may temporarily suspend the service for maintenance or updates.',
                },
                {
                  title: 'Limitations',
                  content: 'Our service is provided "as is" without warranties of any kind. We are not liable for any indirect, incidental, or consequential damages arising from your use of the service.',
                },
              ],
            },
            {
              title: 'Privacy Policy',
              content: 'Your privacy is important to us. This policy explains how we collect, use, and protect your information.',
              subsections: [
                {
                  title: 'Data We Collect',
                  content: 'We collect information you provide directly, such as account details, preferences, and communications with our AI assistant. We also collect usage data to improve our services.',
                },
                {
                  title: 'How We Use Your Data',
                  content: 'We use your data to provide personalized assistance, improve our AI models, ensure service security, and communicate with you about updates and features.',
                },
                {
                  title: 'Data Protection',
                  content: 'We implement industry-standard security measures to protect your data. Your information is encrypted in transit and at rest, and access is restricted to authorized personnel only.',
                },
                {
                  title: 'Your Privacy Rights',
                  content: 'You have the right to access, update, or delete your personal information. You can also opt out of certain data processing activities through your account settings.',
                },
                {
                  title: 'Third-Party Services',
                  content: 'We may integrate with third-party services to enhance functionality. These integrations are governed by their respective privacy policies in addition to ours.',
                },
                {
                  title: 'Data Retention',
                  content: 'We retain your data only as long as necessary to provide our services or as required by law. You can request data deletion through your account settings.',
                },
                {
                  title: 'Contact & Support',
                  content: 'If you have questions about privacy or these terms, please contact our support team through the app or email us at privacy@yoassistant.com.',
                },
              ],
            },
          ],
        },
        isActive: true,
        effectiveDate: new Date(),
      };

      await this.createContent(defaultContent);
      console.log('Default legal content initialized successfully');
    } catch (error) {
      console.error('Error initializing default legal content:', error);
      throw error;
    }
  }
}

export default LegalService;