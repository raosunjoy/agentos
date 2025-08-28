/**
 * Text-to-Speech Engine - Warm, clear voice synthesis
 * 
 * Provides natural-sounding speech synthesis optimized for elderly users
 * with clear pronunciation, appropriate pacing, and warm tone.
 */

import { SpeechSynthesisOptions, SpeechSynthesisResult, UserVoiceProfile } from './types';

export class TextToSpeechEngine {
  private elderlyOptimizations: boolean;
  private userProfile?: UserVoiceProfile;
  private defaultVoiceSettings: SpeechSynthesisOptions;

  constructor(elderlyOptimizations: boolean = true, userProfile?: UserVoiceProfile) {
    this.elderlyOptimizations = elderlyOptimizations;
    this.userProfile = userProfile;
    
    this.defaultVoiceSettings = {
      voice: 'warm-female', // Warm, friendly voice
      rate: elderlyOptimizations ? 0.8 : 1.0, // Slower for elderly users
      pitch: 1.0,
      volume: 0.8,
      language: 'en-US',
      elderlyOptimized: elderlyOptimizations
    };
  }

  /**
   * Synthesize speech from text with elderly optimizations
   */
  async synthesize(
    text: string, 
    options?: Partial<SpeechSynthesisOptions>
  ): Promise<SpeechSynthesisResult> {
    const startTime = Date.now();

    try {
      // Merge options with defaults
      const synthOptions = { ...this.defaultVoiceSettings, ...options };

      // Preprocess text for better synthesis
      const processedText = this.preprocessText(text, synthOptions);

      // Apply elderly-specific optimizations
      if (synthOptions.elderlyOptimized) {
        synthOptions.rate = Math.min(synthOptions.rate, 0.9); // Ensure not too fast
        synthOptions.pitch = this.optimizePitchForElderly(synthOptions.pitch);
      }

      // Generate speech audio (mock implementation)
      const audioResult = await this.generateSpeechAudio(processedText, synthOptions);

      return {
        ...audioResult,
        duration: Date.now() - startTime,
        success: true
      };

    } catch (error) {
      return {
        audioBuffer: new ArrayBuffer(0),
        duration: Date.now() - startTime,
        sampleRate: 22050,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown synthesis error'
      };
    }
  }

  /**
   * Synthesize with SSML (Speech Synthesis Markup Language) support
   */
  async synthesizeSSML(
    ssml: string,
    options?: Partial<SpeechSynthesisOptions>
  ): Promise<SpeechSynthesisResult> {
    // Parse SSML and extract text with prosody information
    const { text, prosody } = this.parseSSML(ssml);
    
    // Apply SSML prosody to options
    const enhancedOptions = this.applySSMLProsody(options || {}, prosody);
    
    return this.synthesize(text, enhancedOptions);
  }

  /**
   * Get available voices optimized for elderly users
   */
  getElderlyOptimizedVoices(): Array<{
    id: string;
    name: string;
    language: string;
    gender: 'male' | 'female' | 'neutral';
    characteristics: string[];
  }> {
    return [
      {
        id: 'warm-female',
        name: 'Sarah (Warm Female)',
        language: 'en-US',
        gender: 'female',
        characteristics: ['warm', 'clear', 'patient', 'friendly']
      },
      {
        id: 'gentle-male',
        name: 'David (Gentle Male)',
        language: 'en-US',
        gender: 'male',
        characteristics: ['gentle', 'clear', 'reassuring', 'calm']
      },
      {
        id: 'clear-neutral',
        name: 'Alex (Clear Neutral)',
        language: 'en-US',
        gender: 'neutral',
        characteristics: ['clear', 'precise', 'neutral', 'professional']
      }
    ];
  }

  /**
   * Set user voice profile for personalized synthesis
   */
  setUserProfile(profile: UserVoiceProfile): void {
    this.userProfile = profile;
    
    // Adjust default settings based on user preferences
    if (profile.voiceCharacteristics.preferredPace) {
      this.defaultVoiceSettings.rate = profile.voiceCharacteristics.preferredPace;
    }
  }

  /**
   * Update voice settings based on user feedback
   */
  updateVoiceSettings(feedback: {
    tooFast?: boolean;
    tooSlow?: boolean;
    tooLoud?: boolean;
    tooQuiet?: boolean;
    unclear?: boolean;
  }): void {
    if (feedback.tooFast) {
      this.defaultVoiceSettings.rate = Math.max(0.5, this.defaultVoiceSettings.rate - 0.1);
    }
    
    if (feedback.tooSlow) {
      this.defaultVoiceSettings.rate = Math.min(1.2, this.defaultVoiceSettings.rate + 0.1);
    }
    
    if (feedback.tooLoud) {
      this.defaultVoiceSettings.volume = Math.max(0.3, this.defaultVoiceSettings.volume - 0.1);
    }
    
    if (feedback.tooQuiet) {
      this.defaultVoiceSettings.volume = Math.min(1.0, this.defaultVoiceSettings.volume + 0.1);
    }
    
    if (feedback.unclear) {
      this.defaultVoiceSettings.rate = Math.max(0.6, this.defaultVoiceSettings.rate - 0.05);
    }
  }

