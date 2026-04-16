import { invoke } from '@tauri-apps/api/core';

const SYSTEM_PROMPT = `You are an AI desktop assistant guiding the user to open Google Chrome and navigate to www.facebook.com.

FIRST, carefully look at the screenshot and determine the current state:
- If the browser address bar shows "facebook.com" or the page displays Facebook's logo/login screen → the task is DONE.
- If Chrome is open but Facebook is not loaded yet → instruct the user to type the URL.
- If Chrome is not open → instruct the user to open Chrome.

If the task is done, respond ONLY with: "Task complete! Facebook is now open in Chrome."
Otherwise, respond with ONE short, specific instruction for the very next action. No preamble, no explanation.`;

class LLMService {
  async getNextStep(imageBase64: string): Promise<string> {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    console.log('[LLM] sending request, image length:', imageBase64.length);

    const result = await invoke<string>('get_next_step', {
      imageBase64,
      systemPrompt: SYSTEM_PROMPT,
      apiKey,
    });

    console.log('[LLM] response:', result);
    return result;
  }
}

export const llmService = new LLMService();
