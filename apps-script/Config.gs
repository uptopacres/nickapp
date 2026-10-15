/** Config payload (spec §7.1): drives modules, pickers, and targets on the field app. */

const DEFAULT_MODULES = [
  'sleep', 'eating', 'smoke', 'exercise', 'read', 'sadie', 'sarah',
  'newexp', 'friends', 'utawork', 'dayrating', 'photo',
];

// A priority shows when its module is on. Deep work lives inside the UTA work module.
const MODULE_FOR_PRIORITY = { deepwork: 'utawork' };

const OPTIONS = {
  sleep: ['<7', '7-8', '8+'],
  exerciseTypes: ['run/walk', 'lift', 'bike', 'golf', 'sport', 'other'],
  exerciseDuration: ['<30', '30-60', '60+'],
  eating: ['on track', 'mostly', 'off'],
  sarahInOut: ['in', 'out'],
  friendsMode: ['in person', 'call'],
  utaLevel: ['full', 'half', 'partial'],
};

const READING_STATUS_RANK = { 'in-progress': 0, queued: 1, done: 2 };

function prioritiesFor_(user) {
  return readTable_('Targets').rows
    .filter(t => user.modules.indexOf(MODULE_FOR_PRIORITY[t.key] || t.key) >= 0)
    .map(t => ({
      key: String(t.key),
      label: String(t.label),
      direction: t.direction === 'min' ? 'min' : 'max',
      target: Number(t.weeklyTarget),
    }));
}

function getConfig_(user) {
  const priorities = prioritiesFor_(user);
  const targets = {};
  priorities.forEach(p => (targets[p.key] = p.target));

  const commonExercises = readTable_('CommonExercises').rows
    .filter(r => NickPacing.isTrue(r.active))
    .map(r => ({ name: String(r.name), category: String(r.category) }));

  // In-progress first, then most recently touched.
  const rank = s => (s in READING_STATUS_RANK ? READING_STATUS_RANK[s] : 3);
  const readingList = readTable_('ReadingList').rows
    .map(r => ({ title: String(r.title), author: String(r.author), status: String(r.status), lastTouched: String(r.lastTouched) }))
    .sort((a, b) => rank(a.status) - rank(b.status) || b.lastTouched.localeCompare(a.lastTouched));

  const config = {
    user: { id: user.userId, displayName: user.displayName },
    modules: user.modules,
    targets,
    priorities,
    options: OPTIONS,
    lookups: { commonExercises, readingList },
  };
  // Content hash: changes only when something the app renders changes.
  config.version = Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(config))
  ).slice(0, 22);
  return config;
}
