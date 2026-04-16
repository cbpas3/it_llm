import { invoke } from '@tauri-apps/api/core';


class LLMService {
  async getNextStep(imageBase64: string): Promise<string> {
    console.log('[LLM] sending request, image length:', imageBase64.length);

    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    const result = await invoke<string>('get_next_step', {
      imageBase64,
      apiKey,
    });

    console.log('[LLM] response:', result);
    return result;
  }
}

export const llmService = new LLMService();
