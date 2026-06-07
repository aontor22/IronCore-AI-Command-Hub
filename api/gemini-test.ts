function setCors(res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function getGeminiKey() {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '';
}

function getModel() {
  return process.env.GEMINI_FAST_MODEL || process.env.GEMINI_MODEL || 'gemini-3-flash-preview';
}

async function callGeminiRest(prompt: string) {
  const apiKey = getGeminiKey();
  if (!apiKey) throw new Error('Gemini API key missing. Add GEMINI_API_KEY in Vercel Environment Variables and redeploy.');

  const model = getModel();
  const timeoutMs = Number(process.env.GEMINI_TIMEOUT_MS || 9000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 120 },
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data?.error?.message || `Gemini REST request failed with ${response.status}`;
      throw new Error(message);
    }

    return data?.candidates?.[0]?.content?.parts?.map((part: any) => part.text || '').join('').trim() || 'IronCore Gemini link is online.';
  } finally {
    clearTimeout(timer);
  }
}

function cleanError(error: any) {
  const raw = error?.name === 'AbortError' ? 'Gemini request timed out. Try again.' : String(error?.message || error || 'Request failed');
  if (/429|RESOURCE_EXHAUSTED|quota/i.test(raw)) return 'Gemini quota is currently exhausted. Wait, enable billing, or use a lighter model.';
  return raw.slice(0, 700);
}

export default async function handler(req: any, res: any) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  const model = getModel();
  try {
    const text = await callGeminiRest('Reply with exactly: IronCore Gemini link is online.');
    return res.status(200).json({ ok: true, text, model, apiMode: 'vercel-standalone-rest-api' });
  } catch (error) {
    return res.status(200).json({ ok: false, error: cleanError(error), model, apiMode: 'vercel-standalone-rest-api' });
  }
}
