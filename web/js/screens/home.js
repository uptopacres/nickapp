// Home: the gamified week (spec §3.1). Renders from a computeHome() payload; no network.
import { esc, ICONS } from '../ui.js';
import { weekRangeLabel } from '../dates.js';

const STATUS_TEXT = {
  hit: 'hit',
  'on-pace': 'on pace',
  'in-reach': 'in reach',
  'at-risk': 'at risk',
  missed: 'missed',
  broken: 'broken',
};
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

// ---------- Week strip: the last completed weeks behind the hero, same unit ----------

// 0-5 Peachy, 6-8 Chartreuse, 9-10 Clover out of 10, scaled if the tracked count changes.
function band(w) {
  const r = w.tracked ? w.targetsHit / w.tracked : 0;
  return r >= 0.9 ? 'band-high' : r >= 0.6 ? 'band-mid' : 'band-low';
}

const weekLabel = w => weekRangeLabel(w.weekStart, NickPacing.addDays(w.weekStart, 6));

function weekStrip(weeks) {
  if (!weeks?.length) return '';
  const chevs = weeks
    .map((w, i) => `
      <button type="button" class="chev ${band(w)}" data-week="${i}" aria-expanded="false"
        aria-label="Week of ${weekLabel(w)}: ${w.targetsHit} of ${w.tracked} targets hit">${w.targetsHit}</button>`)
    .join('');
  return `
    <section class="weeks" aria-label="Last ${weeks.length} completed ${weeks.length === 1 ? 'week' : 'weeks'}">
      <div class="chevs">${chevs}</div>
      <div class="week-detail"><div class="week-detail-inner"></div></div>
    </section>`;
}

function weekDetail(w) {
  const rows = w.priorities
    .map(p => `<li class="${p.status === 'hit' ? 'is-hit' : ''}"><span>${esc(p.label)}</span><span>${p.hits}/${p.target}</span></li>`)
    .join('');
  return `
    <div class="week-detail-body">
      <div class="week-detail-head">
        <span class="label">Week of ${weekLabel(w)}</span>
        <span class="label">${w.targetsHit}/${w.tracked} hit · logged ${w.daysLogged}/7</span>
      </div>
      <ul class="week-list">${rows}</ul>
    </div>`;
}

/** Tap a chevron to open that week's detail; tap it again (or another) to close/switch. */
function wireStrip(root, weeks) {
  const box = root.querySelector('.weeks');
  if (!box) return;
  const panel = box.querySelector('.week-detail');
  box.querySelector('.chevs').addEventListener('click', e => {
    const btn = e.target.closest('.chev');
    if (!btn) return;
    const wasOpen = btn.getAttribute('aria-expanded') === 'true';
    box.querySelectorAll('.chev').forEach(c => c.setAttribute('aria-expanded', 'false'));
    if (!wasOpen) {
      panel.firstElementChild.innerHTML = weekDetail(weeks[Number(btn.dataset.week)]);
      btn.setAttribute('aria-expanded', 'true');
    }
    box.classList.toggle('has-open', !wasOpen);
    panel.classList.toggle('open', !wasOpen);
  });
}

function streakText(n) {
  return n > 0 ? `${n}-day streak` : 'No streak yet';
}

export function renderHome(root, home, { offline = false, demo = false, pending = 0, from = null, weeks = [] } = {}) {
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

    ${weekStrip(weeks)}

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

  wireStrip(root, weeks);
  playFlips(root, flips);
}
