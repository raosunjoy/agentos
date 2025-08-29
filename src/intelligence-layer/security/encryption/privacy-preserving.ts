import { DataAnonymizationOptions, PrivacyPreservingOptions } from './types';

/**
 * Data anonymization and differential privacy implementation
 * Provides privacy-preserving data processing techniques
 */
export class PrivacyPreservingProcessor {
  private anonymizationCache: Map<string, any> = new Map();
  private privacyBudget: Map<string, number> = new Map();

  /**
   * Anonymize data using specified method
   */
  async anonymizeData(
    data: any[], 
    options: DataAnonymizationOptions
  ): Promise<any[]> {
    switch (options.method) {
      case 'k-anonymity':
        return this.applyKAnonymity(data, options.parameters);
      
      case 'differential-privacy':
        return this.applyDifferentialPrivacy(data, options.parameters);
      
      case 'pseudonymization':
        return this.applyPseudonymization(data, options.parameters);
      
      default:
        throw new Error(`Unsupported anonymization method: ${options.method}`);
    }
  }

  /**
   * Apply k-anonymity to dataset
   */
  private applyKAnonymity(data: any[], parameters: any): any[] {
    const k = parameters.k || 5;
    const quasiIdentifiers = parameters.quasiIdentifiers || [];
    const sensitiveAttributes = parameters.sensitiveAttributes || [];

    if (!Array.isArray(data) || data.length === 0) {
      return data;
    }

    // Group records by quasi-identifier combinations
    const groups = new Map<string, any[]>();
    
    for (const record of data) {
      const key = quasiIdentifiers
        .map((attr: string) => this.generalizeValue(record[attr], attr, parameters))
        .join('|');
      
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(record);
    }

    // Filter out groups with less than k records
    const anonymizedData: any[] = [];
    
    for (const [key, group] of groups.entries()) {
      if (group.length >= k) {
        // Apply generalization to the group
        const generalizedGroup = group.map(record => {
          const anonymized = { ...record };
          
          // Generalize quasi-identifiers
          for (const attr of quasiIdentifiers) {
            anonymized[attr] = this.generalizeValue(record[attr], attr, parameters);
          }
          
          // Optionally suppress sensitive attributes
          if (parameters.suppressSensitive) {
            for (const attr of sensitiveAttributes) {
              anonymized[attr] = '*';
            }
          }
          
          return anonymized;
        });
        
        anonymizedData.push(...generalizedGroup);
      }
    }

    return anonymizedData;
  }

  /**
   * Apply differential privacy
   */
  private applyDifferentialPrivacy(data: any[], parameters: any): any[] {
    const epsilon = parameters.epsilon || 1.0;
    const delta = parameters.delta || 0.0001;
    const sensitivity = parameters.sensitivity || 1.0;
    const mechanism = parameters.mechanism || 'laplace';

    return data.map(record => {
      const noisyRecord = { ...record };
      
      // Add noise to numerical attributes
      for (const [key, value] of Object.entries(record)) {
        if (typeof value === 'number') {
          const noise = this.generateNoise(mechanism, epsilon, sensitivity);
          noisyRecord[key] = value + noise;
        }
      }
      
      return noisyRecord;
    });
  }

  /**
   * Apply pseudonymization
   */
  private applyPseudonymization(data: any[], parameters: any): any[] {
    const identifierFields = parameters.identifierFields || ['id', 'email', 'phone'];
    const preserveFormat = parameters.preserveFormat || false;

    return data.map(record => {
      const pseudonymized = { ...record };
      
      for (const field of identifierFields) {
        if (record[field]) {
          const cacheKey = `${field}:${record[field]}`;
          
          if (this.anonymizationCache.has(cacheKey)) {
            pseudonymized[field] = this.anonymizationCache.get(cacheKey);
          } else {
            const pseudonym = this.generatePseudonym(record[field], preserveFormat);
            this.anonymizationCache.set(cacheKey, pseudonym);
            pseudonymized[field] = pseudonym;
          }
        }
      }
      
      return pseudonymized;
    });
  }

