import { GoogleGenAI } from '@google/genai';

const GEMINI_KEY_CANDIDATES = [
  ['GEMINI_API_KEY', process.env.GEMINI_API_KEY],
  ['GOOGLE_API_KEY', process.env.GOOGLE_API_KEY],
  ['GOOGLE_GENERATIVE_AI_API_KEY', process.env.GOOGLE_GENERATIVE_AI_API_KEY],
] as const;

const selectedKey = GEMINI_KEY_CANDIDATES.find(([, value]) => Boolean(value?.trim()));
const GEMINI_API_KEY_SOURCE = selectedKey?.[0] || null;
const HAS_GEMINI_KEY = Boolean(selectedKey?.[1]);
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.1-pro-preview';
const MAX_CONTEXT_CHARS = 12000;

const SYSTEM_PROMPT = `You are IronCore, a safe futuristic personal AI operating assistant. Be concise, practical, and accurate. Help with productivity, research, code, writing, tasks, memory, and browser context. Do not claim to perform external actions unless a tool/backend confirms it. Sensitive actions must remain drafts or pending confirmation.`;

type Task = {
  id: number;
  userId: number;
  title: string;
  description: string | null;
  status: 'pending' | 'completed';
  priority: 'high' | 'medium' | 'low';
  category: string;
  dueDate: string | null;
  createdAt: string;
};

type Memory = {
  id: number;
  userId: number;
  content: string;
  source: string;
  createdAt: string;
};

type ChatMessage = {
  id: number;
  userId: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
};

type UploadedFile = {
  id: number;
  userId: number;
  name: string;
  mimeType: string;
  content: string;
  summary: string | null;
  createdAt: string;
};

type PendingAction = {
  id: number;
  userId: number;
  type: string;
  payload: any;
  status: 'pending' | 'confirmed' | 'cancelled';
  createdAt: string;
};

type Store = {
  nextId: number;
  tasks: Task[];
  memories: Memory[];
  chatHistory: ChatMessage[];
  files: UploadedFile[];
  pendingActions: PendingAction[];
};

declare global {
  // eslint-disable-next-line no-var
  var __IRONCORE_STORE__: Store | undefined;
}

function getStore(): Store {
  if (!globalThis.__IRONCORE_STORE__) {
    globalThis.__IRONCORE_STORE__ = {
      nextId: 1,
      tasks: [],
      memories: [],
      chatHistory: [],
      files: [],
      pendingActions: [],
    };
  }
  return globalThis.__IRONCORE_STORE__;
}

function nextId() {
  const store = getStore();
  const id = store.nextId;
  store.nextId += 1;
  return id;
}

function now() {
  return new Date().toISOString();
}

function truncate(input = '', max = MAX_CONTEXT_CHARS) {
  return input.length > max ? `${input.slice(0, max)}\n\n[Truncated ${input.length - max} characters]` : input;
}

function sanitizePriority(priority?: string): 'high' | 'medium' | 'low' {
  const value = priority?.toString().toLowerCase();
  return value === 'high' || value === 'low' ? value : 'medium';
}

function sanitizeCategory(category?: string) {
  const value = category?.toString().toLowerCase() || 'personal';
  return ['personal', 'work', 'shopping', 'study', 'project'].includes(value) ? value : 'personal';
}

function setCors(res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function sendJson(res: any, status: number, payload: any) {
  setCors(res);
  res.status(status).json(payload);
}

function getRoutePath(req: any) {
  const raw = req.query?.path;
  if (Array.isArray(raw)) return `/${raw.join('/')}`;
  if (typeof raw === 'string') return `/${raw}`;
  const url = new URL(req.url || '/', 'https://ironcore.local');
  return url.pathname.replace(/^\/api/, '') || '/';
}

async function getBody(req: any) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString('utf8');
  try { return JSON.parse(raw); } catch { return {}; }
}

