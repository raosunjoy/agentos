/**
 * Plugin Marketplace Infrastructure
 * Complete plugin ecosystem with marketplace, ratings, monetization, and distribution
 */

import { EventEmitter } from 'events';
import { systemLogger } from '../core/logging';
import { errorHandler } from '../core/errors';

export interface PluginListing {
  id: string;
  name: string;
  description: string;
  version: string;
  author: PluginAuthor;
  category: PluginCategory;
  tags: string[];
  price: PriceInfo;
  rating: RatingInfo;
  downloads: number;
  lastUpdated: Date;
  compatibility: CompatibilityInfo;
  screenshots: string[];
  demoVideo?: string;
  documentation: string;
  support: SupportInfo;
  license: string;
  metadata: PluginMetadata;
}

export interface PluginAuthor {
  id: string;
  name: string;
  email: string;
  website?: string;
  verified: boolean;
  reputation: number; // 0-5 stars
  pluginsPublished: number;
  joinDate: Date;
}

export type PluginCategory =
  | 'communication'
  | 'health'
  | 'productivity'
  | 'entertainment'
  | 'education'
  | 'finance'
  | 'travel'
  | 'shopping'
  | 'utilities'
  | 'accessibility'
  | 'caregiver'
  | 'automation'
  | 'custom';

export interface PriceInfo {
  type: 'free' | 'paid' | 'subscription' | 'freemium';
  amount?: number; // in USD cents
  currency: string;
  trialPeriod?: number; // days
  subscriptionInterval?: 'monthly' | 'yearly';
}

export interface RatingInfo {
  average: number; // 0-5
  totalReviews: number;
  distribution: { [key: number]: number }; // 1-5 star counts
  recentReviews: PluginReview[];
}

export interface PluginReview {
  id: string;
  userId: string;
  userName: string;
  rating: number; // 1-5
  title: string;
  comment: string;
  date: Date;
  verified: boolean; // Purchased/used the plugin
  helpful: number; // Upvotes
  version: string; // Plugin version reviewed
  deviceInfo?: string;
}

export interface CompatibilityInfo {
  minAgentOSVersion: string;
  maxAgentOSVersion?: string;
  supportedPlatforms: ('android' | 'ios' | 'web' | 'desktop')[];
  supportedLanguages: string[];
  systemRequirements: {
    minMemory?: number; // MB
    minStorage?: number; // MB
    permissions: string[];
  };
}

export interface SupportInfo {
  email: string;
  website?: string;
  documentation: string;
  communityForum?: string;
  responseTime: 'hours' | 'days' | 'weeks';
  supportLevel: 'community' | 'email' | 'priority' | 'dedicated';
}

export interface PluginMetadata {
  size: number; // KB
  dependencies: string[];
  intents: PluginIntent[];
  permissions: string[];
  configuration: PluginConfig[];
  hooks: PluginHook[];
  apiEndpoints: string[];
}

export interface PluginIntent {
  name: string;
  description: string;
  examples: string[];
  parameters: PluginParameter[];
}

export interface PluginParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required: boolean;
  description: string;
  default?: any;
}

export interface PluginConfig {
  key: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'multiselect';
  label: string;
  description: string;
  required: boolean;
  default?: any;
  options?: string[]; // for select/multiselect
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

export interface PluginHook {
  name: string;
  type: 'before' | 'after' | 'error';
  event: string;
  description: string;
}

export interface PurchaseInfo {
  id: string;
  userId: string;
  pluginId: string;
  purchaseDate: Date;
  price: PriceInfo;
  transactionId: string;
  status: 'completed' | 'refunded' | 'cancelled';
  licenseKey?: string;
  downloadUrl: string;
  expiresAt?: Date;
}

export interface MarketplaceStats {
  totalPlugins: number;
  totalDownloads: number;
  totalRevenue: number;
  activeUsers: number;
  topCategories: Array<{ category: PluginCategory; count: number }>;
  trendingPlugins: PluginListing[];
  newReleases: PluginListing[];
}

export class PluginMarketplace extends EventEmitter {
  private plugins: Map<string, PluginListing> = new Map();
  private purchases: Map<string, PurchaseInfo[]> = new Map(); // userId -> purchases
  private logger = systemLogger('plugin-marketplace');

  constructor() {
    super();
    this.initializeMarketplace();
  }

