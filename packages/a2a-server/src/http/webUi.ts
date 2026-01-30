/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

const WEB_UI_STYLES = `
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
        height: 100vh;
        display: grid;
        grid-template-rows: auto minmax(0, 1fr);
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
        height: 100%;
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
        height: 100%;
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
        grid-template-columns: 1fr;
        gap: 16px;
        height: 100%;
        min-height: 0;
      }

      .chat-window {
        display: grid;
        grid-template-rows: minmax(0, 1fr) auto;
        gap: 16px;
        min-height: 0;
        height: 100%;
      }

      .messages {
        flex: 1;
        min-height: 0;
        padding: 16px;
        border-radius: 16px;
        background: rgba(12, 18, 28, 0.85);
        border: 1px solid var(--stroke);
        overflow-y: auto;
        max-height: 100%;
        height: 100%;
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
        position: sticky;
        bottom: 0;
      }

      .toggle {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        color: var(--muted);
        white-space: nowrap;
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
        max-height: 300px;
        overflow-y: auto;
      }

      .activity-fab {
        position: fixed;
        right: 24px;
        bottom: 24px;
        width: 52px;
        height: 52px;
        border-radius: 50%;
        border: 1px solid var(--stroke-soft);
        background: #121a28;
        color: var(--text);
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 12px 24px rgba(0, 0, 0, 0.35);
        cursor: pointer;
        z-index: 25;
      }

      .activity-panel {
        position: fixed;
        right: 24px;
        bottom: 88px;
        width: min(320px, 86vw);
        max-height: 380px;
        background: var(--panel);
        border: 1px solid var(--stroke);
        border-radius: 16px;
        padding: 12px;
        display: none;
        flex-direction: column;
        gap: 8px;
        z-index: 25;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.35);
      }

      .activity-panel.active {
        display: flex;
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
        align-content: start;
        align-items: start;
        grid-auto-rows: max-content;
      }

      .page-card {
        background: var(--panel);
        border: 1px solid var(--stroke);
        border-radius: 16px;
        padding: 16px;
        display: grid;
        gap: 12px;
        min-height: 220px;
        align-content: start;
      }

      .page-card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      .page-card-header h3 {
        margin: 0;
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
        align-content: start;
      }

      .data-item {
        border-radius: 12px;
        border: 1px solid var(--stroke-soft);
        background: #101826;
        padding: 10px 12px;
        display: grid;
        gap: 6px;
      }

      .data-item-actions {
        display: flex;
        gap: 8px;
        margin-top: 6px;
      }

      .data-item-actions button {
        background: #192339;
        color: var(--text);
        border: 1px solid var(--stroke-soft);
        padding: 6px 10px;
        border-radius: 8px;
        font-size: 12px;
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
        width: min(820px, 92vw);
        background: #101826;
        border: 1px solid #223047;
        border-radius: 18px;
        padding: 18px;
        display: grid;
        gap: 12px;
        max-height: min(70vh, 520px);
        overflow: hidden;
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

      .editor-modal {
        position: fixed;
        inset: 0;
        background: rgba(4, 6, 10, 0.75);
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 40;
      }

      .editor-modal.active {
        display: flex;
      }

      .editor-card {
        width: min(920px, 94vw);
        background: #0f1726;
        border: 1px solid #223047;
        border-radius: 18px;
        padding: 18px;
        display: grid;
        gap: 12px;
        max-height: min(78vh, 640px);
        overflow: hidden;
        box-shadow: 0 30px 60px rgba(0, 0, 0, 0.45);
      }

      .editor-body {
        display: grid;
        gap: 10px;
        min-height: 0;
      }

      .editor-row {
        display: grid;
        gap: 6px;
      }

      .editor-surface {
        height: 320px;
        border-radius: 12px;
        border: 1px solid var(--stroke-soft);
        overflow: hidden;
      }

      .editor-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }

      .info-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        overflow-y: auto;
        max-height: 360px;
        padding-right: 4px;
      }

      .info-actions button {
        flex: 1 1 calc(50% - 8px);
        min-width: 220px;
        background: #162136;
        color: var(--text);
        border: 1px solid var(--stroke-soft);
        border-radius: 12px;
        padding: 10px 12px;
        text-align: left;
        display: grid;
        gap: 4px;
      }

      .info-actions button span {
        font-size: 12px;
        color: var(--muted);
      }

      @media (max-width: 1200px) {
        .view-grid {
          grid-template-columns: 1fr;
        }
        .dock {
          order: -1;
        }
        .activity-panel {
          right: 16px;
          bottom: 76px;
        }
        .activity-fab {
          right: 16px;
          bottom: 16px;
        }
      }

      @media (max-width: 980px) {
        .workspace {
          grid-template-columns: 1fr;
          grid-template-rows: auto minmax(0, 1fr);
        }
        .sidebar {
          border-right: none;
          border-bottom: 1px solid var(--stroke);
          max-height: 220px;
          overflow-y: auto;
        }
        .page-grid {
          grid-template-columns: 1fr;
        }
        .menu-group {
          overflow-x: auto;
          max-width: 60vw;
          padding-bottom: 4px;
        }
      }

      @media (max-width: 720px) {
        .menu-group {
          display: none;
        }
        .menu-right {
          flex-wrap: wrap;
        }
        .menu-bar {
          padding: 10px 14px;
        }
        aside, main {
          padding: 14px;
        }
        .composer {
          padding: 10px;
        }
        .activity-panel {
          width: min(92vw, 360px);
        }
        .view-header {
          flex-direction: column;
          align-items: flex-start;
        }
      }

      @media (max-width: 520px) {
        .menu-bar {
          flex-direction: column;
          align-items: flex-start;
          gap: 10px;
        }
        .menu-right {
          width: 100%;
          justify-content: space-between;
        }
        .menu-shortcuts {
          flex-wrap: wrap;
        }
        .chip {
          padding: 6px 10px;
        }
        .sidebar {
          padding: 12px;
        }
        .workspace {
          grid-template-columns: 1fr;
          grid-template-rows: auto minmax(0, 1fr);
        }
        .sidebar {
          position: sticky;
          top: 0;
          z-index: 3;
          max-height: 180px;
          overflow-y: auto;
        }
        .view-header {
          flex-direction: column;
          align-items: flex-start;
          gap: 8px;
        }
        .chat-window {
          grid-template-rows: minmax(0, 1fr) auto;
        }
        .composer {
          padding: 8px;
        }
        .composer textarea {
          min-height: 60px;
        }
        .card {
          padding: 12px;
        }
        .messages {
          padding: 12px;
        }
        .composer textarea {
          min-height: 70px;
        }
        .action-row {
          gap: 8px;
        }
        button {
          padding: 8px 10px;
        }
        .activity-panel {
          right: 12px;
          bottom: 72px;
        }
        .activity-fab {
          width: 48px;
          height: 48px;
          right: 12px;
          bottom: 12px;
        }
      }
`

