import { GEMINI_API_KEY_SOURCE, GEMINI_FAST_MODEL, GEMINI_MODEL, GEMINI_TIMEOUT_MS, HAS_GEMINI_KEY, sendJson, setCors, now } from './ironcore-shared';

export default async function handler(req: any, res: any) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  return sendJson(res, 200, {
    ok: true,
    status: 'running',
    dbOk: true,
    model: GEMINI_MODEL,
    fastModel: GEMINI_FAST_MODEL,
    hasGeminiKey: HAS_GEMINI_KEY,
    keySource: GEMINI_API_KEY_SOURCE,
    hasBraveKey: Boolean(process.env.BRAVE_SEARCH_API_KEY),
    serverless: true,
    apiMode: 'vercel-explicit-api-routes',
    dbFile: 'serverless-memory-store',
    timeoutMs: GEMINI_TIMEOUT_MS,
    routes: ['/api/health', '/api/gemini-test', '/api/extension-command', '/api/extension-context'],
    timestamp: now(),
  });
}
