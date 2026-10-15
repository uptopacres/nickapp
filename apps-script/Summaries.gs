/**
 * Weekly rollups (spec §6, §8). buildSummaries runs nightly from a time trigger and
 * rewrites every closed week; saveEntry refreshes one closed week on backfill; getWeeks
 * fills a missing last week on demand. Scores come from NickPacing.weekScore, the same
 * rule Home uses, so the strip and the hero always agree.
 */

/** Time-trigger entry point (and safe to run by hand from the editor). */
function buildSummaries() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    buildSummaries_();
  } finally {
    lock.releaseLock();
  }
}

/** Caller holds the script lock. */
function buildSummaries_() {
  activeUsers_().forEach(buildForUser_);
}

function lastClosedWeekStart_() {
  return NickPacing.addDays(NickPacing.weekStartOf(todayEt_()), -7);
}

function summaryRows_(user, score) {
  return {
    summary: {
      userId: user.userId,
      weekStart: score.weekStart,
      targetsHit: score.targetsHit,
      tracked: score.tracked,
      daysLogged: score.daysLogged,
      computedAt: new Date(),
    },
    stats: score.priorities.map(p => ({
      userId: user.userId,
      weekStart: score.weekStart,
      priorityKey: p.key,
      hits: p.hits,
      target: p.target,
      rate: p.target > 0 ? Math.round((p.hits / p.target) * 1000) / 1000 : 1,
      status: p.status,
    })),
  };
}

/** Rewrites every closed week from the user's first logged week. Caller holds the lock. */
function buildForUser_(user) {
  const entries = entriesFor_(user);
  const priorities = prioritiesFor_(user);
  const last = lastClosedWeekStart_();
  const summaries = [];
  let stats = [];
  if (entries.length) {
    for (let ws = NickPacing.weekStartOf(entries[0].date); ws <= last; ws = NickPacing.addDays(ws, 7)) {
      const rows = summaryRows_(user, NickPacing.weekScore(entries, priorities, ws));
      summaries.push(rows.summary);
      stats = stats.concat(rows.stats);
    }
  }
  deleteRowsWhere_('WeekSummary', 'userId', user.userId);
  deleteRowsWhere_('WeekStats', 'userId', user.userId);
  appendRows_('WeekSummary', summaries);
  appendRows_('WeekStats', stats);
}

/** Rewrites one closed week. Caller holds the script lock. */
function summarizeWeek_(user, weekStart) {
  const rows = summaryRows_(user, NickPacing.weekScore(entriesFor_(user), prioritiesFor_(user), weekStart));
  const same = r => r.userId === user.userId && r.weekStart === weekStart;
  deleteRows_('WeekSummary', same);
  deleteRows_('WeekStats', same);
  appendRows_('WeekSummary', [rows.summary]);
  appendRows_('WeekStats', rows.stats);
}

/**
 * Last `n` closed weeks for the Home strip, oldest first, each with its per-priority
 * detail. If last week isn't summarized yet (Monday before the nightly run), it is
 * computed now.
 */
function getWeeks_(user, n) {
  n = n || 5;
  const current = NickPacing.weekStartOf(todayEt_());
  const mine = () => readTable_('WeekSummary').rows.filter(r => r.userId === user.userId && r.weekStart < current);
  let summaries = mine();

  const stale = !summaries.some(r => r.weekStart === lastClosedWeekStart_());
  if (stale && entriesFor_(user).some(e => e.date < current)) {
    const lock = LockService.getScriptLock();
    if (lock.tryLock(10000)) {
      try {
        buildForUser_(user);
      } finally {
        lock.releaseLock();
      }
      summaries = mine();
    }
  }

  summaries = summaries.sort((a, b) => b.weekStart.localeCompare(a.weekStart)).slice(0, n).reverse();
  const wanted = {};
  summaries.forEach(s => (wanted[s.weekStart] = true));
  const order = {};
  prioritiesFor_(user).forEach((p, i) => (order[p.key] = { label: p.label, i: i }));
  const rank = key => (order[key] ? order[key].i : 99);
  const stats = readTable_('WeekStats').rows.filter(r => r.userId === user.userId && wanted[r.weekStart]);

  return summaries.map(s => ({
    weekStart: s.weekStart,
    targetsHit: Number(s.targetsHit),
    tracked: Number(s.tracked),
    daysLogged: Number(s.daysLogged),
    priorities: stats
      .filter(r => r.weekStart === s.weekStart)
      .sort((a, b) => rank(a.priorityKey) - rank(b.priorityKey))
      .map(r => ({
        key: r.priorityKey,
        label: order[r.priorityKey] ? order[r.priorityKey].label : r.priorityKey,
        hits: Number(r.hits),
        target: Number(r.target),
        status: r.status,
      })),
  }));
}

/** Nightly rollup at ~3am Eastern. Idempotent. */
function installTriggers_() {
  const has = ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'buildSummaries');
  if (!has) ScriptApp.newTrigger('buildSummaries').timeBased().everyDays(1).atHour(3).inTimezone(TZ).create();
}
