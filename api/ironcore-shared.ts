import { GoogleGenAI } from '@google/genai';

export const GEMINI_KEY_CANDIDATES = [
  ['GEMINI_API_KEY', process.env.GEMINI_API_KEY],
  ['GOOGLE_API_KEY', process.env.GOOGLE_API_KEY],
  ['GOOGLE_GENERATIVE_AI_API_KEY', process.env.GOOGLE_GENERATIVE_AI_API_KEY],
] as const;

export const selectedKey = GEMINI_KEY_CANDIDATES.find(([, value]) => Boolean(value?.trim()));
export const GEMINI_API_KEY_SOURCE = selectedKey?.[0] || null;
export const HAS_GEMINI_KEY = Boolean(selectedKey?.[1]);
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';
export const GEMINI_FAST_MODEL = process.env.GEMINI_FAST_MODEL || process.env.GEMINI_MODEL || 'gemini-3-flash-preview';
export const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 22000);
export const EXTENSION_TIMEOUT_MS = Number(process.env.EXTENSION_TIMEOUT_MS || 18000);

export const SYSTEM_PROMPT = `You are IronCore, a safe futuristic personal AI operating assistant. Be concise, practical, and accurate. Help with productivity, research, code, writing, tasks, memory, and browser context. Do not claim to perform external actions unless a tool/backend confirms it. Sensitive actions must remain drafts or pending confirmation.`;

type Memory = {
  id: number;
  userId: number;
  content: string;
  source: string;
  createdAt: string;
};

type Store = {
  nextId: number;
  memories: Memory[];
};

declare global {
  // eslint-disable-next-line no-var
  var __IRONCORE_LIGHT_STORE__: Store | undefined;
}

export function getLightStore(): Store {
  if (!globalThis.__IRONCORE_LIGHT_STORE__) {
    globalThis.__IRONCORE_LIGHT_STORE__ = { nextId: 1, memories: [] };
  }
  return globalThis.__IRONCORE_LIGHT_STORE__;
}

export function nextLightId() {
  const store = getLightStore();
  const id = store.nextId;
  store.nextId += 1;
  return id;
}

export function now() {
  return new Date().toISOString();
}

export function setCors(res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export function sendJson(res: any, status: number, payload: any) {
  setCors(res);
  return res.status(status).json(payload);
}

export async function getBody(req: any) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString('utf8');
  try { return JSON.parse(raw); } catch { return {}; }
}

export function truncate(input = '', max = 4500) {
  const text = String(input || '');
  return text.length > max ? `${text.slice(0, max)}\n\n[Truncated ${text.length - max} characters]` : text;
}

export function redactSensitive(input = '') {
  return String(input || '')
    .replace(/AIza[0-9A-Za-z\-_]{20,}/g, '[REDACTED_GOOGLE_API_KEY]')
    .replace(/sk-[0-9A-Za-z\-_]{20,}/g, '[REDACTED_SECRET_KEY]')
    .replace(/(api[_-]?key|token|secret|password)\s*[:=]\s*['\"]?[^\s'\"]+/gi, '$1=[REDACTED]');
}

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)}s. Try a shorter page context or use a faster Gemini model.`)), timeoutMs);
    }),
  ]);
}

export function cleanGeminiError(error: any) {
  const raw = error?.message || String(error || 'Gemini request failed');
  if (/429|RESOURCE_EXHAUSTED|quota/i.test(raw)) {
    return 'Gemini quota is currently exhausted. Please wait, switch to a lighter model, or enable billing in Google AI Studio.';
  }
  if (/API key|GEMINI_API_KEY|key is missing/i.test(raw)) {
    return 'Gemini API key is missing. Add GEMINI_API_KEY in Vercel Environment Variables and redeploy.';
  }
  return raw.length > 500 ? `${raw.slice(0, 500)}...` : raw;
}

export async function callGemini(prompt: string, options: { timeoutMs?: number; model?: string; compact?: boolean } = {}) {
  if (!selectedKey?.[1]) {
    throw new Error('Gemini API key is missing. Add GEMINI_API_KEY in Vercel Project Settings → Environment Variables, then redeploy.');
  }

  const model = options.model || GEMINI_FAST_MODEL;
  const safePrompt = truncate(redactSensitive(prompt), options.compact ? 4500 : 9000);
  const ai = new GoogleGenAI({ apiKey: selectedKey[1] });
  const run = ai.models.generateContent({
    model,
    contents: [{ role: 'user', parts: [{ text: safePrompt }] }],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      temperature: 0.35,
      maxOutputTokens: options.compact ? 650 : 1100,
    },
  });

  const response: any = await withTimeout<any>(run as Promise<any>, options.timeoutMs || GEMINI_TIMEOUT_MS, `Gemini model ${model}`);
  return response.text || 'I processed the command, but the model returned an empty response.';
}
