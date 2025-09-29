import OpenAI from 'openai';
import fs from 'fs';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface WhisperResponse {
  success: boolean;
  transcript?: string;
  error?: string;
}

export class OpenAIService {

  /**
   * Generate chat completion using OpenAI
   */
  async generateChatCompletion(
    messages: ChatMessage[],
    userId: string,
    assistantName?: string
  ): Promise<ChatResponse> {
    try {
      // Add system context for personal assistant
      const systemMessage: ChatMessage = {
        role: 'system',
        content: `You are ${assistantName || 'Yo!'}, a helpful personal assistant. You are professional, friendly, and concise. Help the user with their requests efficiently. Keep responses conversational but informative.`
      };

      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [systemMessage, ...messages],
        max_tokens: 500,
        temperature: 0.7,
        user: userId, // For tracking/abuse prevention
      });

      const response = completion.choices[0]?.message?.content;

      if (!response) {
        return {
          success: false,
          error: 'No response generated from OpenAI'
        };
      }

      return {
        success: true,
        message: response
      };

    } catch (error: any) {
      console.error('OpenAI chat completion error:', error);

      // Handle specific OpenAI errors
      if (error.code === 'insufficient_quota') {
        return {
          success: false,
          error: 'OpenAI quota exceeded. Please try again later.'
        };
      }

      if (error.code === 'rate_limit_exceeded') {
        return {
          success: false,
          error: 'Rate limit exceeded. Please wait a moment and try again.'
        };
      }

      return {
        success: false,
        error: 'Failed to generate response. Please try again.'
      };
    }
  }

  /**
   * Convert speech to text using OpenAI Whisper
   */
  async transcribeAudio(audioFilePath: string): Promise<WhisperResponse> {
    try {
      // Check if file exists
      if (!fs.existsSync(audioFilePath)) {
        return {
          success: false,
          error: 'Audio file not found'
        };
      }

      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(audioFilePath),
        model: 'whisper-1',
        language: 'en', // Can be made dynamic
        response_format: 'text'
      });

      return {
        success: true,
        transcript: transcription.toString()
      };

    } catch (error: any) {
      console.error('Whisper transcription error:', error);

      return {
        success: false,
        error: 'Failed to transcribe audio. Please try again.'
      };
    }
  }

  /**
   * Convert text to speech (if needed later)
   */
  async generateSpeech(text: string, voice: string = 'alloy'): Promise<Buffer | null> {
    try {
      const mp3 = await openai.audio.speech.create({
        model: 'tts-1',
        voice: voice as any,
        input: text,
      });

      return Buffer.from(await mp3.arrayBuffer());

    } catch (error: any) {
      console.error('Text-to-speech error:', error);
      return null;
    }
  }
}

// Export singleton instance
export const openaiService = new OpenAIService();