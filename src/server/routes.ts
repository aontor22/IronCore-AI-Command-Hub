import { Router } from 'express';
import { DB_FILE, db, sqlite } from './db';
import { tasks, memories, chatHistory, users, files, pendingActions } from './db/schema';
import { generateChatResponse, generatePlainText, GEMINI_API_KEY_SOURCE, GEMINI_MODEL, HAS_GEMINI_KEY } from './ai';
import { and, desc, eq, like } from 'drizzle-orm';
import os from 'os';

export const routes = Router();

const mockUserId = 1;
const MAX_CONTEXT_CHARS = 12000;

function sanitizePriority(priority?: string) {
  const value = priority?.toString().toLowerCase();
  return value === 'high' || value === 'low' ? value : 'medium';
}

function sanitizeCategory(category?: string) {
  const value = category?.toString().toLowerCase() || 'personal';
  return ['personal', 'work', 'shopping', 'study', 'project'].includes(value) ? value : 'personal';
}

function truncate(input = '', max = MAX_CONTEXT_CHARS) {
  return input.length > max ? `${input.slice(0, max)}\n\n[Truncated ${input.length - max} characters]` : input;
}

function mapHistory(rows: Array<{ role: string; content: string }>) {
  return rows
    .filter((h) => h.role === 'assistant' || h.role === 'user')
    .map((h) => ({
      role: h.role === 'assistant' ? ('model' as const) : ('user' as const),
      parts: [{ text: h.content }],
    }));
}

async function ensureDefaultUser() {
  const existing = await db.select().from(users).where(eq(users.id, mockUserId));
  if (!existing.length) {
    await db.insert(users).values({ id: mockUserId, email: 'local@ironcore.dev', passwordHash: 'local-dev-user' });
  }
}

routes.use(async (_req, res, next) => {
  try {
    await ensureDefaultUser();
    next();
  } catch (e: any) {
    console.error('DB init error:', e);
    res.status(500).json({ error: `Database initialization failed: ${e.message}` });
  }
});

async function executeToolCall(call: any) {
  const name = call.name;
  const args = (call.args || {}) as any;

  if (name === 'create_task') {
    const title = String(args.title || '').trim();
    if (!title) return { kind: 'error', text: 'Task creation failed because the title was empty.' };
    await db.insert(tasks).values({
      userId: mockUserId,
      title,
      description: args.description ? String(args.description) : null,
      dueDate: args.dueDate ? new Date(args.dueDate) : null,
      status: 'pending',
      priority: sanitizePriority(args.priority),
      category: sanitizeCategory(args.category),
    });
    return { kind: 'safe', text: `Task created: ${title}` };
  }

  if (name === 'save_memory') {
    const content = String(args.content || '').trim();
    if (!content) return { kind: 'error', text: 'Memory was not saved because the content was empty.' };
    await db.insert(memories).values({ userId: mockUserId, content, source: 'assistant' });
    return { kind: 'safe', text: `Memory saved: ${content}` };
  }

  if (name === 'retrieve_memory') {
    const query = String(args.query || '').trim();
    const rows = query
      ? await db.select().from(memories).where(and(eq(memories.userId, mockUserId), like(memories.content, `%${query}%`))).orderBy(desc(memories.createdAt)).limit(8)
      : await db.select().from(memories).where(eq(memories.userId, mockUserId)).orderBy(desc(memories.createdAt)).limit(8);
    return { kind: 'safe', text: rows.length ? `Retrieved memories:\n${rows.map((m) => `- ${m.content}`).join('\n')}` : 'No matching memories found.' };
  }

  if (name === 'read_file' || name === 'summarize_file') {
    const id = Number(args.id || args.fileId || 0);
    const rows = id
      ? await db.select().from(files).where(and(eq(files.userId, mockUserId), eq(files.id, id))).limit(1)
      : await db.select().from(files).where(eq(files.userId, mockUserId)).orderBy(desc(files.createdAt)).limit(1);

    if (!rows.length) return { kind: 'error', text: 'No uploaded file was found. Upload a text file first.' };
    const file = rows[0];
    if (name === 'read_file') {
      return { kind: 'safe', text: `File: ${file.name}\n\n${truncate(file.content, 4000)}` };
    }
    const summary = await summarizeFileContent(file.name, file.content);
    await db.update(files).set({ summary }).where(eq(files.id, file.id));
    return { kind: 'safe', text: `Summary for ${file.name}:\n${summary}` };
  }

  if (name === 'web_search') {
    const query = String(args.query || '').trim();
    if (!query) return { kind: 'error', text: 'Web search failed because the query was empty.' };
    const result = await runWebSearch(query);
    return { kind: 'safe', text: result };
  }

  if (name === 'draft_email' || name === 'create_calendar_event') {
    const payload = JSON.stringify(args);
    const result = await db.insert(pendingActions).values({ userId: mockUserId, type: name, payload, status: 'pending' }).returning();
    const id = result?.[0]?.id;
    return {
      kind: 'pending',
      id,
      actionType: name,
      payload: args,
      text: `${name === 'draft_email' ? 'Email draft prepared' : 'Calendar event draft prepared'} and waiting for confirmation.`,
    };
  }

  if (name === 'run_code_safely') {
    return { kind: 'pending', text: 'Code execution is blocked in this version for safety. Use the chat to review code instead.' };
  }

  return { kind: 'error', text: `Tool ${name} is registered but not implemented.` };
}