const WEB_UI_SCRIPT = `
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
        activeView: 'chat',
        catalogLoaded: false,
        catalogLoading: false,
      };

      function normalizeState() {
        // Always start clean; stale sessions cause 401s after refresh.
        state.sessions = [];
        state.shareHistory = Array.isArray(state.shareHistory) ? state.shareHistory : [];
        state.activeView = state.activeView || 'chat';
        state.catalogLoaded = false;
        state.catalogLoading = false;
        state.activeSessionId = '';
        state.activeChatId = '';
      }

      normalizeState();

      const serverTokenStorageKey = 'papert.web.serverToken';

      function loadServerToken() {
        try {
          return localStorage.getItem(serverTokenStorageKey) || '';
        } catch {
          return '';
        }
      }

      function saveServerToken(value) {
        try {
          localStorage.setItem(serverTokenStorageKey, value);
        } catch {
          // ignore storage errors
        }
      }

      let catalog = {
        commands: [
          { name: 'papert server', detail: 'Start local server for remote driving', tag: 'terminal', template: 'papert server' },
          { name: 'papert connect', detail: 'Connect to a remote session', tag: 'terminal', template: 'papert connect <url>' },
          { name: 'papert mcp add', detail: 'Register an MCP server', tag: 'terminal', template: 'papert mcp add <name> <commandOrUrl>' },
          { name: '/help', detail: 'Show available commands', tag: 'slash', template: '/help' },
          { name: '/tools', detail: 'Show tool list and status', tag: 'slash', template: '/tools' },
          { name: '/agents', detail: 'Manage subagents', tag: 'slash', template: '/agents' },
          { name: '/mcp', detail: 'List/configure MCP servers', tag: 'slash', template: '/mcp list' },
          { name: '/skills', detail: 'List available skills', tag: 'slash', template: '/skills' },
          { name: '/plugins', detail: 'List extensions and plugins', tag: 'slash', template: '/plugins list' },
          { name: '/hooks', detail: 'Show hooks configuration', tag: 'slash', template: '/hooks' },
          { name: '/schedule add', detail: 'Add scheduled task', tag: 'slash', template: '/schedule add <name> <when> <target>' },
          { name: '/schedule list', detail: 'List scheduled tasks', tag: 'slash', template: '/schedule list' },
          { name: '/schedule remove', detail: 'Remove schedule by id', tag: 'slash', template: '/schedule remove <scheduleId>' },
          { name: '/settings', detail: 'Edit configuration', tag: 'slash', template: '/settings' },
          { name: '/theme', detail: 'Switch theme', tag: 'slash', template: '/theme' },
          { name: '/memory', detail: 'Show or refresh memory', tag: 'slash', template: '/memory show' },
          { name: '/summary', detail: 'Summarize current session', tag: 'slash', template: '/summary' },
          { name: '/share', detail: 'Create a share link', tag: 'slash', template: '/share' },
          { name: '/restore', detail: 'Restore a checkpoint', tag: 'slash', template: '/restore' },
          { name: '/stats', detail: 'Show usage stats', tag: 'slash', template: '/stats' },
          { name: '@{path}', detail: 'Read file or directory into context', tag: 'at', template: '@{path}' },
          { name: '!<cmd>', detail: 'Run a shell command', tag: 'bang', template: '!<cmd>' },
        ],
        tools: [],
        agents: [],
        skills: [],
        mcps: [],
        customTools: [],
        plugins: [],
        hooks: [],
        schedules: [],
        targets: { tools: [], agents: [], mcps: [] },
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
      const brandHome = document.getElementById('brandHome');
      const activityFab = document.getElementById('activityFab');
      const activityPanel = document.getElementById('activityPanel');
      const toolsList = document.getElementById('toolsList');
      const agentsList = document.getElementById('agentsList');
      const skillsList = document.getElementById('skillsList');
      const mcpsList = document.getElementById('mcpsList');
      const customToolsList = document.getElementById('customToolsList');
      const pluginsList = document.getElementById('pluginsList');
      const hooksList = document.getElementById('hooksList');
      const scheduleForm = document.getElementById('scheduleForm');
      const scheduleList = document.getElementById('scheduleList');
      const scheduleId = document.getElementById('scheduleId');
      const scheduleTarget = document.getElementById('scheduleTarget');
      const infoModal = document.getElementById('infoModal');
      const infoTitle = document.getElementById('infoTitle');
      const infoList = document.getElementById('infoList');
      const infoSearch = document.getElementById('infoSearch');
      const infoClose = document.getElementById('infoClose');
      const editorModal = document.getElementById('editorModal');
      const editorTitle = document.getElementById('editorTitle');
      const editorName = document.getElementById('editorName');
      const editorNameRow = document.getElementById('editorNameRow');
      const editorSectionRow = document.getElementById('editorSectionRow');
      const editorSection = document.getElementById('editorSection');
      const editorSurface = document.getElementById('editorSurface');
      const editorClose = document.getElementById('editorClose');
      const editorCancel = document.getElementById('editorCancel');
      const editorSave = document.getElementById('editorSave');

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

      function renderCrudList(target, items, type) {
        target.innerHTML = '';
        if (!currentSession()) {
          const empty = document.createElement('div');
          empty.className = 'activity-item';
          empty.textContent = 'Connect a session to load data.';
          target.appendChild(empty);
          return;
        }
        if (!state.catalogLoaded) {
          const loading = document.createElement('div');
          loading.className = 'activity-item';
          loading.textContent = 'Loading catalog...';
          target.appendChild(loading);
          return;
        }
        if (!items || items.length === 0) {
          const empty = document.createElement('div');
          empty.className = 'activity-item';
          empty.textContent = 'No items yet.';
          target.appendChild(empty);
          return;
        }
        items.forEach((item) => {
          const el = document.createElement('div');
          el.className = 'data-item';
          const tag = item.tag || type;
          el.innerHTML =
            '<div class="name">' + item.name + '</div>' +
            '<div class="meta">' + (item.detail || '') + '</div>' +
            '<div class="tag ' + tagClass(tag) + '">' + tag + '</div>' +
            '<div class="data-item-actions">' +
              '<button data-action="edit" data-type="' + type + '" data-id="' + (item.id || item.name) + '">Edit</button>' +
              '<button data-action="delete" data-type="' + type + '" data-id="' + (item.id || item.name) + '">Delete</button>' +
            '</div>';
          target.appendChild(el);
        });
      }

      function renderActionList(target, items) {
        target.innerHTML = '';
        items.forEach((item) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.dataset.value = item.template || item.name;
          button.innerHTML = '<strong>' + item.name + '</strong>' +
            '<span>' + item.detail + '</span>';
          target.appendChild(button);
        });
      }

      function tagClass(tag) {
        if (tag === 'connected' || tag === 'enabled' || tag === 'core') return 'success';
        if (tag === 'pending' || tag === 'network' || tag === 'disabled') return 'warn';
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
            goToWorkspace();
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
        renderCrudList(toolsList, catalog.tools, 'tools');
        renderCrudList(agentsList, catalog.agents, 'agents');
        renderCrudList(skillsList, catalog.skills, 'skills');
        renderCrudList(mcpsList, catalog.mcps, 'mcps');
        renderCrudList(customToolsList, catalog.customTools, 'customTools');
        renderCrudList(pluginsList, catalog.plugins, 'plugins');
        renderCrudList(hooksList, catalog.hooks, 'hooks');
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
        if (!currentSession()) {
          const empty = document.createElement('div');
          empty.className = 'activity-item';
          empty.textContent = 'Connect a session to load schedules.';
          scheduleList.appendChild(empty);
          return;
        }
        if (!state.catalogLoaded) {
          const loading = document.createElement('div');
          loading.className = 'activity-item';
          loading.textContent = 'Loading schedules...';
          scheduleList.appendChild(loading);
          return;
        }
        if (!catalog.schedules || !catalog.schedules.length) {
          const empty = document.createElement('div');
          empty.className = 'activity-item';
          empty.textContent = 'No schedules yet. Create your first task.';
          scheduleList.appendChild(empty);
          return;
        }
        catalog.schedules.forEach((task) => {
          const el = document.createElement('div');
          el.className = 'data-item';
          el.innerHTML =
            '<div class="name">' + task.name + '</div>' +
            '<div class="meta">' + task.detail + '</div>' +
            '<div class="tag ' + tagClass(task.status) + '">' + task.status + '</div>' +
            '<div class="data-item-actions">' +
              '<button data-action="edit" data-type="schedules" data-id="' + task.id + '">Edit</button>' +
              '<button data-action="delete" data-type="schedules" data-id="' + task.id + '">Delete</button>' +
            '</div>';
          scheduleList.appendChild(el);
        });
      }

      function renderScheduleTargets() {
        if (!scheduleTarget) return;
        const targets = catalog.targets || { tools: [], agents: [], mcps: [] };
        const options = [
          { label: 'Select target', value: '' },
          ...targets.tools.map((name) => ({ label: 'Tool: ' + name, value: 'tool:' + name })),
          ...targets.agents.map((name) => ({ label: 'Agent: ' + name, value: 'agent:' + name })),
          ...targets.mcps.map((name) => ({ label: 'MCP: ' + name, value: 'mcp:' + name })),
        ];
        const current = scheduleTarget.value;
        scheduleTarget.innerHTML = '';
        options.forEach((opt) => {
          const option = document.createElement('option');
          option.value = opt.value;
          option.textContent = opt.label;
          scheduleTarget.appendChild(option);
        });
        if (current) {
          scheduleTarget.value = current;
        }
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
        const setDisabled = (el, value) => {
          if (!el) return;
          el.disabled = value;
        };
        setDisabled(sendBtn, !connected);
        setDisabled(newChatBtn, !connected);
        setDisabled(newChatTopBtn, !connected);
        setDisabled(clearChatBtn, !connected);
        setDisabled(shareBtn, !connected);
        setDisabled(shareNowBtn, !connected);
        updateConnectState();
        if (connected && !state.catalogLoaded && !state.catalogLoading) {
          fetchCatalog();
        }
        renderScheduleTargets();
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

      async function apiFetch(url, options = {}, allowRetry = true) {
        const session = currentSession();
        if (!session) {
          addMessage('system', 'Connect a session to manage configuration.');
          throw new Error('No active session');
        }
        const headers = buildHeaders(session);
        const response = await fetch(url, { ...options, headers: { ...headers, ...(options.headers || {}) } });
        if (response.status === 401 || response.status === 409) {
          state.sessions = [];
          state.activeSessionId = '';
          state.activeChatId = '';
          state.catalogLoaded = false;
          setStatus('Session expired. Reconnect.', false);
          render();
          const storedToken = loadServerToken();
          if (storedToken) {
            const reconnected = await createSessionWithToken(storedToken);
            if (reconnected && allowRetry) {
              return apiFetch(url, options, false);
            }
          }
          throw new Error('Session expired');
        }
        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || 'Request failed');
        }
        return response;
      }

      async function fetchCatalog() {
        if (state.catalogLoading) return;
        state.catalogLoading = true;
        state.catalogLoaded = false;
        try {
          const res = await apiFetch('/api/v1/webui/catalog', { method: 'GET' });
          const data = await res.json();
          catalog = { ...catalog, ...data };
          state.catalogLoaded = true;
          render();
        } catch (err) {
          addMessage('system', 'Failed to load catalog: ' + err.message);
        } finally {
          state.catalogLoading = false;
        }
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
        state.sessions = [session];
        state.activeSessionId = session.id;
        state.activeChatId = session.chats[0].id;
        state.catalogLoaded = false;
        state.catalogLoading = false;
        setStatus('Connected', true);
        addMessage('system', 'Session established for ' + (session.workspaceRoot || 'workspace'));
        render();
        fetchCatalog();
        saveState();
      }

      async function createSessionWithToken(token) {
        if (!token) return false;
        const headers = { authorization: 'Bearer ' + token };
        setStatus('Connecting...', true);
        const res = await fetch('/api/v1/sessions', { method: 'POST', headers });
        if (!res.ok) {
          setStatus('Failed to connect: ' + res.status, false);
          return false;
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
        state.sessions = [session];
        state.activeSessionId = session.id;
        state.activeChatId = session.chats[0].id;
        state.catalogLoaded = false;
        state.catalogLoading = false;
        setStatus('Connected', true);
        render();
        fetchCatalog();
        saveState();
        return true;
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
        const shareToken = shareTokenInput ? shareTokenInput.value.trim() : '';
        if (shareToken) headers['authorization'] = 'Bearer ' + shareToken;
        const res = await fetch('/api/v1/share', {
          method: 'POST',
          headers,
          body: JSON.stringify({ payload, sessionId: session.id }),
        });
        if (!res.ok) {
          if (shareResult) shareResult.textContent = 'Share failed: ' + res.status;
          return;
        }
        const data = await res.json();
        if (shareResult) shareResult.textContent = data.url + ' (secret: ' + data.secret + ')';
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

      function handleModalAction(value, type) {
        if (!value) return;
        infoModal.classList.remove('active');
        let payload = value;
        if (type === 'tools') {
          payload = 'Use this tool: ' + value;
        } else if (type === 'agents') {
          payload = 'Use this agent: ' + value;
        }
        promptInput.value = payload;
        promptInput.focus();
        if (type === 'commands' && currentSession()) {
          sendPrompt().catch((err) => addMessage('system', 'Error: ' + err.message));
        }
      }

      function renderInfoList() {
        const type = infoModal.dataset.type || 'commands';
        const query = (infoSearch.value || '').toLowerCase();
        const items = (catalog[type] || []).filter((item) =>
          item.name.toLowerCase().includes(query) || item.detail.toLowerCase().includes(query)
        );
        renderActionList(infoList, items);
      }

      const typeToEndpoint = {
        agents: 'agents',
        skills: 'skills',
        tools: 'tools',
        customTools: 'custom-tools',
        plugins: 'plugins',
        mcps: 'mcps',
        hooks: 'hooks',
        schedules: 'schedules',
      };

      const editorLanguage = {
        agents: 'markdown',
        skills: 'markdown',
        tools: 'javascript',
        customTools: 'javascript',
        plugins: 'javascript',
        mcps: 'json',
        hooks: 'json',
      };

      let editorContext = null;
      let monacoReady = null;
      let monacoEditor = null;

      function closeEditorModal() {
        editorModal.classList.remove('active');
        editorContext = null;
      }

      function loadMonaco() {
        if (monacoReady) return monacoReady;
        monacoReady = new Promise((resolve, reject) => {
          if (!window.require) {
            reject(new Error('Monaco loader not available'));
            return;
          }
          window.require.config({
            paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.49.0/min/vs' },
          });
          window.require(['vs/editor/editor.main'], () => resolve());
        });
        return monacoReady;
      }

      async function openEditorModal(options) {
        editorContext = options;
        editorTitle.textContent = options.title || 'Edit';
        editorName.value = options.name || '';
        editorNameRow.style.display = options.showName === false ? 'none' : 'grid';
        editorSectionRow.style.display = options.showSection ? 'grid' : 'none';
        if (options.section) {
          editorSection.value = options.section;
        }
        editorModal.classList.add('active');
        await loadMonaco();
        if (!monacoEditor) {
          monacoEditor = window.monaco.editor.create(editorSurface, {
            value: options.content || '',
            language: options.language || 'markdown',
            theme: 'vs-dark',
            minimap: { enabled: false },
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 12,
          });
        } else {
          monacoEditor.setValue(options.content || '');
          window.monaco.editor.setModelLanguage(monacoEditor.getModel(), options.language || 'markdown');
        }
      }

      async function fetchItemContent(type, id) {
        const endpoint = typeToEndpoint[type];
        const res = await apiFetch('/api/v1/webui/content/' + endpoint + '/' + encodeURIComponent(id), { method: 'GET' });
        const data = await res.json();
        return data.content || '';
      }

      async function saveEditorContent() {
        if (!editorContext) return;
        const type = editorContext.type;
        const endpoint = typeToEndpoint[type];
        const content = monacoEditor ? monacoEditor.getValue() : '';
        const name = editorName.value.trim();
        if (editorContext.showName !== false && !name) {
          addMessage('system', 'Name is required.');
          return;
        }
        try {
          if (type === 'mcps') {
            const config = JSON.parse(content || '{}');
            const url = editorContext.mode === 'edit'
              ? '/api/v1/webui/' + endpoint + '/' + encodeURIComponent(editorContext.id)
              : '/api/v1/webui/' + endpoint;
            await apiFetch(url, {
              method: editorContext.mode === 'edit' ? 'PUT' : 'POST',
              body: JSON.stringify({ name, config }),
            });
          } else if (type === 'hooks') {
            const group = JSON.parse(content || '{}');
            const section = editorSection.value;
            const url = editorContext.mode === 'edit'
              ? '/api/v1/webui/' + endpoint + '/' + encodeURIComponent(section) + '/' + encodeURIComponent(editorContext.index)
              : '/api/v1/webui/' + endpoint;
            await apiFetch(url, {
              method: editorContext.mode === 'edit' ? 'PUT' : 'POST',
              body: JSON.stringify({ section, group }),
            });
          } else {
            const url = editorContext.mode === 'edit'
              ? '/api/v1/webui/' + endpoint + '/' + encodeURIComponent(editorContext.id)
              : '/api/v1/webui/' + endpoint;
            await apiFetch(url, {
              method: editorContext.mode === 'edit' ? 'PUT' : 'POST',
              body: JSON.stringify({ name, content }),
            });
          }
          closeEditorModal();
          await fetchCatalog();
        } catch (err) {
          addMessage('system', 'Save failed: ' + err.message);
        }
      }

      async function handleCrudAction(action, type, id) {
        const endpoint = typeToEndpoint[type];
        if (!endpoint) return;
        if (action === 'delete') {
          try {
            await apiFetch('/api/v1/webui/' + endpoint + '/' + encodeURIComponent(id), { method: 'DELETE' });
            await fetchCatalog();
          } catch (err) {
            addMessage('system', 'Delete failed: ' + err.message);
          }
          return;
        }
        if (action !== 'edit') return;
        if (type === 'schedules') {
          const item = (catalog.schedules || []).find((task) => task.id === id);
          if (!item) return;
          scheduleId.value = item.id;
          document.getElementById('scheduleName').value = item.name || '';
          document.getElementById('scheduleType').value = item.schedule?.kind === 'cron'
            ? 'cron'
            : item.schedule?.kind === 'at'
              ? 'event'
              : 'interval';
          document.getElementById('scheduleWhen').value = item.when || '';
          scheduleTarget.value = item.targetValue || '';
          document.getElementById('scheduleNotes').value = item.payload?.notes || '';
          return;
        }
        try {
          const content = await fetchItemContent(type, id);
          const item = (catalog[type] || []).find((entry) => (entry.id || entry.name) === id);
          const language = editorLanguage[type] || 'markdown';
          if (type === 'hooks') {
            const parts = String(id).split(':');
            const section = parts[0];
            const index = Number(parts[1]);
            await openEditorModal({
              title: 'Edit Hook',
              type,
              mode: 'edit',
              id,
              index,
              showName: false,
              showSection: true,
              section,
              content: content || JSON.stringify(item?.group || {}, null, 2),
              language,
            });
            return;
          }
          await openEditorModal({
            title: 'Edit ' + (type === 'customTools' ? 'Custom Tool' : type.slice(0, -1)),
            type,
            mode: 'edit',
            id,
            name: item?.name || id,
            content,
            language,
          });
        } catch (err) {
          addMessage('system', 'Failed to load item: ' + err.message);
        }
      }

      async function handleAddAction(type) {
        const language = editorLanguage[type] || 'markdown';
        if (type === 'hooks') {
          await openEditorModal({
            title: 'Add Hook',
            type,
            mode: 'add',
            showName: false,
            showSection: true,
            content: JSON.stringify({ matcher: '.*', hooks: [] }, null, 2),
            language,
          });
          return;
        }
        if (type === 'mcps') {
          await openEditorModal({
            title: 'Add MCP',
            type,
            mode: 'add',
            name: '',
            content: JSON.stringify({ command: [], args: [], cwd: '' }, null, 2),
            language,
          });
          return;
        }
        await openEditorModal({
          title: 'Add ' + (type === 'customTools' ? 'Custom Tool' : type.slice(0, -1)),
          type,
          mode: 'add',
          name: '',
          content: '',
          language,
        });
      }

      function parseDurationMs(input) {
        const match = String(input || '').trim().match(/^([0-9]+)\\s*([smhd])$/i);
        if (!match) return null;
        const value = Number(match[1]);
        const unit = match[2].toLowerCase();
        const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
        return value * multipliers[unit];
      }

      function resetScheduleForm() {
        scheduleId.value = '';
        scheduleForm.reset();
        renderScheduleTargets();
      }

      function setActiveView(view) {
        state.activeView = view;
        render();
        if (currentSession()) {
          fetchCatalog();
        }
        saveState();
      }

      function goToWorkspace() {
        setActiveView('chat');
      }

      function on(el, event, handler) {
        if (!el) return;
        el.addEventListener(event, handler);
      }

      on(connectBtn, 'click', () => {
        createSession().catch((err) => setStatus(err.message, false));
      });

      on(disconnectBtn, 'click', () => {
        releaseSession().catch(() => setStatus('Release failed', true));
      });

      on(refreshSessions, 'click', () => {
        render();
        if (currentSession()) {
          fetchCatalog();
        }
      });

      on(newChatBtn, 'click', () => {
        goToWorkspace();
        newChat();
      });
      on(newChatTopBtn, 'click', () => {
        goToWorkspace();
        newChat();
      });
      on(clearChatBtn, 'click', () => clearChat());

      on(sendBtn, 'click', () => {
        sendPrompt().catch((err) => addMessage('system', 'Error: ' + err.message));
      });

      on(promptInput, 'keydown', (event) => {
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          sendPrompt().catch((err) => addMessage('system', 'Error: ' + err.message));
        }
      });

      on(shareBtn, 'click', () => shareCurrentChat());
      on(shareNowBtn, 'click', () => shareCurrentChat());

      if (brandHome) {
        brandHome.addEventListener('click', () => goToWorkspace());
      }

      if (activityFab && activityPanel) {
        activityFab.addEventListener('click', () => {
          activityPanel.classList.toggle('active');
        });
      }

      on(serverTokenInput, 'input', () => {
        saveServerToken(serverTokenInput.value.trim());
        updateConnectState();
      });

      on(cliSearch, 'input', () => {
        renderCommands(cliSearch.value);
      });

      on(scheduleForm, 'submit', (event) => {
        event.preventDefault();
        const name = document.getElementById('scheduleName').value.trim();
        const type = document.getElementById('scheduleType').value;
        const when = document.getElementById('scheduleWhen').value.trim();
        const targetValue = scheduleTarget.value.trim();
        const notes = document.getElementById('scheduleNotes').value.trim();
        if (!name || !when || !targetValue) return;
        const [targetType, targetName] = targetValue.split(':');
        let schedule = null;
        if (type === 'interval') {
          const ms = parseDurationMs(when) || 60000;
          schedule = { kind: 'every', everyMs: ms };
        } else if (type === 'cron') {
          schedule = { kind: 'cron', expr: when };
        } else {
          const atMs = Date.parse(when);
          schedule = { kind: 'at', atMs: Number.isNaN(atMs) ? Date.now() : atMs };
        }
        const payload = { targetType, targetName, notes };
        const id = scheduleId.value.trim();
        const url = id
          ? '/api/v1/webui/schedules/' + encodeURIComponent(id)
          : '/api/v1/webui/schedules';
        const method = id ? 'PUT' : 'POST';
        apiFetch(url, {
          method,
          body: JSON.stringify({ name, schedule, payload }),
        })
          .then(() => {
            resetScheduleForm();
            return fetchCatalog();
          })
          .catch((err) => addMessage('system', 'Schedule save failed: ' + err.message));
      });

      document.querySelectorAll('.menu-item').forEach((btn) => {
        btn.addEventListener('click', () => setActiveView(btn.dataset.view));
      });

      document.querySelectorAll('[data-modal]').forEach((btn) => {
        btn.addEventListener('click', () => openInfoModal(btn.dataset.modal));
      });

      on(infoClose, 'click', () => infoModal && infoModal.classList.remove('active'));
      on(infoModal, 'click', (event) => {
        if (event.target === infoModal) infoModal.classList.remove('active');
      });

      on(infoSearch, 'input', renderInfoList);

      on(infoList, 'click', (event) => {
        const target = event.target.closest('button');
        if (!target) return;
        handleModalAction(target.dataset.value || '', infoModal.dataset.type || '');
      });

      if (editorClose) editorClose.addEventListener('click', closeEditorModal);
      if (editorCancel) editorCancel.addEventListener('click', closeEditorModal);
      if (editorSave) editorSave.addEventListener('click', saveEditorContent);
      if (editorModal) {
        editorModal.addEventListener('click', (event) => {
          if (event.target === editorModal) closeEditorModal();
        });
      }

      document.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-action]');
        if (!button || button.closest('.palette-actions')) return;
        const action = button.dataset.action;
        if (action === 'add-tool') return handleAddAction('tools');
        if (action === 'add-agent') return handleAddAction('agents');
        if (action === 'add-skill') return handleAddAction('skills');
        if (action === 'add-mcp') return handleAddAction('mcps');
        if (action === 'add-custom-tool') return handleAddAction('customTools');
        if (action === 'add-plugin') return handleAddAction('plugins');
        if (action === 'add-hook') return handleAddAction('hooks');
        if (action === 'reset-schedule') return resetScheduleForm();
        if (action === 'edit' || action === 'delete') {
          return handleCrudAction(action, button.dataset.type, button.dataset.id);
        }
      });

      on(commandPalette, 'click', (event) => {
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
          closeEditorModal();
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

      const storedToken = loadServerToken();
      if (storedToken && !serverTokenInput.value) {
        serverTokenInput.value = storedToken;
        updateConnectState();
      }

      if (!currentSession() && storedToken) {
        createSessionWithToken(storedToken).catch(() => {
          setStatus('Enter server token to connect.', false);
        });
      }

      render();
`

