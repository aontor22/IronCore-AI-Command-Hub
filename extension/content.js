const IRONCORE_PANEL_ID = 'ironcore-floating-panel';
const IRONCORE_BUTTON_ID = 'ironcore-floating-button';
const IRONCORE_POS_KEY = 'ironcoreFloatingButtonPosition';

let suppressNextClick = false;

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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function applyButtonPosition(position) {
  const button = document.getElementById(IRONCORE_BUTTON_ID);
  if (!button) return;

  const size = 58;
  const margin = 12;
  const x = Number(position?.x);
  const y = Number(position?.y);

  if (Number.isFinite(x) && Number.isFinite(y)) {
    button.style.left = `${clamp(x, margin, window.innerWidth - size - margin)}px`;
    button.style.top = `${clamp(y, margin, window.innerHeight - size - margin)}px`;
    button.style.right = 'auto';
    button.style.bottom = 'auto';
  } else {
    button.style.left = 'auto';
    button.style.top = 'auto';
    button.style.right = '22px';
    button.style.bottom = '22px';
  }

  positionPanelNearButton();
}

function loadButtonPosition() {
  try {
    chrome.storage.local.get({ [IRONCORE_POS_KEY]: null }, (data) => {
      applyButtonPosition(data?.[IRONCORE_POS_KEY]);
    });
  } catch {
    applyButtonPosition(null);
  }
}

function saveButtonPosition(x, y) {
  try {
    chrome.storage.local.set({ [IRONCORE_POS_KEY]: { x, y } });
  } catch {
    // Position persistence is optional.
  }
}

function positionPanelNearButton() {
  const button = document.getElementById(IRONCORE_BUTTON_ID);
  const panel = document.getElementById(IRONCORE_PANEL_ID);
  if (!button || !panel) return;

  const rect = button.getBoundingClientRect();
  const panelWidth = Math.min(380, window.innerWidth - 32);
  const estimatedHeight = Math.min(720, window.innerHeight - 28);
  const margin = 14;

  let left = rect.right + margin;
  if (left + panelWidth > window.innerWidth - margin) left = rect.left - panelWidth - margin;
  left = clamp(left, margin, window.innerWidth - panelWidth - margin);

  let top = rect.top - 16;
  if (top + estimatedHeight > window.innerHeight - margin) top = window.innerHeight - estimatedHeight - margin;
  top = clamp(top, margin, window.innerHeight - 180);

  panel.style.left = `${left}px`;
  panel.style.top = `${top}px`;
  panel.style.right = 'auto';
  panel.style.bottom = 'auto';
}

function makeButtonDraggable(button) {
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;
  let dragging = false;

  button.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    const rect = button.getBoundingClientRect();
    startX = event.clientX;
    startY = event.clientY;
    startLeft = rect.left;
    startTop = rect.top;
    dragging = false;
    button.setPointerCapture?.(event.pointerId);
  });

  button.addEventListener('pointermove', (event) => {
    if (!button.hasPointerCapture?.(event.pointerId)) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (Math.abs(dx) + Math.abs(dy) > 5) dragging = true;
    if (!dragging) return;

    event.preventDefault();
    const nextLeft = clamp(startLeft + dx, 12, window.innerWidth - button.offsetWidth - 12);
    const nextTop = clamp(startTop + dy, 12, window.innerHeight - button.offsetHeight - 12);
    button.style.left = `${nextLeft}px`;
    button.style.top = `${nextTop}px`;
    button.style.right = 'auto';
    button.style.bottom = 'auto';
    positionPanelNearButton();
  });

  button.addEventListener('pointerup', (event) => {
    if (button.hasPointerCapture?.(event.pointerId)) button.releasePointerCapture?.(event.pointerId);
    if (dragging) {
      const rect = button.getBoundingClientRect();
      saveButtonPosition(rect.left, rect.top);
      suppressNextClick = true;
      window.setTimeout(() => { suppressNextClick = false; }, 80);
    }
    dragging = false;
  });
}

function ensurePanel() {
  let button = document.getElementById(IRONCORE_BUTTON_ID);
  if (!button) {
    button = document.createElement('button');
    button.id = IRONCORE_BUTTON_ID;
    button.type = 'button';
    button.innerHTML = '<span></span><b>IC</b>';
    button.title = 'Open IronCore AI. Drag to move.';
    document.documentElement.appendChild(button);
    makeButtonDraggable(button);
    button.addEventListener('click', () => {
      if (suppressNextClick) return;
      togglePanel();
    });
    loadButtonPosition();
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

  positionPanelNearButton();
}

function togglePanel() {
  const panel = document.getElementById(IRONCORE_PANEL_ID);
  positionPanelNearButton();
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
    responseBox.textContent = `Connection problem: ${response?.error || 'Unknown error'}\n\nMake sure the Backend URL in the extension popup points to your running local app or Vercel deployment`;
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
    positionPanelNearButton();
    document.getElementById(IRONCORE_PANEL_ID)?.classList.add('open');
    sendResponse({ ok: true });
    return true;
  }

  return false;
});

window.addEventListener('resize', () => {
  chrome.storage.local.get({ [IRONCORE_POS_KEY]: null }, (data) => applyButtonPosition(data?.[IRONCORE_POS_KEY]));
});

ensurePanel();
