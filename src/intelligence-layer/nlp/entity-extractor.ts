/**
 * Entity Extractor - Extract parameters from user input
 * 
 * Identifies and extracts entities like contacts, dates, locations,
 * and other parameters from natural language input.
 */

import { Entity, IntentParameter } from './types';

export class EntityExtractor {
  private patterns: Map<string, RegExp[]> = new Map();
  private namedEntityCache: Map<string, Entity[]> = new Map();

  constructor() {
    this.initializePatterns();
  }

  /**
   * Extract entities from text based on expected parameters
   */
  async extractEntities(text: string, parameters: IntentParameter[]): Promise<Entity[]> {
    const entities: Entity[] = [];
    const processedText = text.toLowerCase();

    for (const parameter of parameters) {
      const parameterEntities = await this.extractEntitiesForType(
        processedText, 
        parameter.type, 
        parameter.name
      );
      entities.push(...parameterEntities);
    }

    // Remove overlapping entities (keep highest confidence)
    return this.resolveOverlappingEntities(entities);
  }

  /**
   * Extract entities of a specific type from text
   */
  private async extractEntitiesForType(text: string, type: string, parameterName: string): Promise<Entity[]> {
    const entities: Entity[] = [];

    switch (type) {
      case 'contact':
        entities.push(...await this.extractContacts(text, parameterName));
        break;
      case 'date':
        entities.push(...this.extractDates(text, parameterName));
        break;
      case 'location':
        entities.push(...this.extractLocations(text, parameterName));
        break;
      case 'number':
        entities.push(...this.extractNumbers(text, parameterName));
        break;
      case 'string':
        entities.push(...this.extractStrings(text, parameterName));
        break;
      case 'boolean':
        entities.push(...this.extractBooleans(text, parameterName));
        break;
    }

    return entities;
  }

  /**
   * Extract contact names from text
   */
  private async extractContacts(text: string, parameterName: string): Promise<Entity[]> {
    const entities: Entity[] = [];
    const contactPatterns = this.patterns.get('contact') || [];

    // Common contact references
    const commonContacts = [
      'mom', 'mother', 'dad', 'father', 'son', 'daughter', 'wife', 'husband',
      'doctor', 'dentist', 'nurse', 'caregiver', 'neighbor', 'friend',
      'brother', 'sister', 'grandson', 'granddaughter', 'grandma', 'grandpa'
    ];

    // Check for common contact references
    for (const contact of commonContacts) {
      const regex = new RegExp(`\\b(my\\s+)?${contact}\\b`, 'gi');
      let match;
      while ((match = regex.exec(text)) !== null) {
        entities.push({
          type: 'contact',
          value: contact,
          confidence: 0.9,
          startIndex: match.index,
          endIndex: match.index + match[0].length,
          metadata: { parameterName, contactType: 'relationship' }
        });
      }
    }

    // Check for proper names (capitalized words) in original text
    const originalText = text; // Keep original case for name detection
    const namePattern = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g;
    let match;
    while ((match = namePattern.exec(originalText)) !== null) {
      // Skip common words that might be capitalized
      const commonWords = ['I', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      if (!commonWords.includes(match[0])) {
        entities.push({
          type: 'contact',
          value: match[0],
          confidence: 0.7,
          startIndex: match.index,
          endIndex: match.index + match[0].length,
          metadata: { parameterName, contactType: 'name' }
        });
      }
    }

    return entities;
  }

  /**
   * Extract dates and times from text
   */
  private extractDates(text: string, parameterName: string): Entity[] {
    const entities: Entity[] = [];
    const datePatterns = this.patterns.get('date') || [];

    // Time patterns
    const timePattern = /\b(\d{1,2}):?(\d{2})?\s*(am|pm|a\.m\.|p\.m\.)\b/gi;
    let match;
    while ((match = timePattern.exec(text)) !== null) {
      const hour = parseInt(match[1]);
      const minute = match[2] ? parseInt(match[2]) : 0;
      const period = match[3].toLowerCase().replace(/\./g, '');
      
      entities.push({
        type: 'date',
        value: `${hour}:${minute.toString().padStart(2, '0')} ${period}`,
        confidence: 0.9,
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        metadata: { parameterName, dateType: 'time' }
      });
    }

    // Relative time patterns
    const relativePatterns = [
      { pattern: /\b(today|now)\b/gi, value: 'today' },
      { pattern: /\b(tomorrow)\b/gi, value: 'tomorrow' },
      { pattern: /\b(yesterday)\b/gi, value: 'yesterday' },
      { pattern: /\bin\s+(\d+)\s+(minutes?|hours?|days?)\b/gi, value: 'relative' },
      { pattern: /\b(next|this)\s+(week|month|year)\b/gi, value: 'relative' },
      { pattern: /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, value: 'weekday' }
    ];

    for (const { pattern, value } of relativePatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        entities.push({
          type: 'date',
          value: match[0].toLowerCase(),
          confidence: 0.8,
          startIndex: match.index,
          endIndex: match.index + match[0].length,
          metadata: { parameterName, dateType: value }
        });
      }
    }

    return entities;
  }

