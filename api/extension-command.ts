import { callGemini, cleanGeminiError, EXTENSION_TIMEOUT_MS, GEMINI_FAST_MODEL, getBody, redactSensitive, sendJson, setCors, truncate } from './ironcore-shared';

export default async function handler(req: any, res: any) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return sendJson(res, 200, { ok: true, message: 'IronCore extension command endpoint is online. Send POST requests here.' });

  const body = await getBody(req);
  const userCommand = String(body.userCommand || '').trim();
  if (!userCommand) return sendJson(res, 400, { success: false, error: 'userCommand is required' });

  const safeSelected = truncate(redactSensitive(body.selectedText || ''), 900);
  const safePage = truncate(redactSensitive(body.pageText || ''), 1600);
  const prompt = `[Browser Context]\nURL: ${body.pageUrl || 'unknown'}\nTitle: ${body.pageTitle || 'unknown'}\nSelected Text: ${safeSelected || 'none'}\nPage Text: ${safePage || 'No readable page text supplied.'}\n\nUser Command: ${redactSensitive(userCommand)}\n\nAnswer in a concise, useful format. If the page is a Chrome internal page or the context is limited, say so and still help with the available title/URL.`;

  try {
    const text = await callGemini(prompt, { timeoutMs: EXTENSION_TIMEOUT_MS, compact: true, model: GEMINI_FAST_MODEL });
    return sendJson(res, 200, { success: true, text, model: GEMINI_FAST_MODEL, route: '/api/extension-command' });
  } catch (error: any) {
    return sendJson(res, 200, {
      success: true,
      timeout: /timed out/i.test(error?.message || ''),
      text: cleanGeminiError(error),
      model: GEMINI_FAST_MODEL,
      route: '/api/extension-command',
    });
  }
}
