/**
 * COMPREHENSIVE INTEGRATION AGGREGATOR SERVICE
 *
 * This service aggregates ALL integration data from:
 * - Google Services (Gmail, Calendar, Drive, Meet, Contacts, Photos, Maps)
 * - Microsoft Services (Outlook, Calendar, OneDrive, Teams, Contacts, To Do)
 * - Apple Services (Calendar - device level)
 * - Social Media (Twitter/X, LinkedIn, Facebook, Instagram)
 * - Communication (Slack, Discord, Teams, Zoom)
 * - Device Integrations (Contacts, Location, Photos, Calendar, Microphone, Camera)
 * - Email Accounts (Multi-provider)
 * - Cloud Storage (Google Drive, OneDrive, Dropbox, iCloud, Box)
 *
 * Makes all this data available to the PA for intelligent conversations
 */

import { User } from '../models';

export interface IntegrationStatus {
  // Connection status
  connected: boolean;
  connectedAt?: Date;
  lastSyncedAt?: Date;

  // Provider info
  provider: string;
  email?: string;
  username?: string;
  name?: string;

  // Enabled services
  services?: string[];

  // Permissions
  permissions?: string[];
  permissionGranted?: boolean;

  // Stats
  stats?: any;
}

export interface ComprehensiveIntegrationData {
  // Integration summary
  summary: {
    totalIntegrations: number;
    connectedCount: number;
    categories: {
      google: number;
      microsoft: number;
      social: number;
      communication: number;
      device: number;
      email: number;
      storage: number;
    };
  };

  // Google Services
  google: {
    connected: boolean;
    email?: string;
    connectedAt?: Date;
    lastSyncedAt?: Date;
    services: {
      gmail: boolean;
      calendar: boolean;
      drive: boolean;
      meet: boolean;
      contacts: boolean;
      photos: boolean;
      maps: boolean;
    };
  };

  // Microsoft Services
  microsoft: {
    connected: boolean;
    email?: string;
    connectedAt?: Date;
    lastSyncedAt?: Date;
    services: {
      outlook: boolean;
      calendar: boolean;
      oneDrive: boolean;
      teams: boolean;
      contacts: boolean;
      todo: boolean;
    };
  };

  // Calendar Integrations
  calendars: {
    google?: IntegrationStatus;
    outlook?: IntegrationStatus;
    apple?: IntegrationStatus;
  };

  // Social Media
  socialMedia: {
    twitter?: IntegrationStatus;
    linkedin?: IntegrationStatus;
    facebook?: IntegrationStatus;
    instagram?: IntegrationStatus;
  };

  // Communication Platforms
  communication: {
    slack?: IntegrationStatus;
    discord?: IntegrationStatus;
    teams?: IntegrationStatus;
    zoom?: IntegrationStatus;
  };

  // Device Integrations
  device: {
    contacts: {
      enabled: boolean;
      permissionGranted: boolean;
      totalContacts: number;
      lastSyncedAt?: Date;
    };
    location: {
      enabled: boolean;
      permissionGranted: boolean;
      trackingMode?: string;
      lastKnownLocation?: {
        latitude?: number;
        longitude?: number;
        timestamp?: Date;
        accuracy?: number;
      };
    };
    photos: {
      enabled: boolean;
      permissionGranted: boolean;
      totalPhotos: number;
      lastSyncedAt?: Date;
    };
    calendar: {
      enabled: boolean;
      permissionGranted: boolean;
      totalEvents: number;
      lastSyncedAt?: Date;
    };
    microphone: {
      enabled: boolean;
      permissionGranted: boolean;
    };
    camera: {
      enabled: boolean;
      permissionGranted: boolean;
    };
    notifications: {
      enabled: boolean;
      permissionGranted: boolean;
    };
  };

  // Email Accounts
  emailAccounts: Array<{
    id: string;
    provider: string;
    email: string;
    name?: string;
    isDefault: boolean;
    connectedAt: Date;
    lastSyncedAt?: Date;
    stats?: {
      totalEmails: number;
      unreadCount: number;
      lastEmailAt?: Date;
    };
  }>;

  // Cloud Storage
  cloudStorage: Array<{
    id: string;
    provider: string;
    email?: string;
    connectedAt: Date;
    lastSyncedAt?: Date;
    stats?: {
      totalFiles: number;
      totalSize: number;
      quotaUsed: number;
      quotaTotal: number;
    };
  }>;
}