  /**
   * Initialize marketplace with sample plugins
   */
  private initializeMarketplace(): void {
    // Add some sample plugins
    this.addSamplePlugins();
    this.logger.info('Plugin marketplace initialized');
  }

  /**
   * Add sample plugins for demonstration
   */
  private addSamplePlugins(): void {
    const samplePlugins: Omit<PluginListing, 'id'>[] = [
      {
        name: 'Weather Assistant',
        description: 'Get weather information and forecasts with voice commands',
        version: '1.2.0',
        author: {
          id: 'author_weather',
          name: 'Weather Pro Inc.',
          email: 'support@weatherpro.com',
          verified: true,
          reputation: 4.8,
          pluginsPublished: 3,
          joinDate: new Date('2023-01-15')
        },
        category: 'utilities',
        tags: ['weather', 'forecast', 'voice', 'location'],
        price: {
          type: 'free',
          currency: 'USD'
        },
        rating: {
          average: 4.5,
          totalReviews: 1250,
          distribution: { 1: 15, 2: 25, 3: 50, 4: 200, 5: 960 },
          recentReviews: []
        },
        downloads: 50000,
        lastUpdated: new Date('2024-11-01'),
        compatibility: {
          minAgentOSVersion: '1.0.0',
          supportedPlatforms: ['android', 'ios', 'web'],
          supportedLanguages: ['en', 'es', 'fr'],
          systemRequirements: {
            permissions: ['location', 'network']
          }
        },
        screenshots: ['screenshot1.jpg', 'screenshot2.jpg'],
        documentation: 'https://weatherpro.com/docs/agentos',
        support: {
          email: 'support@weatherpro.com',
          documentation: 'https://weatherpro.com/docs',
          communityForum: 'https://community.weatherpro.com',
          responseTime: 'hours',
          supportLevel: 'email'
        },
        license: 'MIT',
        metadata: {
          size: 2048,
          dependencies: [],
          intents: [
            {
              name: 'get_weather',
              description: 'Get current weather conditions',
              examples: ['What\'s the weather?', 'How is the weather in Paris?'],
              parameters: [
                {
                  name: 'location',
                  type: 'string',
                  required: false,
                  description: 'Location for weather query'
                }
              ]
            }
          ],
          permissions: ['location', 'network'],
          configuration: [
            {
              key: 'units',
              type: 'select',
              label: 'Temperature Units',
              description: 'Choose temperature units',
              required: false,
              default: 'celsius',
              options: ['celsius', 'fahrenheit']
            }
          ],
          hooks: [],
          apiEndpoints: ['/api/weather']
        }
      },
      {
        name: 'Medication Reminder Pro',
        description: 'Advanced medication management with caregiver alerts',
        version: '2.1.0',
        author: {
          id: 'author_health',
          name: 'HealthTech Solutions',
          email: 'contact@healthtech.com',
          website: 'https://healthtech.com',
          verified: true,
          reputation: 4.9,
          pluginsPublished: 8,
          joinDate: new Date('2022-08-20')
        },
        category: 'health',
        tags: ['medication', 'reminders', 'health', 'caregiver'],
        price: {
          type: 'subscription',
          amount: 499, // $4.99
          currency: 'USD',
          subscriptionInterval: 'monthly'
        },
        rating: {
          average: 4.7,
          totalReviews: 890,
          distribution: { 1: 8, 2: 12, 3: 35, 4: 150, 5: 685 },
          recentReviews: []
        },
        downloads: 15000,
        lastUpdated: new Date('2024-10-28'),
        compatibility: {
          minAgentOSVersion: '1.0.0',
          supportedPlatforms: ['android', 'ios'],
          supportedLanguages: ['en', 'es', 'fr', 'de', 'it'],
          systemRequirements: {
            permissions: ['notifications', 'storage']
          }
        },
        screenshots: ['med1.jpg', 'med2.jpg', 'med3.jpg'],
        demoVideo: 'https://healthtech.com/demo/medication-reminder.mp4',
        documentation: 'https://docs.healthtech.com/medication-reminder',
        support: {
          email: 'support@healthtech.com',
          website: 'https://healthtech.com/support',
          documentation: 'https://docs.healthtech.com',
          communityForum: 'https://community.healthtech.com',
          responseTime: 'hours',
          supportLevel: 'priority'
        },
        license: 'Proprietary',
        metadata: {
          size: 5120,
          dependencies: ['caregiver-integration'],
          intents: [
            {
              name: 'add_medication',
              description: 'Add a new medication to track',
              examples: ['Add medication aspirin 81mg twice daily'],
              parameters: [
                { name: 'name', type: 'string', required: true, description: 'Medication name' },
                { name: 'dosage', type: 'string', required: true, description: 'Dosage amount' },
                { name: 'frequency', type: 'string', required: true, description: 'How often to take' }
              ]
            }
          ],
          permissions: ['notifications', 'storage', 'caregiver'],
          configuration: [
            {
              key: 'reminder_sound',
              type: 'select',
              label: 'Reminder Sound',
              description: 'Choose reminder notification sound',
              required: false,
              default: 'gentle',
              options: ['gentle', 'standard', 'loud']
            },
            {
              key: 'caregiver_alerts',
              type: 'boolean',
              label: 'Caregiver Alerts',
              description: 'Send alerts to caregivers for missed medications',
              required: false,
              default: true
            }
          ],
          hooks: [
            {
              name: 'medication_taken',
              type: 'after',
              event: 'medication_recorded',
              description: 'Triggered when medication is marked as taken'
            }
          ],
          apiEndpoints: ['/api/medications', '/api/reminders']
        }
      }
    ];

    // Add sample plugins to marketplace
    samplePlugins.forEach(plugin => {
      const id = `plugin_${plugin.name.toLowerCase().replace(/\s+/g, '_')}`;
      this.plugins.set(id, { ...plugin, id });
    });
  }

