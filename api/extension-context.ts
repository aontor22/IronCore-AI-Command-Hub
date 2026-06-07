import { getBody, getLightStore, nextLightId, now, redactSensitive, sendJson, setCors, truncate } from './ironcore-shared';

export default async function handler(req: any, res: any) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return sendJson(res, 200, { ok: true, message: 'IronCore extension context endpoint is online. Send POST requests here.' });

  const body = await getBody(req);
  const store = getLightStore();
  const memory = {
    id: nextLightId(),
    userId: 1,
    content: `Browser context saved\nURL: ${body.pageUrl || 'unknown'}\nTitle: ${body.pageTitle || 'unknown'}\nSelected text: ${redactSensitive(body.selectedText || 'none')}\nPage snippet: ${truncate(redactSensitive(body.pageText || ''), 800)}`,
    source: 'extension',
    createdAt: now(),
  };
  store.memories.unshift(memory);
  return sendJson(res, 200, { success: true, memory, route: '/api/extension-context' });
}
