// NickApp field app: boot, token, routing, background refresh.
// Home is always computed on the phone from cached entries with the shared NickPacing
// rule (js/pacing.js, copied from apps-script/Pacing.js), so it renders offline.
import { ENV, TRENDS_URL } from './config.js';
import * as api from './api.js';
import * as db from './db.js';
import { todayEt } from './dates.js';
import { esc } from './ui.js';
import { renderHome } from './screens/home.js';
import { renderSettings } from './screens/settings.js';

const params = new URLSearchParams(location.search);
const DEMO = params.has('demo');
const TOKEN_KEY = `nickapp.token.${ENV}`;
const REFRESH_MS = 5 * 60 * 1000;
const view = document.getElementById('view');

const state = { config: null, entries: [], lastSync: null, syncing: false, error: null };

// The token stays on the URL (the installed app launches with it; iOS home-screen apps
// don't share storage with Safari) and is mirrored to localStorage as a fallback.
function loadToken() {
  const fromUrl = params.get('u');
  try {
    if (fromUrl) localStorage.setItem(TOKEN_KEY, fromUrl);
    return fromUrl || localStorage.getItem(TOKEN_KEY);
  } catch {
    return fromUrl;
  }
}
const token = DEMO ? null : loadToken();
api.setToken(token);

async function loadLocal() {
  if (DEMO) {
    const demo = await import('./demo.js');
    state.config = demo.config;
    state.entries = demo.entries(todayEt());
    return;
  }
  [state.config, state.entries, state.lastSync] = await Promise.all([
    db.get('config', 'current'),
    db.getAll('entries'),
    db.get('meta', 'lastSync'),
  ]);
}

/** Server entries, with anything still waiting in the outbox laid over the top. */
function mergeEntries(serverEntries, outbox) {
  const byId = new Map(serverEntries.map(e => [e.entryId, e]));
  outbox.forEach(item => byId.set(item.entryId, item.entry));
  return [...byId.values()].sort((a, b) => a.date.localeCompare(b.date));
}

async function refresh() {
  if (DEMO || !token || state.syncing || !navigator.onLine) return;
  state.syncing = true;
  try {
    const [config, serverEntries] = await Promise.all([api.call('getConfig'), api.call('getEntries')]);
    const entries = mergeEntries(serverEntries, await db.getAll('outbox'));
    const changed =
      config.version !== state.config?.version || JSON.stringify(entries) !== JSON.stringify(state.entries);
    await db.put('config', config, 'current');
    await db.replaceAll('entries', entries);
    state.lastSync = new Date().toISOString();
    await db.put('meta', state.lastSync, 'lastSync');
    Object.assign(state, { config, entries, error: null });
    if (changed || route() === 'settings') render();
  } catch (err) {
    state.error = err.message || String(err);
    console.warn('refresh failed:', state.error);
    if (route() === 'settings' || !state.config) render();
  } finally {
    state.syncing = false;
  }
}

// ---------- routing ----------

function route() {
  return location.hash.slice(1) || 'home';
}

function setActiveTab(r) {
  document.querySelectorAll('.tabbar a').forEach(a => {
    if (a.dataset.tab === r) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

function message(title, body, tone = '') {
  view.innerHTML = `
    <header class="topbar"><h1 class="section-title">${esc(title)}</h1></header>
    <div class="notice ${tone}">${body}</div>`;
}

function renderHomeView() {
  if (!state.config) {
    if (state.error === 'bad-token') {
      return message('NickApp', "This link isn't recognized. Open your personal install link again.", 'notice-error');
    }
    if (!navigator.onLine) {
      return message('NickApp', 'The first load needs a connection. After that, Home works offline.', 'notice-warn');
    }
    return message('NickApp', state.error ? 'Still trying to reach the server…' : 'Loading your week…');
  }
  const home = NickPacing.computeHome(state.entries, state.config.priorities, todayEt());
  if (!DEMO) db.put('home', home, 'current').catch(() => {});
  renderHome(view, home, { offline: !navigator.onLine, demo: DEMO });
}

function render() {
  const r = route();
  setActiveTab(r);

  if (!DEMO && !token) {
    return message(
      'NickApp',
      'Open your personal install link (the one ending in <span class="mono">?u=…</span>) to get started.',
      'notice-warn'
    );
  }

  switch (r) {
    case 'settings':
      return renderSettings(
        view,
        { ...state, entriesCount: state.entries.length, env: ENV, demo: DEMO },
        { onRefresh: () => { refresh(); render(); } }
      );
    case 'history':
      return message('History', 'Coming in step 4.');
    case 'entry':
      return message('Log today', 'The entry form is coming in step 4.');
    case 'trends':
      if (!navigator.onLine) return message('Trends', 'Trends needs a connection.', 'notice-warn');
      if (TRENDS_URL) {
        location.href = TRENDS_URL;
        return;
      }
      return message('Trends', 'The Trends page is coming in a later step.');
    default:
      return renderHomeView();
  }
}

// ---------- lifecycle ----------

let updateReady = false;

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js').catch(err => console.warn('sw:', err));
  // A new deploy took over: reload the next time the app comes to the foreground,
  // never in the middle of something.
  navigator.serviceWorker.addEventListener('controllerchange', () => (updateReady = true));
}

function sinceLastSync() {
  return state.lastSync ? Date.now() - Date.parse(state.lastSync) : Infinity;
}

window.addEventListener('hashchange', render);
window.addEventListener('online', () => { render(); refresh(); });
window.addEventListener('offline', render);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (updateReady) return location.reload();
  render(); // the date may have rolled over
  if (sinceLastSync() > 60 * 1000) refresh();
});
setInterval(() => {
  if (document.visibilityState === 'visible') refresh();
}, REFRESH_MS);

(async function boot() {
  registerServiceWorker();
  try {
    await loadLocal();
  } catch (err) {
    console.warn('local cache unavailable:', err);
  }
  render();
  refresh();
})();
