type StoreItem = Record<string, any>;

type IronCoreStore = {
  nextId: number;
  chatHistory: StoreItem[];
  tasks: StoreItem[];
  memories: StoreItem[];
  files: StoreItem[];
  pendingActions: StoreItem[];
};

declare global {
  var __IRONCORE_VERCEL_STORE__: IronCoreStore | undefined;
}

function setCors(res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function store(): IronCoreStore {
  if (!globalThis.__IRONCORE_VERCEL_STORE__) {
    globalThis.__IRONCORE_VERCEL_STORE__ = {
      nextId: 1,
      chatHistory: [],
      tasks: [],
      memories: [],
      files: [],
      pendingActions: [],
    };
  }
  return globalThis.__IRONCORE_VERCEL_STORE__;
}

function nextId() {
  const s = store();
  const id = s.nextId;
  s.nextId += 1;
  return id;
}

function now() {
  return new Date().toISOString();
}

async function readBody(req: any) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }

  const chunks: Buffer[] = [];
  try {
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
  } catch {
    return {};
  }
  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString('utf8');
  try { return JSON.parse(raw); } catch { return {}; }
}

function cleanPath(req: any) {
  const queryPath = req.query?.path;
  let value = Array.isArray(queryPath) ? queryPath.join('/') : String(queryPath || '');

  if (!value) {
    const url = String(req.url || '');
    value = url.replace(/^\/api\/?/i, '').split('?')[0];
  }

  try { value = decodeURIComponent(value); } catch {}
  return value
    .replace(/^\/+|\/+$/g, '')
    .replace(/["']/g, '')
    .replace(/%22/gi, '')
    .trim();
}

function geminiKey() {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '';
}

function primaryModel() {
  return process.env.GEMINI_MODEL || 'gemini-3-flash-preview';
}

function fastModel() {
  return process.env.GEMINI_FAST_MODEL || primaryModel();
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
  const raw = error?.name === 'AbortError'
    ? 'The AI request timed out. Try a shorter command or use a faster Gemini model.'
    : String(error?.message || error || 'Request failed');
  if (/429|RESOURCE_EXHAUSTED|quota/i.test(raw)) return 'Gemini quota is currently exhausted. Wait, enable billing, or switch to a lighter model in Vercel env.';
  if (/API key|key missing|GEMINI_API_KEY/i.test(raw)) return 'Gemini API key is missing. Add GEMINI_API_KEY in Vercel Environment Variables and redeploy.';
  return raw.slice(0, 700);
}

async function callGemini(prompt: string, useFast = false) {
  const apiKey = geminiKey();
  if (!apiKey) throw new Error('Gemini API key missing');

  const selectedModel = useFast ? fastModel() : primaryModel();
  const timeoutMs = Math.min(Number(process.env.GEMINI_TIMEOUT_MS || 9000), 9000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(selectedModel)}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: 'You are IronCore, a concise, safe and practical AI operating assistant. Help with productivity, coding, writing, tasks, memory and browser context. If the user asks to open websites or perform browser actions, explain what can be done from the web app and suggest using the Chrome extension when needed.' }],
        },
        contents: [{ parts: [{ text: truncate(redact(prompt), 7000) }] }],
        generationConfig: { temperature: 0.35, maxOutputTokens: 850 },
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data?.error?.message || `Gemini request failed with ${response.status}`;
      if (!useFast && /429|RESOURCE_EXHAUSTED|quota/i.test(message) && fastModel() !== selectedModel) {
        return callGemini(prompt, true);
      }
      throw new Error(message);
    }

    return data?.candidates?.[0]?.content?.parts?.map((part: any) => part.text || '').join('').trim() || 'I processed the command, but Gemini returned an empty response.';
  } finally {
    clearTimeout(timer);
  }
}

function send(res: any, status: number, payload: any) {
  setCors(res);
  return res.status(status).json(payload);
}

function healthPayload() {
  const keySource = process.env.GEMINI_API_KEY
    ? 'GEMINI_API_KEY'
    : process.env.GOOGLE_API_KEY
      ? 'GOOGLE_API_KEY'
      : process.env.GOOGLE_GENERATIVE_AI_API_KEY
        ? 'GOOGLE_GENERATIVE_AI_API_KEY'
        : null;

  return {
    ok: true,
    status: 'running',
    dbOk: true,
    model: primaryModel(),
    fastModel: fastModel(),
    hasGeminiKey: Boolean(keySource),
    keySource,
    hasBraveKey: Boolean(process.env.BRAVE_SEARCH_API_KEY),
    serverless: true,
    apiMode: 'vercel-standalone-rest-api',
    dbFile: 'serverless-memory-store',
    routes: [
      '/api/health',
      '/api/gemini-test',
      '/api/chat',
      '/api/chat-history',
      '/api/tasks',
      '/api/memories',
      '/api/files',
      '/api/actions',
      '/api/extension-command',
      '/api/extension-context',
    ],
    timestamp: now(),
  };
}

