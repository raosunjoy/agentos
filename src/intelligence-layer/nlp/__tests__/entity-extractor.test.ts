/**
 * Unit tests for Entity Extractor
 */

import { EntityExtractor } from '../entity-extractor';
import { IntentParameter, Entity } from '../types';

describe('EntityExtractor', () => {
  let extractor: EntityExtractor;

  beforeEach(() => {
    extractor = new EntityExtractor();
  });

  describe('Contact Extraction', () => {
    it('should extract relationship-based contacts', async () => {
      const parameters: IntentParameter[] = [
        { name: 'contact', type: 'contact', required: true, description: 'Contact to call' }
      ];

      const entities = await extractor.extractEntities('call mom', parameters);
      
      expect(entities).toHaveLength(1);
      expect(entities[0].type).toBe('contact');
      expect(entities[0].value).toBe('mom');
      expect(entities[0].confidence).toBeGreaterThan(0.8);
    });

    it('should extract proper name contacts', async () => {
      const parameters: IntentParameter[] = [
        { name: 'contact', type: 'contact', required: true, description: 'Contact to call' }
      ];

      const entities = await extractor.extractEntities('call John Smith', parameters);
      
      expect(entities).toHaveLength(1);
      expect(entities[0].type).toBe('contact');
      expect(entities[0].value).toBe('John Smith');
    });

    it('should extract professional contacts', async () => {
      const parameters: IntentParameter[] = [
        { name: 'contact', type: 'contact', required: true, description: 'Contact to call' }
      ];

      const entities = await extractor.extractEntities('call my doctor', parameters);
      
      expect(entities).toHaveLength(1);
      expect(entities[0].type).toBe('contact');
      expect(entities[0].value).toBe('doctor');
    });
  });

  describe('Date and Time Extraction', () => {
    it('should extract specific times', async () => {
      const parameters: IntentParameter[] = [
        { name: 'time', type: 'date', required: true, description: 'Reminder time' }
      ];

      const entities = await extractor.extractEntities('remind me at 3pm', parameters);
      
      expect(entities).toHaveLength(1);
      expect(entities[0].type).toBe('date');
      expect(entities[0].value).toBe('3:00 pm');
    });

    it('should extract relative dates', async () => {
      const parameters: IntentParameter[] = [
        { name: 'date', type: 'date', required: true, description: 'Date' }
      ];

      const entities = await extractor.extractEntities('remind me tomorrow', parameters);
      
      expect(entities).toHaveLength(1);
      expect(entities[0].type).toBe('date');
      expect(entities[0].value).toBe('tomorrow');
    });

    it('should extract weekdays', async () => {
      const parameters: IntentParameter[] = [
        { name: 'date', type: 'date', required: true, description: 'Date' }
      ];

      const entities = await extractor.extractEntities('remind me on Monday', parameters);
      
      expect(entities).toHaveLength(1);
      expect(entities[0].type).toBe('date');
      expect(entities[0].value).toBe('Monday');
    });

    it('should extract time with minutes', async () => {
      const parameters: IntentParameter[] = [
        { name: 'time', type: 'date', required: true, description: 'Time' }
      ];

      const entities = await extractor.extractEntities('set alarm for 7:30am', parameters);
      
      expect(entities).toHaveLength(1);
      expect(entities[0].type).toBe('date');
      expect(entities[0].value).toBe('7:30 am');
    });
  });

  describe('Location Extraction', () => {
    it('should extract common location references', async () => {
      const parameters: IntentParameter[] = [
        { name: 'location', type: 'location', required: true, description: 'Location' }
      ];

      const entities = await extractor.extractEntities('weather at home', parameters);
      
      expect(entities).toHaveLength(1);
      expect(entities[0].type).toBe('location');
      expect(entities[0].value).toBe('home');
    });

    it('should extract workplace references', async () => {
      const parameters: IntentParameter[] = [
        { name: 'location', type: 'location', required: true, description: 'Location' }
      ];

      const entities = await extractor.extractEntities('weather at work', parameters);
      
      expect(entities).toHaveLength(1);
      expect(entities[0].type).toBe('location');
      expect(entities[0].value).toBe('work');
    });
  });

  describe('Number Extraction', () => {
    it('should extract digit numbers', async () => {
      const parameters: IntentParameter[] = [
        { name: 'amount', type: 'number', required: true, description: 'Amount' }
      ];

      const entities = await extractor.extractEntities('set timer for 5 minutes', parameters);
      
      expect(entities).toHaveLength(1);
      expect(entities[0].type).toBe('number');
      expect(entities[0].value).toBe('5');
    });

    it('should extract written numbers', async () => {
      const parameters: IntentParameter[] = [
        { name: 'amount', type: 'number', required: true, description: 'Amount' }
      ];

      const entities = await extractor.extractEntities('set timer for ten minutes', parameters);
      
      expect(entities).toHaveLength(1);
      expect(entities[0].type).toBe('number');
      expect(entities[0].value).toBe('10');
    });

    it('should extract decimal numbers', async () => {
      const parameters: IntentParameter[] = [
        { name: 'amount', type: 'number', required: true, description: 'Amount' }
      ];

      const entities = await extractor.extractEntities('set timer for 2.5 hours', parameters);
      
      expect(entities).toHaveLength(1);
      expect(entities[0].type).toBe('number');
      expect(entities[0].value).toBe('2.5');
    });
  });

  describe('String Extraction', () => {
    it('should extract message content', async () => {
      const parameters: IntentParameter[] = [
        { name: 'message', type: 'string', required: true, description: 'Message content' }
      ];

      const entities = await extractor.extractEntities('text mom I love you', parameters);
      
      expect(entities).toHaveLength(1);
      expect(entities[0].type).toBe('string');
      expect(entities[0].value).toBe('I love you');
    });

    it('should extract message with say command', async () => {
      const parameters: IntentParameter[] = [
        { name: 'message', type: 'string', required: true, description: 'Message content' }
      ];

      const entities = await extractor.extractEntities('say hello world', parameters);
      
      expect(entities).toHaveLength(1);
      expect(entities[0].type).toBe('string');
      expect(entities[0].value).toBe('hello world');
    });
  });

  describe('Boolean Extraction', () => {
    it('should extract positive boolean values', async () => {
      const parameters: IntentParameter[] = [
        { name: 'confirm', type: 'boolean', required: true, description: 'Confirmation' }
      ];

      const entities = await extractor.extractEntities('yes please do it', parameters);
      
      expect(entities).toHaveLength(1);
      expect(entities[0].type).toBe('boolean');
      expect(entities[0].value).toBe('true');
    });

    it('should extract negative boolean values', async () => {
      const parameters: IntentParameter[] = [
        { name: 'confirm', type: 'boolean', required: true, description: 'Confirmation' }
      ];

      const entities = await extractor.extractEntities('no don\'t do it', parameters);
      
      expect(entities).toHaveLength(1);
      expect(entities[0].type).toBe('boolean');
      expect(entities[0].value).toBe('false');
    });
  });

  describe('Multiple Entity Extraction', () => {
    it('should extract multiple entities of different types', async () => {
      const parameters: IntentParameter[] = [
        { name: 'contact', type: 'contact', required: true, description: 'Contact' },
        { name: 'message', type: 'string', required: true, description: 'Message' }
      ];

      const entities = await extractor.extractEntities('text mom I will be late', parameters);
      
      expect(entities.length).toBeGreaterThanOrEqual(2);
      
      const contactEntity = entities.find(e => e.type === 'contact');
      const messageEntity = entities.find(e => e.type === 'string');
      
      expect(contactEntity).toBeDefined();
      expect(messageEntity).toBeDefined();
      expect(contactEntity!.value).toBe('mom');
      expect(messageEntity!.value).toBe('I will be late');
    });

    it('should extract multiple entities of the same type', async () => {
      const parameters: IntentParameter[] = [
        { name: 'number1', type: 'number', required: true, description: 'First number' },
        { name: 'number2', type: 'number', required: true, description: 'Second number' }
      ];

      const entities = await extractor.extractEntities('add 5 and 10 together', parameters);
      
      const numberEntities = entities.filter(e => e.type === 'number');
      expect(numberEntities.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Overlapping Entity Resolution', () => {
    it('should resolve overlapping entities by keeping higher confidence', async () => {
      const parameters: IntentParameter[] = [
        { name: 'contact', type: 'contact', required: true, description: 'Contact' },
        { name: 'location', type: 'location', required: false, description: 'Location' }
      ];

      // "home" could be both a contact and location
      const entities = await extractor.extractEntities('call home', parameters);
      
      // Should not have overlapping entities
      const sortedEntities = entities.sort((a, b) => a.startIndex - b.startIndex);
      for (let i = 0; i < sortedEntities.length - 1; i++) {
        expect(sortedEntities[i].endIndex).toBeLessThanOrEqual(sortedEntities[i + 1].startIndex);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty input', async () => {
      const parameters: IntentParameter[] = [
        { name: 'contact', type: 'contact', required: true, description: 'Contact' }
      ];

      const entities = await extractor.extractEntities('', parameters);
      expect(entities).toHaveLength(0);
    });

    it('should handle input with no matching entities', async () => {
      const parameters: IntentParameter[] = [
        { name: 'contact', type: 'contact', required: true, description: 'Contact' }
      ];

      const entities = await extractor.extractEntities('xyz abc def', parameters);
      expect(entities).toHaveLength(0);
    });

    it('should handle special characters in input', async () => {
      const parameters: IntentParameter[] = [
        { name: 'contact', type: 'contact', required: true, description: 'Contact' }
      ];

      const entities = await extractor.extractEntities('call mom!!!', parameters);
      
      expect(entities).toHaveLength(1);
      expect(entities[0].value).toBe('mom');
    });
  });
});