const WEB_UI_MENU_BAR = `
      <header class="menu-bar">
          <div class="menu-left">
            <div class="window-controls">
              <span class="close"></span>
              <span class="min"></span>
              <span class="max"></span>
            </div>
            <div class="brand" id="brandHome">
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
`

const WEB_UI_SIDEBAR = `
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
`

const WEB_UI_MAIN = `

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
                  <div class="page-card-header">
                    <h3>Tools</h3>
                    <button class="ghost" data-action="add-tool">Add</button>
                  </div>
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
                  <div class="page-card-header">
                    <h3>Agents</h3>
                    <button class="ghost" data-action="add-agent">Add</button>
                  </div>
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
                  <div class="page-card-header">
                    <h3>Skills</h3>
                    <button class="ghost" data-action="add-skill">Add</button>
                  </div>
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
                  <div class="page-card-header">
                    <h3>MCP Servers</h3>
                    <button class="ghost" data-action="add-mcp">Add</button>
                  </div>
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
                  <div class="page-card-header">
                    <h3>Custom Tools</h3>
                    <button class="ghost" data-action="add-custom-tool">Add</button>
                  </div>
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
                  <div class="page-card-header">
                    <h3>Plugins</h3>
                    <button class="ghost" data-action="add-plugin">Add</button>
                  </div>
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
                  <div class="page-card-header">
                    <h3>Hooks</h3>
                    <button class="ghost" data-action="add-hook">Add</button>
                  </div>
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
                  <div class="page-card-header">
                    <h3>Schedule Tasks</h3>
                    <button class="ghost" data-action="reset-schedule">Reset</button>
                  </div>
                  <form id="scheduleForm" class="form-grid">
                    <input id="scheduleId" type="hidden" />
                    <input id="scheduleName" placeholder="Task name" required />
                    <select id="scheduleType">
                      <option value="interval">Interval</option>
                      <option value="cron">Cron</option>
                      <option value="event">Event</option>
                    </select>
                    <input id="scheduleWhen" placeholder="Every 30m / 0 9 * * 1-5 / webhook" required />
                    <select id="scheduleTarget" required></select>
                    <textarea id="scheduleNotes" placeholder="Notes"></textarea>
                    <button type="submit">Save schedule</button>
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
`

