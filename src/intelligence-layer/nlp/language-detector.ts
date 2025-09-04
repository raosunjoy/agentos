/**
 * Language Detector - Detects the language of input text
 * Uses rule-based and statistical approaches for language identification
 */

export interface Language {
  code: string;
  name: string;
  enabled: boolean;
  confidenceThreshold: number;
  charset?: string;
}

export interface DetectionResult {
  language: string;
  confidence: number;
  alternatives: Array<{ language: string; confidence: number }>;
}

export class LanguageDetector {
  private languages: Map<string, Language> = new Map();
  private userPreferences: Map<string, string> = new Map();
  private commonWords: Map<string, string[]> = new Map();

  constructor(private config?: { defaultLanguage?: string }) {
    this.initializeLanguages();
    this.initializeCommonWords();
  }

  /**
   * Detect the language of input text
   */
  async detectLanguage(text: string): Promise<string> {
    if (!text || text.trim().length === 0) {
      return this.config?.defaultLanguage || 'en';
    }

    const normalizedText = this.normalizeText(text);

    // Check user preference first
    const userPreferred = this.getUserPreferredLanguage();
    if (userPreferred) {
      return userPreferred;
    }

    // Try rule-based detection
    const ruleBased = this.detectWithRules(normalizedText);
    if (ruleBased.confidence > 0.8) {
      return ruleBased.language;
    }

    // Try statistical detection
    const statistical = this.detectWithStatistics(normalizedText);

    // Return the most confident result
    if (ruleBased.confidence > statistical.confidence) {
      return ruleBased.language;
    }

    return statistical.language;
  }

  /**
   * Preprocess text for the detected language
   */
  preprocessForLanguage(text: string, language: string): string {
    let processed = text.toLowerCase().trim();

    switch (language) {
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
      case 'en':
      default:
        processed = this.preprocessEnglish(processed);
        break;
    }

    return processed;
  }

  /**
   * Set user's preferred language
   */
  setUserLanguagePreference(userId: string, language: string): void {
    if (this.languages.has(language)) {
      this.userPreferences.set(userId, language);
    }
  }

  /**
   * Get user's preferred language
   */
  getUserPreferredLanguage(userId?: string): string | null {
    if (!userId) {
      return null;
    }
    return this.userPreferences.get(userId) || null;
  }

  /**
   * Get all supported languages
   */
  getSupportedLanguages(): Language[] {
    return Array.from(this.languages.values());
  }

  /**
   * Get language by code
   */
  getLanguage(code: string): Language | null {
    return this.languages.get(code) || null;
  }

  /**
   * Add or update a language
   */
  registerLanguage(language: Language): void {
    this.languages.set(language.code, language);
  }

  /**
   * Remove a language
   */
  removeLanguage(code: string): boolean {
    return this.languages.delete(code);
  }

  /**
   * Initialize supported languages
   */
  private initializeLanguages(): void {
    const defaultLanguages: Language[] = [
      {
        code: 'en',
        name: 'English',
        enabled: true,
        confidenceThreshold: 0.7
      },
      {
        code: 'es',
        name: 'Spanish',
        enabled: true,
        confidenceThreshold: 0.7
      },
      {
        code: 'fr',
        name: 'French',
        enabled: true,
        confidenceThreshold: 0.7
      },
      {
        code: 'de',
        name: 'German',
        enabled: true,
        confidenceThreshold: 0.7
      },
      {
        code: 'zh',
        name: 'Chinese',
        enabled: false,
        confidenceThreshold: 0.6,
        charset: 'utf-8'
      },
      {
        code: 'ja',
        name: 'Japanese',
        enabled: false,
        confidenceThreshold: 0.6,
        charset: 'utf-8'
      },
      {
        code: 'ko',
        name: 'Korean',
        enabled: false,
        confidenceThreshold: 0.6,
        charset: 'utf-8'
      },
      {
        code: 'pt',
        name: 'Portuguese',
        enabled: false,
        confidenceThreshold: 0.7
      },
      {
        code: 'it',
        name: 'Italian',
        enabled: false,
        confidenceThreshold: 0.7
      },
      {
        code: 'ru',
        name: 'Russian',
        enabled: false,
        confidenceThreshold: 0.6,
        charset: 'utf-8'
      }
    ];

    defaultLanguages.forEach(lang => this.languages.set(lang.code, lang));
  }

  /**
   * Initialize common words for statistical detection
   */
  private initializeCommonWords(): void {
    this.commonWords.set('en', [
      'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
      'this', 'that', 'these', 'those', 'what', 'when', 'where', 'why', 'how', 'who'
    ]);

    this.commonWords.set('es', [
      'el', 'la', 'los', 'las', 'y', 'o', 'pero', 'en', 'sobre', 'a', 'para', 'de',
      'con', 'por', 'yo', 'tú', 'él', 'ella', 'nosotros', 'ellos', 'qué', 'cuándo',
      'dónde', 'por', 'qué', 'cómo', 'quién', 'este', 'esta', 'estos', 'estas'
    ]);

    this.commonWords.set('fr', [
      'le', 'la', 'les', 'et', 'ou', 'mais', 'dans', 'sur', 'à', 'pour', 'de', 'avec',
      'par', 'je', 'tu', 'il', 'elle', 'nous', 'vous', 'ils', 'elles', 'que', 'quand',
      'où', 'pourquoi', 'comment', 'qui', 'ce', 'cette', 'ces'
    ]);

    this.commonWords.set('de', [
      'der', 'die', 'das', 'und', 'oder', 'aber', 'in', 'auf', 'an', 'zu', 'für', 'von',
      'mit', 'durch', 'ich', 'du', 'er', 'sie', 'wir', 'ihr', 'sie', 'was', 'wann',
      'wo', 'warum', 'wie', 'wer', 'dieser', 'diese', 'dieses', 'diese'
    ]);
  }

