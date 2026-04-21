import { GoogleGenAI } from "@google/genai";
import { OpenAI } from "openai";
import { Anthropic } from "@anthropic-ai/sdk";
import { UserMemory } from "../types";

export class LLMManager {
  private geminiClient: GoogleGenAI | null;
  private openaiClient: OpenAI | null;
  private anthropicClient: Anthropic | null;

  constructor(geminiKey: string, openaiKey: string, anthropicKey: string) {
    this.geminiClient = geminiKey ? new GoogleGenAI({ apiKey: geminiKey }) : null;
    this.openaiClient = openaiKey ? new OpenAI({ apiKey: openaiKey, dangerouslyAllowBrowser: true }) : null;
    this.anthropicClient = anthropicKey ? new Anthropic({ apiKey: anthropicKey, dangerouslyAllowBrowser: true }) : null;
  }

  async generateContent(
    provider: string,
    model: string,
    history: any[],
    query: string,
    memory: UserMemory,
    systemPrompt: string
  ): Promise<string> {
    let responseText = "";

    if (provider === 'ollama') {
      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'qwen2.5-coder:7b', // Принудительно используем локальную модель
          prompt: `${systemPrompt}\nContext: ${JSON.stringify(memory)}\nHistory: ${JSON.stringify(history.slice(-5))}\nUser: ${query}\nAssistant:`,
          stream: false
        })
      });

      if (!response.ok) throw new Error(`Ollama error: ${response.statusText}`);
      const data = await response.json();
      responseText = data.response.replace(/```json\n?|\n?```/g, '').trim();
      
    } else if (provider === 'gemini' && this.geminiClient) {
        const conversationContext = history.slice(-10).map(item => ({
          role: item.role,
          parts: [{ text: item.content }]
        }));

        const fallbacks = [model, "gemini-2.5-flash-8b", "gemini-2.5-flash", "gemini-3.1-flash-lite-preview", "gemini-2.5-pro"];
        const uniqueFallbacks = [...new Set(fallbacks)];

        let success = false;
        let lastError = null;

        for (const modelToTry of uniqueFallbacks) {
          try {
            console.log(`[Gemini] Attempting to use model: ${modelToTry}`);
            const result = await this.geminiClient.models.generateContent({
              model: modelToTry,
              contents: [...conversationContext, { role: 'user', parts: [{ text: query }] }],
              config: { systemInstruction: systemPrompt + "\nIMPORTANT: Return ONLY valid JSON.", responseMimeType: "application/json" },
            });
            responseText = result.text || "";
            success = true;
            break; 
          } catch (err: any) {
            lastError = err;
            if (err?.message?.includes('429') || err?.message?.includes('RESOURCE_EXHAUSTED') || err?.status === 429) {
              console.warn(`[Gemini] Model ${modelToTry} quota exceeded, falling back to next model...`);
              continue;
            } else {
              throw err; 
            }
          }
        }
        
        if (!success && lastError) throw lastError;

    } else if (provider === 'openai' && this.openaiClient) {
        const messages: any[] = [
          { role: 'system', content: systemPrompt + "\nIMPORTANT: Return ONLY valid JSON." },
          ...history.slice(-10).map(i => ({ role: i.role === 'model' ? 'assistant' : 'user', content: i.content })),
          { role: 'user', content: query }
        ];
        const res = await this.openaiClient.chat.completions.create({ model: model, messages, response_format: { type: "json_object" } });
        responseText = res.choices[0].message.content || "";

    } else if (provider === 'anthropic' && this.anthropicClient) {
        const res = await this.anthropicClient.messages.create({
          model: model,
          system: systemPrompt + "\nIMPORTANT: Return ONLY valid JSON.",
          max_tokens: 1024,
          messages: [
            ...history.slice(-10).map(i => ({ role: i.role === 'model' ? 'assistant' : 'user', content: i.content })),
            { role: 'user', content: query }
          ] as any
        });
        responseText = (res.content[0] as any).text || "";
    } else {
        throw new Error("Provider client not initialized or invalid provider");
    }

    return responseText;
  }
}