  /**
   * Generate noise for differential privacy
   */
  private generateNoise(mechanism: string, epsilon: number, sensitivity: number): number {
    switch (mechanism) {
      case 'laplace':
        return this.generateLaplaceNoise(sensitivity / epsilon);
      
      case 'gaussian':
        const sigma = Math.sqrt(2 * Math.log(1.25 / 0.0001)) * sensitivity / epsilon;
        return this.generateGaussianNoise(0, sigma);
      
      default:
        return this.generateLaplaceNoise(sensitivity / epsilon);
    }
  }

  /**
   * Generate Laplace noise
   */
  private generateLaplaceNoise(scale: number): number {
    const u = Math.random() - 0.5;
    return -scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
  }

  /**
   * Generate Gaussian noise
   */
  private generateGaussianNoise(mean: number, stdDev: number): number {
    // Box-Muller transform
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return z0 * stdDev + mean;
  }

  /**
   * Generalize value for k-anonymity
   */
  private generalizeValue(value: any, attribute: string, parameters: any): any {
    const generalizationRules = parameters.generalizationRules || {};
    const rule = generalizationRules[attribute];

    if (!rule) {
      return value;
    }

    switch (rule.type) {
      case 'range':
        if (typeof value === 'number') {
          const rangeSize = rule.rangeSize || 10;
          const lowerBound = Math.floor(value / rangeSize) * rangeSize;
          return `${lowerBound}-${lowerBound + rangeSize - 1}`;
        }
        return value;
      
      case 'prefix':
        if (typeof value === 'string') {
          const prefixLength = rule.prefixLength || 3;
          return value.substring(0, prefixLength) + '*'.repeat(Math.max(0, value.length - prefixLength));
        }
        return value;
      
      case 'category':
        const categories = rule.categories || {};
        return categories[value] || 'Other';
      
      default:
        return value;
    }
  }

  /**
   * Generate pseudonym
   */
  private generatePseudonym(originalValue: string, preserveFormat: boolean): string {
    if (preserveFormat) {
      // Preserve format (e.g., email structure, phone number format)
      if (originalValue.includes('@')) {
        // Email format
        const [local, domain] = originalValue.split('@');
        const pseudoLocal = this.hashString(local).substring(0, Math.min(8, local.length));
        return `${pseudoLocal}@${domain}`;
      } else if (/^\d+$/.test(originalValue)) {
        // Numeric format
        const hash = this.hashString(originalValue);
        return hash.replace(/[a-f]/g, '').substring(0, originalValue.length);
      }
    }

    // Default: generate random pseudonym
    return this.hashString(originalValue).substring(0, 16);
  }

