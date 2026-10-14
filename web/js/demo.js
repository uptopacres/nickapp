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
  options: {},
  lookups: { commonExercises: [], readingList: [] },
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
      sleepHours: k % 2 ? 7.5 : 6.5,
      smoke: false,
    });
  }
  return out;
}
