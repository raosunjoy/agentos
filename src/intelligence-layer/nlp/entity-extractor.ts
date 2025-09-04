/**
 * Entity Extractor - Extracts structured entities from natural language text
 * Uses rule-based and pattern matching approaches for entity recognition
 */

import { Parameter, Entity, EntityType, EntityMetadata } from './types';

export interface ExtractionResult {
  entities: Entity[];
  confidence: number;
}

export class EntityExtractor {
  private entityPatterns: Map<string, RegExp[]> = new Map();
  private customExtractors: Map<string, (text: string) => Entity[]> = new Map();

  constructor() {
    this.initializeDefaultPatterns();
  }

  /**
   * Extract entities from text based on parameter definitions
   */
  async extractEntities(text: string, parameters: Parameter[]): Promise<Entity[]> {
    const entities: Entity[] = [];
    const normalizedText = text.toLowerCase().trim();

    for (const parameter of parameters) {
      const parameterEntities = await this.extractParameterEntities(
        normalizedText,
        parameter
      );
      entities.push(...parameterEntities);
    }

    // Remove overlapping entities (keep the one with higher confidence)
    return this.resolveEntityConflicts(entities);
  }

  /**
   * Extract entities for a specific parameter
   */
  private async extractParameterEntities(
    text: string,
    parameter: Parameter
  ): Promise<Entity[]> {
    const entities: Entity[] = [];

    // Try custom extractors first
    if (this.customExtractors.has(parameter.type)) {
      const customEntities = this.customExtractors.get(parameter.type)!(text);
      entities.push(...customEntities);
    }

    // Try pattern-based extraction
    const patternEntities = this.extractWithPatterns(text, parameter);
    entities.push(...patternEntities);

    // Try rule-based extraction based on parameter type
    const ruleEntities = this.extractWithRules(text, parameter);
    entities.push(...ruleEntities);

    return entities;
  }

