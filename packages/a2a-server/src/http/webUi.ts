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
        --bg-elev: #0f1724;
        --bg-soft: #141c2b;
        --panel: #161f2f;
        --panel-2: #121a28;
        --stroke: #223149;
        --stroke-soft: #2a3a52;
        --text: #e7edf7;
        --muted: #9fb0c2;
        --accent: #3cd6b4;
        --accent-2: #f1b95a;
        --accent-3: #7aa2ff;
        --danger: #ff6b6b;
        --shadow: rgba(7, 10, 16, 0.5);
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        font-family: 'Space Grotesk', sans-serif;
        font-size: 14px;
        background: radial-gradient(circle at top, #1a263a, #0b0f14 60%);
        color: var(--text);
      }

      .app {
        min-height: 100vh;
        display: grid;
        grid-template-rows: auto 1fr;
      }

      .menu-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        padding: 12px 20px;
        border-bottom: 1px solid var(--stroke);
        background: linear-gradient(90deg, #0f1624, #111b2b);
        position: sticky;
        top: 0;
        z-index: 5;
      }

      .menu-left {
        display: flex;
        align-items: center;
        gap: 18px;
        flex-wrap: wrap;
      }

      .window-controls {
        display: flex;
        gap: 6px;
        align-items: center;
      }

      .window-controls span {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        display: inline-block;
        background: #445068;
      }

      .window-controls .close {
        background: #ff7b7b;
      }

      .window-controls .min {
        background: #ffd66b;
      }

      .window-controls .max {
        background: #76e7b7;
      }

      .brand {
        display: flex;
        align-items: center;
        gap: 10px;
        font-weight: 700;
        font-size: 18px;
        letter-spacing: 0.4px;
      }

      .pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        border-radius: 999px;
        font-size: 11px;
        background: rgba(60, 214, 180, 0.12);
        color: var(--accent);
        text-transform: uppercase;
        letter-spacing: 0.12em;
      }

      .menu-group {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      .menu-item {
        border: 1px solid transparent;
        background: transparent;
        color: var(--muted);
        padding: 6px 10px;
        border-radius: 8px;
        cursor: pointer;
        font: inherit;
        transition: all 0.2s ease;
      }

      .menu-item:hover {
        color: var(--text);
        border-color: var(--stroke-soft);
        background: rgba(16, 25, 39, 0.7);
      }

      .menu-item.active {
        color: var(--text);
        border-color: var(--accent);
        background: rgba(60, 214, 180, 0.12);
      }

      .menu-right {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .menu-shortcuts {
        display: flex;
        gap: 6px;
        align-items: center;
      }

      .menu-hint {
        font-size: 12px;
        color: var(--muted);
      }

      .chip {
        border-radius: 999px;
        border: 1px solid var(--stroke-soft);
        background: #101826;
        color: var(--text);
        padding: 6px 12px;
        font-size: 12px;
        cursor: pointer;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
      }

      .chip:hover {
        transform: translateY(-1px);
        box-shadow: 0 8px 16px var(--shadow);
      }

      .workspace {
        display: grid;
        grid-template-columns: 260px minmax(0, 1fr);
        min-height: 0;
      }

      aside, main {
        padding: 20px;
      }

      .sidebar {
        background: linear-gradient(180deg, #0d1420, #0a0f18);
        border-right: 1px solid var(--stroke);
        display: flex;
        flex-direction: column;
        gap: 18px;
      }

      .card {
        background: var(--panel);
        border: 1px solid var(--stroke);
        border-radius: 14px;
        padding: 14px;
        box-shadow: 0 10px 24px var(--shadow);
      }

      .card-title {
        font-size: 12px;
        color: var(--muted);
        text-transform: uppercase;
        letter-spacing: 0.2em;
        margin-bottom: 10px;
      }

      .section {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 12px;
        color: var(--muted);
        text-transform: uppercase;
        letter-spacing: 0.18em;
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
        box-shadow: 0 0 0 1px rgba(60, 214, 180, 0.2);
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
        gap: 16px;
        background: linear-gradient(180deg, rgba(16, 22, 34, 0.9), rgba(12, 16, 22, 0.95));
        min-height: 0;
        height: 100%;
        overflow: hidden;
      }

      .view-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
      }

      .view-header .title {
        font-size: 22px;
        font-weight: 700;
      }

      .view-header .subtitle {
        font-size: 13px;
        color: var(--muted);
      }

      .action-row {
        display: flex;
        gap: 10px;
        align-items: center;
        flex-wrap: wrap;
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

      input, textarea, select {
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

      .views {
        min-height: 0;
        overflow: hidden;
      }

      .view {
        display: none;
        height: 100%;
      }

      .view.active {
        display: block;
      }

      .view-grid {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 320px;
        gap: 16px;
        height: 100%;
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
        border-color: rgba(60, 214, 180, 0.6);
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

      .dock {
        display: flex;
        flex-direction: column;
        gap: 14px;
        min-height: 0;
      }

      .panel {
        background: var(--panel);
        border: 1px solid var(--stroke);
        border-radius: 14px;
        padding: 14px;
      }

      .panel h3 {
        margin: 0 0 10px 0;
        font-size: 12px;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: var(--muted);
      }

      .activity {
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-height: 220px;
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
        box-shadow: 0 0 0 0 rgba(60, 214, 180, 0.6);
        animation: pulse 2s infinite;
      }

      .pulse.off {
        background: #5d6b7e;
        animation: none;
      }

      @keyframes pulse {
        0% { box-shadow: 0 0 0 0 rgba(60, 214, 180, 0.5); }
        70% { box-shadow: 0 0 0 8px rgba(60, 214, 180, 0); }
        100% { box-shadow: 0 0 0 0 rgba(60, 214, 180, 0); }
      }

      .shortcut-grid {
        display: grid;
        gap: 8px;
      }

      .shortcut-btn {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        background: #141e2d;
        border: 1px solid var(--stroke-soft);
        border-radius: 10px;
        padding: 8px 10px;
        color: var(--text);
        cursor: pointer;
        font: inherit;
      }

      .shortcut-btn span {
        font-size: 11px;
        color: var(--muted);
      }

      .page-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 16px;
        height: 100%;
        overflow-y: auto;
        padding-bottom: 16px;
      }

      .page-card {
        background: var(--panel);
        border: 1px solid var(--stroke);
        border-radius: 16px;
        padding: 16px;
        display: grid;
        gap: 12px;
        min-height: 220px;
      }

      .page-card h3 {
        margin: 0;
        font-size: 14px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--muted);
      }

      .data-list {
        display: grid;
        gap: 10px;
      }

      .data-item {
        border-radius: 12px;
        border: 1px solid var(--stroke-soft);
        background: #101826;
        padding: 10px 12px;
        display: grid;
        gap: 6px;
      }

      .data-item .name {
        font-weight: 600;
      }

      .tag {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: var(--accent-3);
      }

      .tag.success {
        color: var(--accent);
      }

      .tag.warn {
        color: var(--accent-2);
      }

      .form-grid {
        display: grid;
        gap: 10px;
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

      .info-modal {
        position: fixed;
        inset: 0;
        background: rgba(4, 6, 10, 0.75);
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 30;
      }

      .info-modal.active {
        display: flex;
      }

      .info-card {
        width: min(680px, 92vw);
        background: #101826;
        border: 1px solid #223047;
        border-radius: 18px;
        padding: 18px;
        display: grid;
        gap: 12px;
        box-shadow: 0 30px 60px rgba(0, 0, 0, 0.4);
      }

      .info-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }

      .info-title {
        font-size: 16px;
        font-weight: 700;
      }

      @media (max-width: 1200px) {
        .view-grid {
          grid-template-columns: 1fr;
        }
        .dock {
          order: -1;
        }
      }

      @media (max-width: 980px) {
        .workspace {
          grid-template-columns: 1fr;
        }
        .sidebar {
          border-right: none;
          border-bottom: 1px solid var(--stroke);
        }
      }

      @media (max-width: 720px) {
        .menu-group {
          display: none;
        }
        .menu-right {
          flex-wrap: wrap;
        }
      }
    </style>
  </head>
  <body>
    <div class="app">
      <header class="menu-bar">
        <div class="menu-left">
          <div class="window-controls">
            <span class="close"></span>
            <span class="min"></span>
            <span class="max"></span>
          </div>
          <div class="brand">
            Papert Code
            <span class="pill">Web</span>
          </div>
          <nav class="menu-group">
            <button class="menu-item active" data-view="chat">Workspace</button>
            <button class="menu-item" data-view="cli">CLI</button>
            <button class="menu-item" data-view="tools">Tools</button>
            <button class="menu-item" data-view="agents">Agents</button>
            <button class="menu-item" data-view="skills">Skills</button>
            <button class="menu-item" data-view="mcps">MCPs</button>
            <button class="menu-item" data-view="custom-tools">Custom Tools</button>
            <button class="menu-item" data-view="plugins">Plugins</button>
            <button class="menu-item" data-view="hooks">Hooks</button>
            <button class="menu-item" data-view="scheduler">Schedule</button>
          </nav>
        </div>
        <div class="menu-right">
          <div class="menu-shortcuts">
            <button class="chip" data-modal="commands">Commands</button>
            <button class="chip" data-modal="tools">Tools</button>
            <button class="chip" data-modal="agents">Agents</button>
          </div>
          <div class="menu-hint">Cmd/Ctrl + K</div>
        </div>
      </header>

      <div class="workspace">
        <aside class="sidebar">
          <div class="card">
            <div class="card-title">Connection</div>
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
          <div class="view-header">
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

          <div class="views">
            <section class="view active" id="view-chat">
              <div class="view-grid">
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
                <aside class="dock">
                  <div class="panel">
                    <h3>Activity</h3>
                    <div id="activityFeed" class="activity"></div>
                  </div>
                  <div class="panel">
                    <h3>Shortcuts</h3>
                    <div class="shortcut-grid">
                      <button class="shortcut-btn" data-modal="commands">All Commands <span>Slash, terminal, tips</span></button>
                      <button class="shortcut-btn" data-modal="tools">Tools Overview <span>Run, read, write, web</span></button>
                      <button class="shortcut-btn" data-modal="agents">Agents List <span>Available roles</span></button>
                    </div>
                  </div>
                  <div class="panel">
                    <h3>Tips</h3>
                    <div class="activity-item">Cmd/Ctrl + K to open the command palette.</div>
                    <div class="activity-item">Use the menu bar to switch between MCPs, tools, and scheduling.</div>
                  </div>
                  <div class="panel">
                    <h3>Share</h3>
                    <div class="share-card">
                      <input id="shareToken" placeholder="Share token (optional)" />
                      <button id="shareNowBtn">Create share link</button>
                      <div id="shareResult" class="share-link">No share link yet.</div>
                    </div>
                  </div>
                </aside>
              </div>
            </section>

            <section class="view" id="view-cli">
              <div class="page-grid">
                <div class="page-card">
                  <h3>CLI Commands</h3>
                  <input id="cliSearch" placeholder="Filter commands" />
                  <div id="cliList" class="data-list"></div>
                </div>
                <div class="page-card">
                  <h3>Quick Notes</h3>
                  <div class="activity-item">Slash commands control the CLI UI and settings.</div>
                  <div class="activity-item">Terminal commands are invoked as papert &lt;command&gt;.</div>
                  <div class="activity-item">Use @ to load files and ! to run shell commands.</div>
                </div>
              </div>
            </section>

            <section class="view" id="view-tools">
              <div class="page-grid">
                <div class="page-card">
                  <h3>Tools</h3>
                  <div id="toolsList" class="data-list"></div>
                </div>
                <div class="page-card">
                  <h3>Tool Policies</h3>
                  <div class="activity-item">Sensitive tools require confirmation before running.</div>
                  <div class="activity-item">Auto-execute can be toggled per session.</div>
                </div>
              </div>
            </section>

            <section class="view" id="view-agents">
              <div class="page-grid">
                <div class="page-card">
                  <h3>Agents</h3>
                  <div id="agentsList" class="data-list"></div>
                </div>
                <div class="page-card">
                  <h3>Assignments</h3>
                  <div class="activity-item">Route tasks to specialist agents when needed.</div>
                  <div class="activity-item">Use agents to compare solutions quickly.</div>
                </div>
              </div>
            </section>

            <section class="view" id="view-skills">
              <div class="page-grid">
                <div class="page-card">
                  <h3>Skills</h3>
                  <div id="skillsList" class="data-list"></div>
                </div>
                <div class="page-card">
                  <h3>Guidance</h3>
                  <div class="activity-item">Skills provide structured workflows and templates.</div>
                  <div class="activity-item">Install curated skills to expand capabilities.</div>
                </div>
              </div>
            </section>

            <section class="view" id="view-mcps">
              <div class="page-grid">
                <div class="page-card">
                  <h3>MCP Servers</h3>
                  <div id="mcpsList" class="data-list"></div>
                </div>
                <div class="page-card">
                  <h3>Management</h3>
                  <div class="activity-item">Configure MCPs to add external tools and prompts.</div>
                  <div class="activity-item">Status updates refresh with each session.</div>
                </div>
              </div>
            </section>

            <section class="view" id="view-custom-tools">
              <div class="page-grid">
                <div class="page-card">
                  <h3>Custom Tools</h3>
                  <div id="customToolsList" class="data-list"></div>
                </div>
                <div class="page-card">
                  <h3>Registry</h3>
                  <div class="activity-item">Custom tools can be sourced from local scripts.</div>
                  <div class="activity-item">Pair with MCPs for shared usage.</div>
                </div>
              </div>
            </section>

            <section class="view" id="view-plugins">
              <div class="page-grid">
                <div class="page-card">
                  <h3>Plugins</h3>
                  <div id="pluginsList" class="data-list"></div>
                </div>
                <div class="page-card">
                  <h3>Deployment</h3>
                  <div class="activity-item">Plugins are loaded at session start.</div>
                  <div class="activity-item">Restart a session to apply changes.</div>
                </div>
              </div>
            </section>

            <section class="view" id="view-hooks">
              <div class="page-grid">
                <div class="page-card">
                  <h3>Hooks</h3>
                  <div id="hooksList" class="data-list"></div>
                </div>
                <div class="page-card">
                  <h3>Automation</h3>
                  <div class="activity-item">Hooks validate actions before execution.</div>
                  <div class="activity-item">Use hooks to enforce safety policies.</div>
                </div>
              </div>
            </section>

            <section class="view" id="view-scheduler">
              <div class="page-grid">
                <div class="page-card">
                  <h3>Schedule Tasks</h3>
                  <form id="scheduleForm" class="form-grid">
                    <input id="scheduleName" placeholder="Task name" required />
                    <select id="scheduleType">
                      <option value="interval">Interval</option>
                      <option value="cron">Cron</option>
                      <option value="event">Event</option>
                    </select>
                    <input id="scheduleWhen" placeholder="Every 30m / 0 9 * * 1-5 / webhook" required />
                    <input id="scheduleTarget" placeholder="Target (tool, agent, MCP)" required />
                    <textarea id="scheduleNotes" placeholder="Notes"></textarea>
                    <button type="submit">Add schedule</button>
                  </form>
                </div>
                <div class="page-card">
                  <h3>Upcoming</h3>
                  <div id="scheduleList" class="data-list"></div>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>

    <div class="info-modal" id="infoModal">
      <div class="info-card">
        <div class="info-header">
          <div class="info-title" id="infoTitle">Details</div>
          <button class="ghost" id="infoClose">Close</button>
        </div>
        <input id="infoSearch" placeholder="Search list" />
        <div id="infoList" class="data-list"></div>
      </div>
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
        schedules: [],
        activeView: 'chat',
      };

      const catalog = {
        commands: [
          { name: 'papert server', detail: 'Start local server for remote driving', tag: 'terminal' },
          { name: 'papert connect', detail: 'Connect to a remote session', tag: 'terminal' },
          { name: 'papert mcp add', detail: 'Register an MCP server', tag: 'terminal' },
          { name: '/help', detail: 'Show available commands', tag: 'slash' },
          { name: '/tools', detail: 'Show tool list and status', tag: 'slash' },
          { name: '/agents', detail: 'Manage subagents', tag: 'slash' },
          { name: '/mcp', detail: 'List/configure MCP servers', tag: 'slash' },
          { name: '/skills', detail: 'List available skills', tag: 'slash' },
          { name: '/plugins', detail: 'List extensions and plugins', tag: 'slash' },
          { name: '/hooks', detail: 'Show hooks configuration', tag: 'slash' },
          { name: '/schedule', detail: 'Manage scheduled tasks', tag: 'slash' },
          { name: '/settings', detail: 'Edit configuration', tag: 'slash' },
          { name: '/theme', detail: 'Switch theme', tag: 'slash' },
          { name: '/memory', detail: 'Show or refresh memory', tag: 'slash' },
          { name: '/summary', detail: 'Summarize current session', tag: 'slash' },
          { name: '/share', detail: 'Create a share link', tag: 'slash' },
          { name: '/restore', detail: 'Restore a checkpoint', tag: 'slash' },
          { name: '/stats', detail: 'Show usage stats', tag: 'slash' },
          { name: '@{path}', detail: 'Read file or directory into context', tag: 'at' },
          { name: '!<cmd>', detail: 'Run a shell command', tag: 'bang' },
        ],
        tools: [
          { name: 'read_file', detail: 'Read a single file', tag: 'core' },
          { name: 'read_many_files', detail: 'Read many files or directories', tag: 'core' },
          { name: 'write_file', detail: 'Write or overwrite files', tag: 'core' },
          { name: 'edit', detail: 'Patch files safely', tag: 'core' },
          { name: 'run_shell_command', detail: 'Execute shell commands with approval', tag: 'core' },
          { name: 'web_fetch', detail: 'Fetch and summarize URLs', tag: 'network' },
          { name: 'web_search', detail: 'Search the web', tag: 'network' },
        ],
        agents: [
          { name: 'planner', detail: 'Break down complex tasks', tag: 'agent' },
          { name: 'builder', detail: 'Implement code changes', tag: 'agent' },
          { name: 'reviewer', detail: 'Review for risks and regressions', tag: 'agent' },
          { name: 'research', detail: 'Gather external context', tag: 'agent' },
        ],
        skills: [
          { name: 'skill-creator', detail: 'Create structured skills', tag: 'system' },
          { name: 'skill-installer', detail: 'Install curated skills', tag: 'system' },
        ],
        mcps: [
          { name: 'filesystem-mcp', detail: 'stdio - Connected', tag: 'connected' },
          { name: 'docs-mcp', detail: 'http - Pending', tag: 'pending' },
          { name: 'scheduler-mcp', detail: 'stdio - Connected', tag: 'connected' },
        ],
        customTools: [
          { name: 'mcp__filesystem.list', detail: 'List workspace files', tag: 'custom' },
          { name: 'mcp__docs.search', detail: 'Search internal docs', tag: 'custom' },
          { name: 'mcp__scheduler.trigger', detail: 'Trigger scheduled task', tag: 'custom' },
        ],
        plugins: [
          { name: 'context', detail: 'Adds project context prompts', tag: 'enabled' },
          { name: 'custom-commands', detail: 'Provides extra slash commands', tag: 'enabled' },
          { name: 'exclude-tools', detail: 'Restricts tools by policy', tag: 'disabled' },
        ],
        hooks: [
          { name: 'pre-run', detail: 'Validates shell commands', tag: 'enabled' },
          { name: 'post-run', detail: 'Collects run metadata', tag: 'enabled' },
          { name: 'pre-write', detail: 'Checks write operations', tag: 'enabled' },
        ],
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
      const cliSearch = document.getElementById('cliSearch');
      const cliList = document.getElementById('cliList');
      const toolsList = document.getElementById('toolsList');
      const agentsList = document.getElementById('agentsList');
      const skillsList = document.getElementById('skillsList');
      const mcpsList = document.getElementById('mcpsList');
      const customToolsList = document.getElementById('customToolsList');
      const pluginsList = document.getElementById('pluginsList');
      const hooksList = document.getElementById('hooksList');
      const scheduleForm = document.getElementById('scheduleForm');
      const scheduleList = document.getElementById('scheduleList');
      const infoModal = document.getElementById('infoModal');
      const infoTitle = document.getElementById('infoTitle');
      const infoList = document.getElementById('infoList');
      const infoSearch = document.getElementById('infoSearch');
      const infoClose = document.getElementById('infoClose');

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

      function renderList(target, items) {
        target.innerHTML = '';
        items.forEach((item) => {
          const el = document.createElement('div');
          el.className = 'data-item';
          el.innerHTML =
            '<div class="name">' + item.name + '</div>' +
            '<div class="meta">' + item.detail + '</div>' +
            '<div class="tag ' + tagClass(item.tag) + '">' + item.tag + '</div>';
          target.appendChild(el);
        });
      }

      function tagClass(tag) {
        if (tag === 'connected' || tag === 'enabled' || tag === 'core') return 'success';
        if (tag === 'pending' || tag === 'network') return 'warn';
        return '';
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
        if (state.activeView !== 'chat') {
          activeSessionTitle.textContent = 'Control Center';
          activeSessionMeta.textContent = 'Manage tools, agents, and integrations.';
          return;
        }
        activeSessionTitle.textContent = session.label;
        activeSessionMeta.textContent = session.workspaceRoot || 'Workspace pending';
      }

      function renderCatalogs() {
        renderList(toolsList, catalog.tools);
        renderList(agentsList, catalog.agents);
        renderList(skillsList, catalog.skills);
        renderList(mcpsList, catalog.mcps);
        renderList(customToolsList, catalog.customTools);
        renderList(pluginsList, catalog.plugins);
        renderList(hooksList, catalog.hooks);
      }

      function renderCommands(filterText) {
        const query = (filterText || '').toLowerCase();
        const items = catalog.commands.filter((cmd) =>
          cmd.name.toLowerCase().includes(query) || cmd.detail.toLowerCase().includes(query)
        );
        renderList(cliList, items);
      }

      function renderSchedules() {
        scheduleList.innerHTML = '';
        if (!state.schedules.length) {
          const empty = document.createElement('div');
          empty.className = 'activity-item';
          empty.textContent = 'No schedules yet. Create your first task.';
          scheduleList.appendChild(empty);
          return;
        }
        state.schedules.forEach((task) => {
          const el = document.createElement('div');
          el.className = 'data-item';
          el.innerHTML =
            '<div class="name">' + task.name + '</div>' +
            '<div class="meta">' + task.when + ' - ' + task.target + '</div>' +
            '<div class="tag ' + tagClass(task.status) + '">' + task.status + '</div>';
          scheduleList.appendChild(el);
        });
      }

      function renderViews() {
        document.querySelectorAll('.view').forEach((view) => {
          view.classList.toggle('active', view.id === 'view-' + state.activeView);
        });
        document.querySelectorAll('.menu-item').forEach((btn) => {
          btn.classList.toggle('active', btn.dataset.view === state.activeView);
        });
      }

      function render() {
        renderSessions();
        renderChats();
        renderMessages();
        renderActivity();
        renderHeader();
        renderCatalogs();
        renderCommands(cliSearch.value);
        renderSchedules();
        renderViews();
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

      function openInfoModal(type) {
        const items = catalog[type] || [];
        infoTitle.textContent = type === 'commands'
          ? 'CLI Commands'
          : type.charAt(0).toUpperCase() + type.slice(1);
        infoSearch.value = '';
        infoModal.dataset.type = type;
        infoModal.classList.add('active');
        renderInfoList();
      }

      function renderInfoList() {
        const type = infoModal.dataset.type || 'commands';
        const query = (infoSearch.value || '').toLowerCase();
        const items = (catalog[type] || []).filter((item) =>
          item.name.toLowerCase().includes(query) || item.detail.toLowerCase().includes(query)
        );
        renderList(infoList, items);
      }

      function setActiveView(view) {
        state.activeView = view;
        render();
        saveState();
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

      cliSearch.addEventListener('input', () => {
        renderCommands(cliSearch.value);
      });

      scheduleForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const name = document.getElementById('scheduleName').value.trim();
        const type = document.getElementById('scheduleType').value;
        const when = document.getElementById('scheduleWhen').value.trim();
        const target = document.getElementById('scheduleTarget').value.trim();
        const notes = document.getElementById('scheduleNotes').value.trim();
        if (!name || !when || !target) return;
        state.schedules.unshift({
          id: 'schedule-' + Date.now(),
          name,
          when: type + ' - ' + when,
          target,
          notes,
          status: 'enabled',
        });
        scheduleForm.reset();
        renderSchedules();
        saveState();
      });

      document.querySelectorAll('.menu-item').forEach((btn) => {
        btn.addEventListener('click', () => setActiveView(btn.dataset.view));
      });

      document.querySelectorAll('[data-modal]').forEach((btn) => {
        btn.addEventListener('click', () => openInfoModal(btn.dataset.modal));
      });

      infoClose.addEventListener('click', () => infoModal.classList.remove('active'));
      infoModal.addEventListener('click', (event) => {
        if (event.target === infoModal) infoModal.classList.remove('active');
      });

      infoSearch.addEventListener('input', renderInfoList);

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
          infoModal.classList.remove('active');
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
