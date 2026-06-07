import { GoogleGenAI } from '@google/genai';
import { JARVIS_SYSTEM_PROMPT } from './prompts';
import * as tools from './tools';

const keyCandidates = [
  ['GEMINI_API_KEY', process.env.GEMINI_API_KEY],
  ['GOOGLE_API_KEY', process.env.GOOGLE_API_KEY],
  ['GOOGLE_GENERATIVE_AI_API_KEY', process.env.GOOGLE_GENERATIVE_AI_API_KEY],
] as const;

const selectedKey = keyCandidates.find(([, value]) => Boolean(value?.trim()));
export const GEMINI_API_KEY_SOURCE = selectedKey?.[0] || null;
export const HAS_GEMINI_KEY = Boolean(selectedKey?.[1]);
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.1-pro-preview';

export const ai = selectedKey?.[1]
  ? new GoogleGenAI({
      apiKey: selectedKey[1] as string,
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
    throw new Error('Gemini API key is missing. Add GEMINI_API_KEY in your local .env or in Vercel Project Settings → Environment Variables, then redeploy.');
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
    throw new Error('Gemini API key is missing. Add GEMINI_API_KEY in your local .env or in Vercel Project Settings → Environment Variables, then redeploy.');
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
