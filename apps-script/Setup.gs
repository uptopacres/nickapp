/**
 * One-time (and safe to re-run) setup for a NickApp Sheet. Run `setup` from the script
 * editor; the first run asks for permissions. Creates missing tabs and headers (never
 * reorders or deletes columns), seeds empty lookup tabs, creates the user, and creates
 * the Drive photo folder. Run `showMyUrl` any time to print the personal install link.
 */

const PAGES_URL = 'https://uptopacres.github.io/nickapp/';

const TARGET_SEED = [
  ['exercise', 'Exercise', 'max', 4],
  ['read', 'Read', 'max', 5],
  ['sadie', 'Sadie', 'max', 6],
  ['sarah', 'Sarah', 'max', 1],
  ['newexp', 'New experience', 'max', 1],
  ['friends', 'Friends', 'max', 2],
  ['deepwork', 'Deep work', 'max', 3],
  ['eating', 'Eating', 'max', 5],
  ['sleep', 'Sleep', 'max', 5],
  ['smoke', 'Smoke', 'max', 6], // logged smoke-free days
].map(([key, label, direction, weeklyTarget]) => ({ key, label, direction, weeklyTarget }));

const EXERCISE_SEED = [
  ['Squat', 'legs'],
  ['Bench Press', 'chest'],
  ['Lat Row', 'back'],
  ['Deadlift', 'legs'],
  ['Pulldown', 'back'],
  ['Shoulder Press', 'shoulders'],
].map(([name, category]) => ({ name, category, active: true }));

const READING_SEED = [
  ['Slow Productivity', 'Cal Newport'],
  ['Mindset', 'Carol S. Dweck'],
  ['Will', 'Will Smith'],
].map(([title, author]) => ({ title, author, status: 'in-progress' }));

function setup() {
  const ss = SpreadsheetApp.getActive();
  ss.setSpreadsheetTimeZone(TZ);

  Object.keys(SCHEMA).forEach(name => ensureTab_(ss, name, SCHEMA[name]));
  removeBlankDefaultTab_(ss);

  const today = todayEt_();
  seedIfEmpty_('Targets', TARGET_SEED);
  seedIfEmpty_('CommonExercises', EXERCISE_SEED);
  seedIfEmpty_('ReadingList', READING_SEED.map(r => Object.assign({ lastTouched: today }, r)));
  seedIfEmpty_('Users', [{
    token: newToken_(),
    userId: 'usr_' + Utilities.getUuid().replace(/-/g, '').slice(0, 6),
    name: 'Nick',
    displayName: 'Nick',
    modules: DEFAULT_MODULES.join(','),
    active: true,
  }]);

  // A fresh Sheet is already at the current schema.
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('SCHEMA_VERSION') && sheet_('DailyLog').getLastRow() <= 1) {
    props.setProperty('SCHEMA_VERSION', String(SCHEMA_VERSION));
  }

  installTriggers_();

  const folder = ensurePhotoFolder_(ss);
  console.log('Photo folder: ' + folder.getUrl());
  showMyUrl();
}

/** Prints the personal install link for the first active user. */
function showMyUrl() {
  const user = readTable_('Users').rows.find(r => NickPacing.isTrue(r.active));
  if (!user) throw new Error('No active user. Run setup first.');
  const isTest = /TEST/.test(SpreadsheetApp.getActive().getName());
  console.log('Install link for ' + user.displayName + ': ' +
    PAGES_URL + '?u=' + user.token + (isTest ? '&env=test' : ''));
}

function ensureTab_(ss, name, headers) {
  const sh = ss.getSheetByName(name) || ss.insertSheet(name);
  const existing = headers_(sh);
  const missing = headers.filter(h => existing.indexOf(h) < 0);
  if (missing.length) {
    sh.getRange(1, existing.length + 1, 1, missing.length).setValues([missing]);
  }
  const all = headers_(sh);
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, all.length).setFontWeight('bold');
  all.forEach((h, i) => {
    if (DATE_COLS[h]) sh.getRange(2, i + 1, sh.getMaxRows() - 1, 1).setNumberFormat('yyyy-mm-dd');
  });
}

function removeBlankDefaultTab_(ss) {
  const sh = ss.getSheetByName('Sheet1');
  if (sh && sh.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(sh);
}

function seedIfEmpty_(name, rows) {
  if (sheet_(name).getLastRow() <= 1) appendRows_(name, rows);
}

/** Drive folder id lives in Script Properties (not a secret, just per-Sheet config). */
function ensurePhotoFolder_(ss) {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('PHOTO_FOLDER_ID');
  if (id) {
    try {
      const existing = DriveApp.getFolderById(id);
      if (!existing.isTrashed()) return existing;
    } catch (err) {
      // Deleted or inaccessible: fall through and recreate.
    }
  }
  const folder = DriveApp.createFolder(ss.getName() + ' Photos');
  props.setProperty('PHOTO_FOLDER_ID', folder.getId());
  return folder;
}
