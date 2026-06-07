import { GoogleGenAI } from '@google/genai';
import { JARVIS_SYSTEM_PROMPT } from './prompts';
import * as tools from './tools';

const apiKey = process.env.GEMINI_API_KEY;
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.1-pro-preview';

export const ai = apiKey
  ? new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'jarvis-local-assistant',
        },
      },
    })
  : null;

export const availableTools = [
  {
    functionDeclarations: [
      tools.webSearchTool,
      tools.readFileTool,
      tools.summarizeFileTool,
      tools.createTaskTool,
      tools.saveMemoryTool,
      tools.retrieveMemoryTool,
      tools.draftEmailTool,
      tools.searchCalendarTool,
      tools.createCalendarEventTool,
      tools.runCodeSafelyTool,
    ],
  },
];

export type GeminiContent = {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
};

export async function generateChatResponse(history: GeminiContent[], newMessage: string) {
  if (!ai) {
    throw new Error('GEMINI_API_KEY is missing. Copy .env.example to .env and add your Gemini API key.');
  }

  const contents = [...history, { role: 'user' as const, parts: [{ text: newMessage }] }];

  return ai.models.generateContent({
    model: GEMINI_MODEL,
    contents,
    config: {
      systemInstruction: JARVIS_SYSTEM_PROMPT,
      tools: availableTools,
    },
  });
}

export async function generatePlainText(prompt: string) {
  if (!ai) {
    throw new Error('GEMINI_API_KEY is missing. Copy .env.example to .env and add your Gemini API key.');
  }

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      systemInstruction: JARVIS_SYSTEM_PROMPT,
    },
  });

  return response.text || '';
}
