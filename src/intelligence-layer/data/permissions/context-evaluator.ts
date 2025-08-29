/**
 * Context-based permission evaluation
 */

import { PermissionCondition, RequestContext, ConditionType, ConditionOperator } from './types';

export interface ConditionEvaluationResult {
  satisfied: boolean;
  reason: string;
  failedConditions?: PermissionCondition[];
}

export class ContextEvaluator {
  /**
   * Evaluate all conditions against the request context
   */
  async evaluateConditions(
    conditions: PermissionCondition[],
    context: RequestContext
  ): Promise<ConditionEvaluationResult> {
    const failedConditions: PermissionCondition[] = [];

    for (const condition of conditions) {
      const result = await this.evaluateCondition(condition, context);
      if (!result) {
        failedConditions.push(condition);
      }
    }

    if (failedConditions.length === 0) {
      return {
        satisfied: true,
        reason: 'All conditions satisfied'
      };
    }

    return {
      satisfied: false,
      reason: `${failedConditions.length} condition(s) not satisfied`,
      failedConditions
    };
  }

  /**
   * Evaluate a single condition
   */
  private async evaluateCondition(
    condition: PermissionCondition,
    context: RequestContext
  ): Promise<boolean> {
    switch (condition.type) {
      case 'time_range':
        return this.evaluateTimeRange(condition, context);
      
      case 'location':
        return this.evaluateLocation(condition, context);
      
      case 'device':
        return this.evaluateDevice(condition, context);
      
      case 'network':
        return this.evaluateNetwork(condition, context);
      
      case 'user_context':
        return this.evaluateUserContext(condition, context);
      
      case 'data_sensitivity':
        return this.evaluateDataSensitivity(condition, context);
      
      case 'purpose':
        return this.evaluatePurpose(condition, context);
      
      default:
        return false;
    }
  }

  /**
   * Evaluate time-based conditions
   */
  private evaluateTimeRange(condition: PermissionCondition, context: RequestContext): boolean {
    const now = context.timestamp;
    
    switch (condition.operator) {
      case 'between':
        if (Array.isArray(condition.value) && condition.value.length === 2) {
          const [start, end] = condition.value.map(v => new Date(v));
          return now >= start && now <= end;
        }
        return false;
      
      case 'greater_than':
        const after = new Date(condition.value);
        return now > after;
      
      case 'less_than':
        const before = new Date(condition.value);
        return now < before;
      
      default:
        return false;
    }
  }

  /**
   * Evaluate location-based conditions
   */
  private evaluateLocation(condition: PermissionCondition, context: RequestContext): boolean {
    if (!context.location) {
      return condition.operator === 'not_equals';
    }

    const { latitude, longitude } = context.location;

    switch (condition.operator) {
      case 'equals':
        if (typeof condition.value === 'object' && condition.value.latitude && condition.value.longitude) {
          const distance = this.calculateDistance(
            latitude, longitude,
            condition.value.latitude, condition.value.longitude
          );
          const threshold = condition.value.radius || 100; // meters
          return distance <= threshold;
        }
        return false;
      
      case 'in':
        if (Array.isArray(condition.value)) {
          return condition.value.some(location => {
            const distance = this.calculateDistance(
              latitude, longitude,
              location.latitude, location.longitude
            );
            const threshold = location.radius || 100;
            return distance <= threshold;
          });
        }
        return false;
      
      default:
        return false;
    }
  }

  /**
   * Evaluate device-based conditions
   */
  private evaluateDevice(condition: PermissionCondition, context: RequestContext): boolean {
    if (!context.device) {
      return condition.operator === 'not_equals';
    }

    switch (condition.operator) {
      case 'equals':
        return context.device.id === condition.value ||
               context.device.type === condition.value;
      
      case 'in':
        if (Array.isArray(condition.value)) {
          return condition.value.includes(context.device.id) ||
                 condition.value.includes(context.device.type);
        }
        return false;
      
      case 'contains':
        if (condition.value === 'trusted') {
          return context.device.trusted === true;
        }
        return false;
      
      default:
        return false;
    }
  }

  /**
   * Evaluate network-based conditions
   */
  private evaluateNetwork(condition: PermissionCondition, context: RequestContext): boolean {
    if (!context.network) {
      return condition.operator === 'not_equals';
    }

    switch (condition.operator) {
      case 'equals':
        return context.network.type === condition.value;
      
      case 'in':
        if (Array.isArray(condition.value)) {
          return condition.value.includes(context.network.type);
        }
        return false;
      
      case 'contains':
        if (condition.value === 'trusted') {
          return context.network.trusted === true;
        }
        return false;
      
      default:
        return false;
    }
  }

  /**
   * Evaluate user context conditions
   */
  private evaluateUserContext(condition: PermissionCondition, context: RequestContext): boolean {
    switch (condition.operator) {
      case 'equals':
        return context.userActivity === condition.value;
      
      case 'in':
        if (Array.isArray(condition.value)) {
          return condition.value.includes(context.userActivity);
        }
        return false;
      
      case 'matches_pattern':
        if (context.userActivity && typeof condition.value === 'string') {
          const regex = new RegExp(condition.value);
          return regex.test(context.userActivity);
        }
        return false;
      
      default:
        return false;
    }
  }

  /**
   * Evaluate data sensitivity conditions
   */
  private evaluateDataSensitivity(condition: PermissionCondition, context: RequestContext): boolean {
    // This would integrate with the data classification system
    // For now, implement basic sensitivity levels
    const sensitivityLevels = ['public', 'internal', 'confidential', 'restricted'];
    
    switch (condition.operator) {
      case 'equals':
        return condition.metadata?.sensitivity === condition.value;
      
      case 'less_than':
        const currentLevel = sensitivityLevels.indexOf(condition.metadata?.sensitivity || 'public');
        const maxLevel = sensitivityLevels.indexOf(condition.value);
        return currentLevel <= maxLevel;
      
      default:
        return false;
    }
  }

  /**
   * Evaluate purpose-based conditions
   */
  private evaluatePurpose(condition: PermissionCondition, context: RequestContext): boolean {
    // This would integrate with purpose limitation system
    switch (condition.operator) {
      case 'equals':
        return condition.metadata?.purpose === condition.value;
      
      case 'in':
        if (Array.isArray(condition.value)) {
          return condition.value.includes(condition.metadata?.purpose);
        }
        return false;
      
      default:
        return false;
    }
  }

  /**
   * Calculate distance between two coordinates in meters
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  /**
   * Check if current time is within business hours
   */
  isBusinessHours(timestamp: Date = new Date()): boolean {
    const hour = timestamp.getHours();
    const day = timestamp.getDay();
    
    // Monday to Friday, 9 AM to 5 PM
    return day >= 1 && day <= 5 && hour >= 9 && hour < 17;
  }

  /**
   * Check if location is within a geofenced area
   */
  isWithinGeofence(
    userLocation: { latitude: number; longitude: number },
    geofence: { latitude: number; longitude: number; radius: number }
  ): boolean {
    const distance = this.calculateDistance(
      userLocation.latitude, userLocation.longitude,
      geofence.latitude, geofence.longitude
    );
    return distance <= geofence.radius;
  }
}