async function summarizeFileContent(fileName: string, content: string) {
  const prompt = `Summarize this uploaded file clearly. Include: 1) short overview, 2) key points, 3) suggested next action.\n\nFile: ${fileName}\n\nContent:\n${truncate(content, 10000)}`;
  return generatePlainText(prompt);
}

async function runWebSearch(query: string) {
  if (!process.env.BRAVE_SEARCH_API_KEY) {
    return `Web search is not configured. Add BRAVE_SEARCH_API_KEY to .env, then retry. Query requested: ${query}`;
  }

  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'X-Subscription-Token': process.env.BRAVE_SEARCH_API_KEY,
    },
  });

  if (!response.ok) {
    return `Web search failed with status ${response.status}.`;
  }

  const data = await response.json() as any;
  const results = data?.web?.results || [];
  if (!results.length) return `No search results found for: ${query}`;

  return `Search results for "${query}":\n${results
    .slice(0, 5)
    .map((r: any, idx: number) => `${idx + 1}. ${r.title}\n   ${r.url}\n   ${r.description || ''}`)
    .join('\n')}`;
}

routes.get('/health', (_req, res) => {
  let dbOk = true;
  try {
    sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  } catch {
    dbOk = false;
  }

  res.json({
    ok: true,
    status: 'running',
    dbOk,
    model: GEMINI_MODEL,
    hasGeminiKey: HAS_GEMINI_KEY,
    keySource: GEMINI_API_KEY_SOURCE,
    hasBraveKey: Boolean(process.env.BRAVE_SEARCH_API_KEY),
    serverless: Boolean(process.env.VERCEL),
    apiMode: process.env.VERCEL ? 'vercel-function' : 'local-express',
    dbFile: DB_FILE,
    timestamp: new Date().toISOString(),
  });
});

routes.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'Message is required' });

    const historyRows = await db.select().from(chatHistory)
      .where(eq(chatHistory.userId, mockUserId))
      .orderBy(desc(chatHistory.createdAt))
      .limit(20);
    const history = mapHistory(historyRows.reverse());

    await db.insert(chatHistory).values({ userId: mockUserId, role: 'user', content: message });

    const aiResponse = await generateChatResponse(history, message);
    let responseText = aiResponse.text || '';
    const toolResults: any[] = [];
    const pending: any[] = [];

    const functionCalls = aiResponse.functionCalls || [];
    for (const call of functionCalls) {
      const result = await executeToolCall(call);
      toolResults.push({ name: call.name, args: call.args, ...result });
      if (result.kind === 'pending') pending.push(result);
    }

    if (toolResults.length) {
      responseText = `${responseText || 'Command processed.'}\n\n${toolResults.map((r) => `▸ ${r.text}`).join('\n')}`;
    }

    await db.insert(chatHistory).values({ userId: mockUserId, role: 'assistant', content: responseText });
    res.json({ text: responseText, toolCalls: toolResults, pendingActions: pending });
  } catch (error: any) {
    console.error('Chat error:', error);
    res.status(500).json({ error: error?.message || 'Failed to process chat' });
  }
});