async function handleChat(req: any, res: any) {
  const body = await readBody(req);
  const message = String(body.message || body.userCommand || '').trim();
  if (!message) return send(res, 400, { ok: false, error: 'Message is required' });

  const s = store();
  const userMessage = { id: nextId(), role: 'user', content: message, createdAt: now() };
  s.chatHistory.push(userMessage);

  let text = '';
  const lower = message.toLowerCase();

  if (lower.startsWith('create a task') || lower.startsWith('add task') || lower.includes('create task')) {
    const title = message.replace(/^(create a task to|create task to|add task to|create a task|create task|add task)/i, '').trim() || message;
    const task = { id: nextId(), userId: 1, title, description: null, dueDate: null, status: 'pending', priority: 'medium', category: 'personal', createdAt: now() };
    s.tasks.unshift(task);
    text = `Task created: ${title}`;
  } else if (lower.startsWith('save memory') || lower.includes('remember that')) {
    const content = message.replace(/^save memory that/i, '').replace(/^save memory/i, '').replace(/^remember that/i, '').trim() || message;
    const memory = { id: nextId(), userId: 1, content, source: 'chat', createdAt: now() };
    s.memories.unshift(memory);
    text = `Memory saved: ${content}`;
  } else {
    const recent = s.chatHistory.slice(-8).map((m) => `${m.role}: ${m.content}`).join('\n');
    text = await callGemini(`Recent conversation:\n${recent}\n\nUser: ${message}\n\nRespond clearly and helpfully.`);
  }

  const assistantMessage = { id: nextId(), role: 'assistant', content: text, createdAt: now() };
  s.chatHistory.push(assistantMessage);
  return send(res, 200, { ok: true, success: true, text, message: assistantMessage, pendingActions: [] });
}

async function handleTasks(req: any, res: any, path: string) {
  const s = store();
  const idMatch = path.match(/^tasks\/(\d+)/);

  if (req.method === 'GET') return send(res, 200, s.tasks);

  if (req.method === 'POST' && path === 'tasks') {
    const body = await readBody(req);
    const title = String(body.title || '').trim();
    if (!title) return send(res, 400, { ok: false, error: 'Title is required' });
    const task = {
      id: nextId(),
      userId: 1,
      title,
      description: body.description || null,
      dueDate: body.dueDate || null,
      status: 'pending',
      priority: ['high', 'medium', 'low'].includes(String(body.priority || '').toLowerCase()) ? String(body.priority).toLowerCase() : 'medium',
      category: body.category || 'personal',
      createdAt: now(),
    };
    s.tasks.unshift(task);
    return send(res, 200, { ok: true, success: true, task });
  }

  if (idMatch) {
    const id = Number(idMatch[1]);
    const index = s.tasks.findIndex((task) => task.id === id);
    if (index < 0) return send(res, 404, { ok: false, error: 'Task not found' });

    if (req.method === 'PATCH') {
      const body = await readBody(req);
      s.tasks[index] = { ...s.tasks[index], ...body };
      return send(res, 200, { ok: true, success: true, task: s.tasks[index] });
    }
    if (req.method === 'DELETE') {
      s.tasks.splice(index, 1);
      return send(res, 200, { ok: true, success: true });
    }
  }

  return send(res, 405, { ok: false, error: 'Unsupported task route' });
}

async function handleMemories(req: any, res: any, path: string) {
  const s = store();
  const idMatch = path.match(/^memories\/(\d+)/);

  if (req.method === 'GET') {
    const q = String(req.query?.q || '').toLowerCase().trim();
    const rows = q ? s.memories.filter((m) => String(m.content || '').toLowerCase().includes(q)) : s.memories;
    return send(res, 200, rows);
  }

  if (req.method === 'POST' && path === 'memories') {
    const body = await readBody(req);
    const content = String(body.content || '').trim();
    if (!content) return send(res, 400, { ok: false, error: 'Content is required' });
    const memory = { id: nextId(), userId: 1, content, source: body.source || 'manual', createdAt: now() };
    s.memories.unshift(memory);
    return send(res, 200, { ok: true, success: true, memory });
  }

  if (req.method === 'DELETE' && idMatch) {
    const id = Number(idMatch[1]);
    const index = s.memories.findIndex((memory) => memory.id === id);
    if (index >= 0) s.memories.splice(index, 1);
    return send(res, 200, { ok: true, success: true });
  }

  return send(res, 405, { ok: false, error: 'Unsupported memory route' });
}

