export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  return res.status(404).json({
    ok: false,
    error: 'Route not found. Use /api/health, /api/gemini-test, /api/extension-command, or /api/extension-context.',
    path: req.url,
  });
}
