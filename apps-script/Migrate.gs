/**
 * Sheet schema migrations, applied automatically on the first request after a deploy,
 * so a field change never needs a manual step. Columns are matched by header name, so
 * a rename is just the header cell. Removed columns are deleted only when empty; any
 * that hold data are left in place (the app ignores them) and logged.
 */

const SCHEMA_VERSION = 2;

function ensureSchema_() {
  const props = PropertiesService.getScriptProperties();
  if (Number(props.getProperty('SCHEMA_VERSION') || 1) >= SCHEMA_VERSION) return;
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    let v = Number(props.getProperty('SCHEMA_VERSION') || 1);
    if (v < 2) {
      migrateV2_();
      v = 2;
    }
    props.setProperty('SCHEMA_VERSION', String(v));
  } finally {
    lock.releaseLock();
  }
}

/** 2026-10-14 form edits: sleep buckets, no rested/felt, Sadie as a write-in memory. */
function migrateV2_() {
  const sh = sheet_('DailyLog');
  const bucket = v => (v === '' || v === null ? '' : Number(v) < 7 ? '<7' : Number(v) < 8 ? '7-8' : '8+');
  renameColumn_(sh, 'sleepHours', 'sleep', bucket);
  renameColumn_(sh, 'sadieOther', 'sadieMemory');
  mapColumn_(sh, 'exerciseType', v => (v === 'run' ? 'run/walk' : v));
  ['rested', 'exerciseFelt', 'sadieActivities', 'sadieMinutes'].forEach(h => dropColumnIfEmpty_(sh, h));
  ensureTab_(SpreadsheetApp.getActive(), 'DailyLog', SCHEMA.DailyLog);
}

function columnRange_(sh, header) {
  const col = headers_(sh).indexOf(header) + 1;
  if (!col) return null;
  return { col, values: sh.getLastRow() > 1 ? sh.getRange(2, col, sh.getLastRow() - 1, 1) : null };
}

/** Rewrites a column's values as text (so "7-8" can't become a date). */
function rewriteColumn_(range, fn) {
  if (!range) return;
  const next = range.getValues().map(([v]) => [fn(v)]);
  range.setNumberFormat('@');
  range.setValues(next);
}

function renameColumn_(sh, from, to, fn) {
  const c = columnRange_(sh, from);
  if (!c || headers_(sh).indexOf(to) >= 0) return;
  sh.getRange(1, c.col).setValue(to);
  if (fn) rewriteColumn_(c.values, fn);
}

function mapColumn_(sh, header, fn) {
  const c = columnRange_(sh, header);
  if (c) rewriteColumn_(c.values, fn);
}

function dropColumnIfEmpty_(sh, header) {
  const c = columnRange_(sh, header);
  if (!c) return;
  if (c.values && c.values.getValues().some(([v]) => v !== '')) {
    console.log('Kept column "' + header + '": it has data. The app no longer uses it.');
    return;
  }
  sh.deleteColumn(c.col);
}
