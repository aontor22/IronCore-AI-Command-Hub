function setCors(res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(req: any, res: any) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  return res.status(200).json({
    ok: true,
    success: true,
    message: req.method === 'POST' ? 'Extension context received.' : 'IronCore extension context endpoint online. Send POST requests here.',
    route: '/api/extension-context',
    timestamp: new Date().toISOString(),
  });
}
