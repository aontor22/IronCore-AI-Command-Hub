const DEFAULT_BACKEND_URL = 'https://iron-core-ai-command-hub.vercel.app';
const REQUEST_TIMEOUT_MS = 24000;

function normalizeBackendUrl(value) {
  const raw = String(value || DEFAULT_BACKEND_URL).trim() || DEFAULT_BACKEND_URL;
  try {
    const url = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
    url.pathname = url.pathname.replace(/\/api(?:\/.*)?$/i, '').replace(/\/$/, '');
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return DEFAULT_BACKEND_URL;
  }
}

async function getBackendUrl() {
  const { backendUrl } = await chrome.storage.sync.get({ backendUrl: DEFAULT_BACKEND_URL });
  return normalizeBackendUrl(backendUrl);
}

async function apiFetch(path, options = {}) {
  const backendUrl = await getBackendUrl();
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), options.timeoutMs || REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${backendUrl}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json') ? await response.json() : await response.text();

    if (!response.ok) {
      let message = typeof payload === 'string' ? payload : payload?.error || payload?.message || `Request failed with ${response.status}`;
      if (response.status === 404 || /NOT_FOUND/i.test(String(message))) {
        message = `The IronCore extension API route was not found. Redeploy the latest code and test /api/extension-command. Backend URL should be only the site root, not /api/health. Original: ${message}`;
      }
      throw new Error(message);
    }

    return payload;
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`Request timed out after ${Math.round((options.timeoutMs || REQUEST_TIMEOUT_MS) / 1000)}s. The backend is online, but the AI model may be slow. Try a shorter selection or set a faster GEMINI_FAST_MODEL.`);
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

async function setBadge(text, color = '#00d9ff') {
  try {
    await chrome.action.setBadgeText({ text });
    await chrome.action.setBadgeBackgroundColor({ color });
  } catch {
    // Badge is optional.
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  const { backendUrl } = await chrome.storage.sync.get({ backendUrl: DEFAULT_BACKEND_URL });
  await chrome.storage.sync.set({ backendUrl: normalizeBackendUrl(backendUrl) });
  await setBadge('ON');

  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'ironcore_explain_selection',
      title: 'Ask IronCore about selected text',
      contexts: ['selection'],
    });
    chrome.contextMenus.create({
      id: 'ironcore_summarize_page',
      title: 'Summarize this page with IronCore',
      contexts: ['page'],
    });
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const command = info.menuItemId === 'ironcore_explain_selection'
    ? `Explain this selected text clearly: ${info.selectionText || ''}`
    : 'Summarize this page clearly and list the key action points.';

  await chrome.storage.local.set({ queuedCommand: command, queuedAt: Date.now(), queuedTabId: tab?.id });
  if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: 'OPEN_IRONCORE_PANEL' }).catch(() => undefined);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (message?.type === 'GET_SETTINGS') {
        const data = await chrome.storage.sync.get({ backendUrl: DEFAULT_BACKEND_URL });
        sendResponse({ ok: true, backendUrl: normalizeBackendUrl(data.backendUrl) });
        return;
      }

      if (message?.type === 'SAVE_SETTINGS') {
        const nextUrl = normalizeBackendUrl(message.backendUrl);
        await chrome.storage.sync.set({ backendUrl: nextUrl });
        sendResponse({ ok: true, backendUrl: nextUrl });
        return;
      }

      if (message?.type === 'HEALTH_CHECK') {
        const data = await apiFetch('/api/health', { timeoutMs: 10000 });
        await setBadge(data?.ok ? 'ON' : 'ERR', data?.ok ? '#00d9ff' : '#ff5c7a');
        sendResponse({ ok: true, data });
        return;
      }

      if (message?.type === 'OPEN_WEB_APP') {
        const backendUrl = await getBackendUrl();
        await chrome.tabs.create({ url: backendUrl });
        sendResponse({ ok: true });
        return;
      }

      if (message?.type === 'SAVE_CONTEXT') {
        const data = await apiFetch('/api/extension-context', {
          method: 'POST',
          timeoutMs: 12000,
          body: JSON.stringify(message.context || {}),
        });
        sendResponse({ ok: true, data });
        return;
      }

      if (message?.type === 'EXTENSION_COMMAND') {
        await setBadge('AI');
        const data = await apiFetch('/api/extension-command', {
          method: 'POST',
          timeoutMs: 26000,
          body: JSON.stringify(message.payload || {}),
        });
        await setBadge('ON');
        sendResponse({ ok: true, data });
        return;
      }

      sendResponse({ ok: false, error: 'Unknown extension message type.' });
    } catch (error) {
      await setBadge('ERR', '#ff5c7a');
      sendResponse({ ok: false, error: error?.message || 'Extension request failed.' });
    }
  })();

  return true;
});
