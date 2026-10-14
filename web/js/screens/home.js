// Home: the gamified week (spec §3.1). Renders from a computeHome() payload; no network.
import { esc, ICONS } from '../ui.js';
import { weekRangeLabel } from '../dates.js';

const STATUS_TEXT = { hit: 'hit', 'on-pace': 'on pace', 'at-risk': 'at risk', missed: 'missed', broken: 'broken' };
const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function fillPct(p) {
  if (p.direction === 'min') return 100; // inverse row: full bar, color carries the state
  return p.target > 0 ? Math.min(100, Math.round((p.hits / p.target) * 100)) : 100;
}

function countText(p) {
  if (p.direction === 'min') return p.status === 'hit' ? `${p.hits} ✓` : String(p.hits);
  return `${p.hits}/${p.target}`;
}

function priorityRow(p) {
  return `
    <li class="prow s-${esc(p.status)}" data-key="${esc(p.key)}">
      <div class="prow-top">
        <span class="prow-label">${esc(p.label)}</span>
        <span class="pill">${STATUS_TEXT[p.status] || esc(p.status)}</span>
        <span class="prow-count">${countText(p)}</span>
      </div>
      <div class="bar" role="img" aria-label="${esc(p.label)}: ${countText(p)}, ${STATUS_TEXT[p.status] || ''}">
        <span style="--fill:${fillPct(p)}%"></span>
      </div>
    </li>`;
}

function streakText(n) {
  return n > 0 ? `${n}-day streak` : 'No streak yet';
}

export function renderHome(root, home, { offline = false, demo = false } = {}) {
  const dots = home.adherence.days
    .map((d, i) => {
      const cls = ['dot', d.logged && 'logged', d.date === home.today && 'today'].filter(Boolean).join(' ');
      return `<li class="${cls}" title="${d.date}${d.logged ? ' · logged' : ''}"><i></i>${DOW[i]}</li>`;
    })
    .join('');

  root.innerHTML = `
    <header class="topbar">
      <div>
        <h1 class="section-title">This week</h1>
        <span class="label">${weekRangeLabel(home.weekStart, home.weekEnd)}</span>
      </div>
      <div class="topbar-actions">
        ${demo ? '<span class="pill pill-quiet">demo</span>' : ''}
        ${offline ? '<span class="pill pill-quiet">offline</span>' : ''}
        <a class="icon-btn" href="#settings" aria-label="Settings">${ICONS.gear}</a>
      </div>
    </header>

    <section class="card hero" aria-label="Weekly summary">
      <div class="hero-num num" aria-label="${home.onPaceCount} of ${home.trackedCount} targets on pace">
        <span>${home.onPaceCount}</span><span class="slash">/</span><span>${home.trackedCount}</span>
      </div>
      <div class="label hero-label">targets on pace</div>
      <div class="streak">${streakText(home.streak)}</div>
      <div class="adherence">
        <span class="label">Logged</span>
        <ol class="dots">${dots}</ol>
        <span class="adherence-count">${home.adherence.loggedCount}/7</span>
      </div>
    </section>

    ${home.todayLogged ? '' : `
    <a class="prompt" href="#entry">
      <span>Tonight not logged yet</span><span class="go">Log it →</span>
    </a>`}

    <section class="card card-list" aria-label="Priorities">
      <ul class="plist inner">${home.priorities.map(priorityRow).join('')}</ul>
    </section>`;
}
