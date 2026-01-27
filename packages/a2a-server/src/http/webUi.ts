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
      @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap');

      :root {
        color-scheme: light dark;
        --bg: #0b0f14;
        --bg-elev: #101823;
        --bg-soft: #0f1521;
        --panel: #151d2b;
        --panel-2: #131a28;
        --stroke: #1f2a3b;
        --stroke-soft: #233044;
        --text: #e7edf7;
        --muted: #9fb0c2;
        --accent: #42c3aa;
        --accent-2: #f1b95a;
        --danger: #ff6b6b;
        --shadow: rgba(10, 16, 26, 0.35);
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        font-family: 'Space Grotesk', sans-serif;
        font-size: 14px;
        background: radial-gradient(circle at top, #152033, #0b0f14 55%);
        color: var(--text);
      }

      .app {
        display: grid;
        grid-template-columns: 260px minmax(0, 1fr) 320px;
        min-height: 100vh;
      }

      aside, main {
        padding: 20px;
      }

      .sidebar {
        background: linear-gradient(180deg, #0d1420, #0a0f18);
        border-right: 1px solid var(--stroke);
      }

      .brand {
        display: flex;
        align-items: center;
        gap: 10px;
        font-weight: 700;
        font-size: 18px;
        letter-spacing: 0.4px;
        margin-bottom: 18px;
      }

      .pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        border-radius: 999px;
        font-size: 12px;
        background: rgba(66, 195, 170, 0.12);
        color: var(--accent);
      }

      .card {
        background: var(--panel);
        border: 1px solid var(--stroke);
        border-radius: 14px;
        padding: 14px;
        box-shadow: 0 10px 24px var(--shadow);
      }

      .section {
        margin-top: 18px;
      }

      .section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 10px;
        font-size: 13px;
        color: var(--muted);
        text-transform: uppercase;
        letter-spacing: 0.2em;
      }

      .list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .list-item {
        padding: 10px 12px;
        border-radius: 10px;
        background: var(--panel-2);
        border: 1px solid transparent;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .list-item:hover {
        border-color: var(--stroke-soft);
        transform: translateX(2px);
      }

      .list-item.active {
        border-color: var(--accent);
        box-shadow: 0 0 0 1px rgba(66, 195, 170, 0.2);
      }

      .list-item .title {
        font-size: 14px;
        font-weight: 600;
      }

      .list-item .meta {
        font-size: 12px;
        color: var(--muted);
      }

      .main {
        display: grid;
        grid-template-rows: auto 1fr;
        gap: 18px;
        background: linear-gradient(180deg, rgba(16, 22, 34, 0.9), rgba(12, 16, 22, 0.95));
        min-height: 100vh;
        height: 100vh;
        overflow: hidden;
      }

      .topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      .topbar .title {
        font-size: 22px;
        font-weight: 700;
      }

      .topbar .subtitle {
        font-size: 13px;
        color: var(--muted);
      }

      .action-row {
        display: flex;
        gap: 10px;
        align-items: center;
      }

      button {
        font: inherit;
        border: 0;
        border-radius: 10px;
        padding: 8px 12px;
        background: var(--accent);
        color: #041411;
        font-weight: 600;
        cursor: pointer;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
      }

      button.secondary {
        background: #233047;
        color: var(--text);
      }

      button.ghost {
        background: transparent;
        color: var(--text);
        border: 1px solid var(--stroke-soft);
      }

      button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      button:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 8px 16px var(--shadow);
      }

      input, textarea {
        font: inherit;
        width: 100%;
        padding: 8px 10px;
        border-radius: 10px;
        border: 1px solid var(--stroke-soft);
        background: #0b111c;
        color: var(--text);
      }

      textarea {
        min-height: 80px;
        resize: vertical;
      }

      .chat-window {
        display: grid;
        grid-template-rows: 1fr auto;
        gap: 16px;
        min-height: 0;
      }

      .messages {
        flex: 1;
        min-height: 0;
        padding: 16px;
        border-radius: 16px;
        background: rgba(12, 18, 28, 0.85);
        border: 1px solid var(--stroke);
        overflow-y: auto;
      }

      .msg {
        padding: 12px 14px;
        border-radius: 12px;
        margin-bottom: 12px;
        background: #111827;
        border: 1px solid #1f2a3b;
      }

      .msg.user {
        border-color: rgba(66, 195, 170, 0.6);
        background: rgba(20, 40, 48, 0.8);
      }

      .msg.system {
        font-size: 12px;
        color: var(--muted);
        background: #0f1521;
      }

      .msg .content {
        line-height: 1.6;
        white-space: normal;
        word-break: break-word;
      }

      .msg .content pre {
        background: #0b111c;
        border: 1px solid #233148;
        border-radius: 10px;
        padding: 12px;
        overflow-x: auto;
        font-family: 'JetBrains Mono', monospace;
        font-size: 12px;
      }

      .msg .content code {
        font-family: 'JetBrains Mono', monospace;
        font-size: 12px;
        background: #0b111c;
        border: 1px solid #233148;
        border-radius: 6px;
        padding: 2px 6px;
      }

      .composer {
        display: grid;
        gap: 8px;
        padding: 12px;
        border-radius: 16px;
        background: var(--panel);
        border: 1px solid var(--stroke);
        flex: 0 0 auto;
      }

      .toggle {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        color: var(--muted);
      }

      .rightbar {
        background: linear-gradient(180deg, #0e1420, #0b0f14);
        border-left: 1px solid var(--stroke);
        display: flex;
        flex-direction: column;
        gap: 14px;
        min-height: 100vh;
      }

      .panel {
        background: var(--panel);
        border: 1px solid var(--stroke);
        border-radius: 14px;
        padding: 14px;
        margin-bottom: 14px;
      }

      .panel h3 {
        margin: 0 0 10px 0;
        font-size: 14px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--muted);
      }

      .activity {
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-height: 300px;
        overflow-y: auto;
      }

      .activity-item {
        padding: 8px 10px;
        border-radius: 10px;
        background: #101826;
        border: 1px solid #1f2a3b;
        font-size: 12px;
      }

      .activity-item strong {
        color: var(--accent-2);
      }

      .share-card {
        display: grid;
        gap: 8px;
      }

      .share-link {
        font-family: 'JetBrains Mono', monospace;
        font-size: 12px;
        background: #0b111c;
        border: 1px solid #233148;
        border-radius: 10px;
        padding: 10px;
        word-break: break-all;
      }

      .status-row {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 12px;
        color: var(--muted);
      }

      .pulse {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--accent);
        box-shadow: 0 0 0 0 rgba(66, 195, 170, 0.6);
        animation: pulse 2s infinite;
      }

      .pulse.off {
        background: #5d6b7e;
        animation: none;
      }

      @keyframes pulse {
        0% { box-shadow: 0 0 0 0 rgba(66, 195, 170, 0.5); }
        70% { box-shadow: 0 0 0 8px rgba(66, 195, 170, 0); }
        100% { box-shadow: 0 0 0 0 rgba(66, 195, 170, 0); }
      }

      .command-palette {
        position: fixed;
        inset: 0;
        background: rgba(4, 6, 10, 0.7);
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 20;
      }

      .command-palette.active {
        display: flex;
      }

      .palette-card {
        width: min(520px, 92vw);
        background: #0d1422;
        border: 1px solid #223047;
        border-radius: 16px;
        padding: 16px;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4);
      }

      .palette-card h4 {
        margin: 0 0 12px 0;
        font-size: 14px;
        letter-spacing: 0.1em;
        color: var(--muted);
        text-transform: uppercase;
      }

      .palette-actions {
        display: grid;
        gap: 8px;
      }

      .palette-actions button {
        justify-content: flex-start;
        background: #182336;
        color: var(--text);
      }

      @media (max-width: 1100px) {
        .app {
          grid-template-columns: 220px minmax(0, 1fr);
        }
        .rightbar {
          display: none;
        }
      }

      @media (max-width: 820px) {
        .app {
          grid-template-columns: 1fr;
        }
        .sidebar {
          border-right: none;
          border-bottom: 1px solid var(--stroke);
        }
        .action-row {
          flex-wrap: wrap;
        }
      }
    </style>
  </head>
  <body>
    <div class="app">
      <aside class="sidebar">
        <div class="brand">
          Papert Code Web
          <span class="pill">A2A</span>
        </div>
        <div class="card">
          <div style="font-size:12px;color:var(--muted);margin-bottom:8px;">Server token (optional)</div>
          <input id="serverToken" type="password" placeholder="Token for remote session" />
          <div class="status-row" style="margin-top:10px;">
            <span class="pulse off" id="statusPulse"></span>
            <span id="statusText">Disconnected</span>
          </div>
          <div class="action-row" style="margin-top:12px;">
            <button id="connectBtn">New session</button>
            <button id="disconnectBtn" class="secondary">Release</button>
          </div>
        </div>

        <div class="section">
          <div class="section-header">
            <span>Sessions</span>
            <button id="refreshSessions" class="ghost">Refresh</button>
          </div>
          <div id="sessionList" class="list"></div>
        </div>

        <div class="section">
          <div class="section-header">
            <span>Chats</span>
            <button id="newChatBtn" class="ghost">New</button>
          </div>
          <div id="chatList" class="list"></div>
        </div>
      </aside>

      <main class="main">
        <div class="topbar">
          <div>
            <div class="title" id="activeSessionTitle">No session</div>
            <div class="subtitle" id="activeSessionMeta">Connect to start chatting</div>
          </div>
          <div class="action-row">
            <button id="shareBtn" class="secondary">Share</button>
            <button id="newChatTopBtn">New chat</button>
            <button id="clearChatBtn" class="ghost">Clear</button>
          </div>
        </div>

        <div class="chat-window">
          <div id="messages" class="messages"></div>
          <div class="composer">
            <label style="font-size:12px;color:var(--muted);">Prompt</label>
            <textarea id="promptInput" placeholder="Ask Papert Code... (Cmd/Ctrl + Enter to send)"></textarea>
            <div class="action-row">
              <label class="toggle">
                <input id="autoExecToggle" type="checkbox" />
                Auto-execute tools
              </label>
              <button id="sendBtn">Send</button>
            </div>
          </div>
        </div>
      </main>

      <aside class="rightbar">
        <div class="panel">
          <h3>Activity</h3>
          <div id="activityFeed" class="activity"></div>
        </div>
        <div class="panel">
          <h3>Share</h3>
          <div class="share-card">
            <input id="shareToken" placeholder="Share token (optional)" />
            <button id="shareNowBtn">Create share link</button>
            <div id="shareResult" class="share-link">No share link yet.</div>
          </div>
        </div>
        <div class="panel">
          <h3>Tips</h3>
          <div class="activity-item">Cmd/Ctrl + K to open command palette.</div>
          <div class="activity-item">Use the Sessions list to keep multiple workspaces open.</div>
        </div>
      </aside>
    </div>

    <div class="command-palette" id="commandPalette">
      <div class="palette-card">
        <h4>Quick Actions</h4>
        <div class="palette-actions">
          <button data-action="new-session">New session</button>
          <button data-action="new-chat">New chat</button>
          <button data-action="share">Share current chat</button>
          <button data-action="clear">Clear chat view</button>
        </div>
      </div>
    </div>

    <script>
      const storage = {
        load() {
          try {
            const raw = localStorage.getItem('papert.web.state');
            return raw ? JSON.parse(raw) : null;
          } catch {
            return null;
          }
        },
        save(state) {
          localStorage.setItem('papert.web.state', JSON.stringify(state));
        },
      };

      const state = storage.load() || {
        sessions: [],
        activeSessionId: '',
        activeChatId: '',
        shareHistory: [],
      };

      const serverTokenInput = document.getElementById('serverToken');
      const connectBtn = document.getElementById('connectBtn');
      const disconnectBtn = document.getElementById('disconnectBtn');
      const refreshSessions = document.getElementById('refreshSessions');
      const sessionList = document.getElementById('sessionList');
      const chatList = document.getElementById('chatList');
      const sendBtn = document.getElementById('sendBtn');
      const newChatBtn = document.getElementById('newChatBtn');
      const newChatTopBtn = document.getElementById('newChatTopBtn');
      const clearChatBtn = document.getElementById('clearChatBtn');
      const promptInput = document.getElementById('promptInput');
      const messagesEl = document.getElementById('messages');
      const statusText = document.getElementById('statusText');
      const statusPulse = document.getElementById('statusPulse');
      const activeSessionTitle = document.getElementById('activeSessionTitle');
      const activeSessionMeta = document.getElementById('activeSessionMeta');
      const autoExecToggle = document.getElementById('autoExecToggle');
      const activityFeed = document.getElementById('activityFeed');
      const shareBtn = document.getElementById('shareBtn');
      const shareNowBtn = document.getElementById('shareNowBtn');
      const shareTokenInput = document.getElementById('shareToken');
      const shareResult = document.getElementById('shareResult');
      const commandPalette = document.getElementById('commandPalette');

      function saveState() {
        storage.save(state);
      }

      function formatTime(ts) {
        const d = new Date(ts);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }

      function setStatus(text, connected) {
        statusText.textContent = text;
        statusPulse.classList.toggle('off', !connected);
      }

      function updateConnectState() {
        const tokenReady = serverTokenInput.value.trim().length > 0;
        const connected = !!currentSession();
        connectBtn.disabled = !tokenReady || connected;
        disconnectBtn.disabled = !connected;
      }

      function currentSession() {
        return state.sessions.find((s) => s.id === state.activeSessionId) || null;
      }

      function currentChat() {
        const session = currentSession();
        if (!session) return null;
        return session.chats.find((c) => c.id === state.activeChatId) || null;
      }

      function ensureChat(session) {
        if (!session.chats || session.chats.length === 0) {
          const chat = createChat();
          session.chats = [chat];
          state.activeChatId = chat.id;
        }
      }

      function createChat() {
        return {
          id: 'chat-' + Date.now(),
          title: 'New chat',
          createdAt: Date.now(),
          taskId: '',
          messages: [],
          activity: [],
        };
      }

      function renderSessions() {
        sessionList.innerHTML = '';
        state.sessions.forEach((session) => {
          const el = document.createElement('div');
          el.className = 'list-item' + (session.id === state.activeSessionId ? ' active' : '');
          el.innerHTML = '<div class="title">' + session.label + '</div>' +
            '<div class="meta">' + session.workspaceRoot + '</div>';
          el.addEventListener('click', () => {
            state.activeSessionId = session.id;
            ensureChat(session);
            render();
            saveState();
          });
          sessionList.appendChild(el);
        });
      }

      function renderChats() {
        chatList.innerHTML = '';
        const session = currentSession();
        if (!session) return;
        session.chats.forEach((chat) => {
          const el = document.createElement('div');
          el.className = 'list-item' + (chat.id === state.activeChatId ? ' active' : '');
          el.innerHTML = '<div class="title">' + chat.title + '</div>' +
            '<div class="meta">' + formatTime(chat.createdAt) + '</div>';
          el.addEventListener('click', () => {
            state.activeChatId = chat.id;
            render();
            saveState();
          });
          chatList.appendChild(el);
        });
      }

      function renderMessages() {
        messagesEl.innerHTML = '';
        const chat = currentChat();
        if (!chat) return;
        chat.messages.forEach((msg) => {
          const el = document.createElement('div');
          el.className = 'msg ' + msg.role;
          const content = document.createElement('div');
          content.className = 'content';
          content.innerHTML = renderMarkdown(msg.content || '');
          el.appendChild(content);
          messagesEl.appendChild(el);
        });
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }

      function renderActivity() {
        activityFeed.innerHTML = '';
        const chat = currentChat();
        if (!chat) return;
        chat.activity.slice(-12).forEach((item) => {
          const el = document.createElement('div');
          el.className = 'activity-item';
          el.innerHTML = '<strong>' + item.label + '</strong> ' + item.detail;
          activityFeed.appendChild(el);
        });
      }

      function renderHeader() {
        const session = currentSession();
        if (!session) {
          activeSessionTitle.textContent = 'No session';
          activeSessionMeta.textContent = 'Connect to start chatting.';
          return;
        }
        activeSessionTitle.textContent = session.label;
        activeSessionMeta.textContent = session.workspaceRoot || 'Workspace pending';
      }

      function render() {
        renderSessions();
        renderChats();
        renderMessages();
        renderActivity();
        renderHeader();
        const session = currentSession();
        const connected = !!session;
        setStatus(connected ? 'Connected' : 'Disconnected', connected);
        sendBtn.disabled = !connected;
        newChatBtn.disabled = !connected;
        newChatTopBtn.disabled = !connected;
        clearChatBtn.disabled = !connected;
        shareBtn.disabled = !connected;
        shareNowBtn.disabled = !connected;
        updateConnectState();
      }

      function addMessage(role, content) {
        const chat = currentChat();
        if (!chat) return;
        chat.messages.push({ role, content, createdAt: Date.now() });
        if (role === 'user' && chat.title === 'New chat') {
          chat.title = content.slice(0, 32) || 'New chat';
        }
        renderMessages();
        saveState();
      }

      function appendAssistantText(text) {
        const chat = currentChat();
        if (!chat) return;
        let last = chat.messages[chat.messages.length - 1];
        if (!last || last.role !== 'assistant' || !last.streaming) {
          last = { role: 'assistant', content: '', createdAt: Date.now(), streaming: true };
          chat.messages.push(last);
        }
        last.content += text;
        renderMessages();
        saveState();
      }

      function endStreaming() {
        const chat = currentChat();
        if (!chat) return;
        const last = chat.messages[chat.messages.length - 1];
        if (last && last.role === 'assistant' && last.streaming) {
          last.streaming = false;
        }
      }

      function logActivity(label, detail) {
        const chat = currentChat();
        if (!chat) return;
        chat.activity.push({ label, detail, createdAt: Date.now() });
        renderActivity();
        saveState();
      }

      function buildHeaders(session) {
        const headers = { 'content-type': 'application/json' };
        if (session && session.token) {
          headers['authorization'] = 'Bearer ' + session.token;
        }
        if (session && session.id) {
          headers['x-papert-session-id'] = session.id;
        }
        return headers;
      }

      function buildRpcRequest(session, promptText, taskId) {
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
                workspacePath: session.workspaceRoot || '/',
                autoExecute: autoExecToggle.checked,
              },
            },
          },
        };
        if (taskId) {
          request.params.taskId = taskId;
        }
        return request;
      }

      async function readSse(response, onEvent) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          buffer += decoder.decode(chunk.value, { stream: true });
          let idx;
          while ((idx = buffer.indexOf('\\n\\n')) >= 0) {
            const block = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            const lines = block.split('\\n');
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const payload = line.slice(6);
              try {
                const event = JSON.parse(payload);
                onEvent(event);
              } catch {
                addMessage('system', 'Failed to parse event payload.');
              }
            }
          }
        }
      }

      function handleEvent(event) {
        if (!event || !event.result) return;
        const result = event.result;
        if (result.kind === 'task' && result.id) {
          const chat = currentChat();
          if (chat) {
            chat.taskId = result.id;
            logActivity('Task', 'Created ' + result.id);
            saveState();
          }
          return;
        }
        if (result.kind === 'status-update') {
          const parts = result.status && result.status.message && result.status.message.parts;
          if (Array.isArray(parts)) {
            parts.forEach((part) => {
              if (part.kind === 'text' && part.text) {
                appendAssistantText(part.text);
              }
            });
          } else if (result.status && result.status.state) {
            logActivity('Status', result.status.state);
          }
        } else if (result.kind && String(result.kind).includes('tool')) {
          logActivity('Tool', String(result.kind));
        }
      }

      async function createSession() {
        const token = serverTokenInput.value.trim();
        if (!token) {
          setStatus('Enter server token to connect.', false);
          return;
        }
        const headers = { authorization: 'Bearer ' + token };

        setStatus('Connecting...', true);
        const res = await fetch('/api/v1/sessions', { method: 'POST', headers });
        if (!res.ok) {
          setStatus('Failed to connect: ' + res.status, false);
          return;
        }
        const data = await res.json();
        const session = {
          id: data.sessionId,
          token: data.token,
          workspaceRoot: data.workspaceRoot || '',
          label: 'Session ' + (state.sessions.length + 1),
          createdAt: Date.now(),
          chats: [createChat()],
        };
        state.sessions.unshift(session);
        state.activeSessionId = session.id;
        state.activeChatId = session.chats[0].id;
        setStatus('Connected', true);
        addMessage('system', 'Session established for ' + (session.workspaceRoot || 'workspace'));
        render();
        saveState();
      }

      async function releaseSession() {
        const session = currentSession();
        if (!session) return;
        const headers = {};
        if (session.token) headers['authorization'] = 'Bearer ' + session.token;
        const res = await fetch('/api/v1/sessions/' + session.id + '/release', {
          method: 'POST',
          headers,
        });
        if (res.ok) {
          state.sessions = state.sessions.filter((s) => s.id !== session.id);
          state.activeSessionId = state.sessions.length ? state.sessions[0].id : '';
          state.activeChatId = currentSession() && currentSession().chats[0].id || '';
          setStatus('Session released', false);
          render();
          saveState();
        } else {
          setStatus('Release failed', true);
        }
      }

      async function sendPrompt() {
        const session = currentSession();
        const chat = currentChat();
        const text = promptInput.value.trim();
        if (!session || !chat || !text) return;
        promptInput.value = '';
        endStreaming();
        addMessage('user', text);
        endStreaming();
        logActivity('User', 'Sent prompt');
        const request = buildRpcRequest(session, text, chat.taskId);
        const res = await fetch('/', {
          method: 'POST',
          headers: buildHeaders(session),
          body: JSON.stringify(request),
        });
        if (!res.ok) {
          addMessage('system', 'Request failed: ' + res.status);
          return;
        }
        await readSse(res, handleEvent);
        endStreaming();
      }

      function newChat() {
        const session = currentSession();
        if (!session) return;
        const chat = createChat();
        session.chats.unshift(chat);
        state.activeChatId = chat.id;
        addMessage('system', 'Started a new chat.');
        render();
        saveState();
      }

      function clearChat() {
        const chat = currentChat();
        if (!chat) return;
        chat.messages = [];
        chat.activity = [];
        render();
        saveState();
      }

      async function shareCurrentChat() {
        const session = currentSession();
        const chat = currentChat();
        if (!session || !chat) return;
        const payload = {
          sessionId: session.id,
          chatId: chat.id,
          title: chat.title,
          workspaceRoot: session.workspaceRoot,
          messages: chat.messages.map((m) => ({ role: m.role, content: m.content, ts: m.createdAt })),
        };
        const headers = { 'content-type': 'application/json' };
        const shareToken = shareTokenInput.value.trim();
        if (shareToken) headers['authorization'] = 'Bearer ' + shareToken;
        const res = await fetch('/api/v1/share', {
          method: 'POST',
          headers,
          body: JSON.stringify({ payload, sessionId: session.id }),
        });
        if (!res.ok) {
          shareResult.textContent = 'Share failed: ' + res.status;
          return;
        }
        const data = await res.json();
        shareResult.textContent = data.url + ' (secret: ' + data.secret + ')';
        state.shareHistory.unshift({ url: data.url, secret: data.secret, createdAt: Date.now() });
        saveState();
      }

      function toggleCommandPalette(open) {
        commandPalette.classList.toggle('active', open);
      }

      connectBtn.addEventListener('click', () => {
        createSession().catch((err) => setStatus(err.message, false));
      });

      disconnectBtn.addEventListener('click', () => {
        releaseSession().catch(() => setStatus('Release failed', true));
      });

      refreshSessions.addEventListener('click', () => {
        render();
      });

      newChatBtn.addEventListener('click', () => newChat());
      newChatTopBtn.addEventListener('click', () => newChat());
      clearChatBtn.addEventListener('click', () => clearChat());

      sendBtn.addEventListener('click', () => {
        sendPrompt().catch((err) => addMessage('system', 'Error: ' + err.message));
      });

      promptInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          sendPrompt().catch((err) => addMessage('system', 'Error: ' + err.message));
        }
      });

      shareBtn.addEventListener('click', () => shareCurrentChat());
      shareNowBtn.addEventListener('click', () => shareCurrentChat());

      serverTokenInput.addEventListener('input', () => updateConnectState());

      commandPalette.addEventListener('click', (event) => {
        if (event.target === commandPalette) {
          toggleCommandPalette(false);
        }
      });

      document.querySelectorAll('.palette-actions button').forEach((btn) => {
        btn.addEventListener('click', () => {
          const action = btn.getAttribute('data-action');
          toggleCommandPalette(false);
          if (action === 'new-session') createSession();
          if (action === 'new-chat') newChat();
          if (action === 'share') shareCurrentChat();
          if (action === 'clear') clearChat();
        });
      });

      window.addEventListener('keydown', (event) => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
          event.preventDefault();
          toggleCommandPalette(true);
        }
        if (event.key === 'Escape') {
          toggleCommandPalette(false);
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
        if (window.marked && typeof window.marked.parse === 'function') {
          return window.marked.parse(text, { breaks: true, gfm: true });
        }
        return '<pre>' + escapeHtml(text) + '</pre>';
      }

      render();
    </script>
  </body>
</html>`;
}
