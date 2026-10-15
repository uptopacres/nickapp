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

// `shown` is what the row paints first: the pre-save state for rows that are about to flip.
function priorityRow(p, shown = p) {
  return `
    <li class="prow s-${esc(shown.status)}" data-key="${esc(p.key)}">
      <div class="prow-top">
        <span class="prow-label">${esc(p.label)}</span>
        <span class="pill">${STATUS_TEXT[shown.status] || esc(shown.status)}</span>
        <span class="prow-count">${countText(shown)}</span>
      </div>
      <div class="bar" role="img" aria-label="${esc(p.label)}: ${countText(p)}, ${STATUS_TEXT[p.status] || ''}">
        <span style="--fill:${fillPct(shown)}%"></span>
      </div>
    </li>`;
}

/**
 * The one orchestrated motion moment (spec §3.1): after a Save, rows whose numbers
 * changed paint their old state, then fill and recolor to the new one.
 */
function playFlips(root, flips) {
  if (!flips.length) return;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    for (const { from, to } of flips) {
      const row = root.querySelector(`.prow[data-key='${CSS.escape(to.key)}']`);
      if (!row) continue;
      row.querySelector('.bar').classList.add('animate');
      row.classList.replace(`s-${from.status}`, `s-${to.status}`);
      row.querySelector('.bar > span').style.setProperty('--fill', `${fillPct(to)}%`);
      row.querySelector('.pill').textContent = STATUS_TEXT[to.status] || to.status;
      row.querySelector('.prow-count').textContent = countText(to);
    }
  }));
}

function streakText(n) {
  return n > 0 ? `${n}-day streak` : 'No streak yet';
}

export function renderHome(root, home, { offline = false, demo = false, pending = 0, from = null } = {}) {
  const before = new Map((from?.priorities || []).map(p => [p.key, p]));
  const flips = home.priorities
    .map(to => ({ from: before.get(to.key), to }))
    .filter(({ from: f, to }) => f && (f.hits !== to.hits || f.status !== to.status));
  const shownFor = p => flips.find(f => f.to.key === p.key)?.from || p;

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
        ${pending ? `<span class="pill pill-quiet">${pending} to upload</span>` : ''}
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

    <section class="card card-list" aria-label="Priorities">
      <ul class="plist inner">${home.priorities.map(p => priorityRow(p, shownFor(p))).join('')}</ul>
    </section>`;

  playFlips(root, flips);
}
