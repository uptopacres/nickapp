// Run: node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../apps-script/Pacing.js');

const PRIORITIES = [
  { key: 'exercise', label: 'Exercise', direction: 'max', target: 4 },
  { key: 'read', label: 'Read', direction: 'max', target: 5 },
  { key: 'sadie', label: 'Sadie', direction: 'max', target: 6 },
  { key: 'sarah', label: 'Sarah', direction: 'max', target: 1 },
  { key: 'newexp', label: 'New experience', direction: 'max', target: 1 },
  { key: 'friends', label: 'Friends', direction: 'max', target: 2 },
  { key: 'deepwork', label: 'Deep work', direction: 'max', target: 3 },
  { key: 'eating', label: 'Eating', direction: 'max', target: 5 },
  { key: 'sleep', label: 'Sleep', direction: 'max', target: 5 },
  { key: 'smoke', label: 'Smoke', direction: 'max', target: 6 },
];
const row = (home, key) => home.priorities.find(p => p.key === key);
// Week of Mon 2026-10-12 .. Sun 2026-10-18.
const day = (date, fields = {}) => ({ date, ...fields });

test('date helpers: Monday weeks, DST-safe', () => {
  assert.equal(P.weekStartOf('2026-10-12'), '2026-10-12'); // Mon
  assert.equal(P.weekStartOf('2026-10-18'), '2026-10-12'); // Sun belongs to prior Mon
  assert.equal(P.weekStartOf('2026-11-01'), '2026-10-26'); // DST ends that Sunday
  assert.equal(P.addDays('2027-03-13', 2), '2027-03-15'); // across DST start
  assert.equal(P.addDays('2026-12-31', 1), '2027-01-01');
});

test('Monday morning, nothing logged: everything on pace, smoke included', () => {
  const h = P.computeHome([], PRIORITIES, '2026-10-12');
  assert.equal(h.todayLogged, false);
  for (const p of h.priorities) {
    assert.equal(p.status, 'on-pace', p.key);
    assert.equal(p.requiredByToday, 0);
    assert.equal(p.daysLeft, 7);
  }
  assert.equal(h.onPaceCount, 10);
  assert.equal(h.trackedCount, 10);
  assert.equal(h.adherence.days.length, 7);
});

test('linear pace: Tuesday logged, exercise 4/wk needs 2 by today', () => {
  const one = [day('2026-10-12', { exerciseDone: true }), day('2026-10-13')];
  // Behind pace (1 < 2) but 3 needed with 5 days open: slack left.
  assert.equal(row(P.computeHome(one, PRIORITIES, '2026-10-13'), 'exercise').status, 'in-reach');
  const two = [day('2026-10-12', { exerciseDone: true }), day('2026-10-13', { exerciseDone: 'TRUE' })];
  const r = row(P.computeHome(two, PRIORITIES, '2026-10-13'), 'exercise');
  assert.equal(r.requiredByToday, 2);
  assert.equal(r.status, 'on-pace');
});

test('unlogged today is judged through yesterday', () => {
  // Tue, today not logged, Mon had exercise: pace through Mon needs ceil(4/7)=1.
  const h = P.computeHome([day('2026-10-12', { exerciseDone: true })], PRIORITIES, '2026-10-13');
  const r = row(h, 'exercise');
  assert.equal(r.requiredByToday, 1);
  assert.equal(r.daysLeft, 6);
  assert.equal(r.status, 'on-pace');
});

test('in reach vs at risk: at risk only when every open day has to count', () => {
  const max = (target, hits, paceDays) => P.paceStatus({ direction: 'max', target, hits, paceDays });
  // Wednesday logged (3 days decided, 4 open)
  assert.equal(max(2, 0, 3), 'in-reach'); // friends: 2 needed, 4 open
  assert.equal(max(1, 0, 3), 'in-reach'); // sarah: 1 needed, 4 open
  assert.equal(max(5, 1, 3), 'at-risk'); // 4 needed, 4 open
  assert.equal(max(5, 0, 3), 'missed'); // 5 needed, 4 open
  assert.equal(max(4, 2, 3), 'on-pace'); // ceil(12/7) = 2
  // Saturday logged (6 decided, 1 open)
  assert.equal(max(1, 0, 6), 'at-risk'); // last chance
});

test('hit as soon as target reached', () => {
  const h = P.computeHome([day('2026-10-12', { sarahDone: true })], PRIORITIES, '2026-10-12');
  assert.equal(row(h, 'sarah').status, 'hit');
});

test('missed only when out of reach', () => {
  // Fri logged, Sadie 3 of 6: 3 + 2 remaining < 6.
  const entries = ['12', '13', '14', '15', '16'].map((d, i) => day(`2026-10-${d}`, { sadieDone: i < 3 }));
  assert.equal(row(P.computeHome(entries, PRIORITIES, '2026-10-16'), 'sadie').status, 'missed');
});

