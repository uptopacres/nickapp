/** Sheet tabs and their headers (spec §6). Columns are always resolved by header name. */

// Literal, not NickPacing.TIMEZONE: top-level code can't rely on file load order.
const TZ = 'America/New_York';

const SCHEMA = {
  DailyLog: [
    'entryId', 'date', 'submittedAt', 'userId',
    'sleep', 'eating', 'smoke',
    'exerciseDone', 'exerciseType', 'exerciseOther', 'exerciseDuration',
    'readDone', 'readMinutes', 'readTitle',
    'sadieDone', 'sadieMemory',
    'sarahDone', 'sarahInOut', 'sarahNote',
    'newExpDone', 'newExpText',
    'friendsDone', 'friendsMode', 'friendsWho', 'friendsNote',
    'utaDone', 'utaLevel', 'deepWorkDone', 'deepWorkWhat',
    'dayRating', 'note', 'photoUrl',
  ],
  LiftLog: ['entryId', 'date', 'userId', 'seq', 'exercise', 'exerciseOther', 'weight', 'reps', 'sets'],
  CommonExercises: ['name', 'category', 'active'],
  ReadingList: ['title', 'author', 'status', 'lastTouched'],
  Targets: ['key', 'label', 'direction', 'weeklyTarget'],
  Users: ['token', 'userId', 'name', 'displayName', 'modules', 'active'],
  WeekStats: ['userId', 'weekStart', 'priorityKey', 'hits', 'target', 'rate', 'status'],
};

// Calendar-date columns: read back as 'yyyy-MM-dd' in Eastern.
const DATE_COLS = { date: true, weekStart: true, lastTouched: true };

// How saveEntry coerces each written column, and the cell format it applies.
// Text cells are formatted '@' so values like "30-60" or "3/4" never become dates.
const COLUMN_TYPES = {
  entryId: 'text', date: 'date', submittedAt: 'datetime', userId: 'text',
  sleep: 'text', eating: 'text', smoke: 'bool',
  exerciseDone: 'bool', exerciseType: 'text', exerciseOther: 'text', exerciseDuration: 'text',
  readDone: 'bool', readMinutes: 'int', readTitle: 'text',
  sadieDone: 'bool', sadieMemory: 'text',
  sarahDone: 'bool', sarahInOut: 'text', sarahNote: 'text',
  newExpDone: 'bool', newExpText: 'text',
  friendsDone: 'bool', friendsMode: 'text', friendsWho: 'text', friendsNote: 'text',
  utaDone: 'bool', utaLevel: 'text', deepWorkDone: 'bool', deepWorkWhat: 'text',
  dayRating: 'int', note: 'text', photoUrl: 'text',
  seq: 'int', exercise: 'text', weight: 'number', reps: 'int', sets: 'int',
};

const CELL_FORMATS = { date: 'yyyy-mm-dd', datetime: 'yyyy-mm-dd hh:mm:ss', text: '@' };

const ALERT_EMAIL = 'nick@uptopacres.com';
