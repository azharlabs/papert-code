/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

export function getWebUiHtml(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Papert Code Web</title>
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <style>
      :root {
        color-scheme: light dark;
      }
      body {
        margin: 0;
        font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
        background: #0f1115;
        color: #e6e6e6;
      }
      .container {
        max-width: 980px;
        margin: 0 auto;
        padding: 24px;
      }
      header {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        margin-bottom: 16px;
      }
      h1 {
        font-size: 20px;
        margin: 0;
        letter-spacing: 0.6px;
      }
      .badge {
        font-size: 12px;
        padding: 4px 8px;
        border-radius: 999px;
        background: #1f2937;
      }
      .panel {
        background: #141923;
        border: 1px solid #232a3a;
        border-radius: 12px;
        padding: 16px;
        margin-bottom: 16px;
      }
      .grid {
        display: grid;
        gap: 12px;
      }
      .grid.two {
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      }
      label {
        font-size: 12px;
        color: #9aa4b2;
        display: block;
        margin-bottom: 6px;
      }
      input, button, textarea {
        font: inherit;
      }
      input, textarea {
        width: 100%;
        box-sizing: border-box;
        padding: 10px 12px;
        border-radius: 8px;
        border: 1px solid #2f3847;
        background: #0c111b;
        color: inherit;
      }
      button {
        padding: 10px 14px;
        border-radius: 8px;
        border: 0;
        background: #5b7cfa;
        color: #fff;
        cursor: pointer;
      }
      button.secondary {
        background: #2c3346;
      }
      button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .messages {
        min-height: 240px;
        max-height: 480px;
        overflow-y: auto;
        padding-right: 6px;
      }
      .msg {
        padding: 10px 12px;
        border-radius: 10px;
        margin-bottom: 8px;
        background: #101522;
        border: 1px solid #1f2532;
      }
      .msg .content {
        line-height: 1.6;
        white-space: normal;
        text-align: left;
        word-break: break-word;
      }
      .msg .content h1,
      .msg .content h2,
      .msg .content h3,
      .msg .content h4,
      .msg .content h5,
      .msg .content h6 {
        margin: 0 0 8px 0;
        font-weight: 600;
        line-height: 1.3;
      }
      .msg .content h1 { font-size: 20px; }
      .msg .content h2 { font-size: 18px; }
      .msg .content h3 { font-size: 16px; }
      .msg .content h4,
      .msg .content h5,
      .msg .content h6 { font-size: 14px; }
      .msg .content p {
        margin: 0 0 8px 0;
      }
      .msg .content p:last-child {
        margin-bottom: 0;
      }
      .msg .content ul {
        margin: 8px 0 8px 18px;
        padding: 0;
      }
      .msg .content li {
        margin: 4px 0;
      }
      .msg .content pre {
        background: #0c111b;
        border: 1px solid #2b3442;
        border-radius: 8px;
        padding: 10px 12px;
        overflow-x: auto;
        margin: 10px 0;
      }
      .msg .content code {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
        font-size: 12px;
        background: #0c111b;
        border: 1px solid #2b3442;
        border-radius: 6px;
        padding: 2px 6px;
      }
      .msg .content pre code {
        border: 0;
        padding: 0;
        background: transparent;
      }
      .msg .content a {
        color: #8cb4ff;
        text-decoration: none;
      }
      .msg .content a:hover {
        text-decoration: underline;
      }
      .msg.user {
        border-color: #3354d8;
        background: #111a34;
      }
      .msg.system {
        color: #b7c0cc;
        font-size: 12px;
        background: #0d111b;
      }
      .status {
        font-size: 12px;
        color: #9aa4b2;
      }
      .row {
        display: flex;
        gap: 8px;
        align-items: center;
      }
      .row.wrap {
        flex-wrap: wrap;
      }
      .mono {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
        font-size: 12px;
        background: #0c111b;
        border: 1px solid #2f3847;
        border-radius: 8px;
        padding: 8px 10px;
        overflow-x: auto;
      }
      .hidden {
        display: none;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <header>
        <h1>Papert Code Web</h1>
        <span class="badge">A2A daemon</span>
      </header>

      <div class="panel grid two">
        <div>
          <label for="serverToken">Server token (optional)</label>
          <input id="serverToken" type="password" placeholder="Enter server token if required" />
        </div>
        <div class="row wrap" style="align-items:flex-end;">
          <button id="connectBtn">Connect</button>
          <button id="newTaskBtn" class="secondary" disabled>New conversation</button>
          <label class="row" style="gap:6px; font-size:12px;">
            <input id="autoExecToggle" type="checkbox" />
            Auto-execute tools
          </label>
        </div>
        <div class="status" id="statusText">Not connected.</div>
      </div>

      <div class="panel hidden" id="attachPanel">
        <div class="status">Attach from another client:</div>
        <div class="mono" id="attachCommand"></div>
      </div>

      <div class="panel">
        <div class="messages" id="messages"></div>
      </div>

      <div class="panel">
        <label for="promptInput">Prompt</label>
        <div class="row">
          <textarea id="promptInput" rows="3" placeholder="Ask Papert Code..."></textarea>
          <button id="sendBtn" disabled>Send</button>
        </div>
      </div>
    </div>

    <script>
      const state = {
        sessionId: '',
        sessionToken: '',
        workspaceRoot: '',
        taskId: '',
        connected: false,
      };

      const serverTokenInput = document.getElementById('serverToken');
      const connectBtn = document.getElementById('connectBtn');
      const sendBtn = document.getElementById('sendBtn');
      const newTaskBtn = document.getElementById('newTaskBtn');
      const promptInput = document.getElementById('promptInput');
      const messagesEl = document.getElementById('messages');
      const statusText = document.getElementById('statusText');
      const attachPanel = document.getElementById('attachPanel');
      const attachCommand = document.getElementById('attachCommand');
      const autoExecToggle = document.getElementById('autoExecToggle');

      function setStatus(text) {
        statusText.textContent = text;
      }

      let activeAssistantEl = null;
      let activeAssistantText = '';

      function addMessage(text, role) {
        const el = document.createElement('div');
        el.className = 'msg ' + (role || 'assistant');
        const content = document.createElement('div');
        content.className = 'content';
        content.innerHTML = renderMarkdown(text || '');
        el.appendChild(content);
        messagesEl.appendChild(el);
        messagesEl.scrollTop = messagesEl.scrollHeight;
        return el;
      }

      function endStreaming() {
        if (activeAssistantEl) {
          activeAssistantEl.dataset.streaming = 'false';
        }
        activeAssistantEl = null;
        activeAssistantText = '';
      }

      function appendAssistantText(text) {
        if (!activeAssistantEl) {
          const lastStreaming = Array.from(
            messagesEl.querySelectorAll('.msg.assistant')
          ).reverse().find((el) => el.dataset.streaming === 'true');
          if (lastStreaming) {
            activeAssistantEl = lastStreaming;
            activeAssistantText = activeAssistantEl.textContent || '';
          } else {
            activeAssistantText = '';
            activeAssistantEl = addMessage('', 'assistant');
            activeAssistantEl.dataset.streaming = 'true';
          }
        }
        activeAssistantText += text;
        const content = activeAssistantEl.querySelector('.content');
        if (content) {
          content.innerHTML = renderMarkdown(activeAssistantText);
        }
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }

      function resetConversation() {
        state.taskId = '';
        endStreaming();
        addMessage('Starting a new conversation.', 'system');
      }

      function updateAttachCommand() {
        const origin = window.location.origin;
        const cmd = 'papert attach ' + origin +
          ' --session-id ' + state.sessionId +
          ' --session-token ' + state.sessionToken;
        attachCommand.textContent = cmd;
        attachPanel.classList.remove('hidden');
      }

      async function createSession() {
        setStatus('Connecting to daemon...');
        const token = serverTokenInput.value.trim();
        const headers = {};
        if (token) {
          headers['authorization'] = 'Bearer ' + token;
        }
        const res = await fetch('/api/v1/sessions', {
          method: 'POST',
          headers,
        });
        if (!res.ok) {
          setStatus('Failed to create session: ' + res.status + ' ' + res.statusText);
          return;
        }
        const data = await res.json();
        state.sessionId = data.sessionId;
        state.sessionToken = data.token;
        state.workspaceRoot = data.workspaceRoot || '';
        state.connected = true;
        sendBtn.disabled = false;
        newTaskBtn.disabled = false;
        setStatus('Connected. Session: ' + state.sessionId);
        updateAttachCommand();
        addMessage('Session established for workspace: ' + state.workspaceRoot, 'system');
      }

      function buildHeaders() {
        const headers = {
          'content-type': 'application/json',
        };
        if (state.sessionToken) {
          headers['authorization'] = 'Bearer ' + state.sessionToken;
        }
        if (state.sessionId) {
          headers['x-papert-session-id'] = state.sessionId;
        }
        return headers;
      }

      function buildRpcRequest(promptText) {
        const request = {
          jsonrpc: '2.0',
          id: 'web-' + Date.now(),
          method: 'message/stream',
          params: {
            message: {
              kind: 'message',
              role: 'user',
              parts: [{ kind: 'text', text: promptText }],
              messageId: 'web-msg-' + Math.random().toString(36).slice(2),
            },
            metadata: {
              coderAgent: {
                kind: 'agent-settings',
                workspacePath: state.workspaceRoot || '/',
                autoExecute: autoExecToggle.checked,
              },
            },
          },
        };
        if (state.taskId) {
          request.params.taskId = state.taskId;
        }
        return request;
      }

      async function readSse(response, onEvent) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let idx;
          while ((idx = buffer.indexOf('\\n\\n')) >= 0) {
            const chunk = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            const lines = chunk.split('\\n');
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const payload = line.slice(6);
              try {
                const event = JSON.parse(payload);
                onEvent(event);
              } catch (err) {
                addMessage('Failed to parse event: ' + payload, 'system');
              }
            }
          }
        }
      }

      function handleEvent(event) {
        if (!event || !event.result) return;
        const result = event.result;
        if (result.kind === 'task' && result.id) {
          state.taskId = result.id;
          addMessage('Task created: ' + state.taskId, 'system');
          return;
        }
        if (result.kind === 'status-update') {
          const parts = result.status && result.status.message && result.status.message.parts;
          if (Array.isArray(parts)) {
            for (const part of parts) {
              if (part.kind === 'text' && part.text) {
                appendAssistantText(part.text);
              }
            }
          } else {
            addMessage('Status: ' + result.status.state, 'system');
          }
        }
      }

      async function sendPrompt() {
        const text = promptInput.value.trim();
        if (!text) return;
        endStreaming();
        addMessage(text, 'user');
        promptInput.value = '';
        // Start a fresh assistant bubble for this turn.
        endStreaming();
        const request = buildRpcRequest(text);
        const res = await fetch('/', {
          method: 'POST',
          headers: buildHeaders(),
          body: JSON.stringify(request),
        });
        if (!res.ok) {
          addMessage('Request failed: ' + res.status + ' ' + res.statusText, 'system');
          return;
        }
        await readSse(res, handleEvent);
      }

      connectBtn.addEventListener('click', () => {
        if (state.connected) {
          setStatus('Already connected.');
          return;
        }
        createSession().catch((err) => {
          setStatus('Failed to connect: ' + err.message);
        });
      });

      sendBtn.addEventListener('click', () => {
        sendPrompt().catch((err) => addMessage('Error: ' + err.message, 'system'));
      });

      newTaskBtn.addEventListener('click', () => {
        resetConversation();
      });

      promptInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
          sendPrompt().catch((err) => addMessage('Error: ' + err.message, 'system'));
        }
      });

      function escapeHtml(text) {
        return text
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\"/g, '&quot;')
          .replace(/'/g, '&#39;');
      }

      function renderMarkdown(input) {
        const text = String(input || '');
        if (!text) return '';
        const tick = String.fromCharCode(96);
        const fenceOnlyRegex = new RegExp(
          '^' + tick + tick + tick + '(?:md|markdown)?\\s*([\\s\\S]*?)\\s*' + tick + tick + tick + '$',
          'i'
        );
        const fenceOnlyMatch = text.match(fenceOnlyRegex);
        const unwrapped = fenceOnlyMatch ? fenceOnlyMatch[1] : text;
        if (window.marked && typeof window.marked.parse === 'function') {
          const normalizedExternal = unwrapped
            .replace(/(^|[^\\n])\\s+[-*]\\s+/g, '$1\\n- ')
            .replace(/(^|[^\\n])\\s*(#{1,6})\\s+/g, '$1\\n$2 ');
          return window.marked.parse(normalizedExternal, { breaks: true, gfm: true });
        }
        const escaped = escapeHtml(unwrapped);
        const normalized = escaped
          .replace(/(^|[^\\n])\\s*(#{1,6})\\s+/g, '$1\\n$2 ')
          .replace(/(^|[^\\n])\\s+[-*]\\s+/g, '$1\\n- ');
        const fences = [];
        const fenceRegex = new RegExp(tick + tick + tick + '([\\s\\S]*?)' + tick + tick + tick, 'g');
        const inlineCodeRegex = new RegExp(tick + '([^' + tick + ']*)' + tick, 'g');
        const withoutFences = normalized.replace(fenceRegex, (_match, code) => {
          const index = fences.length;
          fences.push('<pre><code>' + code.trim() + '</code></pre>');
          return '@@FENCE_' + index + '@@';
        });
        const lines = withoutFences.split('\\n');
        const out = [];
        let listOpen = false;
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const headingMatch = line.match(/^(#{1,6})\\s+(.+)/);
          const listMatch = line.match(/^\\s*[-*]\\s+(.+)/);
          if (headingMatch) {
            if (listOpen) {
              out.push('</ul>');
              listOpen = false;
            }
            const level = headingMatch[1].length;
            out.push('<h' + level + '>' + headingMatch[2] + '</h' + level + '>');
            continue;
          }
          if (listMatch) {
            if (!listOpen) {
              out.push('<ul>');
              listOpen = true;
            }
            out.push('<li>' + listMatch[1] + '</li>');
            continue;
          }
          if (listOpen) {
            out.push('</ul>');
            listOpen = false;
          }
          if (line.trim().length === 0) {
            out.push('');
            continue;
          }
          out.push('<p>' + line + '</p>');
        }
        if (listOpen) {
          out.push('</ul>');
        }
        let html = out.join('\\n')
          .replace(inlineCodeRegex, '<code>$1</code>')
          .replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>')
          .replace(/\\*([^*]+)\\*/g, '<em>$1</em>')
          .replace(/(https?:\\/\\/[^\\s<]+)/g, '<a href="$1" target="_blank" rel="noreferrer">$1</a>')
          .replace(/\\n{2,}/g, '\\n');
        html = html.replace(/@@FENCE_(\d+)@@/g, (_m, i) => fences[Number(i)]);
        return html;
      }
    </script>
  </body>
</html>`;
}
