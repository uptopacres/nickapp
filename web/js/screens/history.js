// History (spec §3.3): days newest first, grouped by week. Tap a day to view or edit it.
import { esc } from '../ui.js';
import { dayLabel, weekRangeLabel } from '../dates.js';

function hitChips(e, priorities) {
  const chips = priorities
    // Smoke-free is the default; only a smoke day earns a chip (below).
    .filter(p => p.key !== 'smoke' && p.direction === 'max' && NickPacing.HIT_DAY[p.key]?.(e))
    .map(p => `<span class="hit-chip">${esc(p.label)}</span>`);
  if (NickPacing.isTrue(e.smoke)) chips.push('<span class="hit-chip hit-chip-smoke">Smoked</span>');
  return chips.join('') || '<span class="label">No priorities hit</span>';
}

export function renderHistory(root, { entries, config, pending }) {
  const days = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  let week = null;
  const cards = days.map(e => {
    const ws = NickPacing.weekStartOf(e.date);
    const head = ws === week ? '' : `<h2 class="label week-head">${weekRangeLabel(ws, NickPacing.addDays(ws, 6))}</h2>`;
    week = ws;
    const rating = e.dayRating === '' || e.dayRating == null ? '' :
      `<span class="day-rating num" aria-label="Day rating ${esc(e.dayRating)} of 5">${esc(e.dayRating)}<span class="of">/5</span></span>`;
    return `${head}
      <a class="day-card" href="#entry/${e.date}">
        <div class="day-main">
          <div class="day-top"><span class="day-date">${dayLabel(e.date)}</span>${rating}</div>
          <div class="hit-chips">${hitChips(e, config.priorities)}</div>
          ${e.note ? `<div class="day-note">${esc(e.note)}</div>` : ''}
          ${pending.has(e.entryId) ? '<div class="label day-pending">Waiting to upload</div>' : ''}
        </div>
        ${e.photoThumb ? `<img class="day-thumb" src="${e.photoThumb}" alt="">` : ''}
      </a>`;
  });

  root.innerHTML = `
    <header class="topbar"><h1 class="section-title">History</h1></header>
    ${cards.length ? cards.join('') : '<div class="notice">No days logged yet. Tap + to log tonight.</div>'}`;
}
