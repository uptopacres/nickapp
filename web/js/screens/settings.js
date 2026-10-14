// Settings (gear in the Home header): connection and cache status, manual refresh.
import { esc, ICONS } from '../ui.js';

const ERROR_TEXT = {
  'bad-token': "This link isn't recognized. Open your personal install link again.",
  timeout: 'The server took too long to answer. It will retry automatically.',
  'bad-response': 'The server sent something unexpected. It will retry automatically.',
};

function when(iso) {
  if (!iso) return 'never';
  return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function renderSettings(root, s, { onRefresh }) {
  root.innerHTML = `
    <header class="topbar">
      <div class="topbar-lead">
        <a class="icon-btn" href="#home" aria-label="Back to Home">${ICONS.back}</a>
        <h1 class="section-title">Settings</h1>
      </div>
    </header>

    ${s.error ? `<div class="notice notice-error" role="alert">${esc(ERROR_TEXT[s.error] || 'Last sync failed: ' + s.error)}</div>` : ''}

    <section class="card">
      <dl class="kv">
        <dt>User</dt><dd>${esc(s.config?.user?.displayName || '—')}</dd>
        <dt>Environment</dt><dd>${s.demo ? 'demo' : esc(s.env)}</dd>
        <dt>Connection</dt><dd>${navigator.onLine ? 'online' : 'offline'}</dd>
        <dt>Last synced</dt><dd>${s.syncing ? 'syncing…' : when(s.lastSync)}</dd>
        <dt>Days cached</dt><dd>${s.entriesCount}</dd>
        <dt>Config version</dt><dd class="mono">${esc(s.config?.version || '—')}</dd>
      </dl>
      <button class="btn" id="refresh" ${s.syncing || s.demo || !navigator.onLine ? 'disabled' : ''}>Refresh now</button>
    </section>`;

  root.querySelector('#refresh').addEventListener('click', onRefresh);
}
