const els = {
  backendUrl: document.getElementById('backendUrl'),
  saveSettings: document.getElementById('saveSettings'),
  statusText: document.getElementById('statusText'),
  healthCopy: document.getElementById('healthCopy'),
  pageTitle: document.getElementById('pageTitle'),
  pageUrl: document.getElementById('pageUrl'),
  selectionInfo: document.getElementById('selectionInfo'),
  commandInput: document.getElementById('commandInput'),
  responseOutput: document.getElementById('responseOutput'),
  sendCommand: document.getElementById('sendCommand'),
  saveContext: document.getElementById('saveContext'),
  refreshContext: document.getElementById('refreshContext'),
  copyResponse: document.getElementById('copyResponse'),
  openWebApp: document.getElementById('openWebApp'),
};

let activeContext = null;

function sendRuntimeMessage(payload) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(payload, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(response || { ok: false, error: 'No response from IronCore service worker.' });
    });
  });
}

function sendTabMessage(tabId, payload) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, payload, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(response || { ok: false, error: 'No response from page content script.' });
    });
  });
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function setResponse(message) {
  els.responseOutput.textContent = message;
}

function setStatus(label, message, isOnline = false) {
  els.statusText.textContent = label;
  els.healthCopy.textContent = message;
  els.statusText.style.color = isOnline ? '#dffcff' : '#ffd6df';
}

async function loadSettings() {
  const response = await sendRuntimeMessage({ type: 'GET_SETTINGS' });
  if (response?.ok) {
    els.backendUrl.value = response.backendUrl || 'https://iron-core-ai-command-hub.vercel.app';
  }
}

async function saveSettings() {
  const backendUrl = els.backendUrl.value.trim() || 'https://iron-core-ai-command-hub.vercel.app';
  const response = await sendRuntimeMessage({ type: 'SAVE_SETTINGS', backendUrl });
  setResponse(response?.ok ? `Backend URL saved: ${response.backendUrl}` : `Could not save settings: ${response?.error || 'Unknown error'}`);
  await checkHealth();
}

async function checkHealth() {
  const response = await sendRuntimeMessage({ type: 'HEALTH_CHECK' });
  if (!response?.ok) {
    setStatus('OFF', `Backend not connected. Check the backend URL, Vercel deployment, and /api/health. ${response?.error || ''}`, false);
    return;
  }

  const health = response.data || {};
  setStatus(health.hasGeminiKey ? 'ONLINE' : 'NO KEY', health.hasGeminiKey ? `Connected. Model: ${health.model || 'Gemini'}` : 'Backend is running, but GEMINI_API_KEY is missing.', Boolean(health.hasGeminiKey));
}

async function refreshContext() {
  const tab = await getActiveTab();
  if (!tab?.id || !/^https?:/.test(tab.url || '')) {
    activeContext = {
      pageTitle: tab?.title || 'Unsupported tab',
      pageUrl: tab?.url || '',
      selectedText: '',
      pageText: '',
    };
    renderContext();
    return;
  }

  const response = await sendTabMessage(tab.id, { type: 'GET_PAGE_CONTEXT' });
  if (!response?.ok) {
    activeContext = {
      pageTitle: tab.title || 'Page context unavailable',
      pageUrl: tab.url || '',
      selectedText: '',
      pageText: '',
    };
    renderContext();
    setResponse('Could not read page context. Try refreshing the page or use a normal website tab.');
    return;
  }

  activeContext = response.context;
  renderContext();
}

function renderContext() {
  els.pageTitle.textContent = activeContext?.pageTitle || 'No page loaded';
  els.pageUrl.textContent = activeContext?.pageUrl || 'Open a normal website tab to use page context.';
  const selectionLength = activeContext?.selectedText?.length || 0;
  els.selectionInfo.textContent = selectionLength ? `${selectionLength} selected characters detected.` : 'No selected text detected.';
}

async function sendCommand(commandOverride) {
  const userCommand = (commandOverride || els.commandInput.value || '').trim();
  if (!userCommand) {
    setResponse('Type a command first.');
    return;
  }

  if (!activeContext) await refreshContext();
  setResponse('IronCore is analyzing the current browser context...');

  const response = await sendRuntimeMessage({
    type: 'EXTENSION_COMMAND',
    payload: {
      userCommand,
      ...(activeContext || {}),
    },
  });

  if (!response?.ok) {
    setResponse(`Connection problem: ${response?.error || 'Unknown error'}\n\nMake sure the Backend URL in extension settings points to your running local app or Vercel deployment`);
    return;
  }

  setResponse(response.data?.text || 'Command processed.');
}

async function saveContext() {
  if (!activeContext) await refreshContext();
  setResponse('Saving current page context to IronCore memory...');
  const response = await sendRuntimeMessage({ type: 'SAVE_CONTEXT', context: activeContext || {} });
  setResponse(response?.ok ? 'Current page context saved to IronCore memory.' : `Could not save context: ${response?.error || 'Unknown error'}`);
}

async function loadQueuedCommand() {
  const data = await chrome.storage.local.get(['queuedCommand', 'queuedAt']);
  if (data.queuedCommand && Date.now() - Number(data.queuedAt || 0) < 10 * 60 * 1000) {
    els.commandInput.value = data.queuedCommand;
    await chrome.storage.local.remove(['queuedCommand', 'queuedAt', 'queuedTabId']);
  }
}

els.saveSettings.addEventListener('click', saveSettings);
els.refreshContext.addEventListener('click', refreshContext);
els.sendCommand.addEventListener('click', () => sendCommand());
els.saveContext.addEventListener('click', saveContext);
els.openWebApp.addEventListener('click', () => sendRuntimeMessage({ type: 'OPEN_WEB_APP' }));
els.copyResponse.addEventListener('click', async () => {
  await navigator.clipboard.writeText(els.responseOutput.textContent || '');
  setResponse(`${els.responseOutput.textContent}\n\n[Copied to clipboard]`);
});

document.querySelectorAll('[data-command]').forEach((button) => {
  button.addEventListener('click', () => {
    els.commandInput.value = button.getAttribute('data-command') || '';
    sendCommand(els.commandInput.value);
  });
});

(async function init() {
  await loadSettings();
  await loadQueuedCommand();
  await checkHealth();
  await refreshContext();
})();
