import OpenAI from 'openai';
import { NLToSQLRequest, NLToSQLResponse, ConversationMessage } from '../../../shared/types';
import { BaseProvider } from './base';

export class OpenAIProvider extends BaseProvider {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string) {
    super();
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async translate(request: NLToSQLRequest): Promise<NLToSQLResponse> {
    const systemPrompt = this.buildSystemPrompt(request.schema, request.engine);
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
    ];

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

    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: 2048,
      messages,
      response_format: { type: 'json_object' },
    });

    const text = response.choices[0]?.message?.content || '';
    return this.parseResponse(text);
  }
}
