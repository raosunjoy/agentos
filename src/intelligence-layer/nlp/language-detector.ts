/**
 * Language Detector - Multi-language support framework
 * 
 * Detects the language of user input and provides language-specific
 * processing capabilities with elderly-optimized features.
 */

import { LanguageConfig, NLPConfig } from './types';

export class LanguageDetector {
  private config: NLPConfig;
  private languageModels: Map<string, LanguageModel> = new Map();
  private userLanguagePreference?: string;

  constructor(config: NLPConfig) {
    this.config = config;
    this.initializeLanguageModels();
  }

  /**
   * Detect the language of input text
   */
  async detectLanguage(text: string): Promise<string> {
    // Use user preference if available and confident
    if (this.userLanguagePreference) {
      const confidence = await this.calculateLanguageConfidence(text, this.userLanguagePreference);
      if (confidence > 0.7) {
        return this.userLanguagePreference;
      }
    }

    // Detect language using multiple methods
    const candidates = await this.getLanguageCandidates(text);
    
    // Return the most confident language that's enabled
    for (const candidate of candidates) {
      const languageConfig = this.config.languages.find(lang => lang.code === candidate.language);
      if (languageConfig?.enabled) {
        return candidate.language;
      }
    }

    // Fallback to default language
    return this.config.defaultLanguage;
  }

  /**
   * Set user's preferred language
   */
  setUserLanguagePreference(languageCode: string): void {
    const languageConfig = this.config.languages.find(lang => lang.code === languageCode);
    if (languageConfig?.enabled) {
      this.userLanguagePreference = languageCode;
    }
  }

  /**
   * Get language-specific processing configuration
   */
  getLanguageConfig(languageCode: string): LanguageConfig | undefined {
    return this.config.languages.find(lang => lang.code === languageCode);
  }

  /**
   * Check if a language is supported
   */
  isLanguageSupported(languageCode: string): boolean {
    const config = this.getLanguageConfig(languageCode);
    return config?.enabled || false;
  }

  /**
   * Get all supported languages
   */
  getSupportedLanguages(): LanguageConfig[] {
    return this.config.languages.filter(lang => lang.enabled);
  }

  /**
   * Preprocess text for language-specific optimizations
   */
  preprocessForLanguage(text: string, languageCode: string): string {
    const model = this.languageModels.get(languageCode);
    if (!model) return text;

    let processed = text.trim();

    // Apply language-specific preprocessing
    switch (languageCode) {
      case 'en':
        processed = this.preprocessEnglish(processed);
        break;
      case 'es':
        processed = this.preprocessSpanish(processed);
        break;
      case 'fr':
        processed = this.preprocessFrench(processed);
        break;
      case 'de':
        processed = this.preprocessGerman(processed);
        break;
      case 'zh':
        processed = this.preprocessChinese(processed);
        break;
      default:
        processed = this.preprocessGeneric(processed);
    }

    return processed;
  }

  /**
   * Get language candidates with confidence scores
   */
  private async getLanguageCandidates(text: string): Promise<Array<{language: string, confidence: number}>> {
    const candidates: Array<{language: string, confidence: number}> = [];

    // Simple character-based detection
    for (const languageConfig of this.config.languages) {
      if (languageConfig.enabled) {
        const confidence = await this.calculateLanguageConfidence(text, languageConfig.code);
        candidates.push({
          language: languageConfig.code,
          confidence
        });
      }
    }

    // Sort by confidence
    candidates.sort((a, b) => b.confidence - a.confidence);
    return candidates;
  }

  /**
   * Calculate confidence score for a specific language
   */
  private async calculateLanguageConfidence(text: string, languageCode: string): Promise<number> {
    const model = this.languageModels.get(languageCode);
    if (!model) return 0;

    let confidence = 0;

    // Character frequency analysis
    confidence += this.analyzeCharacterFrequency(text, model) * 0.4;

    // Common word analysis
    confidence += this.analyzeCommonWords(text, model) * 0.4;

    // Pattern analysis
    confidence += this.analyzeLanguagePatterns(text, model) * 0.2;

    return Math.min(confidence, 1.0);
  }

  /**
   * Analyze character frequency for language detection
   */
  private analyzeCharacterFrequency(text: string, model: LanguageModel): number {
    const textChars = text.toLowerCase().replace(/[^a-zA-ZÀ-ÿ\u4e00-\u9fff]/g, '');
    if (textChars.length === 0) return 0;

    let score = 0;
    const charCounts = new Map<string, number>();

    // Count characters
    for (const char of textChars) {
      charCounts.set(char, (charCounts.get(char) || 0) + 1);
    }

    // Compare with expected frequencies
    for (const [char, count] of charCounts) {
      const frequency = count / textChars.length;
      const expectedFrequency = model.characterFrequencies.get(char) || 0;
      const difference = Math.abs(frequency - expectedFrequency);
      score += Math.max(0, 1 - difference * 10); // Penalty for large differences
    }

    return score / Math.max(charCounts.size, 1);
  }

