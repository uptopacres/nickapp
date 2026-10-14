/** Home payload (spec §7.2): current week computed live from DailyLog, never from WeekStats. */

function todayEt_() {
  return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
}

function getHome_(user) {
  const entries = readTable_('DailyLog').rows.filter(r => r.userId === user.userId);
  return NickPacing.computeHome(entries, prioritiesFor_(user), todayEt_());
}
