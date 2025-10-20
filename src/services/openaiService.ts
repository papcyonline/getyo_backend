import OpenAI from 'openai';
import fs from 'fs';
import { User } from '../models';
import generateAdvancedSystemPrompt from '../prompts/advancedPASystemPrompt';

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
      // Fetch user info for personalization
      const user = await User.findById(userId);
      const userName = user?.preferredName || user?.fullName;

      console.log('🔍 [OpenAI Service] User Info:', {
        userId,
        fullName: user?.fullName,
        preferredName: user?.preferredName,
        userName: userName,
        assistantName: assistantName
      });

      // Detect if this is a greeting
      const lastUserMessage = messages[messages.length - 1]?.content?.toLowerCase() || '';
      const isGreeting = /^(hi|hello|hey|greetings|good morning|good afternoon|good evening|yo|sup|what's up|whats up)/i.test(lastUserMessage.trim());

      console.log('🔍 [OpenAI Service] Greeting Detection:', {
        lastUserMessage: lastUserMessage.substring(0, 50),
        isGreeting,
        conversationPhase: isGreeting ? 'greeting' : 'task'
      });

      // Use advanced system prompt with user context
      const systemPromptContent = generateAdvancedSystemPrompt({
        assistantName: assistantName || 'Yo!',
        userName: userName,
        conversationPhase: isGreeting ? 'greeting' : 'task',
        userMood: 'neutral'
      });
      
      const systemMessage: ChatMessage = {
        role: 'system',
        content: systemPromptContent
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

  /**
   * Extract structured task data from natural language transcript
   * Uses AI to parse dates, times, names, priorities, etc.
   */
  async extractTaskFromTranscript(
    transcript: string,
    recordedAt: Date = new Date()
  ): Promise<{
    success: boolean;
    data?: {
      title: string;
      description?: string;
      dueDate?: Date;
      priority?: 'low' | 'medium' | 'high' | 'urgent';
      category?: string;
      tags?: string[];
      people?: string[];
      location?: string;
    };
    error?: string;
  }> {
    try {
      const systemPrompt = `You are an AI assistant that extracts structured task information from natural language.
Current date/time: ${recordedAt.toISOString()}

Parse the user's voice input and extract:
1. **title**: A concise task title (required, max 100 chars)
2. **description**: Additional details or context
3. **dueDate**: Parse relative dates like "tomorrow", "next week", "in 2 hours", etc. Return ISO 8601 format
4. **priority**: Determine from context (urgent/high/medium/low). Default: medium
5. **category**: Infer category (work, personal, shopping, health, finance, home, learning, social)
6. **tags**: Extract relevant keywords as tags
7. **people**: Extract names mentioned
8. **location**: Extract location if mentioned

Examples:
- "Book a meeting with Paul tomorrow at 10pm" → title: "Book meeting with Paul", dueDate: tomorrow 10pm, people: ["Paul"]
- "Buy groceries this evening" → title: "Buy groceries", category: "shopping", dueDate: this evening
- "Call mom urgent" → title: "Call mom", priority: "urgent", people: ["mom"]

Respond ONLY with valid JSON. No markdown, no code blocks, just pure JSON:
{
  "title": "string",
  "description": "string or null",
  "dueDate": "ISO date string or null",
  "priority": "low|medium|high|urgent",
  "category": "string or null",
  "tags": ["array of strings or empty"],
  "people": ["array of names or empty"],
  "location": "string or null"
}`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: transcript }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      });

      const responseText = completion.choices[0]?.message?.content;

      if (!responseText) {
        return {
          success: false,
          error: 'No response from AI'
        };
      }

      const parsed = JSON.parse(responseText);

      // Convert dueDate string to Date object if present
      if (parsed.dueDate) {
        parsed.dueDate = new Date(parsed.dueDate);
      }

      return {
        success: true,
        data: parsed
      };

    } catch (error: any) {
      console.error('Task extraction error:', error);
      return {
        success: false,
        error: 'Failed to extract task details. Please try again.'
      };
    }
  }
}

// Export singleton instance
export const openaiService = new OpenAIService();