const WEB_UI_INFO_MODAL = `

    <div class="info-modal" id="infoModal">
      <div class="info-card">
        <div class="info-header">
          <div class="info-title" id="infoTitle">Details</div>
          <button class="ghost" id="infoClose">Close</button>
        </div>
        <input id="infoSearch" placeholder="Search list" />
        <div id="infoList" class="info-actions"></div>
      </div>
    </div>
`

const WEB_UI_EDITOR_MODAL = `

    <div class="editor-modal" id="editorModal">
      <div class="editor-card">
        <div class="info-header">
          <div class="info-title" id="editorTitle">Edit</div>
          <button class="ghost" id="editorClose">Close</button>
        </div>
        <div class="editor-body">
          <div class="editor-row" id="editorNameRow">
            <label for="editorName" style="font-size:12px;color:var(--muted);">Name</label>
            <input id="editorName" placeholder="Name" />
          </div>
          <div class="editor-row" id="editorSectionRow" style="display:none;">
            <label for="editorSection" style="font-size:12px;color:var(--muted);">Section</label>
            <select id="editorSection">
              <option value="BeforeTool">BeforeTool</option>
              <option value="AfterTool">AfterTool</option>
              <option value="Notification">Notification</option>
              <option value="SessionStart">SessionStart</option>
              <option value="AfterAgent">AfterAgent</option>
            </select>
          </div>
          <div class="editor-row">
            <label for="editorSurface" style="font-size:12px;color:var(--muted);">Content</label>
            <div id="editorSurface" class="editor-surface"></div>
          </div>
          <div class="editor-actions">
            <button class="ghost" id="editorCancel">Cancel</button>
            <button id="editorSave">Save</button>
          </div>
        </div>
      </div>
    </div>
`

