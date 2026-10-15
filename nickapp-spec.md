# NickApp Build Spec

Personal daily-priorities scorecard. A deliberate rehearsal for OpsApp.
Draft 1, 2026-10-13. Defaults are my calls on open items; override any of them.

---

## 0. What this is

A single-user, installable phone app where Nick logs an end-of-day entry against his
weekly priorities, plus a separate hosted trends page for the heavy read views. The
real purpose is to prove the patterns OpsApp needs: offline-first field input, a
Sheets-backed data service, config-driven modules, per-user identity by URL, and a
gamified weekly view that colors by pace.

Two deliverables:

1. **Field app** (PWA) on GitHub Pages. Inputs, in-the-moment read, the gamified
   week. Installs to the home screen, loads instantly, works offline.
2. **Trends page** (HTML) served by Apps Script, behind Google login. Month heatmap,
   historical charts, rollups. Online only. Reads precomputed tables.

Both talk to one Apps Script data service over one Sheet. Both import one shared
stylesheet so brand never drifts.

---

## 1. Architecture

| Piece | Host | Job |
|---|---|---|
| Field app (PWA) | GitHub Pages | App shell: screens, inputs, offline cache, gamified week |
| Data service | Apps Script (bound to the Sheet) | One POST endpoint, reads/writes tabs, serves payloads |
| Database | Google Sheet | Tabs below are the storage |
| Photos | Google Drive | Resized day photos, link stored in the log |
| Trends page | Apps Script web app | Dashboards behind Google login |
| Shared CSS | GitHub Pages | One `styles.css` both surfaces link |

Field app calls the Apps Script web-app URL. The URL carries a per-user token (see
Identity). Body is sent as `text/plain` to avoid the preflight that breaks a
GitHub-Pages-to-Apps-Script JSON POST. Columns are resolved by header name at read
time so inserts and reorders don't break scripts. Script runs under
farmer@uptopacres.com.

### OpsApp divergences, parked (named so the NickApp model stays forward-compatible)