class IntegrationAggregatorService {
  /**
   * Aggregate ALL integration data for a user
   */
  async aggregateAllIntegrations(userId: string): Promise<ComprehensiveIntegrationData> {
    console.log(`🔗 Aggregating ALL integrations for user: ${userId}`);

    const user = await User.findById(userId).select('integrations');

    if (!user || !user.integrations) {
      return this.getEmptyIntegrationData();
    }

    const integrations = user.integrations;

    // Calculate summary statistics
    const summary = this.calculateSummary(integrations);

    // Build comprehensive integration data
    const data: ComprehensiveIntegrationData = {
      summary,

      // Google Services
      google: {
        connected: integrations.google?.connected || false,
        email: integrations.google?.email,
        connectedAt: integrations.google?.connectedAt,
        lastSyncedAt: integrations.google?.lastSyncedAt,
        services: {
          gmail: integrations.google?.services?.gmail || false,
          calendar: integrations.google?.services?.calendar || false,
          drive: integrations.google?.services?.drive || false,
          meet: integrations.google?.services?.meet || false,
          contacts: integrations.google?.services?.contacts || false,
          photos: integrations.google?.services?.photos || false,
          maps: integrations.google?.services?.maps || false,
        },
      },

      // Microsoft Services
      microsoft: {
        connected: integrations.microsoft?.connected || false,
        email: integrations.microsoft?.email,
        connectedAt: integrations.microsoft?.connectedAt,
        lastSyncedAt: integrations.microsoft?.lastSyncedAt,
        services: {
          outlook: integrations.microsoft?.services?.outlook || false,
          calendar: integrations.microsoft?.services?.calendar || false,
          oneDrive: integrations.microsoft?.services?.oneDrive || false,
          teams: integrations.microsoft?.services?.teams || false,
          contacts: integrations.microsoft?.services?.contacts || false,
          todo: integrations.microsoft?.services?.todo || false,
        },
      },

      // Calendar Integrations
      calendars: {
        google: integrations.googleCalendar?.connected
          ? {
              connected: true,
              provider: 'google',
              connectedAt: integrations.googleCalendar.connectedAt,
              email: integrations.google?.email,
            }
          : undefined,
        outlook: integrations.outlookCalendar?.connected
          ? {
              connected: true,
              provider: 'outlook',
              email: integrations.outlookCalendar.email,
              name: integrations.outlookCalendar.name,
              connectedAt: integrations.outlookCalendar.connectedAt,
            }
          : undefined,
        apple: integrations.appleCalendar?.connected
          ? {
              connected: true,
              provider: 'apple',
              connectedAt: integrations.appleCalendar.connectedAt,
              permissionGranted: integrations.appleCalendar.permissionGranted,
            }
          : undefined,
      },

      // Social Media
      socialMedia: {
        twitter: integrations.twitter?.connected
          ? {
              connected: true,
              provider: 'twitter',
              username: integrations.twitter.username,
              connectedAt: integrations.twitter.connectedAt,
              lastSyncedAt: integrations.twitter.lastSyncedAt,
              permissions: integrations.twitter.permissions,
            }
          : undefined,
        linkedin: integrations.linkedin?.connected
          ? {
              connected: true,
              provider: 'linkedin',
              name: integrations.linkedin.name,
              email: integrations.linkedin.email,
              connectedAt: integrations.linkedin.connectedAt,
              lastSyncedAt: integrations.linkedin.lastSyncedAt,
              permissions: integrations.linkedin.permissions,
            }
          : undefined,
        facebook: integrations.facebook?.connected
          ? {
              connected: true,
              provider: 'facebook',
              name: integrations.facebook.name,
              email: integrations.facebook.email,
              connectedAt: integrations.facebook.connectedAt,
              lastSyncedAt: integrations.facebook.lastSyncedAt,
              permissions: integrations.facebook.permissions,
            }
          : undefined,
        instagram: integrations.instagram?.connected
          ? {
              connected: true,
              provider: 'instagram',
              username: integrations.instagram.username,
              connectedAt: integrations.instagram.connectedAt,
              lastSyncedAt: integrations.instagram.lastSyncedAt,
              permissions: integrations.instagram.permissions,
            }
          : undefined,
      },

      // Communication Platforms
      communication: {
        slack: integrations.slack?.connected
          ? {
              connected: true,
              provider: 'slack',
              name: integrations.slack.teamName,
              connectedAt: integrations.slack.connectedAt,
              lastSyncedAt: integrations.slack.lastSyncedAt,
              permissions: integrations.slack.permissions,
            }
          : undefined,
        discord: integrations.discord?.connected
          ? {
              connected: true,
              provider: 'discord',
              username: integrations.discord.username,
              connectedAt: integrations.discord.connectedAt,
              lastSyncedAt: integrations.discord.lastSyncedAt,
              stats: {
                guilds: integrations.discord.guilds?.length || 0,
              },
            }
          : undefined,
        teams: integrations.teams?.connected
          ? {
              connected: true,
              provider: 'teams',
              connectedAt: integrations.teams.connectedAt,
              lastSyncedAt: integrations.teams.lastSyncedAt,
            }
          : undefined,
        zoom: integrations.zoom?.connected
          ? {
              connected: true,
              provider: 'zoom',
              email: integrations.zoom.email,
              connectedAt: integrations.zoom.connectedAt,
              lastSyncedAt: integrations.zoom.lastSyncedAt,
              permissions: integrations.zoom.permissions,
            }
          : undefined,
      },

      // Device Integrations
      device: {
        contacts: {
          enabled: integrations.device?.contacts?.enabled || false,
          permissionGranted: integrations.device?.contacts?.permissionGranted || false,
          totalContacts: integrations.device?.contacts?.totalContacts || 0,
          lastSyncedAt: integrations.device?.contacts?.lastSyncedAt,
        },
        location: {
          enabled: integrations.device?.location?.enabled || false,
          permissionGranted: integrations.device?.location?.permissionGranted || false,
          trackingMode: integrations.device?.location?.trackingMode,
          lastKnownLocation: integrations.device?.location?.lastKnownLocation,
        },
        photos: {
          enabled: integrations.device?.photos?.enabled || false,
          permissionGranted: integrations.device?.photos?.permissionGranted || false,
          totalPhotos: integrations.device?.photos?.totalPhotos || 0,
          lastSyncedAt: integrations.device?.photos?.lastSyncedAt,
        },
        calendar: {
          enabled: integrations.device?.calendar?.enabled || false,
          permissionGranted: integrations.device?.calendar?.permissionGranted || false,
          totalEvents: integrations.device?.calendar?.totalEvents || 0,
          lastSyncedAt: integrations.device?.calendar?.lastSyncedAt,
        },
        microphone: {
          enabled: integrations.device?.microphone?.enabled || false,
          permissionGranted: integrations.device?.microphone?.permissionGranted || false,
        },
        camera: {
          enabled: integrations.device?.camera?.enabled || false,
          permissionGranted: integrations.device?.camera?.permissionGranted || false,
        },
        notifications: {
          enabled: integrations.device?.notifications?.enabled || true,
          permissionGranted: integrations.device?.notifications?.permissionGranted || false,
        },
      },

      // Email Accounts
      emailAccounts: (integrations.emailAccounts || []).map((account: any) => ({
        id: account.id,
        provider: account.provider,
        email: account.email,
        name: account.name,
        isDefault: account.isDefault,
        connectedAt: account.connectedAt,
        lastSyncedAt: account.lastSyncedAt,
        stats: account.stats,
      })),

      // Cloud Storage
      cloudStorage: (integrations.cloudStorage || []).map((storage: any) => ({
        id: storage.id,
        provider: storage.provider,
        email: storage.email,
        connectedAt: storage.connectedAt,
        lastSyncedAt: storage.lastSyncedAt,
        stats: storage.stats,
      })),
    };

    console.log(`✅ Aggregated ${summary.connectedCount} connected integrations`);
    return data;
  }

