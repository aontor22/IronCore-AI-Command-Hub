const DEFAULT_BACKEND_URL = 'https://iron-core-ai-command-hub.vercel.app';

async function getBackendUrl() {
  const { backendUrl } = await chrome.storage.sync.get({ backendUrl: DEFAULT_BACKEND_URL });
  return String(backendUrl || DEFAULT_BACKEND_URL).replace(/\/$/, '');
}

async function apiFetch(path, options = {}) {
  const backendUrl = await getBackendUrl();
  const response = await fetch(`${backendUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const message = typeof payload === 'string' ? payload : payload?.error || `Request failed with ${response.status}`;
    throw new Error(message);
  }

  return payload;
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
  await chrome.storage.sync.set({ backendUrl: DEFAULT_BACKEND_URL });
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

  await chrome.storage.local.set({
    queuedCommand: command,
    queuedAt: Date.now(),
    queuedTabId: tab?.id || null,
  });

  try {
    await chrome.action.setBadgeText({ text: 'ASK' });
    await chrome.action.setBadgeBackgroundColor({ color: '#12f7ff' });
  } catch {
    // Ignore badge failure.
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (message?.type === 'GET_SETTINGS') {
        const data = await chrome.storage.sync.get({ backendUrl: DEFAULT_BACKEND_URL });
        sendResponse({ ok: true, ...data });
        return;
      }

      if (message?.type === 'SAVE_SETTINGS') {
        const nextUrl = String(message.backendUrl || DEFAULT_BACKEND_URL).replace(/\/$/, '');
        await chrome.storage.sync.set({ backendUrl: nextUrl });
        sendResponse({ ok: true, backendUrl: nextUrl });
        return;
      }

      if (message?.type === 'HEALTH_CHECK') {
        const data = await apiFetch('/api/health');
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
        const data = await apiFetch('/api/extension/context', {
          method: 'POST',
          body: JSON.stringify(message.context || {}),
        });
        sendResponse({ ok: true, data });
        return;
      }

      if (message?.type === 'EXTENSION_COMMAND') {
        await setBadge('AI');
        const data = await apiFetch('/api/extension/command', {
          method: 'POST',
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
