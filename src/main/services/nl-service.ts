import { NLToSQLRequest, NLToSQLResponse, AppSettings } from '../../shared/types';
import { BaseProvider } from './providers/base';
import { AnthropicProvider } from './providers/anthropic';
import { OpenAIProvider } from './providers/openai';
import { GeminiProvider } from './providers/gemini';
import { OllamaProvider } from './providers/ollama';
import { GroqProvider } from './providers/groq';

export class NLService {
  private provider: BaseProvider | null = null;

  updateConfig(settings: AppSettings): void {
    const provider = settings.aiProvider || 'anthropic';

    switch (provider) {
      case 'anthropic':
        if (!settings.anthropicApiKey) { this.provider = null; return; }
        this.provider = new AnthropicProvider(
          settings.anthropicApiKey,
          settings.claudeModel || 'claude-sonnet-4-20250514',
        );
        break;

      case 'openai':
        if (!settings.openaiApiKey) { this.provider = null; return; }
        this.provider = new OpenAIProvider(
          settings.openaiApiKey,
          settings.openaiModel || 'gpt-4o',
        );
        break;

      case 'gemini':
        if (!settings.geminiApiKey) { this.provider = null; return; }
        this.provider = new GeminiProvider(
          settings.geminiApiKey,
          settings.geminiModel || 'gemini-2.0-flash',
        );
        break;

      case 'ollama':
        this.provider = new OllamaProvider(
          settings.ollamaBaseUrl || 'http://localhost:11434',
          settings.ollamaModel || 'llama3',
        );
        break;

      case 'groq':
        if (!settings.groqApiKey) { this.provider = null; return; }
        this.provider = new GroqProvider(
          settings.groqApiKey,
          settings.groqModel || 'llama-3.3-70b-versatile',
        );
        break;
    }
  }

  async translate(request: NLToSQLRequest): Promise<NLToSQLResponse> {
    if (!this.provider) {
      throw new Error('AI provider not configured. Please set your API key in Settings.');
    }
    try {
      return await this.provider.translate(request);
    } catch (err: unknown) {
      if (err instanceof SyntaxError) {
        throw new Error('Failed to parse AI response as JSON. Please try rephrasing your request.');
      }
      throw err;
    }
  }
}