  /**
   * Hash string for consistent pseudonymization
   */
  private hashString(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Check privacy budget for differential privacy
   */
  checkPrivacyBudget(userId: string, requestedEpsilon: number): boolean {
    const currentBudget = this.privacyBudget.get(userId) || 0;
    const maxBudget = 10.0; // Maximum privacy budget per user
    
    return (currentBudget + requestedEpsilon) <= maxBudget;
  }

  /**
   * Consume privacy budget
   */
  consumePrivacyBudget(userId: string, epsilon: number): void {
    const currentBudget = this.privacyBudget.get(userId) || 0;
    this.privacyBudget.set(userId, currentBudget + epsilon);
  }

  /**
   * Reset privacy budget (e.g., monthly reset)
   */
  resetPrivacyBudget(userId: string): void {
    this.privacyBudget.set(userId, 0);
  }

  /**
   * Get remaining privacy budget
   */
  getRemainingPrivacyBudget(userId: string): number {
    const maxBudget = 10.0;
    const currentBudget = this.privacyBudget.get(userId) || 0;
    return Math.max(0, maxBudget - currentBudget);
  }

  /**
   * Validate anonymization quality
   */
  validateAnonymization(
    originalData: any[], 
    anonymizedData: any[], 
    options: DataAnonymizationOptions
  ): AnonymizationQuality {
    const quality: AnonymizationQuality = {
      dataUtility: this.calculateDataUtility(originalData, anonymizedData),
      privacyLevel: this.calculatePrivacyLevel(anonymizedData, options),
      informationLoss: this.calculateInformationLoss(originalData, anonymizedData),
      reidentificationRisk: this.calculateReidentificationRisk(anonymizedData, options)
    };

    return quality;
  }

  /**
   * Calculate data utility score
   */
  private calculateDataUtility(originalData: any[], anonymizedData: any[]): number {
    if (originalData.length === 0 || anonymizedData.length === 0) {
      return 0;
    }

    // Simple utility measure: ratio of preserved records
    const utilityScore = anonymizedData.length / originalData.length;
    return Math.min(1, utilityScore);
  }

  /**
   * Calculate privacy level
   */
  private calculatePrivacyLevel(anonymizedData: any[], options: DataAnonymizationOptions): number {
    switch (options.method) {
      case 'k-anonymity':
        const k = options.parameters.k || 5;
        return Math.min(1, k / 10); // Normalize to 0-1 scale
      
      case 'differential-privacy':
        const epsilon = options.parameters.epsilon || 1.0;
        return Math.max(0, 1 - (epsilon / 10)); // Lower epsilon = higher privacy
      
      case 'pseudonymization':
        return 0.7; // Fixed privacy level for pseudonymization
      
      default:
        return 0;
    }
  }

  /**
   * Calculate information loss
   */
  private calculateInformationLoss(originalData: any[], anonymizedData: any[]): number {
    if (originalData.length === 0) {
      return 0;
    }

    // Simple measure: ratio of suppressed records
    const suppressedRecords = originalData.length - anonymizedData.length;
    return suppressedRecords / originalData.length;
  }

  /**
   * Calculate re-identification risk
   */
  private calculateReidentificationRisk(anonymizedData: any[], options: DataAnonymizationOptions): number {
    switch (options.method) {
      case 'k-anonymity':
        const k = options.parameters.k || 5;
        return 1 / k; // Risk is inversely proportional to k
      
      case 'differential-privacy':
        const epsilon = options.parameters.epsilon || 1.0;
        return Math.min(1, epsilon / 10); // Higher epsilon = higher risk
      
      case 'pseudonymization':
        return 0.3; // Moderate risk for pseudonymization
      
      default:
        return 1; // Maximum risk for unknown methods
    }
  }

  /**
   * Generate privacy report
   */
  generatePrivacyReport(
    originalData: any[], 
    anonymizedData: any[], 
    options: DataAnonymizationOptions
  ): PrivacyReport {
    const quality = this.validateAnonymization(originalData, anonymizedData, options);
    
    return {
      method: options.method,
      parameters: options.parameters,
      originalRecords: originalData.length,
      anonymizedRecords: anonymizedData.length,
      quality,
      recommendations: this.generateRecommendations(quality, options),
      timestamp: Date.now()
    };
  }

  /**
   * Generate recommendations for improving anonymization
   */
  private generateRecommendations(
    quality: AnonymizationQuality, 
    options: DataAnonymizationOptions
  ): string[] {
    const recommendations: string[] = [];

    if (quality.dataUtility < 0.7) {
      recommendations.push('Consider reducing generalization levels to improve data utility');
    }

    if (quality.privacyLevel < 0.8) {
      recommendations.push('Increase privacy parameters for better protection');
    }

    if (quality.reidentificationRisk > 0.2) {
      recommendations.push('High re-identification risk detected - consider stronger anonymization');
    }

    if (quality.informationLoss > 0.3) {
      recommendations.push('High information loss - review anonymization strategy');
    }

    return recommendations;
  }

  /**
   * Clear anonymization cache
   */
  clearCache(): void {
    this.anonymizationCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): CacheStats {
    return {
      totalEntries: this.anonymizationCache.size,
      memoryUsage: this.estimateMemoryUsage(),
      hitRate: 0 // Would need to track hits/misses for accurate calculation
    };
  }

  /**
   * Estimate memory usage of cache
   */
  private estimateMemoryUsage(): number {
    let totalSize = 0;
    for (const [key, value] of this.anonymizationCache.entries()) {
      totalSize += key.length * 2; // Approximate character size
      totalSize += JSON.stringify(value).length * 2;
    }
    return totalSize;
  }
}

interface AnonymizationQuality {
  dataUtility: number; // 0-1 scale
  privacyLevel: number; // 0-1 scale
  informationLoss: number; // 0-1 scale
  reidentificationRisk: number; // 0-1 scale
}

interface PrivacyReport {
  method: string;
  parameters: any;
  originalRecords: number;
  anonymizedRecords: number;
  quality: AnonymizationQuality;
  recommendations: string[];
  timestamp: number;
}

interface CacheStats {
  totalEntries: number;
  memoryUsage: number;
  hitRate: number;
}