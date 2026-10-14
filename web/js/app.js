// NickApp field app: boot, token, routing, save, background sync.
// Home is always computed on the phone from cached entries with the shared NickPacing
// rule (js/pacing.js, copied from apps-script/Pacing.js), so it renders offline and a
// Save repaints it instantly.
import { ENV, TRENDS_URL } from './config.js';
import * as api from './api.js';
import * as db from './db.js';
import * as sync from './sync.js';
import { todayEt } from './dates.js';
import { esc, toast } from './ui.js';
import { renderHome } from './screens/home.js';
import { renderEntry } from './screens/entry.js';
import { renderHistory } from './screens/history.js';
import { renderSettings } from './screens/settings.js';

const params = new URLSearchParams(location.search);
const DEMO = params.has('demo');
const TOKEN_KEY = `nickapp.token.${ENV}`;
const REFRESH_MS = 5 * 60 * 1000;
const view = document.getElementById('view');

const state = { config: null, entries: [], outbox: [], lastSync: null, syncing: false, error: null };
let flipFrom = null; // Home before the last Save, for the target-flip

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
  [state.config, state.entries, state.outbox, state.lastSync] = await Promise.all([
    db.get('config', 'current'),
    db.getAll('entries'),
    db.getAll('outbox'),
    db.get('meta', 'lastSync'),
  ]);
}

const byDate = (a, b) => a.date.localeCompare(b.date);

/** Server entries + phone-only photo thumbnails, with anything still queued laid on top. */
function mergeEntries(serverEntries, outbox, local) {
  const thumbs = new Map(local.filter(e => e.photoThumb).map(e => [e.entryId, e.photoThumb]));
  const byId = new Map(serverEntries.map(e => [e.entryId, thumbs.has(e.entryId) ? { ...e, photoThumb: thumbs.get(e.entryId) } : e]));
  outbox.forEach(item => byId.set(item.entryId, item.entry));
  return [...byId.values()].sort(byDate);
}

function homeNow() {
  return NickPacing.computeHome(state.entries, state.config.priorities, todayEt());
}

let rerun = null; // a forced refresh asked for while one was already running

/** force: retry queued uploads now, ignoring backoff. */
async function refresh(force = false) {
  if (DEMO || !token || !navigator.onLine) return;
  if (state.syncing) {
    rerun = Boolean(rerun) || force;
    return;
  }
  state.syncing = true;
  try {
    const { sent, lastError } = await sync.flush(force);
    if (sent) {
      toast(sent === 1 ? 'Uploaded' : `Uploaded ${sent} days`);
      [state.outbox, state.entries] = await Promise.all([db.getAll('outbox'), db.getAll('entries')]);
      renderIfSafe(); // drop the "to upload" pill now, not after the pull below
    }

    const [config, serverEntries] = await Promise.all([api.call('getConfig'), api.call('getEntries')]);
    const outbox = await db.getAll('outbox');
    const entries = mergeEntries(serverEntries, outbox, await db.getAll('entries'));
    const changed =
      sent > 0 ||
      outbox.length !== state.outbox.length ||
      config.version !== state.config?.version ||
      JSON.stringify(entries) !== JSON.stringify(state.entries);

    await db.put('config', config, 'current');
    await db.replaceAll('entries', entries);
    state.lastSync = new Date().toISOString();
    await db.put('meta', state.lastSync, 'lastSync');
    Object.assign(state, { config, entries, outbox, error: lastError });
    if (changed || route().name === 'settings') renderIfSafe();
  } catch (err) {
    state.error = err.message || String(err);
    state.outbox = await db.getAll('outbox').catch(() => state.outbox);
    console.warn('refresh failed:', state.error);
    if (route().name === 'settings' || !state.config) renderIfSafe();
  } finally {
    state.syncing = false;
    if (rerun !== null) {
      const again = rerun;
      rerun = null;
      refresh(again);
    }
  }
}

/** Save (spec §9): phone first, "Saved", Home repaints with the flip, upload follows. */
async function handleSave({ entry, photo }) {
  const before = homeNow();
  if (!DEMO) {
    await sync.enqueue(entry, photo);
    state.outbox = await db.getAll('outbox');
  }
  state.entries = [...state.entries.filter(e => e.entryId !== entry.entryId), entry].sort(byDate);
  flipFrom = before;
  toast('Saved');
  location.hash = '#home';
  refresh(true);
}

// ---------- routing ----------

function route() {
  const [name, arg] = location.hash.slice(1).split('/');
  return { name: name || 'home', arg };
}

function setActiveTab(name) {
  document.querySelectorAll('.tabbar a').forEach(a => {
    if (a.dataset.tab === name) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

function message(title, body, tone = '') {
  view.innerHTML = `
    <header class="topbar"><h1 class="section-title">${esc(title)}</h1></header>
    <div class="notice ${tone}">${body}</div>`;
}

function needsConfig() {
  if (state.error === 'bad-token') {
    return message('NickApp', "This link isn't recognized. Open your personal install link again.", 'notice-error');
  }
  if (!navigator.onLine) {
    return message('NickApp', 'The first load needs a connection. After that, the app works offline.', 'notice-warn');
  }
  return message('NickApp', state.error ? 'Still trying to reach the server…' : 'Loading your week…');
}

function renderHomeView() {
  const home = homeNow();
  if (!DEMO) db.put('home', home, 'current').catch(() => {});
  renderHome(view, home, { offline: !navigator.onLine, demo: DEMO, pending: state.outbox.length, from: flipFrom });
  flipFrom = null;
}

function render() {
  const { name, arg } = route();
  setActiveTab(name);
  window.scrollTo(0, 0);

  if (!DEMO && !token) {
    return message(
      'NickApp',
      'Open your personal install link (the one ending in <span class="mono">?u=…</span>) to get started.',
      'notice-warn'
    );
  }

  if (name === 'trends') {
    if (!navigator.onLine) return message('Trends', 'Trends needs a connection.', 'notice-warn');
    if (TRENDS_URL) return void (location.href = TRENDS_URL);
    return message('Trends', 'The Trends page is coming in a later step.');
  }
  if (name === 'settings') {
    return renderSettings(
      view,
      { ...state, entriesCount: state.entries.length, env: ENV, demo: DEMO },
      { onRefresh: () => { refresh(true); render(); } }
    );
  }
  if (!state.config) return needsConfig();

  switch (name) {
    case 'entry': {
      const today = todayEt();
      const date = /^\d{4}-\d{2}-\d{2}$/.test(arg || '') && arg <= today ? arg : today;
      return renderEntry(view, { config: state.config, entries: state.entries, date, today, onSave: handleSave });
    }
    case 'history':
      return renderHistory(view, {
        entries: state.entries,
        config: state.config,
        pending: new Set(state.outbox.map(o => o.entryId)),
      });
    default:
      return renderHomeView();
  }
}

/** Background updates never repaint the entry form (it would wipe what's being typed). */
function renderIfSafe() {
  if (route().name !== 'entry') render();
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
window.addEventListener('online', () => { renderIfSafe(); refresh(true); });
window.addEventListener('offline', renderIfSafe);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (updateReady && route().name !== 'entry') return location.reload();
  renderIfSafe(); // the date may have rolled over
  if (sinceLastSync() > 60 * 1000 || state.outbox.length) refresh();
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