  /**
   * Publish a new plugin to the marketplace
   */
  async publishPlugin(pluginData: Omit<PluginListing, 'id' | 'rating' | 'downloads'>): Promise<string> {
    // Validate plugin data
    const validation = this.validatePluginData(pluginData);
    if (!validation.valid) {
      throw new Error(`Plugin validation failed: ${validation.errors.join(', ')}`);
    }

    const id = `plugin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const plugin: PluginListing = {
      ...pluginData,
      id,
      rating: {
        average: 0,
        totalReviews: 0,
        distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        recentReviews: []
      },
      downloads: 0
    };

    this.plugins.set(id, plugin);

    this.logger.info('Plugin published to marketplace', {
      pluginId: id,
      name: plugin.name,
      author: plugin.author.name,
      category: plugin.category,
      price: plugin.price
    });

    this.emit('pluginPublished', plugin);

    return id;
  }

  /**
   * Search plugins in marketplace
   */
  searchPlugins(query: {
    text?: string;
    category?: PluginCategory;
    author?: string;
    price?: 'free' | 'paid';
    rating?: number; // minimum rating
    tags?: string[];
    sortBy?: 'downloads' | 'rating' | 'price' | 'newest';
    limit?: number;
    offset?: number;
  } = {}): PluginListing[] {
    let results = Array.from(this.plugins.values());

    // Text search
    if (query.text) {
      const searchText = query.text.toLowerCase();
      results = results.filter(plugin =>
        plugin.name.toLowerCase().includes(searchText) ||
        plugin.description.toLowerCase().includes(searchText) ||
        plugin.tags.some(tag => tag.toLowerCase().includes(searchText))
      );
    }

    // Category filter
    if (query.category) {
      results = results.filter(plugin => plugin.category === query.category);
    }

    // Author filter
    if (query.author) {
      results = results.filter(plugin =>
        plugin.author.name.toLowerCase().includes(query.author!.toLowerCase())
      );
    }

    // Price filter
    if (query.price) {
      results = results.filter(plugin => plugin.price.type === query.price);
    }

    // Rating filter
    if (query.rating) {
      results = results.filter(plugin => plugin.rating.average >= query.rating!);
    }

    // Tags filter
    if (query.tags && query.tags.length > 0) {
      results = results.filter(plugin =>
        query.tags!.some(tag => plugin.tags.includes(tag))
      );
    }

    // Sorting
    switch (query.sortBy) {
      case 'downloads':
        results.sort((a, b) => b.downloads - a.downloads);
        break;
      case 'rating':
        results.sort((a, b) => b.rating.average - a.rating.average);
        break;
      case 'price':
        results.sort((a, b) => {
          if (a.price.type === 'free' && b.price.type !== 'free') return -1;
          if (b.price.type === 'free' && a.price.type !== 'free') return 1;
          return (a.price.amount || 0) - (b.price.amount || 0);
        });
        break;
      case 'newest':
        results.sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime());
        break;
      default:
        results.sort((a, b) => b.downloads - a.downloads); // Default: by downloads
    }

    // Pagination
    const offset = query.offset || 0;
    const limit = query.limit || 20;
    results = results.slice(offset, offset + limit);

    return results;
  }

  /**
   * Get plugin details
   */
  getPlugin(pluginId: string): PluginListing | null {
    return this.plugins.get(pluginId) || null;
  }

  /**
   * Purchase/download plugin
   */
  async purchasePlugin(userId: string, pluginId: string, paymentMethod?: any): Promise<PurchaseInfo> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error('Plugin not found');
    }

    // Handle payment (simplified - in real implementation would integrate with payment processor)
    if (plugin.price.type === 'paid' || plugin.price.type === 'subscription') {
      if (!paymentMethod) {
        throw new Error('Payment method required for paid plugins');
      }

      // Simulate payment processing
      await this.processPayment(plugin.price, paymentMethod);
    }

    const purchaseId = `purchase_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const purchase: PurchaseInfo = {
      id: purchaseId,
      userId,
      pluginId,
      purchaseDate: new Date(),
      price: plugin.price,
      transactionId: `txn_${Date.now()}`,
      status: 'completed',
      licenseKey: plugin.price.type === 'paid' ? `license_${purchaseId}` : undefined,
      downloadUrl: `https://marketplace.agentos.com/download/${pluginId}`
    };

    // Record purchase
    if (!this.purchases.has(userId)) {
      this.purchases.set(userId, []);
    }
    this.purchases.get(userId)!.push(purchase);

    // Increment download count
    plugin.downloads++;

    this.logger.info('Plugin purchased', {
      purchaseId,
      userId,
      pluginId,
      pluginName: plugin.name,
      price: plugin.price
    });

    this.emit('pluginPurchased', { purchase, plugin });

    return purchase;
  }

