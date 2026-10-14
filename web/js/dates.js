// Calendar dates are 'yyyy-MM-dd' strings in America/New_York (spec §5).
const fmt = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function todayEt(now = new Date()) {
  const p = Object.fromEntries(fmt.formatToParts(now).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Oct 12 – 18" or "Sep 29 – Oct 5". */
export function weekRangeLabel(start, end) {
  const [, sm, sd] = start.split('-').map(Number);
  const [, em, ed] = end.split('-').map(Number);
  return sm === em
    ? `${MONTHS[sm - 1]} ${sd} – ${ed}`
    : `${MONTHS[sm - 1]} ${sd} – ${MONTHS[em - 1]} ${ed}`;
}
