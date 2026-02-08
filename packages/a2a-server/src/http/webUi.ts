/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

const WEB_UI_STYLES = `
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

      body.desktop-embed .window-controls,
      body.desktop-embed #brandHome,
      body.desktop-embed #remoteConnectCard {
        display: none !important;
      }

      body.desktop-embed #sessionSection {
        display: none !important;
      }

      body.desktop-embed #autoExecToggleRow,
      body.desktop-embed .menu-item[data-view="cli"],
      body.desktop-embed .menu-item[data-view="tools"],
      body.desktop-embed .chip[data-modal="tools"],
      body.desktop-embed #view-cli,
      body.desktop-embed #view-tools,
      body.desktop-embed #shareBtn,
      body.desktop-embed #clearChatBtn {
        display: none !important;
      }

      body.chat-sidebar-collapsed .workspace {
        grid-template-columns: 0 minmax(0, 1fr);
      }

      body.chat-sidebar-collapsed .sidebar {
        border-right: none;
        padding: 0;
        overflow: hidden;
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
        overflow-x: hidden;
        max-height: 100%;
        height: 100%;
      }

      .msg {
        padding: 0 14px;
        border-radius: 12px;
        margin-bottom: 12px;
        background: #111827;
        border: none;
        font-size: 13px;
      }

      .msg.user {
        border: none;
        background: transparent;
      }

      .msg.assistant {
        border: none;
      }

      .msg.system {
        font-size: 12px;
        color: var(--muted);
        background: #0f1521;
      }

      .msg .content {
        line-height: 1.6;
        white-space: pre-wrap;
        word-break: break-word;
        overflow-wrap: anywhere;
      }

      .msg .content pre {
        background: #0b111c;
        border: 1px solid #233148;
        border-radius: 10px;
        padding: 12px;
        overflow-x: hidden;
        white-space: pre-wrap;
        word-break: break-word;
        overflow-wrap: anywhere;
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

      .msg.assistant .content pre,
      .msg.assistant .content code {
        border: none;
        background: transparent;
      }

      .composer {
        display: grid;
        gap: 8px;
        padding: 8px;
        border-radius: 16px;
        background: var(--panel);
        border: 1px solid var(--stroke);
        flex: 0 0 auto;
        position: sticky;
        bottom: 0;
      }

      .composer-shell {
        display: flex;
        flex-direction: column;
        gap: 6px;
        border: 1px solid var(--stroke-soft);
        border-radius: 14px;
        padding: 8px 10px;
        background: #0b111c;
      }

      #promptInput {
        border: none;
        background: transparent;
        padding: 0;
        min-height: 54px;
        font-size: 13px;
        line-height: 1.4;
        resize: vertical;
      }

      #promptInput:focus {
        outline: none;
      }

      .composer-controls {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }

      .composer-left {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
      }

      .composer-hint {
        font-size: 11px;
        color: var(--muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .icon-btn {
        width: 30px;
        height: 30px;
        min-width: 30px;
        border-radius: 999px;
        border: 1px solid var(--stroke-soft);
        background: linear-gradient(180deg, #1a2537 0%, #121a28 100%);
        color: var(--text);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 17px;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12);
        line-height: 1;
        padding: 0;
      }

      #sendBtn.composer-send {
        width: 34px;
        height: 34px;
        min-width: 34px;
        border-radius: 999px;
        padding: 0;
        font-size: 18px;
        font-weight: 600;
      }

      .attachment-strip {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .attachment-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        max-width: 100%;
        border: 1px solid var(--stroke-soft);
        border-radius: 999px;
        background: #101827;
        color: var(--text);
        font-size: 11px;
        padding: 4px 8px;
      }

      .attachment-chip span {
        max-width: 260px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .attachment-remove {
        border: none;
        background: transparent;
        color: var(--muted);
        padding: 0;
        width: 16px;
        height: 16px;
        min-width: 16px;
        border-radius: 999px;
        line-height: 1;
      }

      .attachment-remove:hover {
        color: var(--text);
        box-shadow: none;
      }

      .attachment-error {
        font-size: 12px;
        color: #ff8a8a;
        min-height: 14px;
      }

      .composer-meta {
        display: flex;
        align-items: center;
        gap: 8px;
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

      .editor-fallback {
        width: 100%;
        height: 100%;
        border: none;
        outline: none;
        resize: none;
        padding: 12px;
        color: var(--text);
        background: #0d1422;
        font-family: 'JetBrains Mono', monospace;
        font-size: 12px;
        line-height: 1.45;
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
        #promptInput {
          min-height: 52px;
        }
        .card {
          padding: 12px;
        }
        .messages {
          padding: 12px;
        }
        #promptInput {
          min-height: 52px;
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
      const workspaceRootFromHost = window.__PAPERT_WEB_UI_WORKSPACE_ROOT__ || 'workspace';
      function makeWorkspaceSuffix(input) {
        try {
          const encoded = encodeURIComponent(String(input || 'workspace'));
          return btoa(encoded).replace(/=+$/g, '');
        } catch {
          return 'workspace';
        }
      }
      const workspaceSuffix = makeWorkspaceSuffix(workspaceRootFromHost);
      const stateStorageKey = 'papert.web.state.' + workspaceSuffix;
      const serverTokenStorageKey = 'papert.web.serverToken.' + workspaceSuffix;
      const autoConnectStorageKey = 'papert.web.autoConnect.' + workspaceSuffix;
      const hostInitialState = window.__PAPERT_WEB_UI_INITIAL_STATE__;
      const allowEmptyToken = window.__PAPERT_WEB_UI_ALLOW_EMPTY_TOKEN__ === true;
      const desktopMode = window.__PAPERT_WEB_UI_DESKTOP_MODE__ === true;

      const storage = {
        load() {
          try {
            const raw = localStorage.getItem(stateStorageKey);
            return raw ? JSON.parse(raw) : null;
          } catch {
            return null;
          }
        },
        save(state) {
          localStorage.setItem(stateStorageKey, JSON.stringify(state));
        },
      };

      const state = hostInitialState || storage.load() || {
        sessions: [],
        activeSessionId: '',
        activeChatId: '',
        shareHistory: [],
        activeView: 'chat',
        catalogLoaded: false,
        catalogLoading: false,
      };

      function normalizeState() {
        state.sessions = Array.isArray(state.sessions)
          ? state.sessions.map((session, index) => ({
              id: '',
              token: '',
              workspaceRoot:
                (session && typeof session.workspaceRoot === 'string' && session.workspaceRoot) ||
                workspaceRootFromHost ||
                '',
              label:
                (session && typeof session.label === 'string' && session.label) ||
                (desktopMode ? 'Workspace' : 'Session ' + (index + 1)),
              createdAt:
                (session && Number.isFinite(session.createdAt) && session.createdAt) ||
                Date.now(),
              chats:
                session && Array.isArray(session.chats)
                  ? session.chats
                      .map((chat) => ({
                        id:
                          (chat && typeof chat.id === 'string' && chat.id) ||
                          'chat-' + Date.now() + '-' + Math.random().toString(36).slice(2),
                        title:
                          (chat && typeof chat.title === 'string' && chat.title) || 'New chat',
                        createdAt:
                          (chat && Number.isFinite(chat.createdAt) && chat.createdAt) ||
                          Date.now(),
                        taskId: '',
                        messages:
                          chat && Array.isArray(chat.messages)
                            ? chat.messages
                                .filter(
                                  (msg) =>
                                    msg &&
                                    typeof msg.role === 'string' &&
                                    typeof msg.content === 'string',
                                )
                                .map((msg) => ({
                                  role: msg.role,
                                  content: msg.content,
                                  createdAt:
                                    Number.isFinite(msg.createdAt) ? msg.createdAt : Date.now(),
                                }))
                            : [],
                        activity:
                          chat && Array.isArray(chat.activity)
                            ? chat.activity
                                .filter(
                                  (item) =>
                                    item &&
                                    typeof item.label === 'string' &&
                                    typeof item.detail === 'string',
                                )
                                .map((item) => ({
                                  label: item.label,
                                  detail: item.detail,
                                  createdAt:
                                    Number.isFinite(item.createdAt)
                                      ? item.createdAt
                                      : Date.now(),
                                }))
                            : [],
                      }))
                      .slice(0, 100)
                  : [],
            }))
          : [];
        state.sessions = state.sessions.slice(0, 1);
        if (state.sessions[0] && (!Array.isArray(state.sessions[0].chats) || state.sessions[0].chats.length === 0)) {
          state.sessions[0].chats = [createChat()];
        }
        state.shareHistory = Array.isArray(state.shareHistory) ? state.shareHistory : [];
        state.activeView = state.activeView || 'chat';
        state.catalogLoaded = false;
        state.catalogLoading = false;
        state.activeSessionId = '';
        state.activeChatId =
          state.sessions[0] && state.sessions[0].chats && state.sessions[0].chats[0]
            ? state.sessions[0].chats[0].id
            : '';
      }

      normalizeState();

      function loadServerToken() {
        try {
          return sessionStorage.getItem(serverTokenStorageKey) || '';
        } catch {
          return '';
        }
      }

      function saveServerToken(value) {
        try {
          sessionStorage.setItem(serverTokenStorageKey, value);
        } catch {
          // ignore storage errors
        }
      }

      function loadAutoConnect() {
        try {
          const value = localStorage.getItem(autoConnectStorageKey);
          return value === null ? true : value === 'true';
        } catch {
          return true;
        }
      }

      function saveAutoConnect(value) {
        try {
          localStorage.setItem(autoConnectStorageKey, value ? 'true' : 'false');
        } catch {
          // ignore storage errors
        }
      }

      const fallbackCommandCatalog = [
          { name: 'papert server', detail: 'Start local server for remote driving', tag: 'terminal', template: 'papert server' },
          { name: 'papert connect', detail: 'Connect to a remote session', tag: 'terminal', template: 'papert connect <url>' },
          { name: 'papert mcp add', detail: 'Register an MCP server', tag: 'terminal', template: 'papert mcp add <name> <commandOrUrl>' },
          { name: '/help', detail: 'Show available commands', tag: 'slash', template: '/help' },
          { name: '/tools', detail: 'Show tool list and status', tag: 'slash', template: '/tools' },
          { name: '/agents', detail: 'Manage subagents', tag: 'slash', template: '/agents' },
          { name: '/mcp', detail: 'List/configure MCP servers', tag: 'slash', template: '/mcp list' },
          { name: '/mcp diagnose', detail: 'Diagnose MCP server and OAuth issues', tag: 'slash', template: '/mcp diagnose' },
          { name: '/mcp auth', detail: 'Authenticate an OAuth-enabled MCP server', tag: 'slash', template: '/mcp auth <server-name>' },
          { name: '/skills', detail: 'List available skills', tag: 'slash', template: '/skills' },
          { name: '/plugins', detail: 'List extensions and plugins', tag: 'slash', template: '/plugins list' },
          { name: '/hooks', detail: 'Show hooks configuration', tag: 'slash', template: '/hooks' },
          { name: '/github status', detail: 'Show Papert GitHub workflow status', tag: 'slash', template: '/github status' },
          { name: '/github install', detail: 'Install Papert GitHub workflows', tag: 'slash', template: '/github install' },
          { name: '/github run', detail: 'Trigger a GitHub workflow', tag: 'slash', template: '/github run dispatch' },
          { name: '/schedule add', detail: 'Add scheduled task', tag: 'slash', template: '/schedule add <name> <when> <target>' },
          { name: '/schedule list', detail: 'List scheduled tasks', tag: 'slash', template: '/schedule list' },
          { name: '/schedule remove', detail: 'Remove schedule by id', tag: 'slash', template: '/schedule remove <scheduleId>' },
          { name: '/settings', detail: 'Edit configuration', tag: 'slash', template: '/settings' },
          { name: '/theme', detail: 'Switch theme', tag: 'slash', template: '/theme' },
          { name: '/memory', detail: 'Show or refresh memory', tag: 'slash', template: '/memory show' },
          { name: '/summary', detail: 'Summarize current session', tag: 'slash', template: '/summary' },
          { name: '/share', detail: 'Create a share link', tag: 'slash', template: '/share' },
          { name: '/chat list', detail: 'Open the session browser', tag: 'slash', template: '/chat list' },
          { name: '/chat resume', detail: 'Resume via session browser', tag: 'slash', template: '/chat resume' },
          { name: '/resume', detail: 'Open resume session browser', tag: 'slash', template: '/resume' },
          { name: '/rewind', detail: 'Preview and restore checkpoints', tag: 'slash', template: '/rewind' },
          { name: '/restore', detail: 'Restore a checkpoint', tag: 'slash', template: '/restore' },
          { name: '/stats', detail: 'Show usage stats', tag: 'slash', template: '/stats' },
          { name: '@{path}', detail: 'Read file or directory into context', tag: 'at', template: '@{path}' },
          { name: '!<cmd>', detail: 'Run a shell command', tag: 'bang', template: '!<cmd>' },
      ];

      function mapCommandTreeToCatalog(entries, prefix = []) {
        const result = [];
        (entries || []).forEach((entry) => {
          if (!entry || !entry.name) return;
          const pathParts = prefix.concat(entry.name);
          const commandText = 'papert ' + pathParts.join(' ');
          result.push({
            name: commandText,
            detail: entry.description || 'Server command',
            tag: 'terminal',
            template: commandText,
          });
          if (Array.isArray(entry.subCommands) && entry.subCommands.length > 0) {
            result.push(...mapCommandTreeToCatalog(entry.subCommands, pathParts));
          }
        });
        return result;
      }

      let catalog = {
        commands: [...fallbackCommandCatalog],
        tools: [],
        agents: [],
        skills: [],
        mcps: [],
        customTools: [],
        plugins: [],
        hooks: [],
        schedules: [],
        rewindPoints: [],
        releaseChannel: 'stable',
        targets: { tools: [], agents: [], mcps: [] },
      };
      let activeStreamingChatId = '';
      const maxAttachments = 3;
      const maxAttachmentSizeBytes = 2 * 1024 * 1024;
      const allowedDocumentMimeTypes = new Set([
        'application/pdf',
        'text/plain',
        'text/markdown',
        'text/csv',
        'application/json',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ]);
      const allowedDocumentExtensions = new Set([
        'pdf',
        'txt',
        'md',
        'markdown',
        'csv',
        'json',
        'doc',
        'docx',
      ]);
      let pendingAttachments = [];

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
      const attachmentStrip = document.getElementById('attachmentStrip');
      const attachmentError = document.getElementById('attachmentError');
      const uploadImageBtn = document.getElementById('uploadImageBtn');
      const imageUploadInput = document.getElementById('imageUploadInput');
      const activityFeed = document.getElementById('activityFeed');
      const shareBtn = document.getElementById('shareBtn');
      const shareNowBtn = document.getElementById('shareNowBtn');
      const shareTokenInput = document.getElementById('shareToken');
      const shareResult = document.getElementById('shareResult');
      const commandPalette = document.getElementById('commandPalette');
      const cliSearch = document.getElementById('cliSearch');
      const cliList = document.getElementById('cliList');
      const releaseChannelSelect = document.getElementById('releaseChannelSelect');
      const releaseChannelSave = document.getElementById('releaseChannelSave');
      const brandHome = document.getElementById('brandHome');
      const activityFab = document.getElementById('activityFab');
      const activityPanel = document.getElementById('activityPanel');
      const chatSidebarToggle = document.getElementById('chatSidebarToggle');
      const toolsList = document.getElementById('toolsList');
      const agentsList = document.getElementById('agentsList');
      const skillsList = document.getElementById('skillsList');
      const mcpsList = document.getElementById('mcpsList');
      const customToolsList = document.getElementById('customToolsList');
      const pluginsList = document.getElementById('pluginsList');
      const hooksList = document.getElementById('hooksList');
      const rewindList = document.getElementById('rewindList');
      const rewindRefresh = document.getElementById('rewindRefresh');
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

      let stateSyncTimer = null;

      function toPersistedState() {
        const session = Array.isArray(state.sessions) && state.sessions[0] ? state.sessions[0] : null;
        const chats = session && Array.isArray(session.chats)
          ? session.chats.map((chat) => ({
              id: chat.id,
              title: chat.title,
              createdAt: chat.createdAt,
              taskId: '',
              messages: Array.isArray(chat.messages)
                ? chat.messages.map((msg) => ({
                    role: msg.role,
                    content: msg.content,
                    createdAt: msg.createdAt,
                  }))
                : [],
              activity: Array.isArray(chat.activity)
                ? chat.activity.map((item) => ({
                    label: item.label,
                    detail: item.detail,
                    createdAt: item.createdAt,
                  }))
                : [],
            }))
          : [];
        return {
          sessions: session
            ? [
                {
                  id: '',
                  token: '',
                  workspaceRoot: session.workspaceRoot || workspaceRootFromHost || '',
                  label: session.label || (desktopMode ? 'Workspace' : 'Session 1'),
                  createdAt: session.createdAt || Date.now(),
                  chats,
                },
              ]
            : [],
          activeSessionId: '',
          activeChatId: chats[0] ? chats[0].id : '',
          shareHistory: Array.isArray(state.shareHistory) ? state.shareHistory : [],
          activeView: state.activeView || 'chat',
          catalogLoaded: false,
          catalogLoading: false,
        };
      }

      async function persistStateToDisk(snapshot) {
        const session = currentSession();
        const headers = buildHeaders(session || undefined);
        try {
          await fetch('/api/v1/webui/state', {
            method: 'PUT',
            headers,
            body: JSON.stringify(snapshot),
          });
        } catch {
          // ignore save failures; localStorage still keeps recent state
        }
      }

      function scheduleStateSync(snapshot) {
        if (stateSyncTimer) {
          clearTimeout(stateSyncTimer);
        }
        stateSyncTimer = setTimeout(() => {
          persistStateToDisk(snapshot).catch(() => {
            // ignore
          });
        }, 250);
      }

      function saveState() {
        const snapshot = toPersistedState();
        storage.save(snapshot);
        scheduleStateSync(snapshot);
      }

      function formatTime(ts) {
        const d = new Date(ts);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }

      function setStatus(text, connected) {
        const channel = catalog.releaseChannel ? ' [' + catalog.releaseChannel + ']' : '';
        statusText.textContent = text + channel;
        statusPulse.classList.toggle('off', !connected);
      }

      function setAttachmentError(text) {
        if (!attachmentError) return;
        attachmentError.textContent = text || '';
      }

      function formatAttachmentBytes(bytes) {
        if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
        if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
        return Math.max(1, Math.round(bytes / 1024)) + ' KB';
      }

      function renderAttachmentStrip() {
        if (!attachmentStrip) return;
        attachmentStrip.innerHTML = '';
        pendingAttachments.forEach((attachment) => {
          const chip = document.createElement('div');
          chip.className = 'attachment-chip';
          chip.innerHTML =
            '<span>' +
            escapeHtml(attachment.name) +
            ' (' +
            escapeHtml(formatAttachmentBytes(attachment.size)) +
            ')</span>';
          const removeBtn = document.createElement('button');
          removeBtn.type = 'button';
          removeBtn.className = 'attachment-remove';
          removeBtn.setAttribute('aria-label', 'Remove file');
          removeBtn.textContent = 'x';
          removeBtn.addEventListener('click', () => {
            pendingAttachments = pendingAttachments.filter((item) => item.id !== attachment.id);
            renderAttachmentStrip();
            setAttachmentError('');
          });
          chip.appendChild(removeBtn);
          attachmentStrip.appendChild(chip);
        });
      }

      function readFileAsDataUrl(file) {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsDataURL(file);
        });
      }

      function getFileExtension(fileName) {
        const name = String(fileName || '');
        const idx = name.lastIndexOf('.');
        if (idx < 0 || idx === name.length - 1) return '';
        return name.slice(idx + 1).toLowerCase();
      }

      function isAllowedAttachment(file) {
        if (!file) return false;
        const mimeType = typeof file.type === 'string' ? file.type.toLowerCase() : '';
        if (mimeType.startsWith('image/')) return true;
        if (allowedDocumentMimeTypes.has(mimeType)) return true;
        const ext = getFileExtension(file.name);
        return allowedDocumentExtensions.has(ext);
      }

      async function handleAttachmentSelection(fileList) {
        const files = Array.from(fileList || []);
        if (!files.length) return;
        const remaining = maxAttachments - pendingAttachments.length;
        if (remaining <= 0) {
          setAttachmentError('Maximum 3 files allowed.');
          return;
        }

        const selected = files.slice(0, remaining);
        if (files.length > remaining) {
          setAttachmentError('Only 3 files can be attached.');
        } else {
          setAttachmentError('');
        }

        for (const file of selected) {
          if (!isAllowedAttachment(file)) {
            setAttachmentError('Only images or supported docs are allowed.');
            continue;
          }
          if (file.size > maxAttachmentSizeBytes) {
            setAttachmentError('Each file must be 2MB or less.');
            continue;
          }
          try {
            const dataUrl = await readFileAsDataUrl(file);
            const commaIndex = dataUrl.indexOf(',');
            const base64 = commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : '';
            const mimePrefix = commaIndex >= 0 ? dataUrl.slice(0, commaIndex) : '';
            const parsedMime = /^data:([^;]+);base64$/i.test(mimePrefix)
              ? mimePrefix.replace(/^data:/i, '').replace(/;base64$/i, '')
              : '';
            if (!base64) {
              setAttachmentError('Failed to process one selected file.');
              continue;
            }
            pendingAttachments.push({
              id: 'img-' + Date.now() + '-' + Math.random().toString(36).slice(2),
              name: file.name || 'file',
              mimeType: file.type || parsedMime || 'application/octet-stream',
              size: file.size,
              data: base64,
            });
          } catch {
            setAttachmentError('Failed to read one selected file.');
          }
        }
        renderAttachmentStrip();
      }

      function updateConnectState() {
        const tokenReady = serverTokenInput.value.trim().length > 0;
        const connected = !!currentConnectedSession();
        connectBtn.disabled = !(tokenReady || allowEmptyToken) || connected;
        disconnectBtn.disabled = !connected;
      }

      function currentSession() {
        return state.sessions.find((s) => s.id === state.activeSessionId) || null;
      }

      function currentConnectedSession() {
        const session = currentSession();
        if (!session || !session.id) return null;
        return session;
      }

      function currentChat() {
        const session = currentSession();
        if (!session) return null;
        return session.chats.find((c) => c.id === state.activeChatId) || null;
      }

      function getChatById(chatId) {
        const session = currentSession();
        if (!session || !chatId) return null;
        return session.chats.find((c) => c.id === chatId) || null;
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

      function formatChatTitleFromQuery(text) {
        const limit = 44;
        const compact = String(text || '').replace(/\s+/g, ' ').trim();
        if (compact.length <= limit) return compact || 'New chat';
        return compact.slice(0, limit - 3) + '...';
      }

      function buildContextualPrompt(chat, text) {
        if (!desktopMode || !chat) return text;
        const history = Array.isArray(chat.messages) ? chat.messages.slice(-12) : [];
        if (history.length === 0) return text;

        const transcript = history
          .map((msg) => {
            const role = msg && msg.role ? String(msg.role) : 'user';
            const content = msg && typeof msg.content === 'string' ? msg.content.trim() : '';
            return content ? role + ': ' + content : '';
          })
          .filter(Boolean)
          .join('\\n');

        if (!transcript) return text;

        return (
          'Use this recent local chat context when responding.\\n' +
          'Recent chat transcript:\\n' +
          transcript +
          '\\n\\n' +
          'New user message:\\n' +
          text
        );
      }

      function renderList(target, items) {
        target.innerHTML = '';
        items.forEach((item) => {
          const el = document.createElement('div');
          el.className = 'data-item';
          el.innerHTML =
            '<div class="name">' + escapeHtml(item.name || '') + '</div>' +
            '<div class="meta">' + escapeHtml(item.detail || '') + '</div>' +
            '<div class="tag ' + tagClass(item.tag) + '">' + escapeHtml(item.tag || '') + '</div>';
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
          const itemId = item.id || item.name || '';
          el.innerHTML =
            '<div class="name">' + escapeHtml(item.name || '') + '</div>' +
            '<div class="meta">' + escapeHtml(item.detail || '') + '</div>' +
            '<div class="tag ' + tagClass(tag) + '">' + escapeHtml(tag) + '</div>' +
            '<div class="data-item-actions">' +
              '<button data-action="edit" data-type="' + escapeAttr(type) + '" data-id="' + escapeAttr(itemId) + '">Edit</button>' +
              '<button data-action="delete" data-type="' + escapeAttr(type) + '" data-id="' + escapeAttr(itemId) + '">Delete</button>' +
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
          button.innerHTML = '<strong>' + escapeHtml(item.name || '') + '</strong>' +
            '<span>' + escapeHtml(item.detail || '') + '</span>';
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
          el.innerHTML = '<div class="title">' + escapeHtml(session.label || '') + '</div>' +
            '<div class="meta">' + escapeHtml(session.workspaceRoot || '') + '</div>';
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
          el.innerHTML = '<div class="title">' + escapeHtml(chat.title || '') + '</div>' +
            '<div class="meta">' + formatTime(chat.createdAt) + '</div>';
          el.addEventListener('click', () => {
            state.activeChatId = chat.id;
            goToWorkspace();
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
          el.innerHTML =
            '<strong>' + escapeHtml(item.label || '') + '</strong> ' +
            escapeHtml(item.detail || '');
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
          activeSessionMeta.textContent =
            'Manage tools, agents, and integrations. Release channel: ' +
            (catalog.releaseChannel || 'stable');
          return;
        }
        activeSessionTitle.textContent = desktopMode ? '' : session.label;
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
        if (releaseChannelSelect) {
          releaseChannelSelect.value = catalog.releaseChannel || 'stable';
        }
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
            '<div class="name">' + escapeHtml(task.name || '') + '</div>' +
            '<div class="meta">' + escapeHtml(task.detail || '') + '</div>' +
            '<div class="tag ' + tagClass(task.status) + '">' + escapeHtml(task.status || '') + '</div>' +
            '<div class="data-item-actions">' +
              '<button data-action="edit" data-type="schedules" data-id="' + escapeAttr(task.id || '') + '">Edit</button>' +
              '<button data-action="delete" data-type="schedules" data-id="' + escapeAttr(task.id || '') + '">Delete</button>' +
            '</div>';
          scheduleList.appendChild(el);
        });
      }

      function renderRewind() {
        if (!rewindList) return;
        rewindList.innerHTML = '';
        if (!currentSession()) {
          const empty = document.createElement('div');
          empty.className = 'activity-item';
          empty.textContent = 'Connect a session to load rewind points.';
          rewindList.appendChild(empty);
          return;
        }
        if (!state.catalogLoaded) {
          const loading = document.createElement('div');
          loading.className = 'activity-item';
          loading.textContent = 'Loading rewind points...';
          rewindList.appendChild(loading);
          return;
        }
        const points = Array.isArray(catalog.rewindPoints)
          ? catalog.rewindPoints
          : [];
        if (points.length === 0) {
          const empty = document.createElement('div');
          empty.className = 'activity-item';
          empty.textContent =
            'No rewind points found. Run tools in CLI, then refresh.';
          rewindList.appendChild(empty);
          return;
        }

        points.forEach((point) => {
          const el = document.createElement('div');
          el.className = 'data-item';
          el.innerHTML =
            '<div class="name">' + escapeHtml(point.name || '') + '</div>' +
            '<div class="meta">' + escapeHtml(point.detail || '') + '</div>' +
            '<div class="tag">' + escapeHtml(point.restoreType || '') + '</div>' +
            '<div class="data-item-actions">' +
              '<button data-action="rewind-use" data-checkpoint="' + escapeAttr(point.id || '') + '">Use</button>' +
            '</div>';
          rewindList.appendChild(el);
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
        renderRewind();
        renderViews();
        const session = currentConnectedSession();
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

      function addMessage(role, content, chatId) {
        const chat = chatId ? getChatById(chatId) : currentChat();
        if (!chat) return;
        chat.messages.push({ role, content, createdAt: Date.now() });
        if (role === 'user') {
          const userMessageCount = chat.messages.filter((item) => item.role === 'user').length;
          if (userMessageCount === 1) {
            chat.title = formatChatTitleFromQuery(content);
          }
        }
        if (!chatId || state.activeChatId === chat.id) {
          renderMessages();
        }
        saveState();
      }

      function appendAssistantText(text, chatId) {
        const chat = chatId ? getChatById(chatId) : currentChat();
        if (!chat) return;
        let last = chat.messages[chat.messages.length - 1];
        if (!last || last.role !== 'assistant' || !last.streaming) {
          last = { role: 'assistant', content: '', createdAt: Date.now(), streaming: true };
          chat.messages.push(last);
        }
        last.content += text;
        if (!chatId || state.activeChatId === chat.id) {
          renderMessages();
        }
        saveState();
      }

      function endStreaming(chatId) {
        const chat = chatId ? getChatById(chatId) : currentChat();
        if (!chat) return;
        const last = chat.messages[chat.messages.length - 1];
        if (last && last.role === 'assistant' && last.streaming) {
          last.streaming = false;
        }
      }

      function logActivity(label, detail, chatId) {
        const chat = chatId ? getChatById(chatId) : currentChat();
        if (!chat) return;
        chat.activity.push({ label, detail, createdAt: Date.now() });
        if (!chatId || state.activeChatId === chat.id) {
          renderActivity();
        }
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
        const session = currentConnectedSession();
        if (!session) {
          addMessage('system', 'Connect a session to manage configuration.');
          throw new Error('No active session');
        }
        const headers = buildHeaders(session);
        const response = await fetch(url, { ...options, headers: { ...headers, ...(options.headers || {}) } });
        if (response.status === 401 || response.status === 409) {
          const previousChats =
            state.sessions[0] && Array.isArray(state.sessions[0].chats)
              ? state.sessions[0].chats
              : [];
          state.sessions = previousChats.length
            ? [
                {
                  id: '',
                  token: '',
                  workspaceRoot: workspaceRootFromHost || '',
                  label: desktopMode ? 'Workspace' : 'Session 1',
                  createdAt: Date.now(),
                  chats: previousChats,
                },
              ]
            : [];
          state.activeSessionId = '';
          state.activeChatId = previousChats[0] ? previousChats[0].id : '';
          state.catalogLoaded = false;
          setStatus('Session expired. Reconnect.', false);
          saveState();
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
        if (!currentConnectedSession()) {
          state.catalogLoading = false;
          state.catalogLoaded = false;
          return;
        }
        if (state.catalogLoading) return;
        state.catalogLoading = true;
        state.catalogLoaded = false;
        try {
          const [catalogRes, commandsRes] = await Promise.all([
            apiFetch('/api/v1/webui/catalog', { method: 'GET' }),
            apiFetch('/listCommands', { method: 'GET' }),
          ]);
          const data = await catalogRes.json();
          const commandData = await commandsRes.json();
          const dynamicCommands = mapCommandTreeToCatalog(commandData.commands || []);
          const mergedCommands = [...fallbackCommandCatalog];
          const seenTemplates = new Set(mergedCommands.map((entry) => entry.template));
          dynamicCommands.forEach((entry) => {
            if (!seenTemplates.has(entry.template)) {
              seenTemplates.add(entry.template);
              mergedCommands.push(entry);
            }
          });
          catalog = { ...catalog, ...data, commands: mergedCommands };
          state.catalogLoaded = true;
          render();
        } catch (err) {
          const message = err && err.message ? String(err.message) : 'Request failed';
          if (!/Session expired/i.test(message)) {
            addMessage('system', 'Failed to load catalog: ' + message);
          } else {
            setStatus('Disconnected', false);
          }
        } finally {
          state.catalogLoading = false;
        }
      }

      function buildRpcRequest(session, promptText, taskId, attachments) {
        const parts = [{ kind: 'text', text: promptText }];
        (attachments || []).forEach((attachment) => {
          parts.push({
            kind: 'data',
            data: {
              type: 'inline-file',
              mimeType: attachment.mimeType,
              data: attachment.data,
              name: attachment.name,
              size: attachment.size,
            },
          });
        });
        const request = {
          jsonrpc: '2.0',
          id: 'web-' + Date.now(),
          method: 'message/stream',
          params: {
            message: {
              kind: 'message',
              role: 'user',
              parts,
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

      function extractPolicyDenialReason(result) {
        if (!result) return '';
        const maybeReason =
          (typeof result.reason === 'string' && result.reason) ||
          (typeof result.error?.message === 'string' && result.error.message) ||
          '';

        const statusParts = result.status?.message?.parts;
        if (Array.isArray(statusParts)) {
          const denialPart = statusParts
            .filter((part) => part && part.kind === 'text' && typeof part.text === 'string')
            .map((part) => part.text)
            .find((text) => /denied|policy/i.test(text));
          if (denialPart) {
            return denialPart;
          }
        }

        if (maybeReason && /denied|policy/i.test(maybeReason)) {
          return maybeReason;
        }

        return '';
      }

      function handleEvent(event, chatId) {
        if (!event || !event.result) return;
        const result = event.result;
        if (result.kind === 'task' && result.id) {
          const chat = chatId ? getChatById(chatId) : currentChat();
          if (chat) {
            chat.taskId = result.id;
            logActivity('Task', 'Created ' + result.id, chatId);
            saveState();
          }
          return;
        }
        if (result.kind === 'status-update') {
          const parts = result.status && result.status.message && result.status.message.parts;
          if (Array.isArray(parts)) {
            parts.forEach((part) => {
              if (part.kind === 'text' && part.text) {
                appendAssistantText(part.text, chatId);
              }
            });
          } else if (result.status && result.status.state) {
            logActivity('Status', result.status.state, chatId);
          }
        } else if (result.kind && String(result.kind).includes('tool')) {
          const denialReason = extractPolicyDenialReason(result);
          if (denialReason) {
            logActivity('Policy Deny', denialReason, chatId);
            addMessage('system', 'Policy denied tool execution: ' + denialReason, chatId);
          } else {
            logActivity('Tool', String(result.kind), chatId);
          }
        }
      }

      async function createSession() {
        const token = serverTokenInput.value.trim();
        if (!token && !allowEmptyToken) {
          setStatus('Enter server token to connect.', false);
          return;
        }
        const headers = {};
        if (token) headers.authorization = 'Bearer ' + token;

        setStatus('Connecting...', true);
        const res = await fetch('/api/v1/sessions', { method: 'POST', headers });
        if (!res.ok) {
          setStatus('Failed to connect: ' + res.status, false);
          return;
        }
        const data = await res.json();
        const previousChats =
          state.sessions[0] && Array.isArray(state.sessions[0].chats)
            ? state.sessions[0].chats
            : [];
        const chats = previousChats.length ? previousChats : [createChat()];
        const session = {
          id: data.sessionId,
          token: data.token,
          workspaceRoot: data.workspaceRoot || '',
          label: desktopMode ? 'Workspace' : 'Session ' + (state.sessions.length + 1),
          createdAt: Date.now(),
          chats,
        };
        saveAutoConnect(true);
        state.sessions = [session];
        state.activeSessionId = session.id;
        state.activeChatId = chats.some((chat) => chat.id === state.activeChatId)
          ? state.activeChatId
          : session.chats[0].id;
        state.catalogLoaded = false;
        state.catalogLoading = false;
        setStatus('Connected', true);
        addMessage('system', 'Session established for ' + (session.workspaceRoot || 'workspace'));
        render();
        fetchCatalog();
        saveState();
      }

      async function createSessionWithToken(token) {
        if (!token && !allowEmptyToken) return false;
        const headers = {};
        if (token) headers.authorization = 'Bearer ' + token;
        setStatus('Connecting...', true);
        const res = await fetch('/api/v1/sessions', { method: 'POST', headers });
        if (!res.ok) {
          setStatus('Failed to connect: ' + res.status, false);
          return false;
        }
        const data = await res.json();
        const previousChats =
          state.sessions[0] && Array.isArray(state.sessions[0].chats)
            ? state.sessions[0].chats
            : [];
        const chats = previousChats.length ? previousChats : [createChat()];
        const session = {
          id: data.sessionId,
          token: data.token,
          workspaceRoot: data.workspaceRoot || '',
          label: desktopMode ? 'Workspace' : 'Session ' + (state.sessions.length + 1),
          createdAt: Date.now(),
          chats,
        };
        saveAutoConnect(true);
        state.sessions = [session];
        state.activeSessionId = session.id;
        state.activeChatId = chats.some((chat) => chat.id === state.activeChatId)
          ? state.activeChatId
          : session.chats[0].id;
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
          saveAutoConnect(false);
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
        const attachments = pendingAttachments.slice();
        if (!session || !chat || (!text && attachments.length === 0)) return;
        promptInput.value = '';
        pendingAttachments = [];
        renderAttachmentStrip();
        setAttachmentError('');
        endStreaming(chat.id);
        const attachmentSummary = attachments
          .map((attachment) =>
            String(attachment.mimeType || '').startsWith('image/')
              ? '[Image] ' + attachment.name
              : '[Doc] ' + attachment.name,
          )
          .join('\\n');
        const userMessage = text
          ? (attachmentSummary ? text + '\\n\\n' + attachmentSummary : text)
          : attachmentSummary;
        addMessage('user', userMessage);
        endStreaming(chat.id);
        logActivity('User', 'Sent prompt', chat.id);
        const promptText = text || 'Analyze the attached image(s).';
        const contextualText = buildContextualPrompt(chat, promptText);
        const request = buildRpcRequest(session, contextualText, chat.taskId, attachments);
        activeStreamingChatId = chat.id;
        const res = await fetch('/', {
          method: 'POST',
          headers: buildHeaders(session),
          body: JSON.stringify(request),
        });
        if (!res.ok) {
          addMessage('system', 'Request failed: ' + res.status, chat.id);
          activeStreamingChatId = '';
          return;
        }
        await readSse(res, (event) => handleEvent(event, chat.id));
        endStreaming(chat.id);
        if (activeStreamingChatId === chat.id) {
          activeStreamingChatId = '';
        }
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
        if (type === 'commands' || type === 'agents') {
          goToWorkspace();
        }
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
      let fallbackEditor = null;
      let useFallbackEditor = false;

      function ensureFallbackEditor() {
        if (fallbackEditor) return fallbackEditor;
        fallbackEditor = document.createElement('textarea');
        fallbackEditor.className = 'editor-fallback';
        fallbackEditor.setAttribute('spellcheck', 'false');
        editorSurface.innerHTML = '';
        editorSurface.appendChild(fallbackEditor);
        return fallbackEditor;
      }

      function setEditorValue(value, language) {
        if (useFallbackEditor || !monacoEditor) {
          const el = ensureFallbackEditor();
          el.value = value || '';
          return;
        }
        monacoEditor.setValue(value || '');
        window.monaco.editor.setModelLanguage(monacoEditor.getModel(), language || 'markdown');
      }

      function getEditorValue() {
        if (useFallbackEditor || !monacoEditor) {
          return fallbackEditor ? fallbackEditor.value : '';
        }
        return monacoEditor.getValue();
      }

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
        try {
          await loadMonaco();
          useFallbackEditor = false;
          if (fallbackEditor && fallbackEditor.parentNode === editorSurface) {
            editorSurface.removeChild(fallbackEditor);
          }
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
            setEditorValue(options.content || '', options.language || 'markdown');
          }
        } catch {
          useFallbackEditor = true;
          setEditorValue(options.content || '', options.language || 'markdown');
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
        const content = getEditorValue();
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
        if (currentConnectedSession()) {
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
        if (currentConnectedSession()) {
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

      on(uploadImageBtn, 'click', () => {
        if (!imageUploadInput) return;
        imageUploadInput.click();
      });

      on(imageUploadInput, 'change', () => {
        handleAttachmentSelection(imageUploadInput.files).catch(() => {
          setAttachmentError('Failed to process selected file.');
        });
        imageUploadInput.value = '';
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

      if (chatSidebarToggle) {
        chatSidebarToggle.addEventListener('click', () => {
          const collapsed = document.body.classList.toggle('chat-sidebar-collapsed');
          chatSidebarToggle.textContent = collapsed ? '▶' : '◀';
          chatSidebarToggle.setAttribute('title', collapsed ? 'Show chats sidebar' : 'Hide chats sidebar');
          chatSidebarToggle.setAttribute('aria-label', collapsed ? 'Show chats sidebar' : 'Hide chats sidebar');
        });
      }

      on(serverTokenInput, 'input', () => {
        saveServerToken(serverTokenInput.value.trim());
        updateConnectState();
      });

      on(cliSearch, 'input', () => {
        renderCommands(cliSearch.value);
      });

      on(releaseChannelSave, 'click', () => {
        const selected = releaseChannelSelect ? releaseChannelSelect.value : '';
        if (!selected) return;
        apiFetch('/api/v1/webui/release-channel', {
          method: 'PUT',
          body: JSON.stringify({ releaseChannel: selected }),
        })
          .then(() => fetchCatalog())
          .catch((err) =>
            addMessage(
              'system',
              'Release channel update failed: ' + err.message,
            ),
          );
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

      on(rewindRefresh, 'click', () => {
        fetchCatalog();
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
        if (action === 'rewind-use') {
          const checkpoint = button.dataset.checkpoint;
          if (!checkpoint) return;
          promptInput.value = '/rewind ' + checkpoint;
          setActiveView('chat');
          promptInput.focus();
          return;
        }
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
        const raw = String(text || '');
        return raw
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\"/g, '&quot;')
          .replace(/'/g, '&#39;');
      }

      function escapeAttr(text) {
        return text
          ? escapeHtml(text).replace(/\x60/g, '&#96;')
          : '';
      }

      function sanitizeUrl(url) {
        const raw = String(url || '').trim();
        if (!raw) return '#';
        if (raw.startsWith('/')) return raw;
        const lower = raw.toLowerCase();
        if (
          lower.startsWith('http://') ||
          lower.startsWith('https://') ||
          lower.startsWith('mailto:')
        ) {
          return raw;
        }
        return '#';
      }

      function sanitizeHtml(html) {
        const template = document.createElement('template');
        template.innerHTML = String(html || '');
        const blockedTags = new Set([
          'script',
          'iframe',
          'object',
          'embed',
          'link',
          'meta',
          'style',
        ]);
        const elements = template.content.querySelectorAll('*');
        elements.forEach((el) => {
          const tagName = el.tagName.toLowerCase();
          if (blockedTags.has(tagName)) {
            el.remove();
            return;
          }
          const attributes = Array.from(el.attributes);
          attributes.forEach((attr) => {
            const name = attr.name.toLowerCase();
            if (name.startsWith('on')) {
              el.removeAttribute(attr.name);
              return;
            }
            if (name === 'href' || name === 'src' || name === 'xlink:href') {
              el.setAttribute(attr.name, sanitizeUrl(attr.value));
              if (tagName === 'a' && name === 'href') {
                el.setAttribute('rel', 'noopener noreferrer');
                el.setAttribute('target', '_blank');
              }
            }
          });
        });
        return template.innerHTML;
      }

      function renderFallbackMarkdown(input) {
        let text = escapeHtml(input || '');
        const codeBlocks = [];

        text = text.replace(/\`\`\`([a-zA-Z0-9_-]+)?\\n([\\s\\S]*?)\`\`\`/g, (_match, lang, code) => {
          const language = lang ? ' class="language-' + lang + '"' : '';
          const html = '<pre><code' + language + '>' + code + '</code></pre>';
          const index = codeBlocks.push(html) - 1;
          return '@@CODEBLOCK_' + index + '@@';
        });

        text = text.replace(/^###\\s+(.*)$/gm, '<h3>$1</h3>');
        text = text.replace(/^##\\s+(.*)$/gm, '<h2>$1</h2>');
        text = text.replace(/^#\\s+(.*)$/gm, '<h1>$1</h1>');
        text = text.replace(/^[-*]\\s+(.*)$/gm, '&#8226; $1');
        text = text.replace(/\\[([^\\]]+)\\]\\(([^)]+)\\)/g, '<a href="$2">$1</a>');
        text = text.replace(/\`([^\`]+)\`/g, '<code>$1</code>');
        text = text.replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>');
        text = text.replace(/\\*([^*\\n]+)\\*/g, '<em>$1</em>');

        let html = text
          .split(/\\n{2,}/)
          .map((chunk) => '<p>' + chunk.replace(/\\n/g, '<br>') + '</p>')
          .join('');

        codeBlocks.forEach((block, index) => {
          const token = '@@CODEBLOCK_' + index + '@@';
          html = html.replace('<p>' + token + '</p>', block);
          html = html.replace(token, block);
        });

        html = html.replace(/<p>(<h[1-3]>[\\s\\S]*?<\\/h[1-3]>)<\\/p>/g, '$1');
        return sanitizeHtml(html);
      }

      function renderMarkdown(input) {
        const text = String(input || '');
        if (!text) return '';
        if (window.marked && typeof window.marked.parse === 'function') {
          return sanitizeHtml(window.marked.parse(text, { breaks: true, gfm: true }));
        }
        return renderFallbackMarkdown(text);
      }

      const storedToken = loadServerToken();
      if (storedToken && !serverTokenInput.value) {
        serverTokenInput.value = storedToken;
        updateConnectState();
      }

      if (desktopMode && allowEmptyToken) {
        createSessionWithToken(storedToken).catch(() => {
          setStatus('Session connection failed.', false);
        });
      } else if (!currentConnectedSession() && loadAutoConnect()) {
        if (storedToken) {
          createSessionWithToken(storedToken).catch(() => {
            setStatus('Enter server token to connect.', false);
          });
        }
      }

      renderAttachmentStrip();
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
            <button class="menu-item" data-view="rewind">Rewind</button>
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
          <div class="card" id="remoteConnectCard">
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

          <div id="sessionSection" class="section">
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
              <button id="chatSidebarToggle" class="ghost" aria-label="Hide chats sidebar" title="Hide chats sidebar">◀</button>
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
                    <div class="composer-shell">
                      <textarea id="promptInput" placeholder="Ask Papert Code... (Cmd/Ctrl + Enter to send)"></textarea>
                      <div id="attachmentStrip" class="attachment-strip"></div>
                      <div class="composer-controls">
                        <div class="composer-left">
                          <button id="uploadImageBtn" class="icon-btn" type="button" aria-label="Upload files" title="Upload files">+</button>
                          <input id="imageUploadInput" type="file" accept="image/*,.pdf,.txt,.md,.markdown,.csv,.json,.doc,.docx" multiple style="display:none;" />
                          <span class="composer-hint">Up to 3 files, 2MB each</span>
                        </div>
                        <button id="sendBtn" class="composer-send" type="button" aria-label="Send prompt" title="Send prompt">↑</button>
                      </div>
                    </div>
                    <div id="attachmentError" class="attachment-error"></div>
                    <div class="composer-meta">
                      <label id="autoExecToggleRow" class="toggle">
                        <input id="autoExecToggle" type="checkbox" />
                        Auto-execute tools
                      </label>
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
                  <div class="activity-item" style="margin-top:12px;">
                    <strong>Release channel</strong>
                    <div class="action-row" style="margin-top:8px;">
                      <select id="releaseChannelSelect">
                        <option value="stable">stable</option>
                        <option value="preview">preview</option>
                        <option value="nightly">nightly</option>
                      </select>
                      <button id="releaseChannelSave" class="ghost">Save</button>
                    </div>
                  </div>
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

            <section class="view" id="view-rewind">
              <div class="page-grid">
                <div class="page-card">
                  <div class="page-card-header">
                    <h3>Rewind Points</h3>
                    <button id="rewindRefresh" class="ghost">Refresh</button>
                  </div>
                  <div id="rewindList" class="data-list"></div>
                </div>
                <div class="page-card">
                  <h3>How it works</h3>
                  <div class="activity-item">Choose a rewind point and click Use to prefill /rewind &lt;id&gt; in chat.</div>
                  <div class="activity-item">Rewind always asks for explicit confirmation before restoring state.</div>
                  <div class="activity-item">For file rollback, checkpoints must include a git commit snapshot.</div>
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


export function getWebUiHtml(
  allowEmptyToken = false,
  desktopMode = false,
  workspaceRoot = '',
  initialState: unknown = null,
): string {
  const safeInitialState = JSON.stringify(initialState).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Papert Code Web</title>
    <style>
${WEB_UI_STYLES}
    </style>
  </head>
  <body class="${desktopMode ? "desktop-embed" : ""}">
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
window.__PAPERT_WEB_UI_ALLOW_EMPTY_TOKEN__ = ${allowEmptyToken ? "true" : "false"};
window.__PAPERT_WEB_UI_DESKTOP_MODE__ = ${desktopMode ? "true" : "false"};
window.__PAPERT_WEB_UI_WORKSPACE_ROOT__ = ${JSON.stringify(workspaceRoot)};
window.__PAPERT_WEB_UI_INITIAL_STATE__ = ${safeInitialState};
${WEB_UI_SCRIPT}
    </script>
  </body>
</html>`;
}