  /**
   * Generate natural language summary of ALL integrations
   */
  async generateIntegrationSummary(userId: string): Promise<string> {
    const data = await this.aggregateAllIntegrations(userId);

    let summary = `═══════════════════════════════════════════════════════════
📡 COMPREHENSIVE INTEGRATION STATUS
═══════════════════════════════════════════════════════════

OVERVIEW:
- Total Integrations: ${data.summary.totalIntegrations}
- Connected: ${data.summary.connectedCount}
- Categories: Google (${data.summary.categories.google}), Microsoft (${data.summary.categories.microsoft}), Social (${data.summary.categories.social}), Communication (${data.summary.categories.communication}), Device (${data.summary.categories.device}), Email (${data.summary.categories.email}), Storage (${data.summary.categories.storage})

`;

    // Google Services
    if (data.google.connected) {
      const enabledServices = Object.entries(data.google.services)
        .filter(([_, enabled]) => enabled)
        .map(([service, _]) => service);
      summary += `🟢 GOOGLE (${data.google.email}):
   Enabled Services: ${enabledServices.join(', ') || 'None'}
   Connected: ${data.google.connectedAt ? new Date(data.google.connectedAt).toLocaleDateString() : 'N/A'}
   Last Synced: ${data.google.lastSyncedAt ? new Date(data.google.lastSyncedAt).toLocaleString() : 'Never'}

`;
    } else {
      summary += `⚪ GOOGLE: Not connected

`;
    }

    // Microsoft Services
    if (data.microsoft.connected) {
      const enabledServices = Object.entries(data.microsoft.services)
        .filter(([_, enabled]) => enabled)
        .map(([service, _]) => service);
      summary += `🟢 MICROSOFT (${data.microsoft.email}):
   Enabled Services: ${enabledServices.join(', ') || 'None'}
   Connected: ${data.microsoft.connectedAt ? new Date(data.microsoft.connectedAt).toLocaleDateString() : 'N/A'}
   Last Synced: ${data.microsoft.lastSyncedAt ? new Date(data.microsoft.lastSyncedAt).toLocaleString() : 'Never'}

`;
    } else {
      summary += `⚪ MICROSOFT: Not connected

`;
    }

    // Calendars
    const connectedCalendars = Object.entries(data.calendars)
      .filter(([_, cal]) => cal?.connected)
      .map(([name, _]) => name);
    if (connectedCalendars.length > 0) {
      summary += `📅 CALENDARS: ${connectedCalendars.join(', ')}

`;
    } else {
      summary += `📅 CALENDARS: None connected

`;
    }

    // Social Media
    const connectedSocial = Object.entries(data.socialMedia)
      .filter(([_, platform]) => platform?.connected)
      .map(([name, platform]) => `${name} (${platform!.username || platform!.name || platform!.email})`);
    if (connectedSocial.length > 0) {
      summary += `📱 SOCIAL MEDIA: ${connectedSocial.join(', ')}

`;
    } else {
      summary += `📱 SOCIAL MEDIA: None connected

`;
    }

    // Communication
    const connectedComm = Object.entries(data.communication)
      .filter(([_, platform]) => platform?.connected)
      .map(([name, _]) => name);
    if (connectedComm.length > 0) {
      summary += `💬 COMMUNICATION: ${connectedComm.join(', ')}

`;
    } else {
      summary += `💬 COMMUNICATION: None connected

`;
    }

    // Device Integrations
    const devicePermissions = [];
    if (data.device.contacts.permissionGranted) devicePermissions.push(`Contacts (${data.device.contacts.totalContacts})`);
    if (data.device.location.permissionGranted) devicePermissions.push(`Location`);
    if (data.device.photos.permissionGranted) devicePermissions.push(`Photos (${data.device.photos.totalPhotos})`);
    if (data.device.calendar.permissionGranted) devicePermissions.push(`Calendar (${data.device.calendar.totalEvents})`);
    if (data.device.microphone.permissionGranted) devicePermissions.push('Microphone');
    if (data.device.camera.permissionGranted) devicePermissions.push('Camera');
    if (data.device.notifications.permissionGranted) devicePermissions.push('Notifications');

    if (devicePermissions.length > 0) {
      summary += `📱 DEVICE PERMISSIONS: ${devicePermissions.join(', ')}

`;
    } else {
      summary += `📱 DEVICE PERMISSIONS: None granted

`;
    }

    // Email Accounts
    if (data.emailAccounts.length > 0) {
      summary += `📧 EMAIL ACCOUNTS (${data.emailAccounts.length}):
`;
      data.emailAccounts.forEach(account => {
        const unreadText = account.stats?.unreadCount ? ` - ${account.stats.unreadCount} unread` : '';
        summary += `   - ${account.email} (${account.provider})${account.isDefault ? ' [DEFAULT]' : ''}${unreadText}
`;
      });
      summary += `\n`;
    } else {
      summary += `📧 EMAIL ACCOUNTS: None connected

`;
    }

    // Cloud Storage
    if (data.cloudStorage.length > 0) {
      summary += `☁️ CLOUD STORAGE (${data.cloudStorage.length}):
`;
      data.cloudStorage.forEach(storage => {
        const sizeGB = storage.stats?.totalSize ? (storage.stats.totalSize / (1024 ** 3)).toFixed(2) : '0';
        const quotaGB = storage.stats?.quotaTotal ? (storage.stats.quotaTotal / (1024 ** 3)).toFixed(2) : '?';
        summary += `   - ${storage.provider}: ${sizeGB}GB / ${quotaGB}GB (${storage.stats?.totalFiles || 0} files)
`;
      });
      summary += `\n`;
    } else {
      summary += `☁️ CLOUD STORAGE: None connected

`;
    }

    // Location Info
    if (data.device.location.permissionGranted && data.device.location.lastKnownLocation) {
      const loc = data.device.location.lastKnownLocation;
      summary += `📍 LAST KNOWN LOCATION:
   Coordinates: ${loc.latitude}, ${loc.longitude}
   Accuracy: ${loc.accuracy}m
   Updated: ${loc.timestamp ? new Date(loc.timestamp).toLocaleString() : 'Unknown'}

`;
    }

    summary += `═══════════════════════════════════════════════════════════`;

    return summary;
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(integrations: any): ComprehensiveIntegrationData['summary'] {
    let totalIntegrations = 0;
    let connectedCount = 0;
    const categories = {
      google: 0,
      microsoft: 0,
      social: 0,
      communication: 0,
      device: 0,
      email: 0,
      storage: 0,
    };

    // Google
    totalIntegrations++;
    if (integrations.google?.connected) {
      connectedCount++;
      categories.google++;
    }

    // Microsoft
    totalIntegrations++;
    if (integrations.microsoft?.connected) {
      connectedCount++;
      categories.microsoft++;
    }

    // Social Media
    totalIntegrations += 4; // twitter, linkedin, facebook, instagram
    if (integrations.twitter?.connected) {
      connectedCount++;
      categories.social++;
    }
    if (integrations.linkedin?.connected) {
      connectedCount++;
      categories.social++;
    }
    if (integrations.facebook?.connected) {
      connectedCount++;
      categories.social++;
    }
    if (integrations.instagram?.connected) {
      connectedCount++;
      categories.social++;
    }

    // Communication
    totalIntegrations += 4; // slack, discord, teams, zoom
    if (integrations.slack?.connected) {
      connectedCount++;
      categories.communication++;
    }
    if (integrations.discord?.connected) {
      connectedCount++;
      categories.communication++;
    }
    if (integrations.teams?.connected) {
      connectedCount++;
      categories.communication++;
    }
    if (integrations.zoom?.connected) {
      connectedCount++;
      categories.communication++;
    }

    // Device
    totalIntegrations += 7; // contacts, location, photos, calendar, microphone, camera, notifications
    if (integrations.device?.contacts?.permissionGranted) {
      connectedCount++;
      categories.device++;
    }
    if (integrations.device?.location?.permissionGranted) {
      connectedCount++;
      categories.device++;
    }
    if (integrations.device?.photos?.permissionGranted) {
      connectedCount++;
      categories.device++;
    }
    if (integrations.device?.calendar?.permissionGranted) {
      connectedCount++;
      categories.device++;
    }
    if (integrations.device?.microphone?.permissionGranted) {
      connectedCount++;
      categories.device++;
    }
    if (integrations.device?.camera?.permissionGranted) {
      connectedCount++;
      categories.device++;
    }
    if (integrations.device?.notifications?.permissionGranted) {
      connectedCount++;
      categories.device++;
    }

    // Email Accounts
    const emailCount = integrations.emailAccounts?.length || 0;
    totalIntegrations += emailCount;
    connectedCount += emailCount;
    categories.email = emailCount;

    // Cloud Storage
    const storageCount = integrations.cloudStorage?.length || 0;
    totalIntegrations += storageCount;
    connectedCount += storageCount;
    categories.storage = storageCount;

    return {
      totalIntegrations,
      connectedCount,
      categories,
    };
  }

  /**
   * Get empty integration data (when user has no integrations)
   */
  private getEmptyIntegrationData(): ComprehensiveIntegrationData {
    return {
      summary: {
        totalIntegrations: 0,
        connectedCount: 0,
        categories: {
          google: 0,
          microsoft: 0,
          social: 0,
          communication: 0,
          device: 0,
          email: 0,
          storage: 0,
        },
      },
      google: {
        connected: false,
        services: {
          gmail: false,
          calendar: false,
          drive: false,
          meet: false,
          contacts: false,
          photos: false,
          maps: false,
        },
      },
      microsoft: {
        connected: false,
        services: {
          outlook: false,
          calendar: false,
          oneDrive: false,
          teams: false,
          contacts: false,
          todo: false,
        },
      },
      calendars: {},
      socialMedia: {},
      communication: {},
      device: {
        contacts: { enabled: false, permissionGranted: false, totalContacts: 0 },
        location: { enabled: false, permissionGranted: false },
        photos: { enabled: false, permissionGranted: false, totalPhotos: 0 },
        calendar: { enabled: false, permissionGranted: false, totalEvents: 0 },
        microphone: { enabled: false, permissionGranted: false },
        camera: { enabled: false, permissionGranted: false },
        notifications: { enabled: true, permissionGranted: false },
      },
      emailAccounts: [],
      cloudStorage: [],
    };
  }
}

export default new IntegrationAggregatorService();
