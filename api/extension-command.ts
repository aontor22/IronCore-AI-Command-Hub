function setCors(res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

async function readBody(req: any) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString('utf8');
  try { return JSON.parse(raw); } catch { return {}; }
}

function key() {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '';
}

function model() {
  return process.env.GEMINI_FAST_MODEL || process.env.GEMINI_MODEL || 'gemini-3-flash-preview';
}

function truncate(value: any, max: number) {
  const text = String(value || '');
  return text.length > max ? `${text.slice(0, max)}\n\n[Context truncated]` : text;
}

function redact(value: any) {
  return String(value || '')
    .replace(/AIza[0-9A-Za-z\-_]{20,}/g, '[REDACTED_GOOGLE_API_KEY]')
    .replace(/sk-[0-9A-Za-z\-_]{20,}/g, '[REDACTED_SECRET_KEY]')
    .replace(/(api[_-]?key|token|secret|password)\s*[:=]\s*['"]?[^\s'"]+/gi, '$1=[REDACTED]');
}

function cleanError(error: any) {
  const raw = error?.name === 'AbortError' ? 'The AI request timed out. Try a shorter command or refresh the page.' : String(error?.message || error || 'Request failed');
  if (/429|RESOURCE_EXHAUSTED|quota/i.test(raw)) return 'Gemini quota is currently exhausted. Wait, enable billing, or switch to a lighter model in Vercel env.';
  if (/API key|key missing/i.test(raw)) return 'Gemini API key is missing. Add GEMINI_API_KEY in Vercel Environment Variables and redeploy.';
  return raw.slice(0, 700);
}

async function askGemini(prompt: string) {
  const apiKey = key();
  if (!apiKey) throw new Error('Gemini API key missing');
  const selectedModel = model();
  const timeoutMs = Math.min(Number(process.env.EXTENSION_TIMEOUT_MS || 9000), 9000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(selectedModel)}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: 'You are IronCore, a concise and safe browser AI companion. Help with the current page using the provided context. Do not expose secrets. Keep answers practical.' }],
        },
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.35, maxOutputTokens: 650 },
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error?.message || `Gemini request failed with ${response.status}`);
    return data?.candidates?.[0]?.content?.parts?.map((part: any) => part.text || '').join('').trim() || 'I processed the page, but Gemini returned an empty response.';
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req: any, res: any) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    return res.status(200).json({ ok: true, message: 'IronCore extension command endpoint online. Send POST requests here.', route: '/api/extension-command' });
  }

  try {
    const body = await readBody(req);
    const userCommand = redact(body.userCommand || body.command || '').trim();
    if (!userCommand) return res.status(400).json({ success: false, error: 'userCommand is required' });

    const pageUrl = truncate(redact(body.pageUrl), 300);
    const pageTitle = truncate(redact(body.pageTitle), 180);
    const selectedText = truncate(redact(body.selectedText), 800);
    const pageText = truncate(redact(body.pageText), 1200);
    const prompt = `Browser context:\nTitle: ${pageTitle || 'Unknown'}\nURL: ${pageUrl || 'Unknown'}\nSelected text: ${selectedText || 'None'}\nPage text: ${pageText || 'No page text available'}\n\nUser command: ${userCommand}\n\nAnswer clearly and briefly.`;

    const text = await askGemini(prompt);
    return res.status(200).json({ success: true, ok: true, text, model: model(), route: '/api/extension-command' });
  } catch (error) {
    return res.status(200).json({ success: false, ok: false, text: cleanError(error), error: cleanError(error), model: model(), route: '/api/extension-command' });
  }
}