const WEB_UI_COMMAND_PALETTE = `

    <div class="command-palette" id="commandPalette">
      <div class="palette-card">
        <h4>Quick Actions</h4>
        <div class="palette-actions">
          <button data-action="new-session">New session</button>
          <button data-action="new-chat">New chat</button>
          <button data-action="share">Share current chat</button>
          <button data-action="clear">Clear chat view</button>
        </div>
`


export function getWebUiHtml(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Papert Code Web</title>
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.49.0/min/vs/loader.min.js"></script>
    <style>
${WEB_UI_STYLES}
    </style>
  </head>
  <body>
    <div class="app">
${WEB_UI_MENU_BAR}

      <div class="workspace">
${WEB_UI_SIDEBAR}
${WEB_UI_MAIN}
      </div>
    </div>
${WEB_UI_INFO_MODAL}
${WEB_UI_EDITOR_MODAL}
${WEB_UI_COMMAND_PALETTE}
      </div>
    </div>
    <div class="activity-panel" id="activityPanel">
      <div class="panel" style="margin:0;">
        <h3>Activity</h3>
        <div id="activityFeed" class="activity"></div>
      </div>
    </div>
    <button class="activity-fab" id="activityFab" aria-label="Activity">⚙️</button>

    <script>
${WEB_UI_SCRIPT}
    </script>
  </body>
</html>`;
}