  /**
   * Normalize text for processing
   */
  private normalizeText(text: string): string {
    // Remove punctuation and numbers
    return text.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\d+/g, ' ').trim();
  }

  /**
   * Detect language using rule-based approach
   */
  private detectWithRules(text: string): DetectionResult {
    const results: Array<{ language: string; confidence: number }> = [];

    // Character-based detection
    const charResults = this.detectByCharacters(text);
    results.push(...charResults);

    // Script-based detection
    const scriptResult = this.detectByScript(text);
    if (scriptResult) {
      results.push(scriptResult);
    }

    // Sort by confidence and return top result
    results.sort((a, b) => b.confidence - a.confidence);

    return {
      language: results[0]?.language || 'en',
      confidence: results[0]?.confidence || 0,
      alternatives: results.slice(1)
    };
  }

  /**
   * Detect language by character analysis
   */
  private detectByCharacters(text: string): Array<{ language: string; confidence: number }> {
    const results: Array<{ language: string; confidence: number }> = [];

    // Spanish-specific characters
    const spanishChars = /[ñáéíóúü]/gi;
    if (spanishChars.test(text)) {
      results.push({ language: 'es', confidence: 0.9 });
    }

    // French-specific characters
    const frenchChars = /[àâäéèêëïîôöùûüÿç]/gi;
    if (frenchChars.test(text)) {
      results.push({ language: 'fr', confidence: 0.9 });
    }

    // German-specific characters
    const germanChars = /[äöüß]/gi;
    if (germanChars.test(text)) {
      results.push({ language: 'de', confidence: 0.9 });
    }

    // Chinese characters
    const chineseChars = /[\u4e00-\u9fff]/g;
    if (chineseChars.test(text)) {
      const chineseRatio = (text.match(chineseChars) || []).length / text.length;
      results.push({ language: 'zh', confidence: Math.min(chineseRatio * 2, 1) });
    }

    return results;
  }

  /**
   * Detect language by script analysis
   */
  private detectByScript(text: string): { language: string; confidence: number } | null {
    // Cyrillic (Russian, etc.)
    if (/[\u0400-\u04ff]/g.test(text)) {
      return { language: 'ru', confidence: 0.8 };
    }

    // Japanese Hiragana/Katakana
    if (/[\u3040-\u309f\u30a0-\u30ff]/g.test(text)) {
      return { language: 'ja', confidence: 0.8 };
    }

    // Korean Hangul
    if (/[\uac00-\ud7af]/g.test(text)) {
      return { language: 'ko', confidence: 0.8 };
    }

    return null;
  }

  /**
   * Detect language using statistical approach
   */
  private detectWithStatistics(text: string): DetectionResult {
    const words = text.split(/\s+/).filter(word => word.length > 0);
    if (words.length === 0) {
      return { language: 'en', confidence: 0, alternatives: [] };
    }

    const results: Array<{ language: string; confidence: number }> = [];

    for (const [langCode, commonWords] of this.commonWords.entries()) {
      const language = this.languages.get(langCode);
      if (!language?.enabled) {
        continue;
      }

      let matches = 0;
      for (const word of words.slice(0, 20)) { // Check first 20 words
        if (commonWords.includes(word.toLowerCase())) {
          matches++;
        }
      }

      const confidence = matches / Math.min(words.length, 20);
      if (confidence > 0.1) { // Only consider if there's some confidence
        results.push({ language: langCode, confidence });
      }
    }

    // Sort by confidence
    results.sort((a, b) => b.confidence - a.confidence);

    return {
      language: results[0]?.language || 'en',
      confidence: results[0]?.confidence || 0,
      alternatives: results.slice(1)
    };
  }

  /**
   * Preprocess English text
   */
  private preprocessEnglish(text: string): string {
    // Remove extra whitespace
    return text.replace(/\s+/g, ' ').trim();
  }

  /**
   * Preprocess Spanish text
   */
  private preprocessSpanish(text: string): string {
    // Normalize accented characters
    return text
      .replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i')
      .replace(/ó/g, 'o').replace(/ú/g, 'u').replace(/ü/g, 'u')
      .replace(/ñ/g, 'n')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Preprocess French text
   */
  private preprocessFrench(text: string): string {
    // Normalize accented characters
    return text
      .replace(/[àâä]/g, 'a').replace(/[éèêë]/g, 'e')
      .replace(/[ïî]/g, 'i').replace(/[ôö]/g, 'o')
      .replace(/[ùûü]/g, 'u').replace(/ÿ/g, 'y').replace(/ç/g, 'c')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Preprocess German text
   */
  private preprocessGerman(text: string): string {
    // Normalize umlauts
    return text
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
      .replace(/ß/g, 'ss')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Preprocess Chinese text
   */
  private preprocessChinese(text: string): string {
    // For Chinese, we keep the characters as-is but normalize whitespace
    return text.replace(/\s+/g, ' ').trim();
  }

  /**
   * Get detection statistics
   */
  getDetectionStats(): {
    supportedLanguages: number;
    enabledLanguages: number;
    userPreferences: number;
  } {
    const enabledLanguages = Array.from(this.languages.values())
      .filter(lang => lang.enabled).length;

    return {
      supportedLanguages: this.languages.size,
      enabledLanguages,
      userPreferences: this.userPreferences.size
    };
  }
}