test('Sunday before logging is still reachable', () => {
  const entries = ['12', '13', '14', '15', '16', '17'].map((d, i) => day(`2026-10-${d}`, { sadieDone: i > 0 }));
  const r = row(P.computeHome(entries, PRIORITIES, '2026-10-18'), 'sadie');
  assert.equal(r.status, 'at-risk'); // 5 of 6, behind linear pace but tonight can still hit it
  assert.equal(r.daysLeft, 1);
  // Logged Sunday without Sadie: now out of reach.
  entries.push(day('2026-10-18'));
  assert.equal(row(P.computeHome(entries, PRIORITIES, '2026-10-18'), 'sadie').status, 'missed');
});

test('smoke: credit only for logged smoke-free days, X/6', () => {
  const h = P.computeHome([day('2026-10-12', { smoke: 'TRUE' }), day('2026-10-13', { smoke: false })], PRIORITIES, '2026-10-14');
  const r = row(h, 'smoke');
  assert.equal(r.hits, 1); // Mon smoked, Tue clean, Wed not logged yet
  assert.equal(r.target, 6);
  assert.equal(r.status, 'at-risk'); // needs ceil(6*2/7) = 2 by Tue
});

test('min-direction priorities still work (kept generic)', () => {
  assert.equal(P.paceStatus({ direction: 'min', target: 0, hits: 0 }), 'hit');
  assert.equal(P.paceStatus({ direction: 'min', target: 0, hits: 1 }), 'broken');
});

test('weekScore: closed week totals, zero for an unlogged week', () => {
  const ws = '2026-10-05';
  const full = ['05', '06', '07', '08', '09', '10', '11'].map((d, i) =>
    day(`2026-10-${d}`, { exerciseDone: i < 4, readDone: i < 5, sadieDone: i < 6, sarahDone: i === 0, smoke: i === 6, eating: 'on track', sleep: '7-8' })
  );
  const s = P.weekScore([...full, day('2026-10-12', { readDone: true })], PRIORITIES, ws);
  assert.equal(s.daysLogged, 7);
  assert.equal(s.tracked, 10);
  // hit: exercise 4/4, read 5/5, sadie 6/6, sarah 1/1, eating 7/5, sleep 7/5, smoke 6/6 = 7; missed: newexp, friends, deepwork
  assert.equal(s.targetsHit, 7);
  assert.equal(s.priorities.find(p => p.key === 'smoke').status, 'hit');
  assert.equal(s.priorities.find(p => p.key === 'friends').status, 'missed');
  const empty = P.weekScore(full, PRIORITIES, '2026-09-28');
  assert.equal(empty.daysLogged, 0);
  assert.equal(empty.targetsHit, 0);
});

test('eating: on track and mostly count, off misses; sleep needs 7-8 or 8+', () => {
  const entries = [
    day('2026-10-12', { eating: 'on track', sleep: '7-8' }),
    day('2026-10-13', { eating: 'mostly', sleep: '<7' }),
    day('2026-10-14', { eating: 'off', sleep: '' }),
    day('2026-10-15', { eating: 'on track', sleep: '8+' }),
  ];
  const h = P.computeHome(entries, PRIORITIES, '2026-10-15');
  assert.equal(row(h, 'eating').hits, 3); // on track, mostly, on track (off and blank miss)
  assert.equal(row(h, 'sleep').hits, 2);
});

test('streak through today, or through yesterday when today unlogged; gaps break it', () => {
  const entries = ['09', '10', '11', '12', '13'].map(d => day(`2026-10-${d}`));
  assert.equal(P.computeHome(entries, PRIORITIES, '2026-10-14').streak, 5); // Wed unlogged
  assert.equal(P.computeHome([...entries, day('2026-10-14')], PRIORITIES, '2026-10-14').streak, 6);
  assert.equal(P.computeHome(entries.filter(e => e.date !== '2026-10-11'), PRIORITIES, '2026-10-14').streak, 2);
  assert.equal(P.computeHome(entries, PRIORITIES, '2026-10-15').streak, 0); // Wed missed
});

test('adherence ignores other weeks and future dates', () => {
  const entries = [day('2026-10-11'), day('2026-10-12'), day('2026-10-13'), day('2026-10-16')];
  const h = P.computeHome(entries, PRIORITIES, '2026-10-13');
  assert.equal(h.adherence.loggedCount, 2);
  assert.deepEqual(h.adherence.days.map(d => d.logged), [true, true, false, false, false, false, false]);
  assert.equal(h.weekStart, '2026-10-12');
  assert.equal(h.weekEnd, '2026-10-18');
});

test('closed week: short is missed', () => {
  assert.equal(P.paceStatus({ direction: 'max', target: 4, hits: 3, closed: true }), 'missed');
  assert.equal(P.paceStatus({ direction: 'max', target: 4, hits: 4, closed: true }), 'hit');
});
