export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const model = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';
  const fastModel = process.env.GEMINI_FAST_MODEL || model;
  const keySource = process.env.GEMINI_API_KEY
    ? 'GEMINI_API_KEY'
    : process.env.GOOGLE_API_KEY
      ? 'GOOGLE_API_KEY'
      : process.env.GOOGLE_GENERATIVE_AI_API_KEY
        ? 'GOOGLE_GENERATIVE_AI_API_KEY'
        : null;

  return res.status(200).json({
    ok: true,
    status: 'running',
    dbOk: true,
    model,
    fastModel,
    hasGeminiKey: Boolean(keySource),
    keySource,
    hasBraveKey: Boolean(process.env.BRAVE_SEARCH_API_KEY),
    serverless: true,
    apiMode: 'vercel-standalone-rest-api',
    dbFile: 'serverless-memory-store',
    routes: ['/api/health', '/api/gemini-test', '/api/extension-command', '/api/extension-context'],
    timestamp: new Date().toISOString(),
  });
}