  /**
   * Analyze common words for language detection
   */
  private analyzeCommonWords(text: string, model: LanguageModel): number {
    const words = text.toLowerCase().split(/\s+/);
    if (words.length === 0) return 0;

    let matchCount = 0;
    for (const word of words) {
      if (model.commonWords.has(word)) {
        matchCount++;
      }
    }

    return matchCount / words.length;
  }

  /**
   * Analyze language-specific patterns
   */
  private analyzeLanguagePatterns(text: string, model: LanguageModel): number {
    let score = 0;
    let patternCount = 0;

    for (const pattern of model.patterns) {
      const matches = text.match(pattern);
      if (matches) {
        score += matches.length;
      }
      patternCount++;
    }

    return patternCount > 0 ? Math.min(score / patternCount, 1) : 0;
  }

  /**
   * English-specific preprocessing
   */
  private preprocessEnglish(text: string): string {
    return text
      .toLowerCase()
      .replace(/won't/g, 'will not')
      .replace(/can't/g, 'cannot')
      .replace(/n't/g, ' not')
      .replace(/'ll/g, ' will')
      .replace(/'re/g, ' are')
      .replace(/'ve/g, ' have')
      .replace(/'d/g, ' would')
      .replace(/\s+/g, ' ');
  }

  /**
   * Spanish-specific preprocessing
   */
  private preprocessSpanish(text: string): string {
    return text
      .toLowerCase()
      .replace(/¿/g, '')
      .replace(/¡/g, '')
      .replace(/ñ/g, 'n')
      .replace(/[áàâãä]/g, 'a')
      .replace(/[éèêë]/g, 'e')
      .replace(/[íìîï]/g, 'i')
      .replace(/[óòôõö]/g, 'o')
      .replace(/[úùûü]/g, 'u')
      .replace(/\s+/g, ' ');
  }

  /**
   * French-specific preprocessing
   */
  private preprocessFrench(text: string): string {
    return text
      .toLowerCase()
      .replace(/[àáâãäå]/g, 'a')
      .replace(/[èéêë]/g, 'e')
      .replace(/[ìíîï]/g, 'i')
      .replace(/[òóôõö]/g, 'o')
      .replace(/[ùúûü]/g, 'u')
      .replace(/ç/g, 'c')
      .replace(/\s+/g, ' ');
  }

  /**
   * German-specific preprocessing
   */
  private preprocessGerman(text: string): string {
    return text
      .toLowerCase()
      .replace(/ä/g, 'ae')
      .replace(/ö/g, 'oe')
      .replace(/ü/g, 'ue')
      .replace(/ß/g, 'ss')
      .replace(/\s+/g, ' ');
  }

  /**
   * Chinese-specific preprocessing
   */
  private preprocessChinese(text: string): string {
    // Remove spaces between Chinese characters
    return text.replace(/(?<=[\u4e00-\u9fff])\s+(?=[\u4e00-\u9fff])/g, '');
  }

  /**
   * Generic preprocessing for unsupported languages
   */
  private preprocessGeneric(text: string): string {
    return text.replace(/\s+/g, ' ');
  }

  /**
   * Initialize language models with character frequencies and common words
   */
  private initializeLanguageModels(): void {
    // English model
    this.languageModels.set('en', {
      characterFrequencies: new Map([
        ['e', 0.127], ['t', 0.091], ['a', 0.082], ['o', 0.075], ['i', 0.070],
        ['n', 0.067], ['s', 0.063], ['h', 0.061], ['r', 0.060], ['d', 0.043]
      ]),
      commonWords: new Set([
        'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
        'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
        'call', 'text', 'send', 'get', 'set', 'help', 'please', 'thank'
      ]),
      patterns: [
        /\b(the|a|an)\s+\w+/g,
        /\w+ing\b/g,
        /\w+ed\b/g
      ]
    });

    // Spanish model
    this.languageModels.set('es', {
      characterFrequencies: new Map([
        ['e', 0.137], ['a', 0.125], ['o', 0.086], ['s', 0.080], ['r', 0.069],
        ['n', 0.067], ['i', 0.063], ['d', 0.058], ['l', 0.050], ['c', 0.047]
      ]),
      commonWords: new Set([
        'el', 'la', 'de', 'que', 'y', 'a', 'en', 'un', 'es', 'se',
        'no', 'te', 'lo', 'le', 'da', 'su', 'por', 'son', 'con', 'para',
        'llamar', 'enviar', 'mensaje', 'ayuda', 'por favor', 'gracias'
      ]),
      patterns: [
        /\b(el|la|los|las)\s+\w+/g,
        /\w+ción\b/g,
        /\w+ando\b/g
      ]
    });

    // Add more language models as needed
  }
}

interface LanguageModel {
  characterFrequencies: Map<string, number>;
  commonWords: Set<string>;
  patterns: RegExp[];
}