  /**
   * Generate speech for emergency situations with appropriate urgency
   */
  async synthesizeEmergency(text: string): Promise<SpeechSynthesisResult> {
    const emergencyOptions: Partial<SpeechSynthesisOptions> = {
      rate: 0.9, // Slightly faster but still clear
      volume: 0.9, // Louder for attention
      pitch: 1.1, // Slightly higher pitch for urgency
      voice: 'clear-neutral' // Most clear voice
    };

    // Add emergency-specific text preprocessing
    const processedText = `Important: ${text}`;
    
    return this.synthesize(processedText, emergencyOptions);
  }

  /**
   * Preprocess text for better synthesis quality
   */
  private preprocessText(text: string, options: SpeechSynthesisOptions): string {
    let processed = text.trim();

    if (options.elderlyOptimized) {
      // Add pauses for better comprehension
      processed = this.addNaturalPauses(processed);
      
      // Expand abbreviations and numbers
      processed = this.expandAbbreviations(processed);
      processed = this.expandNumbers(processed);
      
      // Improve pronunciation of technical terms
      processed = this.improvePronunciation(processed);
    }

    return processed;
  }

  /**
   * Add natural pauses for elderly users
   */
  private addNaturalPauses(text: string): string {
    return text
      .replace(/\./g, '. <break time="500ms"/>')
      .replace(/,/g, ', <break time="200ms"/>')
      .replace(/;/g, '; <break time="300ms"/>')
      .replace(/:/g, ': <break time="300ms"/>');
  }

  /**
   * Expand common abbreviations
   */
  private expandAbbreviations(text: string): string {
    const abbreviations = {
      'Dr.': 'Doctor',
      'Mr.': 'Mister',
      'Mrs.': 'Missus',
      'Ms.': 'Miss',
      'etc.': 'etcetera',
      'vs.': 'versus',
      'e.g.': 'for example',
      'i.e.': 'that is',
      'AM': 'A M',
      'PM': 'P M'
    };

    let expanded = text;
    for (const [abbrev, expansion] of Object.entries(abbreviations)) {
      const regex = new RegExp(`\\b${abbrev.replace('.', '\\.')}\\b`, 'gi');
      expanded = expanded.replace(regex, expansion);
    }

    return expanded;
  }

  /**
   * Expand numbers for better pronunciation
   */
  private expandNumbers(text: string): string {
    // Convert digits to words for phone numbers, times, etc.
    return text
      .replace(/\b(\d{3})-(\d{3})-(\d{4})\b/g, '$1 $2 $3') // Phone numbers
      .replace(/\b(\d{1,2}):(\d{2})\b/g, '$1 $2') // Times
      .replace(/\b911\b/g, 'nine one one'); // Emergency number
  }

  /**
   * Improve pronunciation of technical terms
   */
  private improvePronunciation(text: string): string {
    const pronunciationMap = {
      'WiFi': 'Wi Fi',
      'SMS': 'S M S',
      'GPS': 'G P S',
      'USB': 'U S B',
      'PDF': 'P D F',
      'URL': 'U R L',
      'FAQ': 'F A Q'
    };

    let improved = text;
    for (const [term, pronunciation] of Object.entries(pronunciationMap)) {
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      improved = improved.replace(regex, pronunciation);
    }

    return improved;
  }

  /**
   * Optimize pitch for elderly users
   */
  private optimizePitchForElderly(pitch: number): number {
    // Slightly lower pitch is often more comfortable for elderly users
    return Math.max(0.8, Math.min(1.2, pitch * 0.95));
  }

  /**
   * Generate speech audio (mock implementation)
   */
  private async generateSpeechAudio(
    text: string, 
    options: SpeechSynthesisOptions
  ): Promise<Omit<SpeechSynthesisResult, 'duration' | 'success' | 'error'>> {
    // Mock implementation - in real system, this would use actual TTS engine
    
    // Simulate processing time based on text length (but cap it for tests)
    const processingTime = Math.min(500, Math.max(50, text.length * 5));
    await new Promise(resolve => setTimeout(resolve, processingTime));

    // Calculate estimated duration based on speech rate and text length
    const wordsPerMinute = 150 * options.rate;
    const wordCount = text.split(' ').length;
    const estimatedDuration = (wordCount / wordsPerMinute) * 60 * 1000; // in milliseconds

    // Generate mock audio buffer
    const sampleRate = 22050;
    const samples = Math.floor((estimatedDuration / 1000) * sampleRate);
    const audioBuffer = new ArrayBuffer(samples * 2); // 16-bit audio

    // Fill with mock audio data (in real implementation, this would be actual speech)
    const view = new Int16Array(audioBuffer);
    for (let i = 0; i < samples; i++) {
      // Generate a simple sine wave as placeholder
      const frequency = 200 + Math.sin(i / 1000) * 100;
      view[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 16384 * options.volume;
    }

    return {
      audioBuffer,
      sampleRate
    };
  }

  /**
   * Parse SSML markup
   */
  private parseSSML(ssml: string): { text: string; prosody: any } {
    // Simple SSML parser (in real implementation, use proper XML parser)
    const text = ssml.replace(/<[^>]*>/g, ''); // Remove all tags for now
    const prosody = {}; // Extract prosody information
    
    return { text, prosody };
  }

  /**
   * Apply SSML prosody to synthesis options
   */
  private applySSMLProsody(
    options: Partial<SpeechSynthesisOptions>, 
    prosody: any
  ): Partial<SpeechSynthesisOptions> {
    // Apply prosody modifications to options
    return options;
  }
}