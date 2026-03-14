import { GoogleGenerativeAI } from '@google/generative-ai';
import { NLToSQLRequest, NLToSQLResponse, ConversationMessage } from '../../../shared/types';
import { BaseProvider } from './base';

export class GeminiProvider extends BaseProvider {
  private client: GoogleGenerativeAI;
  private model: string;

  constructor(apiKey: string, model: string) {
    super();
    this.client = new GoogleGenerativeAI(apiKey);
    this.model = model;
  }

  async translate(request: NLToSQLRequest): Promise<NLToSQLResponse> {
    const systemPrompt = this.buildSystemPrompt(request.schema, request.engine);
    const genModel = this.client.getGenerativeModel({
      model: this.model,
      systemInstruction: systemPrompt,
      generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 2048 },
    });

    // Build history for multi-turn conversation
    const history: { role: string; parts: { text: string }[] }[] = [];
    if (request.conversationHistory) {
      for (const msg of request.conversationHistory.slice(-6) as ConversationMessage[]) {
        history.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{
            text: msg.role === 'user'
              ? msg.content
              : `Generated SQL: ${msg.sql || 'N/A'}\n${msg.content}`,
          }],
        });
      }
    }

    const chat = genModel.startChat({ history });
    const result = await chat.sendMessage(request.naturalLanguage);
    const text = result.response.text();
    return this.parseResponse(text);
  }
}
