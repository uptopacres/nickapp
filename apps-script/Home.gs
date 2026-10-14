/**
 * Home payload (spec §7.2): current week computed live from DailyLog, never from WeekStats.
 * getEntries feeds the field app's local cache, which runs the same NickPacing rule offline.
 */

function todayEt_() {
  return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
}

function entriesFor_(user) {
  return readTable_('DailyLog').rows
    .filter(r => r.userId === user.userId)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

/** Every DailyLog row for the user, each with its LiftLog children as `lifts`. */
function getEntries_(user) {
  const lifts = {};
  readTable_('LiftLog').rows
    .filter(r => r.userId === user.userId)
    .sort((a, b) => Number(a.seq) - Number(b.seq))
    .forEach(r => {
      (lifts[r.entryId] = lifts[r.entryId] || []).push({
        seq: r.seq, exercise: r.exercise, exerciseOther: r.exerciseOther,
        weight: r.weight, reps: r.reps, sets: r.sets,
      });
    });
  return entriesFor_(user).map(e => Object.assign(e, { lifts: lifts[e.entryId] || [] }));
}

function getHome_(user) {
  return NickPacing.computeHome(entriesFor_(user), prioritiesFor_(user), todayEt_());
}