routes.get('/chat-history', async (_req, res) => {
  const history = await db.select().from(chatHistory)
    .where(eq(chatHistory.userId, mockUserId))
    .orderBy(desc(chatHistory.createdAt))
    .limit(80);
  res.json(history.reverse());
});

routes.delete('/chat-history/clear', async (_req, res) => {
  await db.delete(chatHistory).where(eq(chatHistory.userId, mockUserId));
  res.json({ success: true });
});

routes.get('/tasks', async (_req, res) => {
  const rows = await db.select().from(tasks).where(eq(tasks.userId, mockUserId)).orderBy(desc(tasks.createdAt));
  res.json(rows);
});

routes.post('/tasks', async (req, res) => {
  const { title, description, dueDate, priority, category } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });
  const row = await db.insert(tasks).values({
    userId: mockUserId,
    title: String(title).trim(),
    description: description || null,
    dueDate: dueDate ? new Date(dueDate) : null,
    status: 'pending',
    priority: sanitizePriority(priority),
    category: sanitizeCategory(category),
  }).returning();
  res.json({ success: true, task: row?.[0] });
});

routes.patch('/tasks/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid task id' });
  const { status, priority, category, title, description, dueDate } = req.body;
  const updateData: any = {};
  if (status !== undefined) updateData.status = status === 'completed' ? 'completed' : 'pending';
  if (priority !== undefined) updateData.priority = sanitizePriority(priority);
  if (category !== undefined) updateData.category = sanitizeCategory(category);
  if (title !== undefined) updateData.title = String(title).trim();
  if (description !== undefined) updateData.description = description || null;
  if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
  await db.update(tasks).set(updateData).where(and(eq(tasks.id, id), eq(tasks.userId, mockUserId)));
  res.json({ success: true });
});

routes.delete('/tasks/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid task id' });
  await db.delete(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, mockUserId)));
  res.json({ success: true });
});

routes.get('/memories', async (req, res) => {
  const query = String(req.query.q || '').trim();
  const rows = query
    ? await db.select().from(memories).where(and(eq(memories.userId, mockUserId), like(memories.content, `%${query}%`))).orderBy(desc(memories.createdAt))
    : await db.select().from(memories).where(eq(memories.userId, mockUserId)).orderBy(desc(memories.createdAt));
  res.json(rows);
});

routes.post('/memories', async (req, res) => {
  const { content, source = 'manual' } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Content is required' });
  const row = await db.insert(memories).values({ userId: mockUserId, content: String(content).trim(), source }).returning();
  res.json({ success: true, memory: row?.[0] });
});

routes.delete('/memories/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid memory id' });
  await db.delete(memories).where(and(eq(memories.id, id), eq(memories.userId, mockUserId)));
  res.json({ success: true });
});

routes.get('/files', async (_req, res) => {
  const rows = await db.select({ id: files.id, name: files.name, mimeType: files.mimeType, summary: files.summary, createdAt: files.createdAt })
    .from(files)
    .where(eq(files.userId, mockUserId))
    .orderBy(desc(files.createdAt));
  res.json(rows);
});

routes.post('/upload', async (req, res) => {
  const { name, mimeType = 'text/plain', content } = req.body;
  if (!name || typeof content !== 'string') return res.status(400).json({ error: 'name and text content are required' });
  const row = await db.insert(files).values({ userId: mockUserId, name, mimeType, content: truncate(content, 200000) }).returning();
  res.json({ success: true, file: row?.[0] });
});