  /**
   * Submit plugin review
   */
  async submitReview(pluginId: string, userId: string, review: Omit<PluginReview, 'id' | 'userId' | 'date'>): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error('Plugin not found');
    }

    // Check if user has purchased the plugin
    const userPurchases = this.purchases.get(userId) || [];
    const hasPurchased = userPurchases.some(p => p.pluginId === pluginId && p.status === 'completed');

    const reviewId = `review_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const fullReview: PluginReview = {
      ...review,
      id: reviewId,
      userId,
      date: new Date(),
      verified: hasPurchased
    };

    // Add to plugin reviews
    plugin.rating.recentReviews.unshift(fullReview);
    plugin.rating.recentReviews = plugin.rating.recentReviews.slice(0, 10); // Keep only 10 recent

    // Update rating statistics
    plugin.rating.totalReviews++;
    plugin.rating.distribution[review.rating]++;
    plugin.rating.average = this.calculateNewAverageRating(plugin.rating);

    this.logger.info('Plugin review submitted', {
      reviewId,
      pluginId,
      userId,
      rating: review.rating,
      verified: hasPurchased
    });

    this.emit('reviewSubmitted', { pluginId, review: fullReview });
  }

  /**
   * Get marketplace statistics
   */
  getMarketplaceStats(): MarketplaceStats {
    const plugins = Array.from(this.plugins.values());

    const totalPlugins = plugins.length;
    const totalDownloads = plugins.reduce((sum, p) => sum + p.downloads, 0);
    const totalRevenue = plugins
      .filter(p => p.price.type === 'paid' || p.price.type === 'subscription')
      .reduce((sum, p) => sum + (p.price.amount || 0) * p.downloads / 100, 0); // Rough estimate

    // Calculate category distribution
    const categoryCounts = new Map<PluginCategory, number>();
    plugins.forEach(plugin => {
      categoryCounts.set(plugin.category, (categoryCounts.get(plugin.category) || 0) + 1);
    });

    const topCategories = Array.from(categoryCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, count]) => ({ category, count }));

    // Get trending plugins (by recent downloads)
    const trendingPlugins = plugins
      .sort((a, b) => b.downloads - a.downloads)
      .slice(0, 10);

    // Get new releases (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const newReleases = plugins
      .filter(p => p.lastUpdated > thirtyDaysAgo)
      .sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime())
      .slice(0, 10);

    return {
      totalPlugins,
      totalDownloads,
      totalRevenue,
      activeUsers: this.purchases.size, // Rough estimate
      topCategories,
      trendingPlugins,
      newReleases
    };
  }

  /**
   * Get user's purchased plugins
   */
  getUserPurchases(userId: string): PurchaseInfo[] {
    return this.purchases.get(userId) || [];
  }

  /**
   * Get plugin recommendations for user
   */
  getRecommendationsForUser(userId: string, limit: number = 5): PluginListing[] {
    const userPurchases = this.getUserPurchases(userId);
    const purchasedCategories = new Set(
      userPurchases
        .map(p => this.plugins.get(p.pluginId))
        .filter(p => p)
        .map(p => p!.category)
    );

    // Recommend plugins from purchased categories that user hasn't bought
    const recommendations = Array.from(this.plugins.values())
      .filter(plugin =>
        purchasedCategories.has(plugin.category) &&
        !userPurchases.some(p => p.pluginId === plugin.id)
      )
      .sort((a, b) => b.rating.average - a.rating.average)
      .slice(0, limit);

    return recommendations;
  }

  /**
   * Utility methods
   */
  private validatePluginData(pluginData: Omit<PluginListing, 'id' | 'rating' | 'downloads'>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!pluginData.name || pluginData.name.length < 3) {
      errors.push('Plugin name must be at least 3 characters');
    }

    if (!pluginData.description || pluginData.description.length < 10) {
      errors.push('Plugin description must be at least 10 characters');
    }

    if (!pluginData.version || !/^\d+\.\d+\.\d+$/.test(pluginData.version)) {
      errors.push('Version must be in semver format (x.y.z)');
    }

    if (!pluginData.compatibility?.minAgentOSVersion) {
      errors.push('Minimum AgentOS version is required');
    }

    if (!pluginData.documentation) {
      errors.push('Documentation URL is required');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private async processPayment(price: PriceInfo, paymentMethod: any): Promise<void> {
    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 100));

    if (Math.random() < 0.05) { // 5% failure rate
      throw new Error('Payment processing failed');
    }
  }

  private calculateNewAverageRating(rating: RatingInfo): number {
    const totalStars = Object.entries(rating.distribution)
      .reduce((sum, [stars, count]) => sum + (parseInt(stars) * count), 0);

    return totalStars / rating.totalReviews;
  }

  /**
   * Public API methods
   */
  getAllPlugins(): PluginListing[] {
    return Array.from(this.plugins.values());
  }

  getPluginsByCategory(category: PluginCategory): PluginListing[] {
    return Array.from(this.plugins.values())
      .filter(plugin => plugin.category === category);
  }

  getPluginsByAuthor(authorId: string): PluginListing[] {
    return Array.from(this.plugins.values())
      .filter(plugin => plugin.author.id === authorId);
  }

  getTopRatedPlugins(limit: number = 10): PluginListing[] {
    return Array.from(this.plugins.values())
      .sort((a, b) => b.rating.average - a.rating.average)
      .slice(0, limit);
  }

  getMostDownloadedPlugins(limit: number = 10): PluginListing[] {
    return Array.from(this.plugins.values())
      .sort((a, b) => b.downloads - a.downloads)
      .slice(0, limit);
  }

  getFeaturedPlugins(): PluginListing[] {
    // Return plugins with high ratings and downloads
    return Array.from(this.plugins.values())
      .filter(plugin => plugin.rating.average >= 4.0 && plugin.downloads >= 1000)
      .sort((a, b) => (b.rating.average * b.downloads) - (a.rating.average * a.downloads))
      .slice(0, 5);
  }

  /**
   * Update plugin metadata
   */
  updatePlugin(pluginId: string, updates: Partial<PluginListing>): boolean {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return false;

    // Only allow certain fields to be updated
    const allowedUpdates: (keyof PluginListing)[] = [
      'name', 'description', 'version', 'tags', 'price',
      'screenshots', 'demoVideo', 'documentation', 'support',
      'lastUpdated', 'metadata'
    ];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedUpdates.includes(key as keyof PluginListing)) {
        (plugin as any)[key] = value;
      }
    }

    plugin.lastUpdated = new Date();

    this.logger.info('Plugin updated', { pluginId, updates: Object.keys(updates) });
    this.emit('pluginUpdated', { pluginId, plugin });

    return true;
  }

  /**
   * Remove plugin from marketplace
   */
  removePlugin(pluginId: string): boolean {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return false;

    this.plugins.delete(pluginId);

    this.logger.info('Plugin removed from marketplace', {
      pluginId,
      name: plugin.name,
      author: plugin.author.name
    });

    this.emit('pluginRemoved', { pluginId, plugin });

    return true;
  }
}
