// src/config/openai.ts
import { logger } from '@utils/logger';
import OpenAI from 'openai';

type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatArgs {
  model?: string;
  messages: ChatMessage[];
  max_tokens?: number;
  temperature?: number;
  response_format?: { type: 'json_object' | 'text' };
}

export interface ChatResponse {
  choices: Array<{ message: { content: string } }>;
}

class OpenAIAdapter {
  private client: OpenAI | null = null;
  private enabled = false;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (apiKey) {
      try {
        this.client = new OpenAI({ apiKey });
        this.enabled = true;
        logger.info('OpenAI client initialized');
      } catch (err) {
        this.client = null;
        this.enabled = false;
        logger.error('Failed to initialize OpenAI client (using stub):', err as any);
      }
    } else {
      logger.warn('OPENAI_API_KEY not set. Using stub OpenAI client.');
      this.enabled = false;
    }
  }

  public isAvailable(): boolean {
    return this.enabled && !!this.client;
  }

  /**
   * Mirrors the shape your AIService expects:
   * await openai.createChatCompletion({...})
   * -> returns { choices: [{ message: { content: string } }] }
   */
  public async createChatCompletion(args: ChatArgs): Promise<ChatResponse> {
    // Real client path
    if (this.isAvailable() && this.client) {
      const model = args.model || process.env.OPENAI_MODEL || 'gpt-4o-mini';
      const res = await this.client.chat.completions.create({
        model,
        messages: args.messages,
        max_tokens: args.max_tokens,
        temperature: args.temperature,
        // The SDK accepts response_format on chat.completions
        response_format: args.response_format as any,
      });

      // Conform to your expected return type
      return {
        choices: [
          {
            message: {
              content: res.choices?.[0]?.message?.content ?? '',
            },
          },
        ],
      };
    }

    // Stubbed fallback (no API key): return a JSON-ish payload so your services can parse it.
    const stubJson = JSON.stringify({
      // field discovery defaults
      fields: [],
      recommendations: { governance: [], quality: [], compliance: [] },
      confidence: 0.5,
      // nlq defaults
      sql: 'SELECT 1;',
      explanation: 'OpenAI disabled; returning stubbed content.',
      tables: [],
      fieldsUsed: [],
      warnings: ['OpenAI disabled (stub)'],
    });

    logger.warn('OpenAI call intercepted by stub. Set OPENAI_API_KEY to enable real calls.');
    return { choices: [{ message: { content: stubJson } }] };
  }
}

export const openai = new OpenAIAdapter();
