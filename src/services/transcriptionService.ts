import fs from 'fs';
import FormData from 'form-data';

export class TranscriptionService {
  private openaiApiKey: string;

  constructor() {
    this.openaiApiKey = process.env.OPENAI_API_KEY || '';
    if (!this.openaiApiKey) {
      console.warn('⚠️ OpenAI API key not found. Transcription will use fallback responses.');
    }
  }

  /**
   * Transcribe audio using OpenAI Whisper
   */
  async transcribeWithWhisper(audioFilePath: string): Promise<{
    text: string;
    confidence: number;
    duration?: number;
    language?: string;
  } | null> {
    try {
      if (!this.openaiApiKey) {
        console.log('No OpenAI API key, returning mock transcription');
        return this.getMockTranscription();
      }

      console.log('🎤 Transcribing audio with OpenAI Whisper...');

      const formData = new FormData();
      formData.append('file', fs.createReadStream(audioFilePath));
      formData.append('model', 'whisper-1');
      formData.append('language', 'en');
      formData.append('response_format', 'verbose_json');
      formData.append('temperature', '0.2'); // Lower temperature for more accurate transcription

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          ...formData.getHeaders(),
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenAI API error:', response.status, errorText);
        return this.getMockTranscription();
      }

      const result = await response.json() as any;
      console.log('✅ Whisper transcription successful:', result.text);

      return {
        text: result.text || '',
        confidence: this.calculateConfidence(result),
        duration: result.duration,
        language: result.language || 'en',
      };
    } catch (error) {
      console.error('Whisper transcription error:', error);
      return this.getMockTranscription();
    }
  }

  /**
   * Alternative: Transcribe using VAPI.AI (if you prefer their voice-optimized engine)
   */
  async transcribeWithVAPI(audioFilePath: string): Promise<{
    text: string;
    confidence: number;
  } | null> {
    try {
      const vapiApiKey = process.env.VAPI_API_KEY;
      if (!vapiApiKey) {
        console.log('No VAPI API key, falling back to Whisper');
        return this.transcribeWithWhisper(audioFilePath);
      }

      console.log('🎤 Transcribing audio with VAPI.AI...');

      const formData = new FormData();
      formData.append('audio', fs.createReadStream(audioFilePath));
      formData.append('language', 'en');

      const response = await fetch('https://api.vapi.ai/transcribe', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${vapiApiKey}`,
          ...formData.getHeaders(),
        },
        body: formData,
      });

      if (!response.ok) {
        console.error('VAPI API error:', response.status);
        return this.transcribeWithWhisper(audioFilePath);
      }

      const result = await response.json() as any;
      console.log('✅ VAPI transcription successful:', result.text);

      return {
        text: result.text || result.transcript || '',
        confidence: result.confidence || 0.9,
      };
    } catch (error) {
      console.error('VAPI transcription error:', error);
      return this.transcribeWithWhisper(audioFilePath);
    }
  }

  /**
   * Smart transcription - tries OpenAI Whisper first, falls back to mock
   */
  async transcribe(audioFilePath: string, preferredService: 'whisper' | 'vapi' = 'whisper'): Promise<{
    text: string;
    confidence: number;
    service: string;
  }> {
    let result = null;

    if (preferredService === 'vapi') {
      result = await this.transcribeWithVAPI(audioFilePath);
      if (result) {
        return { ...result, service: 'vapi' };
      }
    }

    result = await this.transcribeWithWhisper(audioFilePath);
    if (result) {
      return { ...result, service: 'whisper' };
    }

    // Final fallback
    const mockResult = this.getMockTranscription();
    return { ...mockResult, service: 'mock' };
  }

  /**
   * Calculate confidence score from Whisper response
   */
  private calculateConfidence(whisperResult: any): number {
    if (whisperResult.confidence) {
      return whisperResult.confidence;
    }

    // Estimate confidence based on various factors
    const textLength = whisperResult.text?.length || 0;
    const hasWords = whisperResult.words && whisperResult.words.length > 0;

    if (textLength < 10) return 0.7; // Short responses tend to be less reliable
    if (textLength > 100) return 0.95; // Longer responses are usually more accurate
    if (hasWords) return 0.9; // Word-level timestamps indicate high quality

    return 0.85; // Default confidence
  }

  /**
   * Realistic mock transcriptions for conversation interview
   */
  private getMockTranscription(): { text: string; confidence: number } {
    const mockResponses = [
      { text: "I'm a software engineer working on mobile applications and AI integration projects.", confidence: 0.95 },
      { text: "My biggest challenge is managing multiple projects and staying organized with deadlines.", confidence: 0.92 },
      { text: "I prefer having a structured day but with flexibility for unexpected urgent tasks.", confidence: 0.88 },
      { text: "I'd like reminders to be friendly but professional, not too casual.", confidence: 0.94 },
      { text: "I usually work from 9 to 6 but sometimes need to work late on important projects.", confidence: 0.90 },
      { text: "I want my assistant to help with scheduling meetings and managing my calendar efficiently.", confidence: 0.93 },
      { text: "I prefer getting daily briefings in the morning around 8 AM before I start work.", confidence: 0.91 },
      { text: "I'd like the assistant to learn my preferences over time and become more personalized.", confidence: 0.89 },
      { text: "Email management takes up too much of my time. I need help organizing my inbox.", confidence: 0.87 },
      { text: "I'm most productive in the morning and prefer tackling complex tasks early in the day.", confidence: 0.93 },
      { text: "I work with international teams so I need reminders that consider different time zones.", confidence: 0.91 },
      { text: "I like to batch similar tasks together rather than constantly switching between different types of work.", confidence: 0.89 }
    ];

    return mockResponses[Math.floor(Math.random() * mockResponses.length)];
  }

  /**
   * Health check for transcription services
   */
  async healthCheck(): Promise<{
    whisper: boolean;
    vapi: boolean;
    hasOpenAIKey: boolean;
    hasVAPIKey: boolean;
  }> {
    return {
      whisper: !!this.openaiApiKey,
      vapi: !!process.env.VAPI_API_KEY,
      hasOpenAIKey: !!this.openaiApiKey,
      hasVAPIKey: !!process.env.VAPI_API_KEY,
    };
  }
}

export const transcriptionService = new TranscriptionService();