async function callGemini(prompt: string) {
  if (!selectedKey?.[1]) {
    throw new Error('Gemini API key is missing. Add GEMINI_API_KEY in Vercel Project Settings → Environment Variables, then redeploy.');
  }

  const ai = new GoogleGenAI({ apiKey: selectedKey[1] });
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { systemInstruction: SYSTEM_PROMPT },
  });

  return response.text || 'I processed the command, but the model returned an empty response.';
}

async function runWebSearch(query: string) {
  if (!process.env.BRAVE_SEARCH_API_KEY) {
    return `Live web search is not configured. Add BRAVE_SEARCH_API_KEY only if you need live search. Requested query: ${query}`;
  }

  const response = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`, {
    headers: {
      Accept: 'application/json',
      'X-Subscription-Token': process.env.BRAVE_SEARCH_API_KEY,
    },
  });

  if (!response.ok) return `Web search failed with status ${response.status}.`;
  const data = await response.json() as any;
  const results = data?.web?.results || [];
  if (!results.length) return `No results found for: ${query}`;
  return results.slice(0, 5).map((item: any, index: number) => `${index + 1}. ${item.title}\n${item.url}\n${item.description || ''}`).join('\n\n');
}

async function summarizeText(name: string, content: string) {
  return callGemini(`Summarize this file clearly. Include: overview, key points, and next actions.\n\nFile: ${name}\n\n${truncate(content, 10000)}`);
}

async function handleChat(body: any) {
  const store = getStore();
  const message = String(body.message || '').trim();
  if (!message) return { status: 400, payload: { error: 'Message is required' } };

  store.chatHistory.push({ id: nextId(), userId: 1, role: 'user', content: message, createdAt: now() });

  const lower = message.toLowerCase();
  const toolNotes: string[] = [];
  const pendingActions: PendingAction[] = [];

  const createTaskMatch = lower.match(/(?:create|add)\s+(?:a\s+)?(?:high|medium|low)?\s*(?:priority\s+)?task\s+(?:to\s+)?(.+)/i);
  if (createTaskMatch?.[1]) {
    const priority = lower.includes('high priority') ? 'high' : lower.includes('low priority') ? 'low' : 'medium';
    const task: Task = {
      id: nextId(),
      userId: 1,
      title: createTaskMatch[1].replace(/tomorrow$/i, '').trim() || 'New task',
      description: message,
      status: 'pending',
      priority,
      category: 'project',
      dueDate: lower.includes('tomorrow') ? new Date(Date.now() + 86400000).toISOString() : null,
      createdAt: now(),
    };
    store.tasks.unshift(task);
    toolNotes.push(`Task created: ${task.title}`);
  }

  const saveMemoryMatch = message.match(/save memory(?: that)?\s+(.+)/i);
  if (saveMemoryMatch?.[1]) {
    const memory: Memory = { id: nextId(), userId: 1, content: saveMemoryMatch[1].trim(), source: 'assistant', createdAt: now() };
    store.memories.unshift(memory);
    toolNotes.push(`Memory saved: ${memory.content}`);
  }

  if (lower.includes('draft an email') || lower.includes('create calendar event')) {
    const action: PendingAction = {
      id: nextId(),
      userId: 1,
      type: lower.includes('calendar') ? 'create_calendar_event' : 'draft_email',
      payload: { request: message },
      status: 'pending',
      createdAt: now(),
    };
    store.pendingActions.unshift(action);
    pendingActions.push(action);
    toolNotes.push(`${action.type === 'draft_email' ? 'Email draft' : 'Calendar event draft'} prepared and waiting for confirmation.`);
  }

  let responseText = '';
  if (lower.startsWith('search ') || lower.includes('web search')) {
    responseText = await runWebSearch(message.replace(/^search\s+/i, '').replace(/web search/gi, '').trim() || message);
  } else {
    const memoryContext = store.memories.slice(0, 8).map((m) => `- ${m.content}`).join('\n') || 'No saved memories yet.';
    const taskContext = store.tasks.slice(0, 8).map((t) => `- ${t.title} [${t.status}]`).join('\n') || 'No active tasks yet.';
    responseText = await callGemini(`Saved memories:\n${memoryContext}\n\nCurrent tasks:\n${taskContext}\n\nUser command:\n${message}`);
  }

  if (toolNotes.length) responseText = `${responseText}\n\n${toolNotes.map((note) => `▸ ${note}`).join('\n')}`;
  store.chatHistory.push({ id: nextId(), userId: 1, role: 'assistant', content: responseText, createdAt: now() });
  return { status: 200, payload: { text: responseText, pendingActions } };
}

export default async function handler(req: any, res: any) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const store = getStore();
    const routePath = getRoutePath(req);
    const method = String(req.method || 'GET').toUpperCase();
    const body = method === 'GET' ? {} : await getBody(req);

    if (method === 'GET' && (routePath === '/' || routePath === '/health')) {
      return sendJson(res, 200, {
        ok: true,
        status: 'running',
        dbOk: true,
        model: GEMINI_MODEL,
        hasGeminiKey: HAS_GEMINI_KEY,
        keySource: GEMINI_API_KEY_SOURCE,
        hasBraveKey: Boolean(process.env.BRAVE_SEARCH_API_KEY),
        serverless: true,
        apiMode: 'vercel-serverless-memory',
        dbFile: 'serverless-memory-store',
        timestamp: now(),
      });
    }

    if (routePath === '/chat' && method === 'POST') {
      const result = await handleChat(body);
      return sendJson(res, result.status, result.payload);
    }

    if (routePath === '/chat-history' && method === 'GET') return sendJson(res, 200, store.chatHistory.slice(-80));
    if (routePath === '/chat-history/clear' && method === 'DELETE') {
      store.chatHistory = [];
      return sendJson(res, 200, { success: true });
    }

    if (routePath === '/tasks' && method === 'GET') return sendJson(res, 200, store.tasks);
    if (routePath === '/tasks' && method === 'POST') {
      const title = String(body.title || '').trim();
      if (!title) return sendJson(res, 400, { error: 'Title is required' });
      const task: Task = {
        id: nextId(),
        userId: 1,
        title,
        description: body.description || null,
        status: 'pending',
        priority: sanitizePriority(body.priority),
        category: sanitizeCategory(body.category),
        dueDate: body.dueDate ? new Date(body.dueDate).toISOString() : null,
        createdAt: now(),
      };
      store.tasks.unshift(task);
      return sendJson(res, 200, { success: true, task });
    }

    const taskMatch = routePath.match(/^\/tasks\/(\d+)$/);
    if (taskMatch) {
      const id = Number(taskMatch[1]);
      const task = store.tasks.find((item) => item.id === id);
      if (!task) return sendJson(res, 404, { error: 'Task not found' });
      if (method === 'PATCH') {
        if (body.status !== undefined) task.status = body.status === 'completed' ? 'completed' : 'pending';
        if (body.priority !== undefined) task.priority = sanitizePriority(body.priority);
        if (body.category !== undefined) task.category = sanitizeCategory(body.category);
        if (body.title !== undefined) task.title = String(body.title).trim() || task.title;
        if (body.description !== undefined) task.description = body.description || null;
        if (body.dueDate !== undefined) task.dueDate = body.dueDate ? new Date(body.dueDate).toISOString() : null;
        return sendJson(res, 200, { success: true, task });
      }
      if (method === 'DELETE') {
        store.tasks = store.tasks.filter((item) => item.id !== id);
        return sendJson(res, 200, { success: true });
      }
    }

    if (routePath === '/memories' && method === 'GET') {
      const url = new URL(req.url || '/', 'https://ironcore.local');
      const q = String(url.searchParams.get('q') || '').toLowerCase();
      const memories = q ? store.memories.filter((item) => item.content.toLowerCase().includes(q)) : store.memories;
      return sendJson(res, 200, memories);
    }
    if (routePath === '/memories' && method === 'POST') {
      const content = String(body.content || '').trim();
      if (!content) return sendJson(res, 400, { error: 'Content is required' });
      const memory: Memory = { id: nextId(), userId: 1, content, source: body.source || 'manual', createdAt: now() };
      store.memories.unshift(memory);
      return sendJson(res, 200, { success: true, memory });
    }
    const memoryMatch = routePath.match(/^\/memories\/(\d+)$/);
    if (memoryMatch && method === 'DELETE') {
      store.memories = store.memories.filter((item) => item.id !== Number(memoryMatch[1]));
      return sendJson(res, 200, { success: true });
    }

    if (routePath === '/files' && method === 'GET') {
      return sendJson(res, 200, store.files.map(({ content, ...file }) => file));
    }
    if (routePath === '/upload' && method === 'POST') {
      if (!body.name || typeof body.content !== 'string') return sendJson(res, 400, { error: 'name and text content are required' });
      const file: UploadedFile = { id: nextId(), userId: 1, name: String(body.name), mimeType: body.mimeType || 'text/plain', content: truncate(body.content, 200000), summary: null, createdAt: now() };
      store.files.unshift(file);
      return sendJson(res, 200, { success: true, file });
    }
    if (routePath === '/summarize-file' && method === 'POST') {
      const file = store.files.find((item) => item.id === Number(body.id));
      if (!file) return sendJson(res, 404, { error: 'File not found' });
      file.summary = await summarizeText(file.name, file.content);
      return sendJson(res, 200, { success: true, summary: file.summary });
    }

    if (routePath === '/actions' && method === 'GET') return sendJson(res, 200, store.pendingActions.slice(0, 20));
    const confirmMatch = routePath.match(/^\/actions\/(\d+)\/(confirm|cancel)$/);
    if (confirmMatch && method === 'POST') {
      const action = store.pendingActions.find((item) => item.id === Number(confirmMatch[1]));
      if (!action) return sendJson(res, 404, { error: 'Pending action not found' });
      action.status = confirmMatch[2] === 'confirm' ? 'confirmed' : 'cancelled';
      return sendJson(res, 200, { success: true, message: `${action.type} ${action.status}. External sending/booking is intentionally disabled in this safe build.` });
    }

    if (routePath === '/system/usage' && method === 'GET') {
      return sendJson(res, 200, { cpu: 24, memory: 53, totalMemoryGB: 'serverless', usedMemoryGB: 'serverless', cpuCores: 1, uptime: 0, timestamp: now() });
    }

    if (routePath === '/extension/context' && method === 'POST') {
      const content = `Browser context saved\nURL: ${body.pageUrl || 'unknown'}\nTitle: ${body.pageTitle || 'unknown'}\nSelected text: ${body.selectedText || 'none'}\nPage snippet: ${truncate(body.pageText || '', 1000)}`;
      const memory: Memory = { id: nextId(), userId: 1, content, source: 'extension', createdAt: now() };
      store.memories.unshift(memory);
      return sendJson(res, 200, { success: true, memory });
    }

    if (routePath === '/extension/command' && method === 'POST') {
      const userCommand = String(body.userCommand || '').trim();
      if (!userCommand) return sendJson(res, 400, { error: 'userCommand is required' });
      const prompt = `[Browser Context]\nURL: ${body.pageUrl || 'unknown'}\nTitle: ${body.pageTitle || 'unknown'}\nSelected Text: ${body.selectedText || 'none'}\nPage Text: ${truncate(body.pageText || '', 2500)}\n\nUser Command: ${userCommand}`;
      const text = await callGemini(prompt);
      return sendJson(res, 200, { success: true, text });
    }

    return sendJson(res, 404, { error: `API route not found: ${method} ${routePath}` });
  } catch (error: any) {
    console.error('[IronCore API]', error);
    return sendJson(res, 500, {
      error: error?.message || 'Serverless function failed',
      code: error?.code || 'IRONCORE_API_ERROR',
      hint: 'Check Vercel logs and verify GEMINI_API_KEY is added to the Production environment.',
    });
  }
}
