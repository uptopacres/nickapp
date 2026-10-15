/**
 * NickApp pace rule and Home payload (spec §4, §5, §7.2; decisions §13).
 *
 * One source of truth, kept pure (no Apps Script, DOM, or clock access):
 *  - pushed to Apps Script by clasp (global `NickPacing`),
 *  - copied into the PWA at deploy time (classic <script>, global `NickPacing`),
 *  - required by the Node tests in tests/.
 * Dates are 'yyyy-MM-dd' strings already in America/New_York; callers pass `today`.
 */
var NickPacing = (function () {
  const TIMEZONE = 'America/New_York';
  const MS_DAY = 86400000;

  // Noon UTC keeps calendar arithmetic clear of DST and offset edges.
  function addDays(iso, n) {
    return new Date(Date.parse(iso + 'T12:00:00Z') + n * MS_DAY).toISOString().slice(0, 10);
  }
  // Mon 0 .. Sun 6
  function dayIndex(iso) {
    return (new Date(iso + 'T12:00:00Z').getUTCDay() + 6) % 7;
  }
  function weekStartOf(iso) {
    return addDays(iso, -dayIndex(iso));
  }

  // Sheet booleans arrive as true or 'TRUE'; the form may send 'yes'.
  function isTrue(v) {
    return v === true || v === 1 || /^(true|yes)$/i.test(String(v));
  }

  // What counts as a hit-day, per priority key (spec §4 table).
  const HIT_DAY = {
    exercise: e => isTrue(e.exerciseDone),
    read: e => isTrue(e.readDone),
    sadie: e => isTrue(e.sadieDone),
    sarah: e => isTrue(e.sarahDone),
    newexp: e => isTrue(e.newExpDone),
    friends: e => isTrue(e.friendsDone),
    deepwork: e => isTrue(e.deepWorkDone),
    eating: e => e.eating === 'on track',
    sleep: e => e.sleep === '7-8' || e.sleep === '8+', // 7+ hours
    smoke: e => !isTrue(e.smoke), // a logged smoke-free day; unlogged days earn nothing
  };

  function requiredBy(target, paceDays) {
    return Math.ceil(target * paceDays / 7);
  }

  /**
   * Status for one priority: hit | on-pace | at-risk | missed (max), hit | broken (min).
   *  paceDays: days of the week already decided. Today counts only once it is logged,
   *            so an unlogged today is still open (never "missed" while reachable).
   *  closed:   the week is over (WeekStats rollups).
   */
  function paceStatus(p) {
    if (p.direction === 'min') return p.hits > p.target ? 'broken' : 'hit';
    if (p.hits >= p.target) return 'hit';
    const paceDays = p.closed ? 7 : p.paceDays;
    if (p.hits + (7 - paceDays) < p.target) return 'missed';
    return p.hits >= requiredBy(p.target, paceDays) ? 'on-pace' : 'at-risk';
  }

  /**
   * Home payload for the week containing `today`.
   *  entries:    DailyLog rows for one user ({ date, ...fields }), any order, any range.
   *  priorities: [{ key, label, direction, target }] already filtered by the user's modules.
   */
  function computeHome(entries, priorities, today) {
    const byDate = {};
    entries.forEach(e => {
      if (e && e.date && e.date <= today) byDate[e.date] = e;
    });

    const weekStart = weekStartOf(today);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(weekStart, i);
      days.push({ date, logged: !!byDate[date] });
    }
    const weekEntries = days.filter(d => d.logged).map(d => byDate[d.date]);
    const todayLogged = !!byDate[today];

    // Through today if logged, else through yesterday (decision §13.6).
    let streak = 0;
    for (let d = todayLogged ? today : addDays(today, -1); byDate[d]; d = addDays(d, -1)) streak++;

    const paceDays = dayIndex(today) + (todayLogged ? 1 : 0);
    const rows = priorities.map(p => {
      const test = HIT_DAY[p.key];
      const hits = test ? weekEntries.filter(test).length : 0;
      const direction = p.direction === 'min' ? 'min' : 'max';
      return {
        key: p.key,
        label: p.label,
        direction,
        target: p.target,
        hits,
        requiredByToday: direction === 'min' ? 0 : requiredBy(p.target, paceDays),
        daysLeft: 7 - paceDays,
        status: paceStatus({ direction, target: p.target, hits, paceDays }),
      };
    });

    return {
      weekStart,
      weekEnd: addDays(weekStart, 6),
      today,
      timezone: TIMEZONE,
      todayLogged,
      streak,
      adherence: { target: 7, loggedCount: weekEntries.length, days },
      onPaceCount: rows.filter(r => r.status === 'hit' || r.status === 'on-pace').length,
      trackedCount: rows.length,
      priorities: rows,
    };
  }

  /**
   * Final score for one closed week (WeekStats / WeekSummary rows, the Home week strip):
   * targetsHit = priorities that ended the week "hit", out of `tracked`. A week with
   * nothing logged scores 0.
   */
  function weekScore(entries, priorities, weekStart) {
    const weekEnd = addDays(weekStart, 6);
    const byDate = {};
    entries.forEach(e => {
      if (e && e.date >= weekStart && e.date <= weekEnd) byDate[e.date] = e;
    });
    const week = Object.keys(byDate).map(d => byDate[d]);
    const rows = priorities.map(p => {
      const test = HIT_DAY[p.key];
      const hits = test ? week.filter(test).length : 0;
      const direction = p.direction === 'min' ? 'min' : 'max';
      return { key: p.key, label: p.label, direction, target: p.target, hits, status: paceStatus({ direction, target: p.target, hits, closed: true }) };
    });
    return {
      weekStart,
      daysLogged: week.length,
      tracked: rows.length,
      targetsHit: week.length ? rows.filter(r => r.status === 'hit').length : 0,
      priorities: rows,
    };
  }

  return { TIMEZONE, addDays, dayIndex, weekStartOf, isTrue, HIT_DAY, requiredBy, paceStatus, computeHome, weekScore };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = NickPacing;