- OpsApp bottom bar adds **Schedule** (source of "expected" visits) and **clock
  in/out** (a stateful open session, versus NickApp's one-and-done daily Save).
- OpsApp needs real per-user identity for attribution and to gate dashboards.
- OpsApp DailyLog equivalent is pure append-only (many visits per day); NickApp is
  one row per day (below). The keys are chosen so adding `userId` and a per-visit id
  later is additive.

---

## 2. Identity (NickApp now, forward to OpsApp)

Each user installs a personal URL: `.../exec?u=<token>`. The token is a long random
secret (32+ chars), not a name or number, mapped server-side to a user. The backend
reads identity off the URL, stamps every row with `userId`, and serves a per-user
config (which modules to show, targets). No login on the field side.

This is a bearer secret, not authentication. Fine for stamping who logged what. Not
strong enough to gate dashboards, which is why the trends page sits behind Google
login instead. Do not let the URL token creep into protecting analytics.

NickApp is one user (Nick), but the app renders modules and targets from the served
config rather than hardcoding them, so the per-user customization mechanism is proven
here and inherited whole by OpsApp.

---

## 3. Screens

Bottom bar, field app: **Home · History · [ + ] · Trends**. The **+** is a raised
Moss button (highest-frequency action). Settings is a gear in the Home header, not a
tab. Trends is a link that opens the hosted HTML; it degrades to "needs a connection"
when offline rather than a dead page.

### 3.1 Home (gamified week, renders offline from cache)

- **Hero:** big Moss serif number, "X / N targets on pace", where X = count of
  priorities currently `hit` or `on-pace`, N = number of tracked priorities.
- **Streak:** consecutive days with a logged entry, through today.
- **Adherence strip:** seven dots Mon to Sun, filled Clover if that date has an
  entry, faint Cream if not, plus "logged M/7".
- **Priority rows:** one per tracked priority. Each shows a progress-to-target bar,
  the count "hits / target", and a color by pace state (below). The bar fills and
  flips Clover the instant a Save completes a target, on return to Home. One
  orchestrated motion moment; nothing ambient.
- **Prompt:** "Tonight not logged yet" when today has no entry, also a tap into the + form.

```
┌─────────────────────────────┐
│  This week            ⚙      │
│        5 / 10               │  ← hero, Moss serif
│   targets on pace           │
│   12-day streak             │
│  Logged ● ● ○ ○ ○ ○ ○  2/7  │  ← adherence
│  Exercise  ████████░░  3/4  │  ← bar + hits/target, colored by pace
│  Read      ██████████  5/5  │
│  Sadie     ██░░░░░░░░  2/7  │
│  Sarah     ░░░░░░░░░░  0/1  │
│  Friends   ██████████  2/2  │
│  Deep work ███░░░░░░░  1/3  │
│  Smoke     ██████████  0 ✓  │  ← inverse, Clover at zero
├─────────────────────────────┤
│  Home   History  [+]  Trends│
└─────────────────────────────┘
```

### 3.2 Entry (the + form), single scroll, top to bottom

Date at top, prefilled today, editable for backfill.

**Always-on strip (daily constants, no expand):**

- **Sleep:** hours, native number, step 0.5. Rested, 1 to 5 segmented.
- **Eating:** three-way segmented: on track / mostly / off.
- **Smoke:** yes/no toggle.

**Priority rows (collapsed; tap to expand means it happened; blank means it didn't):**

1. **Exercise** → type chips (run, lift, bike, golf, sport, other → describe).
   Duration bucket chips (<30, 30-60, 60+). Felt segmented (easy / solid / hard).
   If type = **lift**: repeater. "Add exercise" → searchable picker from cached
   CommonExercises (fixed list, "Other → describe" one-off, no write-back), then
   weight / reps / sets per row, add many rows.
2. **Read** → minutes stepper. Title: searchable recent picker from ReadingList
   (in-progress and recent first, filter as you type, fixed list, "Other → describe"
   one-off, no write-back).
3. **Sadie** → what, multi-select chips (played, read to her, outing, meal, bedtime)
   + "Other → describe". Rough minutes, bucket chips.
4. **Sarah** → in or out, two-way segmented. Optional one-liner.
5. **New experience** → describe, free text.
6. **Friends** → in person or call, segmented. Who, short text. Optional note.
7. **UTA work** → level three-way segmented (full / half / partial). Then 90+ min deep
   work block yes/no; yes reveals "what was it", required only when yes.

**Closer:**

- **Day rating** 1 to 5 segmented.
- **Note** one short optional line.
- **Photo of the day** optional. Capture/pick, resize to ~1600px on the phone, show
  thumbnail immediately, queue upload so Save never blocks.
- **Save** full-width Moss CTA. Writes to the phone instantly ("Saved"), uploads when
  there's signal.

Lookups (CommonExercises, ReadingList) are admin-managed in the Sheet. The app reads
and caches them. "Other → describe" logs to that day's record but never appends to the
list. This is the OpsApp rule: curated lists, describe an exception, no bloat.

### 3.3 History (field app)

Chronological list of days, each a card with date, day rating, and the priorities hit.
Tap to view or edit a day (re-opens the + form prefilled; saving replaces that day).

### 3.4 Trends (hosted HTML, online, Apps Script, Google login)

Month heatmap (GitHub-contributions grid of logged days, tinted by day rating),
per-priority weekly hit-rate over time, sleep series, lift volume trend. Reads
precomputed WeekStats and a daily series, never the raw log recomputed on open. Pulls
chart libs from CDN; the field app never carries them.

---

## 4. Pacing math (exact rule, one source of truth)

Computed server-side for the Home payload; recomputed in JS from cached entries when
offline using the identical rule. Client maps `status` to color from the stylesheet.

For a **max** target (hit up to N days in the Mon-Sun week):

```
hits         = count of hit-days so far this week
daysElapsed  = days from Monday through today, inclusive (Eastern)
daysLeft     = 7 - daysElapsed
requiredByToday = ceil(N * daysElapsed / 7)        // linear pace

status:
  hit       if hits >= N
  missed    if (hits + daysLeft) < N   OR  (week closed and hits < N)
  on-pace   if hits >= requiredByToday
  at-risk   otherwise (behind pace but still reachable)
```

For the **min** target (smoke, N = 0): `hit` (Clover) when the week's smoke count is
0; any smoke day shows Beet and the target can't be met for the week.

Color map: hit → Clover `#54864C`, on-pace → Chartreuse `#E8EFC5`, at-risk → Peachy
Keen `#FDCCA5`, missed → Tomato `#FD6742`, smoke-broken → Beet `#D14549`.

What counts as a hit-day per priority:

| Priority | Hit-day condition |
|---|---|
| Exercise | exerciseDone = true |
| Read | readDone = true |
| Sadie | sadieDone = true |
| Sarah | sarahDone = true |
| New experience | newExpDone = true |
| Friends | friendsDone = true |
| Deep work | deepWorkDone = true |
| Eating | eating = "on track" (mostly and off don't count) |
| Sleep | sleepHours >= 7 |
| Smoke | smoke = yes (counts against the min target) |

---

## 5. Day and week boundary

- A row's `date` is the day being logged (the form's date field), default = today in
  **America/New_York**. Not `submittedAt`.
- "Today", the week window, streak, and adherence all use `date`.
- Week = **Monday to Sunday, Eastern**. (NJ relocation keeps Eastern, no change.)

---

## 6. Data model (Sheet tabs)

Header-name lookups at read time. Types are how the app reads them, all stored as
Sheet values.

### DailyLog (one row per user-day; upsert keyed on `entryId`)

`entryId` is canonical and stable: `userId + "_" + date` (e.g. `usr_ab12_2026-10-13`).
An edit of the same day re-upserts the same row, so retries are naturally idempotent
and no separate UUID is needed. (OpsApp, with many visits per day, uses a per-visit
UUID instead and appends.)

| Column | Type | Notes |
|---|---|---|
| entryId | text | userId_date, primary key |
| date | date | day logged, Eastern |
| submittedAt | datetime | server receipt time |
| userId | text | from URL token |
| sleepHours | number | step 0.5 |
| rested | int | 1-5 |
| eating | text | on track / mostly / off |
| smoke | bool | yes/no |
| exerciseDone | bool | row expanded |
| exerciseType | text | run/lift/bike/golf/sport/other |
| exerciseOther | text | describe when type = other |
| exerciseDuration | text | <30 / 30-60 / 60+ |
| exerciseFelt | text | easy/solid/hard |
| readDone | bool | |
| readMinutes | int | |
| readTitle | text | from ReadingList or one-off describe |
| sadieDone | bool | |
| sadieActivities | text | pipe-joined chips |
| sadieOther | text | |
| sadieMinutes | text | bucket |
| sarahDone | bool | |
| sarahInOut | text | in/out |
| sarahNote | text | |
| newExpDone | bool | |
| newExpText | text | |
| friendsDone | bool | |
| friendsMode | text | in person / call |
| friendsWho | text | |
| friendsNote | text | |
| utaDone | bool | |
| utaLevel | text | full/half/partial |
| deepWorkDone | bool | |
| deepWorkWhat | text | required when deepWorkDone |
| dayRating | int | 1-5 |
| note | text | |
| photoUrl | text | Drive link |

### LiftLog (append-only child; join on `entryId`)

On save: delete existing LiftLog rows for this `entryId`, then insert the current set.
So editing a day's lifts replaces them cleanly.

| Column | Type |
|---|---|
| entryId | text (join to DailyLog) |
| date | date |
| userId | text |
| seq | int (row order) |
| exercise | text (from CommonExercises or one-off) |
| exerciseOther | text |
| weight | number |
| reps | int |
| sets | int |

### CommonExercises (lookup, admin-managed)

`name`, `category`, `active`.

### ReadingList (lookup, admin-managed)

`title`, `author`, `status` (in-progress / queued / done), `lastTouched` (sort key,
recent first).

### Targets (config)

`key`, `label`, `direction` (max/min), `weeklyTarget`. Per-user override column can be
added for OpsApp.

### Users (identity + per-user config)

`token` (random secret), `userId`, `name`, `displayName`, `modules` (comma list for
config-driven rows), `active`.

### WeekStats (precomputed by a scheduled job)

`userId`, `weekStart`, `priorityKey`, `hits`, `target`, `rate`, `status`. Feeds Trends
and History. Home computes the current week live from the 7 DailyLog rows (cheap) so it
never waits on the rollup.

Current-week Home is live from DailyLog; everything historical and aggregated reads
WeekStats and the daily series. Dashboards never recompute from the raw log.

---

## 7. Data contracts

Client maps `status` to color; color is not sent. Sent as JSON in the POST response.

### 7.1 Config payload (cached, drives modules, lookups, targets)

```json
{
  "user": { "id": "usr_ab12", "displayName": "Nick" },
  "modules": ["sleep","eating","smoke","exercise","read","sadie","sarah",
              "newexp","friends","utawork","dayrating","photo"],
  "targets": { "exercise":4,"read":5,"sadie":7,"sarah":1,"newexp":1,
               "friends":2,"eating":5,"sleep":5,"deepwork":3,"smoke":0 },
  "options": {
    "exerciseTypes": ["run","lift","bike","golf","sport","other"],
    "exerciseDuration": ["<30","30-60","60+"],
    "exerciseFelt": ["easy","solid","hard"],
    "sadieActivities": ["played","read to her","outing","meal","bedtime"],
    "eating": ["on track","mostly","off"],
    "sarahInOut": ["in","out"],
    "friendsMode": ["in person","call"],
    "utaLevel": ["full","half","partial"]
  },
  "lookups": {
    "commonExercises": [{ "name":"Back squat","category":"legs" }],
    "readingList": [{ "title":"", "author":"", "status":"in-progress" }]
  },
  "version": "2026-10-13T20:00:00Z"
}
```

### 7.2 Home payload (this week, rendered offline from cache)

```json
{
  "weekStart": "2026-10-12",
  "weekEnd": "2026-10-18",
  "today": "2026-10-13",
  "timezone": "America/New_York",
  "todayLogged": false,
  "streak": 12,
  "adherence": {
    "target": 7,
    "loggedCount": 2,
    "days": [ { "date":"2026-10-12","logged":true },
              { "date":"2026-10-13","logged":true } ]
  },
  "onPaceCount": 5,
  "trackedCount": 10,
  "priorities": [
    { "key":"exercise","label":"Exercise","direction":"max",
      "target":4,"hits":3,"requiredByToday":1,"daysLeft":5,"status":"on-pace" }
  ]
}
```

### 7.3 Dashboard payload (Trends, online)

```json
{
  "generatedAt": "2026-10-13T20:00:00Z",
  "user": { "id":"usr_ab12","displayName":"Nick" },
  "weeks": [
    { "weekStart":"2026-09-29",
      "adherence":6,
      "priorities": { "exercise":{"hits":4,"target":4,"rate":1.0} } }
  ],
  "heatmap": [ { "date":"2026-09-01","logged":true,"dayRating":4 } ],
  "sleepSeries": [ { "date":"2026-09-01","hours":7.5,"rested":4 } ],
  "lifts": [ { "date":"2026-09-01","exercise":"Back squat",
               "weight":225,"reps":5,"sets":3,"volume":3375 } ]
}
```

---

## 8. Backend endpoint

One `doPost`, action-routed, token in body and URL identifies the user. `text/plain`
body. Actions:

- `ping` → ok.
- `getConfig` → config payload (7.1).
- `getHome` → home payload (7.2), current week live from DailyLog.
- `saveEntry` → upsert DailyLog by entryId; replace LiftLog for entryId; if a photo is
  attached (base64), save to Drive and set photoUrl; return the updated day + fresh
  home payload so Home can repaint with the target-flip.
- `getDashboard` → dashboard payload (7.3), from WeekStats + series. (Served to the
  Trends page, which is separately gated by Google login.)

Scheduled `buildSummaries` (time trigger, nightly plus a light refresh) writes
WeekStats. Error alerting: the save handler emails farmer@ on an unhandled exception so
a failure surfaces before a missed day does.

---

## 9. Sync and offline

IndexedDB stores: `outbox` (pending day submissions incl. resized photo blob),
`entries` (local copy of recent days for History and current-week recompute), `config`
(cached), `home` (last payload).

- Save → write/replace today's row in `entries`, enqueue in `outbox`, show "Saved",
  kick sync. Home repaints from the local recompute immediately (target-flip happens
  offline).
- `sync()` on launch, on reconnect, on interval: POST each outbox item; on success
  remove it; on failure keep and back off. Upsert-by-entryId makes retries safe.
- Config and Home refresh in the background when online and `version` changed. Pickers
  always read the config cache, so no screen waits on the server.
- Photo is resized on the phone before it enters the outbox, so the queued blob is
  small and the upload feels instant.

---

## 10. Shared stylesheet and design language

One `styles.css` on GitHub Pages, linked by the PWA and by the Apps Script dashboards
(stylesheets load cross-origin fine). Single source of brand truth.

Carried from the hiring UI: cream cards on white, hairline cream dividers instead of
drop shadows, 6px radius, ~22px card padding. Serif (Cormorant Garamond; Fraunces as
the hosted stand-in) for headings, section titles in Clover, and big tabular numbers in
Moss. Urbanist for body and UI. Cabin for small labels, sentence case, not all-caps.
999px pills for status. Segmented controls and chips are the primary input vocabulary:
selected = Moss fill / Cream text, unselected = Cream outline. Expand rows reveal on tap
with a height transition; motion only on user action. Full-width CTA, disabled at 0.55.
Inline form messages in the established ok / warn / error colors. One bold move: the big
serif numbers; everything else quiet.

Tokens: Moss `#004D40`, Clover `#54864C`, Cream `#E5EADE`, Chartreuse `#E8EFC5`, Sky
`#9CCBD0`, Tomato `#FD6742`, Beet `#D14549`, Dirt `#333132`, Peachy `#FDCCA5`, white
inner cards, muted `#6b696a`, divider `#D5DCCB`, hover `#F7F9F3`, error bg `#FBECEC` /
text `#7A1F22`.

---

## 11. Dev workflow and setup (a named build step, not overhead)

1. One Git repo. PWA files for GitHub Pages; Apps Script pushed with **clasp** (the
   rehearsal for doing OpsApp this way instead of copy-paste). Every change tracked,
   any version rolled back.
2. Create the Sheet, bind Apps Script via Extensions. Script Properties hold the
   per-user token secret and the Drive folder id. No Sheet id to paste.
3. A test copy of the Sheet and a test deployment so experiments never touch live data.
4. First deploy: GitHub Pages for the PWA and the shared CSS; Apps Script web app for
   the data service and the Trends page.
5. Error-alert email wired on the save handler.

---

## 12. Open items (my defaults shown; override any)

1. **Targets:** exercise 4, read 5, Sadie 7, Sarah 1, new experience 1, friends 2,
   eating 5 on-track days, sleep 5 nights at 7+ hours, deep work 3, smoke 0.
2. **Pacing:** linear pace (`requiredByToday = ceil(N * daysElapsed / 7)`); a row goes
   missed only when mathematically out of reach or the week closes short. Eating counts
   only "on track" days (not "mostly").
3. **Day/week:** entry keyed to the logged `date` (default today), Monday to Sunday,
   America/New_York.
4. **Field model:** one DailyLog row per day (entryId = userId_date, upsert); LiftLog
   children replaced on edit. This is the one place NickApp and OpsApp diverge on
   purpose.
5. **Setup path:** clasp + Git, bound Sheet, test copy and test deploy. Dependency on
   you: seed CommonExercises and ReadingList before first real use.

Flag changes on these five and this is build-ready.

---

## 13. Decisions (2026-10-14, supersede the sections above where they conflict)

1. **Owner account:** nick@uptopacres.com owns the Sheet, script, and Drive folder;
   the script runs as nick@ (not farmer@). Error alerts go to nick@.
2. **Open items §12:** all five defaults accepted as written.
3. **Trends gating:** served from a second deployment (access: only me), separate from
   the anonymous data-service deployment the PWA posts to.
4. **Token location:** the token rides on the Pages URL (`https://uptopacres.github.io/nickapp/?u=<token>`),
   is persisted on first load, and is sent in every request body. Tokens live only in
   the Users tab (no Script Properties copy).
5. **Home rows:** all 10 tracked priorities render on Home (exercise, read, sadie, sarah,
   newexp, friends, eating, sleep, deepwork, smoke).
6. **Streak:** when today is not logged yet, the streak counts through yesterday.
7. **Smoke status:** adds `broken` (Beet `#D14549`) as a status distinct from `missed`.
8. **Seed lookups:** CommonExercises = Squat, Bench Press, Lat Row, Deadlift, Pulldown,
   Shoulder Press. ReadingList = Slow Productivity, Mindset, Will (all in-progress).
9. **Form edits (2026-10-14, after first use):**
   - Home drops the "Tonight not logged yet" prompt; the raised + is the entry point.
   - Sleep is a pill choice `<7` / `7-8` / `8+` stored in `sleep` (replaces `sleepHours`);
     the Rested 1-5 question is removed. Sleep hit-day = `7-8` or `8+` (still 7+ hours).
   - Exercise drops "Felt"; the run type is `run/walk` (shown "Run/Walk").
   - Sadie is a single write-in "memory or event" stored in `sadieMemory` (replaces
     `sadieActivities`, `sadieOther`, `sadieMinutes`).
   - Sheets migrate automatically (`apps-script/Migrate.gs`, schema version 2) on the
     first request after deploy: headers renamed, old sleep hours converted to buckets,
     `run` → `run/walk`, removed columns deleted only if empty.
10. **Targets (2026-10-14):** Smoke is now a normal max target: 6 logged smoke-free days
    a week (X/6); an unlogged day earns no credit. Sadie's target is 6. The `broken`
    status remains for any future min-direction priority.
11. **Home week strip:** the last 5 completed weeks sit above the hero as nested
    chevrons (`clip-path: polygon(0 0, 84% 0, 100% 50%, 84% 100%, 0 100%, 16% 50%)`),
    oldest left, each labelled with that week's targets hit out of tracked (the hero's
    unit). Colors: 0-5 Peachy, 6-8 Chartreuse, 9-10 Clover. Tap for per-priority detail.
    Fewer than 5 weeks of history shows only what exists. A week with nothing logged
    scores 0.
    - New `WeekSummary` tab (`userId, weekStart, targetsHit, tracked, daysLogged,
      computedAt`), alongside per-priority `WeekStats`, both written by `buildSummaries`
      (nightly trigger ~3am ET) and refreshed for a closed week when a backfill save
      lands in it. `getWeeks` serves the last 5 and fills last week on demand if the
      nightly run hasn't happened yet. The phone caches it, so the strip renders offline.
12. **Steppers:** act on touch-down and repeat while held; the installed app disables
    page zoom (`maximum-scale=1, user-scalable=no`, `touch-action: manipulation`).
13. **"In reach" status (2026-10-14):** between on pace and at risk. Behind linear pace
    but with slack (open days > hits still needed) shows **in reach** in the brand
    gray-green `#D5DCCB`; **at risk** (Peachy) now means no slack left, every open day
    has to count. Hero still counts hit + on pace.
14. **Eating:** "on track" and "mostly" both count as a hit day; only "off" misses
    (supersedes §12.2). Closed weeks were rescored (schema v4).
