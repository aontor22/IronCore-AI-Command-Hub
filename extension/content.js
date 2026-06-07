const IRONCORE_PANEL_ID = 'ironcore-floating-panel';
const IRONCORE_BUTTON_ID = 'ironcore-floating-button';

function getReadablePageText() {
  const selectorsToRemove = 'script, style, noscript, iframe, svg, canvas, nav, footer, header, aside';
  const clone = document.body ? document.body.cloneNode(true) : null;
  if (!clone) return '';
  clone.querySelectorAll(selectorsToRemove).forEach((node) => node.remove());
  return clone.innerText.replace(/\s+/g, ' ').trim().slice(0, 12000);
}

function getPageContext() {
  return {
    pageTitle: document.title || '',
    pageUrl: location.href,
    selectedText: String(window.getSelection?.() || '').trim(),
    pageText: getReadablePageText(),
  };
}

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

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function ensurePanel() {
  let button = document.getElementById(IRONCORE_BUTTON_ID);
  if (!button) {
    button = document.createElement('button');
    button.id = IRONCORE_BUTTON_ID;
    button.type = 'button';
    button.innerHTML = '<span></span><b>IC</b>';
    button.title = 'Open IronCore AI';
    document.documentElement.appendChild(button);
    button.addEventListener('click', togglePanel);
  }

  let panel = document.getElementById(IRONCORE_PANEL_ID);
  if (!panel) {
    panel = document.createElement('section');
    panel.id = IRONCORE_PANEL_ID;
    panel.innerHTML = `
      <div class="ic-panel-shell">
        <div class="ic-panel-header">
          <div>
            <small>ASSISTANT CORE</small>
            <strong>IronCore</strong>
          </div>
          <button type="button" class="ic-close" aria-label="Close IronCore">×</button>
        </div>
        <div class="ic-core-mini">
          <div class="ic-ring"></div>
          <div class="ic-core-label">ONLINE</div>
        </div>
        <div class="ic-page-card">
          <span>Current context</span>
          <b class="ic-page-title">${escapeHtml(document.title || 'Untitled page')}</b>
          <small>${escapeHtml(location.hostname)}</small>
        </div>
        <div class="ic-quick-grid">
          <button type="button" data-command="Summarize this page clearly with key bullet points.">Summarize</button>
          <button type="button" data-command="Explain the selected text. If nothing is selected, explain the page topic.">Explain</button>
          <button type="button" data-command="Extract action items and next steps from this page.">Actions</button>
          <button type="button" data-command="Rewrite the selected text in a clearer professional tone.">Rewrite</button>
        </div>
        <textarea class="ic-command" rows="3" placeholder="Ask IronCore about this page..."></textarea>
        <div class="ic-actions">
          <button type="button" class="ic-save">Save context</button>
          <button type="button" class="ic-send">Send command</button>
        </div>
        <pre class="ic-response">Ready. Select text or ask about this page.</pre>
      </div>
    `;
    document.documentElement.appendChild(panel);

    panel.querySelector('.ic-close')?.addEventListener('click', () => panel.classList.remove('open'));
    panel.querySelector('.ic-send')?.addEventListener('click', sendPanelCommand);
    panel.querySelector('.ic-save')?.addEventListener('click', saveContextFromPanel);
    panel.querySelectorAll('[data-command]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const input = panel.querySelector('.ic-command');
        input.value = btn.getAttribute('data-command') || '';
        sendPanelCommand();
      });
    });
  }
}

function togglePanel() {
  const panel = document.getElementById(IRONCORE_PANEL_ID);
  panel?.classList.toggle('open');
  const title = panel?.querySelector('.ic-page-title');
  if (title) title.textContent = document.title || 'Untitled page';
}

async function sendPanelCommand() {
  const panel = document.getElementById(IRONCORE_PANEL_ID);
  const input = panel?.querySelector('.ic-command');
  const responseBox = panel?.querySelector('.ic-response');
  const userCommand = input?.value?.trim();

  if (!userCommand) {
    responseBox.textContent = 'Type a command first.';
    return;
  }

  responseBox.textContent = 'Thinking through browser context...';
  const payload = { userCommand, ...getPageContext() };
  const response = await sendRuntimeMessage({ type: 'EXTENSION_COMMAND', payload });

  if (!response?.ok) {
    responseBox.textContent = `Connection problem: ${response?.error || 'Unknown error'}\n\nMake sure the IronCore web app is running at http://localhost:3000`;
    return;
  }

  responseBox.textContent = response.data?.text || 'Command processed.';
}

async function saveContextFromPanel() {
  const panel = document.getElementById(IRONCORE_PANEL_ID);
  const responseBox = panel?.querySelector('.ic-response');
  responseBox.textContent = 'Saving this page context to IronCore memory...';
  const response = await sendRuntimeMessage({ type: 'SAVE_CONTEXT', context: getPageContext() });
  responseBox.textContent = response?.ok ? 'Context saved to IronCore memory.' : `Could not save context: ${response?.error || 'Unknown error'}`;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'GET_PAGE_CONTEXT') {
    sendResponse({ ok: true, context: getPageContext() });
    return true;
  }

  if (message?.type === 'OPEN_IRONCORE_PANEL') {
    ensurePanel();
    document.getElementById(IRONCORE_PANEL_ID)?.classList.add('open');
    sendResponse({ ok: true });
    return true;
  }

  return false;
});

ensurePanel();
