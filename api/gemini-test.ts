import { callGemini, cleanGeminiError, GEMINI_FAST_MODEL, sendJson, setCors } from './ironcore-shared';

export default async function handler(req: any, res: any) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    const text = await callGemini('Reply with exactly: IronCore Gemini link is online.', { timeoutMs: 12000, compact: true, model: GEMINI_FAST_MODEL });
    return sendJson(res, 200, { ok: true, text, model: GEMINI_FAST_MODEL });
  } catch (error) {
    return sendJson(res, 200, { ok: false, error: cleanGeminiError(error), model: GEMINI_FAST_MODEL });
  }
}
