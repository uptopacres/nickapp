/**
 * saveEntry (spec §8): upsert DailyLog by entryId, replace LiftLog for that entryId,
 * store an attached photo in Drive. Retries are idempotent: same user + date, same row.
 * Request: { entry: {date, ...DailyLog fields}, lifts: [...], photo: {base64, mimeType} | null }
 */

// Fields the client may set. entryId/userId/submittedAt are the server's; photoUrl is
// handled separately because a new photo replaces it. A function, not a top-level
// const: Save.gs loads before Schema.gs.
function clientFields_() {
  return SCHEMA.DailyLog.filter(h => ['entryId', 'date', 'submittedAt', 'userId', 'photoUrl'].indexOf(h) < 0);
}
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

function invalid_(what) {
  return new Error('invalid:' + what);
}

function coerce_(type, v) {
  if (type === 'bool') return NickPacing.isTrue(v);
  if (v === undefined || v === null || v === '') return '';
  if (type === 'number' || type === 'int') {
    const n = Number(v);
    if (!isFinite(n)) return '';
    return type === 'int' ? Math.round(n) : n;
  }
  return String(v).trim().slice(0, 500);
}

function saveEntry_(user, req) {
  const input = req.entry || {};
  const date = String(input.date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw invalid_('date');
  if (date > todayEt_()) throw invalid_('future-date');
  const entryId = user.userId + '_' + date;

  const row = { entryId: entryId, date: date, submittedAt: new Date(), userId: user.userId };
  clientFields_().forEach(h => (row[h] = coerce_(COLUMN_TYPES[h] || 'text', input[h])));

  const isLift = row.exerciseDone && row.exerciseType === 'lift';
  const lifts = (isLift && Array.isArray(req.lifts) ? req.lifts : [])
    .filter(l => l && (l.exercise || l.exerciseOther))
    .map((l, i) => ({
      seq: i + 1,
      exercise: coerce_('text', l.exercise),
      exerciseOther: coerce_('text', l.exerciseOther),
      weight: coerce_('number', l.weight),
      reps: coerce_('int', l.reps),
      sets: coerce_('int', l.sets),
    }));

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const existing = readTable_('DailyLog').rows.find(r => r.entryId === entryId);
    const oldPhotoUrl = existing ? String(existing.photoUrl || '') : '';
    if (req.photo) {
      row.photoUrl = savePhoto_(user, date, req.photo);
      if (oldPhotoUrl) trashDriveFile_(oldPhotoUrl);
    } else {
      row.photoUrl = coerce_('text', input.photoUrl); // '' when the photo was removed
    }

    upsertRow_('DailyLog', 'entryId', row);
    deleteRowsWhere_('LiftLog', 'entryId', entryId);
    appendRows_('LiftLog', lifts.map(l => Object.assign({ entryId: entryId, date: date, userId: user.userId }, l)));
    // Backfill into a closed week: refresh that week's summary now, not tonight.
    const weekStart = NickPacing.weekStartOf(date);
    if (weekStart < NickPacing.weekStartOf(todayEt_())) summarizeWeek_(user, weekStart);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }

  const saved = Object.assign({}, row, { submittedAt: row.submittedAt.toISOString(), lifts: lifts });
  return { entry: saved, home: getHome_(user) };
}

function savePhoto_(user, date, photo) {
  if (!/^image\/(jpeg|png|webp)$/.test(photo.mimeType || '')) throw invalid_('photo-type');
  const bytes = Utilities.base64Decode(String(photo.base64 || ''));
  if (!bytes.length || bytes.length > MAX_PHOTO_BYTES) throw invalid_('photo-size');
  const ext = photo.mimeType.split('/')[1].replace('jpeg', 'jpg');
  const id = PropertiesService.getScriptProperties().getProperty('PHOTO_FOLDER_ID');
  if (!id) throw new Error('photo-folder-missing: run setup');
  const file = DriveApp.getFolderById(id).createFile(
    Utilities.newBlob(bytes, photo.mimeType, date + ' ' + user.userId + '.' + ext)
  );
  return file.getUrl();
}

function trashDriveFile_(url) {
  const m = /\/d\/([\w-]+)/.exec(url) || /[?&]id=([\w-]+)/.exec(url);
  if (!m) return;
  try {
    DriveApp.getFileById(m[1]).setTrashed(true);
  } catch (err) {
    console.warn('could not trash old photo', url, err);
  }
}

/**
 * Emails the owner about an unhandled save failure, at most once an hour per error
 * message, so a retrying outbox can't flood the inbox.
 */
function alertSaveFailure_(err, req) {
  const message = String((err && err.message) || err);
  const key = 'alert:' + Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, message)
  );
  const cache = CacheService.getScriptCache();
  if (cache.get(key)) return;
  cache.put(key, '1', 3600);
  const date = req && req.entry && req.entry.date;
  MailApp.sendEmail(
    ALERT_EMAIL,
    'NickApp save failed' + (date ? ' (' + date + ')' : ''),
    [
      'A saveEntry call failed on "' + SpreadsheetApp.getActive().getName() + '".',
      'The entry is still queued on the phone and will retry.',
      '',
      'Error: ' + message,
      '',
      (err && err.stack) || '',
    ].join('\n')
  );
}
