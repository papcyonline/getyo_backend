import axios from 'axios';

interface LocationData {
  city?: string;
  country?: string;
  countryCode?: string;
  region?: string;
  timezone?: string;
}

class GeolocationService {
  private cache: Map<string, LocationData> = new Map();
  private cacheExpiry: number = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Get location data from IP address using ip-api.com (free, no API key required)
   */
  async getLocationFromIP(ipAddress: string): Promise<LocationData> {
    try {
      // Handle localhost and private IPs
      if (this.isLocalOrPrivateIP(ipAddress)) {
        return {
          city: 'Local',
          country: 'Local Development',
          countryCode: 'LOCAL',
          region: 'Local',
          timezone: 'UTC',
        };
      }

      // Check cache first
      const cached = this.cache.get(ipAddress);
      if (cached) {
        return cached;
      }

      // Fetch from API
      const response = await axios.get(`http://ip-api.com/json/${ipAddress}`, {
        timeout: 5000,
        params: {
          fields: 'status,message,country,countryCode,region,city,timezone'
        }
      });

      if (response.data.status === 'success') {
        const locationData: LocationData = {
          city: response.data.city || 'Unknown',
          country: response.data.country || 'Unknown',
          countryCode: response.data.countryCode || 'XX',
          region: response.data.region || 'Unknown',
          timezone: response.data.timezone || 'UTC',
        };

        // Cache the result
        this.cache.set(ipAddress, locationData);

        // Clear cache after expiry
        setTimeout(() => {
          this.cache.delete(ipAddress);
        }, this.cacheExpiry);

        return locationData;
      } else {
        console.warn(`Geolocation API error for IP ${ipAddress}:`, response.data.message);
        return this.getDefaultLocation();
      }
    } catch (error: any) {
      console.error('Geolocation service error:', error.message);
      return this.getDefaultLocation();
    }
  }

  /**
   * Check if IP is localhost or private
   */
  private isLocalOrPrivateIP(ip: string): boolean {
    // Localhost
    if (ip === '127.0.0.1' || ip === 'localhost' || ip === '::1' || ip === '::ffff:127.0.0.1') {
      return true;
    }

    // Private IP ranges
    const privateRanges = [
      /^10\./,                    // 10.0.0.0 - 10.255.255.255
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,  // 172.16.0.0 - 172.31.255.255
      /^192\.168\./,              // 192.168.0.0 - 192.168.255.255
    ];

    return privateRanges.some(range => range.test(ip));
  }

  /**
   * Get default location for fallback
   */
  private getDefaultLocation(): LocationData {
    return {
      city: 'Unknown',
      country: 'Unknown',
      countryCode: 'XX',
      region: 'Unknown',
      timezone: 'UTC',
    };
  }

  /**
   * Clear the cache (useful for testing)
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Alternative: Get location using ipapi.co (has rate limits, but more accurate)
   * Requires API key for production
   */
  async getLocationFromIPApiCo(ipAddress: string, apiKey?: string): Promise<LocationData> {
    try {
      if (this.isLocalOrPrivateIP(ipAddress)) {
        return {
          city: 'Local',
          country: 'Local Development',
          countryCode: 'LOCAL',
          region: 'Local',
          timezone: 'UTC',
        };
      }

      const url = apiKey
        ? `https://ipapi.co/${ipAddress}/json/?key=${apiKey}`
        : `https://ipapi.co/${ipAddress}/json/`;

      const response = await axios.get(url, {
        timeout: 5000,
      });

      if (response.data && !response.data.error) {
        return {
          city: response.data.city || 'Unknown',
          country: response.data.country_name || 'Unknown',
          countryCode: response.data.country_code || 'XX',
          region: response.data.region || 'Unknown',
          timezone: response.data.timezone || 'UTC',
        };
      } else {
        console.warn(`IPApi.co error for IP ${ipAddress}:`, response.data.reason);
        return this.getDefaultLocation();
      }
    } catch (error: any) {
      console.error('IPApi.co service error:', error.message);
      return this.getDefaultLocation();
    }
  }

  /**
   * Batch lookup for multiple IPs (useful for analytics)
   */
  async batchLookup(ipAddresses: string[]): Promise<Map<string, LocationData>> {
    const results = new Map<string, LocationData>();

    // Process in batches of 5 to avoid rate limits
    const batchSize = 5;
    for (let i = 0; i < ipAddresses.length; i += batchSize) {
      const batch = ipAddresses.slice(i, i + batchSize);
      const promises = batch.map(ip => this.getLocationFromIP(ip));
      const batchResults = await Promise.all(promises);

      batch.forEach((ip, index) => {
        results.set(ip, batchResults[index]);
      });

      // Small delay between batches to respect rate limits
      if (i + batchSize < ipAddresses.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }
}

export default new GeolocationService();
