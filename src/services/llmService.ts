import OpenAI from 'openai';

export interface LLMConfig {
  baseURL: string;      // e.g. 'http://localhost:8080/v1' for local Gemma, or cloud endpoint
  apiKey: string;       // 'ollama' for local, real key for cloud
  model: string;        // e.g. 'gemma-4-e2b' or 'gpt-4o'
}

const DEFAULT_CONFIG: LLMConfig = {
  baseURL: 'http://localhost:11434/v1',  // Local E2B or Ollama endpoint
  apiKey: 'ollama',
  model: 'gemma4:e2b',
};

export class LLMService {
  private client: OpenAI;
  private config: LLMConfig;

  constructor(config: Partial<LLMConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.client = new OpenAI({
      baseURL: this.config.baseURL,
      apiKey: this.config.apiKey,
      dangerouslyAllowBrowser: true,
    });
  }

  async getNextStep(screenshotBase64: string): Promise<string> {
    console.log('[LLM] sending request, image length:', screenshotBase64.length);
    const response = await this.client.chat.completions.create({
      model: this.config.model,
      messages: [
        {
          role: 'system',
          content: `You are an AI desktop assistant guiding the user to open Google Chrome and navigate to www.facebook.com.

FIRST, carefully look at the screenshot and determine the current state:
- If the browser address bar shows "facebook.com" or the page displays Facebook's logo/login screen → the task is DONE.
- If Chrome is open but Facebook is not loaded yet → instruct the user to type the URL.
- If Chrome is not open → instruct the user to open Chrome.

If the task is done, respond ONLY with: "Task complete! Facebook is now open in Chrome."
Otherwise, respond with ONE short, specific instruction for the very next action. No preamble, no explanation.`,
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${screenshotBase64}`,
              },
            },
            {
              type: 'text',
              text: 'What is the next step I should take?',
            },
          ],
        },
      ],
      max_tokens: 2048,
    });

    console.log('[LLM] raw response:', JSON.stringify(response));
    const msg = response.choices[0]?.message as { content?: string; reasoning?: string };
    return msg?.content?.trim() || msg?.reasoning?.trim() || 'Unable to determine next step.';
  }

  updateConfig(newConfig: Partial<LLMConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.client = new OpenAI({
      baseURL: this.config.baseURL,
      apiKey: this.config.apiKey,
      dangerouslyAllowBrowser: true,
    });
  }
}

export const llmService = new LLMService();
