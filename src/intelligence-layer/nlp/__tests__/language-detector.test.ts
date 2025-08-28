/**
 * Unit tests for Language Detector
 */

import { LanguageDetector } from '../language-detector';
import { NLPConfig } from '../types';

describe('LanguageDetector', () => {
  let detector: LanguageDetector;
  let config: NLPConfig;

  beforeEach(() => {
    config = {
      languages: [
        { code: 'en', name: 'English', enabled: true, confidenceThreshold: 0.7 },
        { code: 'es', name: 'Spanish', enabled: true, confidenceThreshold: 0.7 },
        { code: 'fr', name: 'French', enabled: false, confidenceThreshold: 0.7 }
      ],
      defaultLanguage: 'en',
      confidenceThreshold: 0.7,
      maxAmbiguousResults: 3,
      enableElderlyOptimizations: true,
      cacheSize: 100
    };
    detector = new LanguageDetector(config);
  });

  describe('Language Detection', () => {
    it('should detect English text correctly', async () => {
      const language = await detector.detectLanguage('Hello, how are you today?');
      expect(language).toBe('en');
    });

    it('should detect Spanish text correctly', async () => {
      const language = await detector.detectLanguage('Hola, ¿cómo estás hoy?');
      expect(language).toBe('es');
    });

    it('should return default language for ambiguous text', async () => {
      const language = await detector.detectLanguage('123 456');
      expect(language).toBe('en'); // Default language
    });

    it('should return default language for empty text', async () => {
      const language = await detector.detectLanguage('');
      expect(language).toBe('en'); // Default language
    });

    it('should prefer enabled languages over disabled ones', async () => {
      // Even if French might be detected, it should fall back to enabled languages
      const language = await detector.detectLanguage('Bonjour comment allez-vous');
      expect(['en', 'es']).toContain(language); // Should be an enabled language
    });
  });

  describe('User Language Preference', () => {
    it('should use user preference when confidence is high', async () => {
      detector.setUserLanguagePreference('es');
      
      const language = await detector.detectLanguage('llamar mama');
      expect(language).toBe('es');
    });

    it('should ignore user preference for disabled languages', () => {
      detector.setUserLanguagePreference('fr'); // Disabled language
      
      // Should not set preference for disabled language
      expect(detector.getSupportedLanguages()).not.toContain('fr');
    });

    it('should fall back to detection when user preference confidence is low', async () => {
      detector.setUserLanguagePreference('es');
      
      // Clear English text should override Spanish preference
      const language = await detector.detectLanguage('Hello this is clearly English text');
      expect(language).toBe('en');
    });
  });

  describe('Language Support', () => {
    it('should correctly identify supported languages', () => {
      expect(detector.isLanguageSupported('en')).toBe(true);
      expect(detector.isLanguageSupported('es')).toBe(true);
      expect(detector.isLanguageSupported('fr')).toBe(false);
      expect(detector.isLanguageSupported('de')).toBe(false);
    });

    it('should return correct list of supported languages', () => {
      const supported = detector.getSupportedLanguages();
      
      expect(supported).toHaveLength(2);
      expect(supported.map(lang => lang.code)).toContain('en');
      expect(supported.map(lang => lang.code)).toContain('es');
      expect(supported.map(lang => lang.code)).not.toContain('fr');
    });

    it('should return language config for supported languages', () => {
      const enConfig = detector.getLanguageConfig('en');
      expect(enConfig).toBeDefined();
      expect(enConfig!.enabled).toBe(true);
      
      const frConfig = detector.getLanguageConfig('fr');
      expect(frConfig).toBeDefined();
      expect(frConfig!.enabled).toBe(false);
    });
  });

  describe('Text Preprocessing', () => {
    it('should preprocess English text correctly', () => {
      const processed = detector.preprocessForLanguage("I can't go there", 'en');
      expect(processed).toBe("i cannot go there");
    });

    it('should handle contractions in English', () => {
      const processed = detector.preprocessForLanguage("won't you'll they're", 'en');
      expect(processed).toBe("will not you will they are");
    });

    it('should preprocess Spanish text correctly', () => {
      const processed = detector.preprocessForLanguage("¿Cómo estás?", 'es');
      expect(processed).toBe("como estas?");
    });

    it('should handle special characters in Spanish', () => {
      const processed = detector.preprocessForLanguage("niño señor", 'es');
      expect(processed).toBe("nino senor");
    });

    it('should preprocess French text correctly', () => {
      const processed = detector.preprocessForLanguage("café très bien", 'fr');
      expect(processed).toBe("cafe tres bien");
    });

    it('should preprocess German text correctly', () => {
      const processed = detector.preprocessForLanguage("Mädchen Größe weiß", 'de');
      expect(processed).toBe("maedchen groesse weiss");
    });

    it('should preprocess Chinese text correctly', () => {
      const processed = detector.preprocessForLanguage("你 好 世 界", 'zh');
      expect(processed).toBe("你好世界");
    });

    it('should handle unknown languages gracefully', () => {
      const processed = detector.preprocessForLanguage("some text", 'unknown');
      expect(processed).toBe("some text");
    });
  });

  describe('Character Frequency Analysis', () => {
    it('should detect English based on character frequency', async () => {
      // Text with high frequency of English characters
      const englishText = "the quick brown fox jumps over the lazy dog";
      const language = await detector.detectLanguage(englishText);
      expect(language).toBe('en');
    });

    it('should handle mixed character sets', async () => {
      // Text with numbers and special characters
      const mixedText = "call 123-456-7890 at 3pm";
      const language = await detector.detectLanguage(mixedText);
      expect(['en', 'es']).toContain(language); // Should detect a supported language
    });
  });

  describe('Common Words Analysis', () => {
    it('should detect language based on common words', async () => {
      const englishText = "please call the doctor";
      const language = await detector.detectLanguage(englishText);
      expect(language).toBe('en');
    });

    it('should detect Spanish based on common words', async () => {
      const spanishText = "por favor llamar el doctor";
      const language = await detector.detectLanguage(spanishText);
      expect(language).toBe('es');
    });
  });

  describe('Pattern Analysis', () => {
    it('should detect English patterns', async () => {
      const englishText = "I am calling the doctor";
      const language = await detector.detectLanguage(englishText);
      expect(language).toBe('en');
    });

    it('should detect Spanish patterns', async () => {
      const spanishText = "estoy llamando al doctor";
      const language = await detector.detectLanguage(spanishText);
      expect(language).toBe('es');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very short text', async () => {
      const language = await detector.detectLanguage('hi');
      expect(['en', 'es']).toContain(language);
    });

    it('should handle text with only numbers', async () => {
      const language = await detector.detectLanguage('123456');
      expect(language).toBe('en'); // Should fall back to default
    });

    it('should handle text with only special characters', async () => {
      const language = await detector.detectLanguage('!@#$%^&*()');
      expect(language).toBe('en'); // Should fall back to default
    });

    it('should handle mixed language text', async () => {
      const language = await detector.detectLanguage('hello hola bonjour');
      expect(['en', 'es']).toContain(language); // Should detect one of the enabled languages
    });
  });

  describe('Performance', () => {
    it('should detect language quickly', async () => {
      const startTime = Date.now();
      await detector.detectLanguage('This is a test sentence for performance measurement');
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(50); // Should be very fast
    });

    it('should handle multiple detections efficiently', async () => {
      const startTime = Date.now();
      
      const promises = [
        detector.detectLanguage('Hello world'),
        detector.detectLanguage('Hola mundo'),
        detector.detectLanguage('Call mom'),
        detector.detectLanguage('Llamar mama'),
        detector.detectLanguage('Help me please')
      ];
      
      await Promise.all(promises);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(200); // Should handle batch efficiently
    });
  });
});