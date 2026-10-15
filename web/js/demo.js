// ?demo: a believable week with no network or storage, for design review.
const PRIORITIES = [
  ['exercise', 'Exercise', 'max', 4],
  ['read', 'Read', 'max', 5],
  ['sadie', 'Sadie', 'max', 6],
  ['sarah', 'Sarah', 'max', 1],
  ['newexp', 'New experience', 'max', 1],
  ['friends', 'Friends', 'max', 2],
  ['deepwork', 'Deep work', 'max', 3],
  ['eating', 'Eating', 'max', 5],
  ['sleep', 'Sleep', 'max', 5],
  ['smoke', 'Smoke', 'max', 6],
].map(([key, label, direction, target]) => ({ key, label, direction, target }));

export const config = {
  user: { id: 'usr_demo', displayName: 'Nick' },
  modules: ['sleep', 'eating', 'smoke', 'exercise', 'read', 'sadie', 'sarah', 'newexp', 'friends', 'utawork', 'dayrating', 'photo'],
  targets: Object.fromEntries(PRIORITIES.map(p => [p.key, p.target])),
  priorities: PRIORITIES,
  options: {
    sleep: ['<7', '7-8', '8+'],
    exerciseTypes: ['run/walk', 'lift', 'bike', 'golf', 'sport', 'other'],
    exerciseDuration: ['<30', '30-60', '60+'],
    eating: ['on track', 'mostly', 'off'],
    sarahInOut: ['in', 'out'],
    friendsMode: ['in person', 'call'],
    utaLevel: ['full', 'half', 'partial'],
  },
  lookups: {
    commonExercises: ['Squat:legs', 'Bench Press:chest', 'Lat Row:back', 'Deadlift:legs', 'Pulldown:back', 'Shoulder Press:shoulders']
      .map(s => s.split(':')).map(([name, category]) => ({ name, category })),
    readingList: [
      { title: 'Slow Productivity', author: 'Cal Newport', status: 'in-progress' },
      { title: 'Mindset', author: 'Carol S. Dweck', status: 'in-progress' },
      { title: 'Will', author: 'Will Smith', status: 'in-progress' },
    ],
  },
  version: 'demo',
};

/**
 * Six weeks of entries ending yesterday, varied week to week so the strip shows a
 * spread of scores, with one gap so the streak is finite.
 */
export function entries(today) {
  const current = NickPacing.weekStartOf(today);
  const out = [];
  for (let i = 45; i >= 1; i--) {
    if (i === 15) continue;
    const date = NickPacing.addDays(today, -i);
    const k = NickPacing.dayIndex(date); // Mon 0 .. Sun 6
    const back = Math.round((Date.parse(current) - Date.parse(NickPacing.weekStartOf(date))) / 6048e5);
    const strong = back === 1; // last week: a 10/10
    if (back === 4 && k > 3) continue; // a thin week
    out.push({
      entryId: `usr_demo_${date}`,
      date,
      userId: 'usr_demo',
      exerciseDone: strong ? k < 4 : (k + back) % 2 === 0,
      readDone: strong || k !== 3,
      sadieDone: strong || k !== 5,
      sarahDone: k === 2 && back !== 3,
      newExpDone: k === 3 && (strong || back % 2 === 1),
      friendsDone: k === 4 || (strong && k === 6),
      deepWorkDone: k % 3 === 0,
      eating: strong || k % 3 ? 'on track' : 'mostly',
      sleep: strong || k % 2 ? '7-8' : '<7',
      smoke: back === 2 && k === 5,
    });
  }
  return out;
}

/** Same shape as the server's getWeeks: last 5 closed weeks with something logged. */
export function weeks(today, all) {
  const current = NickPacing.weekStartOf(today);
  const out = [];
  for (let back = 5; back >= 1; back--) {
    const score = NickPacing.weekScore(all, PRIORITIES, NickPacing.addDays(current, -7 * back));
    if (score.daysLogged) out.push(score);
  }
  return out;
}