  /**
   * Extract entities using predefined patterns
   */
  private extractWithPatterns(text: string, parameter: Parameter): Entity[] {
    const entities: Entity[] = [];
    const patterns = this.entityPatterns.get(parameter.type) || [];

    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) {
        for (const match of matches) {
          const startIndex = text.indexOf(match);
          const endIndex = startIndex + match.length;

          entities.push({
            type: parameter.type as EntityType,
            value: this.cleanExtractedValue(match, parameter.type),
            startIndex,
            endIndex,
            confidence: 0.8,
            metadata: {
              parameterName: parameter.name,
              extractionMethod: 'pattern',
              pattern: pattern.source
            }
          });
        }
      }
    }

    return entities;
  }

  /**
   * Extract entities using rule-based approaches
   */
  private extractWithRules(text: string, parameter: Parameter): Entity[] {
    const entities: Entity[] = [];

    switch (parameter.type) {
      case 'date':
        entities.push(...this.extractDates(text, parameter));
        break;
      case 'time':
        entities.push(...this.extractTimes(text, parameter));
        break;
      case 'number':
        entities.push(...this.extractNumbers(text, parameter));
        break;
      case 'location':
        entities.push(...this.extractLocations(text, parameter));
        break;
      case 'person':
        entities.push(...this.extractPersons(text, parameter));
        break;
      case 'email':
        entities.push(...this.extractEmails(text, parameter));
        break;
      case 'phone':
        entities.push(...this.extractPhones(text, parameter));
        break;
      case 'url':
        entities.push(...this.extractUrls(text, parameter));
        break;
      default:
        // Try generic extraction for custom types
        entities.push(...this.extractGeneric(text, parameter));
        break;
    }

    return entities;
  }

  /**
   * Extract date entities
   */
  private extractDates(text: string, parameter: Parameter): Entity[] {
    const entities: Entity[] = [];
    const datePatterns = [
      /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,  // MM/DD/YYYY
      /\b\d{1,2}-\d{1,2}-\d{2,4}\b/g,    // MM-DD-YYYY
      /\b\d{4}-\d{1,2}-\d{1,2}\b/g,      // YYYY-MM-DD
      /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{2,4}\b/gi,
      /\b\d{1,2}(st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)\b/gi,
      /\btoday\b|\btomorrow\b|\byesterday\b/gi,
      /\bnext\s+(week|month|year)\b/gi,
      /\bin\s+\d+\s+(days?|weeks?|months?|years?)\b/gi
    ];

    for (const pattern of datePatterns) {
      const matches = text.match(pattern);
      if (matches) {
        for (const match of matches) {
          const startIndex = text.indexOf(match);
          const endIndex = startIndex + match.length;

          entities.push({
            type: 'date',
            value: this.parseDate(match),
            startIndex,
            endIndex,
            confidence: 0.9,
            metadata: {
              parameterName: parameter.name,
              extractionMethod: 'rule',
              originalText: match
            }
          });
        }
      }
    }

    return entities;
  }

  /**
   * Extract time entities
   */
  private extractTimes(text: string, parameter: Parameter): Entity[] {
    const entities: Entity[] = [];
    const timePatterns = [
      /\b\d{1,2}:\d{1,2}\s*(am|pm)?\b/gi,
      /\b\d{1,2}\s*(am|pm)\b/gi,
      /\bat\s+\d{1,2}(:\d{1,2})?\s*(am|pm)?\b/gi,
      /\bin\s+\d+\s+(minutes?|hours?)\b/gi
    ];

    for (const pattern of timePatterns) {
      const matches = text.match(pattern);
      if (matches) {
        for (const match of matches) {
          const startIndex = text.indexOf(match);
          const endIndex = startIndex + match.length;

          entities.push({
            type: 'time',
            value: this.parseTime(match),
            startIndex,
            endIndex,
            confidence: 0.85,
            metadata: {
              parameterName: parameter.name,
              extractionMethod: 'rule',
              originalText: match
            }
          });
        }
      }
    }

    return entities;
  }

  /**
   * Extract number entities
   */
  private extractNumbers(text: string, parameter: Parameter): Entity[] {
    const entities: Entity[] = [];
    const numberPatterns = [
      /\b\d+(\.\d+)?\b/g,
      /\bone|two|three|four|five|six|seven|eight|nine|ten\b/gi,
      /\ba\s+(dozen|hundred|thousand|million|billion)\b/gi
    ];

    for (const pattern of numberPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        for (const match of matches) {
          const startIndex = text.indexOf(match);
          const endIndex = startIndex + match.length;
          const numericValue = this.parseNumber(match);

          if (numericValue !== null) {
            entities.push({
              type: 'number',
              value: numericValue,
              startIndex,
              endIndex,
              confidence: 0.95,
              metadata: {
                parameterName: parameter.name,
                extractionMethod: 'rule',
                originalText: match
              }
            });
          }
        }
      }
    }

    return entities;
  }

  /**
   * Extract location entities
   */
  private extractLocations(text: string, parameter: Parameter): Entity[] {
    const entities: Entity[] = [];
    // Simple location extraction - in a real system, this would use a gazetteer
    const locationPatterns = [
      /\b(New York|London|Paris|Tokyo|Berlin|Miami|Boston|Chicago)\b/gi,
      /\b\d+\s+[A-Za-z]+\s+(Street|Avenue|Road|Boulevard|Drive|Place)\b/gi
    ];

    for (const pattern of locationPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        for (const match of matches) {
          const startIndex = text.indexOf(match);
          const endIndex = startIndex + match.length;

          entities.push({
            type: 'location',
            value: match,
            startIndex,
            endIndex,
            confidence: 0.75,
            metadata: {
              parameterName: parameter.name,
              extractionMethod: 'rule',
              originalText: match
            }
          });
        }
      }
    }

    return entities;
  }

  /**
   * Extract person name entities
   */
  private extractPersons(text: string, parameter: Parameter): Entity[] {
    const entities: Entity[] = [];
    // Simple person name extraction - in a real system, this would use NER models
    const personPatterns = [
      /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g,  // First Last
      /\bDr\.?\s+[A-Z][a-z]+\b/gi,
      /\bMr\.?\s+[A-Z][a-z]+\b/gi,
      /\bMrs\.?\s+[A-Z][a-z]+\b/gi,
      /\bMs\.?\s+[A-Z][a-z]+\b/gi
    ];

    for (const pattern of personPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        for (const match of matches) {
          const startIndex = text.indexOf(match);
          const endIndex = startIndex + match.length;

          entities.push({
            type: 'person',
            value: match,
            startIndex,
            endIndex,
            confidence: 0.7,
            metadata: {
              parameterName: parameter.name,
              extractionMethod: 'rule',
              originalText: match
            }
          });
        }
      }
    }

    return entities;
  }

  /**
   * Extract email entities
   */
  private extractEmails(text: string, parameter: Parameter): Entity[] {
    const entities: Entity[] = [];
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;

    const matches = text.match(emailPattern);
    if (matches) {
      for (const match of matches) {
        const startIndex = text.indexOf(match);
        const endIndex = startIndex + match.length;

        entities.push({
          type: 'email',
          value: match.toLowerCase(),
          startIndex,
          endIndex,
          confidence: 0.95,
          metadata: {
            parameterName: parameter.name,
            extractionMethod: 'rule',
            originalText: match
          }
        });
      }
    }

    return entities;
  }

  /**
   * Extract phone entities
   */
  private extractPhones(text: string, parameter: Parameter): Entity[] {
    const entities: Entity[] = [];
    const phonePatterns = [
      /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,  // 123-456-7890
      /\b\(\d{3}\)\s*\d{3}[-.]?\d{4}\b/g,  // (123) 456-7890
      /\b\d{10,11}\b/g  // 1234567890
    ];

    for (const pattern of phonePatterns) {
      const matches = text.match(pattern);
      if (matches) {
        for (const match of matches) {
          const startIndex = text.indexOf(match);
          const endIndex = startIndex + match.length;

          entities.push({
            type: 'phone',
            value: this.formatPhoneNumber(match),
            startIndex,
            endIndex,
            confidence: 0.9,
            metadata: {
              parameterName: parameter.name,
              extractionMethod: 'rule',
              originalText: match
            }
          });
        }
      }
    }

    return entities;
  }

  /**
   * Extract URL entities
   */
  private extractUrls(text: string, parameter: Parameter): Entity[] {
    const entities: Entity[] = [];
    const urlPattern = /\bhttps?:\/\/[^\s<>"{}|\\^`[\]]+\b/gi;

    const matches = text.match(urlPattern);
    if (matches) {
      for (const match of matches) {
        const startIndex = text.indexOf(match);
        const endIndex = startIndex + match.length;

        entities.push({
          type: 'url',
          value: match,
          startIndex,
          endIndex,
          confidence: 0.95,
          metadata: {
            parameterName: parameter.name,
            extractionMethod: 'rule',
            originalText: match
          }
        });
      }
    }

    return entities;
  }

  /**
   * Extract generic entities
   */
  private extractGeneric(text: string, parameter: Parameter): Entity[] {
    const entities: Entity[] = [];

    // Try to find quoted strings
    const quotedPattern = /"([^"]+)"/g;
    const quotedMatches = text.match(quotedPattern);
    if (quotedMatches) {
      for (const match of quotedMatches) {
        const startIndex = text.indexOf(match);
        const endIndex = startIndex + match.length;
        const value = match.slice(1, -1); // Remove quotes

        entities.push({
          type: parameter.type as EntityType,
          value,
          startIndex,
          endIndex,
          confidence: 0.6,
          metadata: {
            parameterName: parameter.name,
            extractionMethod: 'generic',
            originalText: match
          }
        });
      }
    }

    return entities;
  }

  /**
   * Initialize default patterns for common entity types
   */
  private initializeDefaultPatterns(): void {
    // Date patterns
    this.entityPatterns.set('date', [
      /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,
      /\b\d{4}-\d{1,2}-\d{1,2}\b/g
    ]);

    // Time patterns
    this.entityPatterns.set('time', [
      /\b\d{1,2}:\d{1,2}\b/g,
      /\b\d{1,2}\s*(am|pm)\b/gi
    ]);

    // Number patterns
    this.entityPatterns.set('number', [
      /\b\d+(\.\d+)?\b/g
    ]);

    // Email patterns
    this.entityPatterns.set('email', [
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g
    ]);

    // URL patterns
    this.entityPatterns.set('url', [
      /\bhttps?:\/\/[^\s<>"{}|\\^`[\]]+\b/gi
    ]);
  }

  /**
   * Clean extracted value based on entity type
   */
  private cleanExtractedValue(value: string, type: string): any {
    switch (type) {
      case 'number':
        return this.parseNumber(value);
      case 'date':
        return this.parseDate(value);
      case 'time':
        return this.parseTime(value);
      case 'phone':
        return this.formatPhoneNumber(value);
      case 'email':
        return value.toLowerCase();
      default:
        return value.trim();
    }
  }

  /**
   * Parse date string
   */
  private parseDate(dateStr: string): Date | string {
    // Handle relative dates
    const lowerDate = dateStr.toLowerCase();
    const now = new Date();

    if (lowerDate.includes('today')) {
      return now;
    }
    if (lowerDate.includes('tomorrow')) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow;
    }
    if (lowerDate.includes('yesterday')) {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return yesterday;
    }

    // Try to parse as regular date
    const parsed = new Date(dateStr);
    return isNaN(parsed.getTime()) ? dateStr : parsed;
  }

  /**
   * Parse time string
   */
  private parseTime(timeStr: string): string {
    // Simple time parsing - in a real system, this would be more sophisticated
    return timeStr.trim();
  }

  /**
   * Parse number from string
   */
  private parseNumber(numStr: string): number | null {
    // Handle word numbers
    const wordNumbers: Record<string, number> = {
      'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
      'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
      'a dozen': 12, 'a hundred': 100, 'a thousand': 1000, 'a million': 1000000
    };

    const lowerNum = numStr.toLowerCase();
    if (wordNumbers[lowerNum]) {
      return wordNumbers[lowerNum];
    }

    const parsed = parseFloat(numStr);
    return isNaN(parsed) ? null : parsed;
  }

  /**
   * Format phone number
   */
  private formatPhoneNumber(phoneStr: string): string {
    const digits = phoneStr.replace(/\D/g, '');
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    if (digits.length === 11 && digits.startsWith('1')) {
      return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    return phoneStr;
  }

  /**
   * Resolve conflicts between overlapping entities
   */
  private resolveEntityConflicts(entities: Entity[]): Entity[] {
    if (entities.length <= 1) {
      return entities;
    }

    // Sort by confidence (highest first)
    entities.sort((a, b) => b.confidence - a.confidence);

    const resolved: Entity[] = [];
    const usedRanges: Array<[number, number]> = [];

    for (const entity of entities) {
      const [start, end] = [entity.startIndex, entity.endIndex];
      const overlaps = usedRanges.some(([usedStart, usedEnd]) =>
        (start < usedEnd && end > usedStart)
      );

      if (!overlaps) {
        resolved.push(entity);
        usedRanges.push([start, end]);
      }
    }

    return resolved;
  }

  /**
   * Register a custom extractor for a specific entity type
   */
  registerCustomExtractor(type: string, extractor: (text: string) => Entity[]): void {
    this.customExtractors.set(type, extractor);
  }

  /**
   * Register custom patterns for an entity type
   */
  registerPatterns(type: string, patterns: RegExp[]): void {
    this.entityPatterns.set(type, patterns);
  }

  /**
   * Get extraction statistics
   */
  getExtractionStats(): Record<string, any> {
    return {
      customExtractors: this.customExtractors.size,
      patternTypes: this.entityPatterns.size,
      supportedEntityTypes: Array.from(new Set([
        ...this.customExtractors.keys(),
        ...this.entityPatterns.keys(),
        'date', 'time', 'number', 'location', 'person', 'email', 'phone', 'url'
      ]))
    };
  }
}