/**
 * Rate Limiter for AgentOS Service Integration
 * Implements token bucket and sliding window algorithms
 */

import { RateLimiter, RateLimitConfig } from './types';

interface RateLimitEntry {
  tokens: number;
  lastRefill: number;
  requests: number[];
}

export class DefaultRateLimiter implements RateLimiter {
  private limits = new Map<string, RateLimitEntry>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up old entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  /**
   * Check if request is within rate limit
   */
  async checkLimit(serviceId: string, endpoint: string, config: RateLimitConfig): Promise<boolean> {
    const key = `${serviceId}:${endpoint}`;
    const now = Date.now();
    
    let entry = this.limits.get(key);
    if (!entry) {
      entry = {
        tokens: config.requests,
        lastRefill: now,
        requests: []
      };
      this.limits.set(key, entry);
    }

    // Use token bucket algorithm for burst handling
    if (config.burst) {
      return this.checkTokenBucket(entry, config, now);
    } else {
      // Use sliding window algorithm
      return this.checkSlidingWindow(entry, config, now);
    }
  }

  /**
   * Token bucket algorithm for burst requests
   */
  private checkTokenBucket(entry: RateLimitEntry, config: RateLimitConfig, now: number): boolean {
    const timePassed = now - entry.lastRefill;
    const tokensToAdd = Math.floor((timePassed / config.windowMs) * config.requests);
    
    // Refill tokens
    entry.tokens = Math.min(config.burst || config.requests, entry.tokens + tokensToAdd);
    entry.lastRefill = now;

    // Check if we have tokens available
    if (entry.tokens > 0) {
      entry.tokens--;
      return true;
    }

    return false;
  }

  /**
   * Sliding window algorithm for consistent rate limiting
   */
  private checkSlidingWindow(entry: RateLimitEntry, config: RateLimitConfig, now: number): boolean {
    const windowStart = now - config.windowMs;
    
    // Remove old requests outside the window
    entry.requests = entry.requests.filter(timestamp => timestamp > windowStart);

    // Check if we're within the limit
    if (entry.requests.length < config.requests) {
      entry.requests.push(now);
      return true;
    }

    return false;
  }

  /**
   * Get remaining requests for a service/endpoint
   */
  async getRemainingRequests(serviceId: string, endpoint: string): Promise<number> {
    const key = `${serviceId}:${endpoint}`;
    const entry = this.limits.get(key);
    
    if (!entry) {
      return 0; // No limit entry means no requests made yet
    }

    // For token bucket, return available tokens
    if (entry.tokens !== undefined) {
      return Math.max(0, entry.tokens);
    }

    // For sliding window, calculate remaining based on current window
    const now = Date.now();
    const windowStart = now - (60 * 1000); // Assume 1 minute window if not specified
    const recentRequests = entry.requests.filter(timestamp => timestamp > windowStart);
    
    return Math.max(0, 100 - recentRequests.length); // Assume 100 requests per minute default
  }

  /**
   * Reset rate limit for a service/endpoint
   */
  async resetLimit(serviceId: string, endpoint: string): Promise<void> {
    const key = `${serviceId}:${endpoint}`;
    this.limits.delete(key);
  }

  /**
   * Get all current rate limit states
   */
  getAllLimits(): Map<string, RateLimitEntry> {
    return new Map(this.limits);
  }

  /**
   * Clean up old entries
   */
  private cleanup(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const [key, entry] of this.limits.entries()) {
      // Remove entries that haven't been used in 24 hours
      if (now - entry.lastRefill > maxAge) {
        this.limits.delete(key);
      }
    }
  }

  /**
   * Destroy rate limiter and clean up resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.limits.clear();
  }
}

/**
 * Memory-efficient rate limiter using Redis-like operations
 */
export class MemoryEfficientRateLimiter implements RateLimiter {
  private counters = new Map<string, { count: number; resetTime: number }>();

  async checkLimit(serviceId: string, endpoint: string, config: RateLimitConfig): Promise<boolean> {
    const key = `${serviceId}:${endpoint}`;
    const now = Date.now();
    const windowStart = Math.floor(now / config.windowMs) * config.windowMs;
    
    let counter = this.counters.get(key);
    
    // Reset counter if we're in a new window
    if (!counter || counter.resetTime !== windowStart) {
      counter = { count: 0, resetTime: windowStart };
      this.counters.set(key, counter);
    }

    // Check if we're within the limit
    if (counter.count < config.requests) {
      counter.count++;
      return true;
    }

    return false;
  }

  async getRemainingRequests(serviceId: string, endpoint: string): Promise<number> {
    const key = `${serviceId}:${endpoint}`;
    const counter = this.counters.get(key);
    
    if (!counter) {
      return 0;
    }

    return Math.max(0, 100 - counter.count); // Assume 100 requests default
  }

  async resetLimit(serviceId: string, endpoint: string): Promise<void> {
    const key = `${serviceId}:${endpoint}`;
    this.counters.delete(key);
  }
}