async function handleFiles(req: any, res: any, path: string) {
  const s = store();

  if (req.method === 'GET' && path === 'files') {
    return send(res, 200, s.files.map(({ content, ...file }) => file));
  }

  if (req.method === 'POST' && path === 'upload') {
    const body = await readBody(req);
    if (!body.name || typeof body.content !== 'string') return send(res, 400, { ok: false, error: 'name and text content are required' });
    const file = { id: nextId(), userId: 1, name: String(body.name), mimeType: body.mimeType || 'text/plain', content: truncate(body.content, 200000), summary: null, createdAt: now() };
    s.files.unshift(file);
    return send(res, 200, { ok: true, success: true, file });
  }

  if (req.method === 'POST' && path === 'summarize-file') {
    const body = await readBody(req);
    const id = Number(body.id);
    const file = s.files.find((item) => item.id === id);
    if (!file) return send(res, 404, { ok: false, error: 'File not found' });
    const summary = await callGemini(`Summarize this uploaded file clearly. Include overview, key points and next action.\n\nFile: ${file.name}\n\nContent:\n${truncate(file.content, 7000)}`, true);
    file.summary = summary;
    return send(res, 200, { ok: true, success: true, summary });
  }

  return send(res, 405, { ok: false, error: 'Unsupported file route' });
}

async function handleExtension(req: any, res: any, path: string) {
  if (path === 'extension-context' || path === 'extension/context') {
    if (req.method !== 'POST') return send(res, 200, { ok: true, success: true, message: 'IronCore extension context endpoint online. Send POST requests here.', route: '/api/extension-context', timestamp: now() });
    const body = await readBody(req);
    const content = `Browser context saved\nURL: ${truncate(redact(body.pageUrl), 300) || 'unknown'}\nTitle: ${truncate(redact(body.pageTitle), 180) || 'unknown'}\nSelected text: ${truncate(redact(body.selectedText), 800) || 'none'}\nPage snippet: ${truncate(redact(body.pageText), 1000)}`;
    const memory = { id: nextId(), userId: 1, content, source: 'extension', createdAt: now() };
    store().memories.unshift(memory);
    return send(res, 200, { ok: true, success: true, memory, route: '/api/extension-context', timestamp: now() });
  }

  if (path === 'extension-command' || path === 'extension/command') {
    if (req.method !== 'POST') return send(res, 200, { ok: true, message: 'IronCore extension command endpoint online. Send POST requests here.', route: '/api/extension-command' });
    const body = await readBody(req);
    const userCommand = redact(body.userCommand || body.command || '').trim();
    if (!userCommand) return send(res, 400, { ok: false, success: false, error: 'userCommand is required' });
    const pageUrl = truncate(redact(body.pageUrl), 300);
    const pageTitle = truncate(redact(body.pageTitle), 180);
    const selectedText = truncate(redact(body.selectedText), 800);
    const pageText = truncate(redact(body.pageText), 1200);
    const prompt = `Browser context:\nTitle: ${pageTitle || 'Unknown'}\nURL: ${pageUrl || 'Unknown'}\nSelected text: ${selectedText || 'None'}\nPage text: ${pageText || 'No page text available'}\n\nUser command: ${userCommand}\n\nAnswer clearly and briefly.`;
    try {
      const text = await callGemini(prompt, true);
      return send(res, 200, { ok: true, success: true, text, model: fastModel(), route: '/api/extension-command' });
    } catch (error) {
      return send(res, 200, { ok: false, success: false, text: cleanError(error), error: cleanError(error), model: fastModel(), route: '/api/extension-command' });
    }
  }

  return null;
}

export default async function handler(req: any, res: any) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  const path = cleanPath(req);

  try {
    if (!path || path === 'health') return send(res, 200, healthPayload());

    if (path === 'gemini-test') {
      try {
        const text = await callGemini('Reply with exactly: IronCore Gemini link is online.', true);
        return send(res, 200, { ok: true, text, model: fastModel(), apiMode: 'vercel-standalone-rest-api' });
      } catch (error) {
        return send(res, 200, { ok: false, error: cleanError(error), model: fastModel(), apiMode: 'vercel-standalone-rest-api' });
      }
    }

    const extensionResult = await handleExtension(req, res, path);
    if (extensionResult) return extensionResult;

    if (path === 'chat' && req.method === 'POST') return handleChat(req, res);
    if (path === 'chat-history' && req.method === 'GET') return send(res, 200, store().chatHistory.slice(-80));
    if (path === 'chat-history/clear' && req.method === 'DELETE') {
      store().chatHistory = [];
      return send(res, 200, { ok: true, success: true });
    }

    if (path === 'actions' && req.method === 'GET') return send(res, 200, store().pendingActions);
    if (path.match(/^actions\/\d+\/(confirm|cancel)$/) && req.method === 'POST') return send(res, 200, { ok: true, success: true, message: 'Action updated locally. External sending/booking is intentionally disabled in this safe build.' });

    if (path === 'tasks' || path.startsWith('tasks/')) return handleTasks(req, res, path);
    if (path === 'memories' || path.startsWith('memories/')) return handleMemories(req, res, path);
    if (path === 'files' || path === 'upload' || path === 'summarize-file') return handleFiles(req, res, path);

    return send(res, 404, {
      ok: false,
      error: 'Route not found. Use /api/health, /api/gemini-test, /api/chat, /api/extension-command, or /api/extension-context.',
      path,
    });
  } catch (error) {
    return send(res, 200, { ok: false, error: cleanError(error), path, apiMode: 'vercel-standalone-rest-api' });
  }
}
