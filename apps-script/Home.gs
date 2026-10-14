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

function getEntries_(user) {
  return entriesFor_(user);
}

function getHome_(user) {
  return NickPacing.computeHome(entriesFor_(user), prioritiesFor_(user), todayEt_());
}