  /**
   * Extract location references from text
   */
  private extractLocations(text: string, parameterName: string): Entity[] {
    const entities: Entity[] = [];

    // Common location references
    const locationPatterns = [
      { pattern: /\b(home|house)\b/gi, type: 'home' },
      { pattern: /\b(work|office|workplace)\b/gi, type: 'work' },
      { pattern: /\b(hospital|clinic|doctor'?s office)\b/gi, type: 'medical' },
      { pattern: /\b(store|shop|market|mall)\b/gi, type: 'shopping' },
      { pattern: /\b(here|there|nearby)\b/gi, type: 'relative' }
    ];

    for (const { pattern, type } of locationPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        entities.push({
          type: 'location',
          value: match[0],
          confidence: 0.7,
          startIndex: match.index,
          endIndex: match.index + match[0].length,
          metadata: { parameterName, locationType: type }
        });
      }
    }

    return entities;
  }

  /**
   * Extract numbers from text
   */
  private extractNumbers(text: string, parameterName: string): Entity[] {
    const entities: Entity[] = [];

    // Digit patterns
    const numberPattern = /\b\d+(?:\.\d+)?\b/g;
    let match;
    while ((match = numberPattern.exec(text)) !== null) {
      entities.push({
        type: 'number',
        value: match[0],
        confidence: 0.9,
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        metadata: { parameterName }
      });
    }

    // Written numbers
    const writtenNumbers = {
      'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4',
      'five': '5', 'six': '6', 'seven': '7', 'eight': '8', 'nine': '9',
      'ten': '10', 'eleven': '11', 'twelve': '12', 'thirteen': '13',
      'fourteen': '14', 'fifteen': '15', 'sixteen': '16', 'seventeen': '17',
      'eighteen': '18', 'nineteen': '19', 'twenty': '20', 'thirty': '30',
      'forty': '40', 'fifty': '50', 'sixty': '60', 'seventy': '70',
      'eighty': '80', 'ninety': '90', 'hundred': '100'
    };

    for (const [word, value] of Object.entries(writtenNumbers)) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      let match;
      while ((match = regex.exec(text)) !== null) {
        entities.push({
          type: 'number',
          value: value,
          confidence: 0.8,
          startIndex: match.index,
          endIndex: match.index + match[0].length,
          metadata: { parameterName, originalText: word }
        });
      }
    }

    return entities;
  }

  /**
   * Extract string content (usually message content)
   */
  private extractStrings(text: string, parameterName: string): Entity[] {
    const entities: Entity[] = [];

    // For message content, extract everything after common trigger words
    if (parameterName === 'message') {
      const messagePatterns = [
        /\bsay\s+(.+)/gi,
        /\btell\s+\w+\s+(.+)/gi,
        /\bmessage\s+\w+\s+(.+)/gi,
        /\btext\s+\w+\s+(.+)/gi
      ];

      for (const pattern of messagePatterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          entities.push({
            type: 'string',
            value: match[1].trim().toLowerCase(),
            confidence: 0.8,
            startIndex: match.index + match[0].indexOf(match[1]),
            endIndex: match.index + match[0].length,
            metadata: { parameterName }
          });
        }
      }
    }

    return entities;
  }

  /**
   * Extract boolean values from text
   */
  private extractBooleans(text: string, parameterName: string): Entity[] {
    const entities: Entity[] = [];

    const booleanPatterns = [
      { pattern: /\b(yes|yeah|yep|sure|okay|ok|true)\b/gi, value: 'true' },
      { pattern: /\b(no|nope|false|never)\b/gi, value: 'false' }
    ];

    for (const { pattern, value } of booleanPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        entities.push({
          type: 'boolean',
          value: value,
          confidence: 0.7,
          startIndex: match.index,
          endIndex: match.index + match[0].length,
          metadata: { parameterName }
        });
      }
    }

    return entities;
  }

  /**
   * Resolve overlapping entities by keeping the highest confidence ones
   */
  private resolveOverlappingEntities(entities: Entity[]): Entity[] {
    // Sort by start index
    entities.sort((a, b) => a.startIndex - b.startIndex);

    const resolved: Entity[] = [];
    
    for (const entity of entities) {
      // Check if this entity overlaps with any already resolved entity
      const hasOverlap = resolved.some(resolvedEntity => 
        this.entitiesOverlap(entity, resolvedEntity)
      );

      if (!hasOverlap) {
        resolved.push(entity);
      } else {
        // Find overlapping entity and keep the one with higher confidence
        const overlappingIndex = resolved.findIndex(resolvedEntity => 
          this.entitiesOverlap(entity, resolvedEntity)
        );
        
        if (overlappingIndex !== -1 && entity.confidence > resolved[overlappingIndex].confidence) {
          resolved[overlappingIndex] = entity;
        }
      }
    }

    return resolved;
  }

  /**
   * Check if two entities overlap in the text
   */
  private entitiesOverlap(entity1: Entity, entity2: Entity): boolean {
    return !(entity1.endIndex <= entity2.startIndex || entity2.endIndex <= entity1.startIndex);
  }

  /**
   * Initialize regex patterns for entity extraction
   */
  private initializePatterns(): void {
    // Contact patterns
    this.patterns.set('contact', [
      /\b(call|phone|ring|dial)\s+([a-zA-Z\s]+)/gi,
      /\b(text|message)\s+([a-zA-Z\s]+)/gi
    ]);

    // Date patterns
    this.patterns.set('date', [
      /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,
      /\b\d{1,2}-\d{1,2}-\d{2,4}\b/g,
      /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}\b/gi
    ]);

    // Location patterns
    this.patterns.set('location', [
      /\b\d+\s+[a-zA-Z\s]+\b/g, // Street addresses
      /\b[A-Z][a-zA-Z\s]+,\s*[A-Z]{2}\b/g // City, State
    ]);
  }
}