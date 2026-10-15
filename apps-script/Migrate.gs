/**
 * Sheet schema migrations, applied automatically on the first request after a deploy,
 * so a field change never needs a manual step. Columns are matched by header name, so
 * a rename is just the header cell. Removed columns are deleted only when empty; any
 * that hold data are left in place (the app ignores them) and logged.
 */

const SCHEMA_VERSION = 4;

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
    if (v < 3) {
      migrateV3_();
      v = 3;
    }
    if (v < 4) {
      // Eating "mostly" now counts as a hit: rescore every closed week.
      buildSummaries_();
      v = 4;
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

/**
 * 2026-10-14 week strip + targets: WeekSummary tab, nightly trigger, first rollup.
 * Smoke becomes "6 logged smoke-free days" (max) and Sadie 6, only where the Targets
 * rows still hold the old defaults (a hand edit in the Sheet wins).
 */
function migrateV3_() {
  ensureTab_(SpreadsheetApp.getActive(), 'WeekSummary', SCHEMA.WeekSummary);
  updateTarget_('smoke', t => t.direction === 'min' && Number(t.weeklyTarget) === 0, { direction: 'max', weeklyTarget: 6 });
  updateTarget_('sadie', t => Number(t.weeklyTarget) === 7, { weeklyTarget: 6 });
  try {
    installTriggers_();
  } catch (err) {
    // getWeeks and saveEntry keep summaries current without it; setup() installs it too.
    console.warn('Could not install the nightly trigger from a web request:', err);
  }
  buildSummaries_();
}

function updateTarget_(key, isOldDefault, changes) {
  const row = readTable_('Targets').rows.find(t => t.key === key);
  if (row && isOldDefault(row)) upsertRow_('Targets', 'key', Object.assign({}, row, changes));
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