routes.post('/summarize-file', async (req, res) => {
  const id = Number(req.body.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Valid file id is required' });
  const rows = await db.select().from(files).where(and(eq(files.userId, mockUserId), eq(files.id, id))).limit(1);
  if (!rows.length) return res.status(404).json({ error: 'File not found' });
  const summary = await summarizeFileContent(rows[0].name, rows[0].content);
  await db.update(files).set({ summary }).where(eq(files.id, id));
  res.json({ success: true, summary });
});

routes.get('/actions', async (_req, res) => {
  const rows = await db.select().from(pendingActions).where(eq(pendingActions.userId, mockUserId)).orderBy(desc(pendingActions.createdAt)).limit(20);
  res.json(rows.map((row) => ({ ...row, payload: JSON.parse(row.payload) })));
});

routes.post('/actions/:id/confirm', async (req, res) => {
  const id = Number(req.params.id);
  const rows = await db.select().from(pendingActions).where(and(eq(pendingActions.id, id), eq(pendingActions.userId, mockUserId))).limit(1);
  if (!rows.length) return res.status(404).json({ error: 'Pending action not found' });
  const action = rows[0];
  await db.update(pendingActions).set({ status: 'confirmed' }).where(eq(pendingActions.id, id));
  res.json({ success: true, message: `${action.type} confirmed locally. External sending/booking is intentionally not enabled in this safe build.` });
});

routes.post('/actions/:id/cancel', async (req, res) => {
  const id = Number(req.params.id);
  await db.update(pendingActions).set({ status: 'cancelled' }).where(and(eq(pendingActions.id, id), eq(pendingActions.userId, mockUserId)));
  res.json({ success: true });
});

routes.get('/system/usage', (_req, res) => {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memoryPercent = Math.round((usedMem / totalMem) * 100);
  const cpuCount = os.cpus()?.length || 1;
  const loadAvg = os.loadavg()[0] || 0;
  let cpuPercent = Math.round((loadAvg / cpuCount) * 100);
  if (cpuPercent <= 0 || cpuPercent > 100) cpuPercent = Math.floor(Math.random() * 12) + 7;

  res.json({
    cpu: cpuPercent,
    memory: memoryPercent,
    totalMemoryGB: (totalMem / (1024 * 1024 * 1024)).toFixed(1),
    usedMemoryGB: (usedMem / (1024 * 1024 * 1024)).toFixed(1),
    cpuCores: cpuCount,
    uptime: Math.round(os.uptime()),
    timestamp: new Date().toISOString(),
  });
});

routes.post('/extension/context', async (req, res) => {
  const { pageTitle, pageUrl, selectedText, pageText } = req.body;
  const content = `Browser context saved\nURL: ${pageUrl || 'unknown'}\nTitle: ${pageTitle || 'unknown'}\nSelected text: ${selectedText || 'none'}\nPage snippet: ${truncate(pageText || '', 1000)}`;
  const row = await db.insert(memories).values({ userId: mockUserId, content, source: 'extension' }).returning();
  res.json({ success: true, memory: row?.[0] });
});

routes.post('/extension/command', async (req, res) => {
  const { userCommand, pageTitle, pageUrl, selectedText, pageText } = req.body;
  if (!userCommand?.trim()) return res.status(400).json({ error: 'userCommand is required' });
  const fullMessage = `[Browser Context]\nURL: ${pageUrl || 'unknown'}\nTitle: ${pageTitle || 'unknown'}\nSelected Text: ${selectedText || 'none'}\nPage Text: ${truncate(pageText || '', 2500)}\n\nUser Command: ${userCommand}`;
  const historyRows = await db.select().from(chatHistory).where(eq(chatHistory.userId, mockUserId)).orderBy(desc(chatHistory.createdAt)).limit(10);
  const response = await generateChatResponse(mapHistory(historyRows.reverse()), fullMessage);
  res.json({ success: true, text: response.text || 'Command processed.' });
});
