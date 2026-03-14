import Anthropic from '@anthropic-ai/sdk';
import { NLToSQLRequest, NLToSQLResponse, ConversationMessage } from '../../../shared/types';
import { BaseProvider } from './base';

export class AnthropicProvider extends BaseProvider {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model: string) {
    super();
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async translate(request: NLToSQLRequest): Promise<NLToSQLResponse> {
    const systemPrompt = this.buildSystemPrompt(request.schema, request.engine, request.isDBA);
    const messages: Anthropic.MessageParam[] = [];

    if (request.conversationHistory) {
      for (const msg of request.conversationHistory.slice(-6) as ConversationMessage[]) {
        messages.push({
          role: msg.role,
          content: msg.role === 'user'
            ? msg.content
            : `Generated SQL: ${msg.sql || 'N/A'}\n${msg.content}`,
        });
      }
    }
    messages.push({ role: 'user', content: request.naturalLanguage });

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 2048,
      system: systemPrompt,
      messages,
    });

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as Anthropic.TextBlock).text)
      .join('');

    return this.parseResponse(text);
  }
}
