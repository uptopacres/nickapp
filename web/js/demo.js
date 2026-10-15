// ?demo: a believable week with no network or storage, for design review.
const PRIORITIES = [
  ['exercise', 'Exercise', 'max', 4],
  ['read', 'Read', 'max', 5],
  ['sadie', 'Sadie', 'max', 7],
  ['sarah', 'Sarah', 'max', 1],
  ['newexp', 'New experience', 'max', 1],
  ['friends', 'Friends', 'max', 2],
  ['deepwork', 'Deep work', 'max', 3],
  ['eating', 'Eating', 'max', 5],
  ['sleep', 'Sleep', 'max', 5],
  ['smoke', 'Smoke', 'min', 0],
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

/** Three weeks of entries ending yesterday, with one gap so the streak is finite. */
export function entries(today) {
  const out = [];
  for (let i = 20; i >= 1; i--) {
    if (i === 15) continue;
    const date = NickPacing.addDays(today, -i);
    const k = i % 7;
    out.push({
      entryId: `usr_demo_${date}`,
      date,
      userId: 'usr_demo',
      exerciseDone: k % 2 === 0,
      readDone: k !== 3,
      sadieDone: k !== 5,
      sarahDone: k === 2,
      newExpDone: false,
      friendsDone: k === 4,
      deepWorkDone: k % 3 === 0,
      eating: k % 3 ? 'on track' : 'mostly',
      sleep: k % 2 ? '7-8' : '<7',
      smoke: false,
    });
  }
  return out;
}
