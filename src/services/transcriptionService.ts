import fs from 'fs';
import OpenAI from 'openai';

export class TranscriptionService {
  private openai: OpenAI | null = null;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn('⚠️ OpenAI API key not found. Transcription will use fallback responses.');
    } else {
      this.openai = new OpenAI({ apiKey });
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
      if (!this.openai) {
        throw new Error('OpenAI client not initialized. Please set OPENAI_API_KEY in environment variables.');
      }

      console.log('🎤 Transcribing audio with OpenAI Whisper...');
      console.log('📁 Audio file path:', audioFilePath);

      // Use OpenAI SDK to transcribe
      const transcription = await this.openai.audio.transcriptions.create({
        file: fs.createReadStream(audioFilePath),
        model: 'whisper-1',
        language: 'en',
        response_format: 'verbose_json',
        temperature: 0.2,
      });

      console.log('✅ Whisper transcription successful:', transcription.text);

      return {
        text: transcription.text || '',
        confidence: this.calculateConfidence(transcription),
        duration: transcription.duration,
        language: transcription.language || 'en',
      };
    } catch (error: any) {
      console.error('❌ Whisper transcription error:', error.message);
      console.error('Error details:', error);
      throw error;
    }
  }

  /**
   * Transcribe audio using OpenAI Whisper
   */
  async transcribe(audioFilePath: string, preferredService: 'whisper' | 'vapi' = 'whisper'): Promise<{
    text: string;
    confidence: number;
    service: string;
  }> {
    const result = await this.transcribeWithWhisper(audioFilePath);

    if (!result) {
      throw new Error('Transcription failed - no result returned from Whisper API');
    }

    return { ...result, service: 'whisper' };
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
   * Generate a smart title from transcript using AI
   */
  async generateTitle(transcript: string): Promise<string> {
    try {
      if (!this.openai) {
        // Fallback: Simple title generation without AI
        return this.generateSimpleTitle(transcript);
      }

      console.log('🤖 Generating smart title with AI...');

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that creates concise, descriptive titles for voice recordings. Create a short title (max 60 characters) that captures the main topic. Do not include greetings, filler words, or meta information. Focus on the key subject matter. Examples: "Meeting with board members about Q4", "Call with Google CEO", "Reminder to buy groceries", "Discussion about project timeline".'
          },
          {
            role: 'user',
            content: `Create a concise title for this transcript:\n\n${transcript}`
          }
        ],
        max_tokens: 30,
        temperature: 0.3,
      });

      const title = completion.choices[0]?.message?.content?.trim() || this.generateSimpleTitle(transcript);

      // Remove quotes if AI added them
      const cleanTitle = title.replace(/^["']|["']$/g, '');

      console.log('✅ AI generated title:', cleanTitle);
      return cleanTitle;

    } catch (error: any) {
      console.error('❌ AI title generation error:', error.message);
      return this.generateSimpleTitle(transcript);
    }
  }

  /**
   * Simple fallback title generation without AI
   */
  private generateSimpleTitle(text: string): string {
    // Remove greetings and common filler words
    const cleaned = text
      .replace(/^(hello|hi|hey|good morning|good afternoon|good evening)[,\s]*/i, '')
      .replace(/\b(um|uh|like|you know|so|well)\b/gi, '')
      .trim();

    // Try to extract key phrases
    const meetingMatch = cleaned.match(/meeting (with|about|regarding) ([^,.!?]+)/i);
    if (meetingMatch) {
      return `Meeting ${meetingMatch[1]} ${meetingMatch[2]}`.substring(0, 60);
    }

    const callMatch = cleaned.match(/call (with|about|regarding) ([^,.!?]+)/i);
    if (callMatch) {
      return `Call ${callMatch[1]} ${callMatch[2]}`.substring(0, 60);
    }

    const reminderMatch = cleaned.match(/remind(er)? (me )?(to|about) ([^,.!?]+)/i);
    if (reminderMatch) {
      return `Reminder: ${reminderMatch[4]}`.substring(0, 60);
    }

    // Get first sentence or first 50 characters
    const firstSentence = cleaned.split(/[.!?]/)[0].trim();
    if (firstSentence.length <= 60) {
      return firstSentence;
    }

    // Take first 50 chars
    const words = cleaned.split(' ');
    let title = '';
    for (const word of words) {
      if ((title + word).length > 50) break;
      title += (title ? ' ' : '') + word;
    }

    return title + (title.length < cleaned.length ? '...' : '');
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
      whisper: !!this.openai,
      vapi: !!process.env.VAPI_API_KEY,
      hasOpenAIKey: !!this.openai,
      hasVAPIKey: !!process.env.VAPI_API_KEY,
    };
  }
}

export const transcriptionService = new TranscriptionService();