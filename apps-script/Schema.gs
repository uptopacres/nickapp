/** Sheet tabs and their headers (spec §6). Columns are always resolved by header name. */

// Literal, not NickPacing.TIMEZONE: top-level code can't rely on file load order.
const TZ = 'America/New_York';

const SCHEMA = {
  DailyLog: [
    'entryId', 'date', 'submittedAt', 'userId',
    'sleepHours', 'rested', 'eating', 'smoke',
    'exerciseDone', 'exerciseType', 'exerciseOther', 'exerciseDuration', 'exerciseFelt',
    'readDone', 'readMinutes', 'readTitle',
    'sadieDone', 'sadieActivities', 'sadieOther', 'sadieMinutes',
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
