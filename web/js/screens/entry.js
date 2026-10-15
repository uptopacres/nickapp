// The + form (spec §3.2): one scroll. Daily constants, then priority rows (expanded means
// it happened, collapsed means it didn't), then the closer. Sections follow config.modules.
import { esc, cap, ICONS } from '../ui.js';
import { dayLabel } from '../dates.js';
import { resizePhoto } from '../photo.js';

const DONE_FIELDS = ['exerciseDone', 'readDone', 'sadieDone', 'sarahDone', 'newExpDone', 'friendsDone', 'utaDone'];
const NUMERIC_FIELDS = ['readMinutes', 'dayRating'];

function blank(date) {
  return {
    date,
    sleep: '', eating: '', smoke: false,
    exerciseDone: false, exerciseType: '', exerciseOther: '', exerciseDuration: '',
    readDone: false, readMinutes: '', readTitle: '',
    sadieDone: false, sadieMemory: '',
    sarahDone: false, sarahInOut: '', sarahNote: '',
    newExpDone: false, newExpText: '',
    friendsDone: false, friendsMode: '', friendsWho: '', friendsNote: '',
    utaDone: false, utaLevel: '', deepWorkDone: false, deepWorkWhat: '',
    dayRating: '', note: '', photoUrl: '', photoThumb: '',
    lifts: [],
  };
}

function fromEntry(e) {
  const s = blank(e.date);
  for (const k of Object.keys(s)) {
    if (e[k] !== undefined && e[k] !== null) s[k] = e[k];
  }
  for (const k of [...DONE_FIELDS, 'smoke', 'deepWorkDone']) s[k] = NickPacing.isTrue(e[k]);
  for (const k of NUMERIC_FIELDS) s[k] = e[k] === '' || e[k] == null ? '' : String(e[k]);
  s.lifts = (e.lifts || []).map(l => ({
    exercise: l.exercise || '',
    exerciseOther: l.exerciseOther || '',
    weight: l.weight ?? '',
    reps: l.reps ?? '',
    sets: l.sets ?? '',
  }));
  return s;
}

/**
 * ctx: { config, entries, date, today, onSave({ entry, photo }) }
 *   photo passed to onSave: Blob (new), null (removed), undefined (unchanged)
 */
export function renderEntry(root, ctx) {
  const { config, today } = ctx;
  const opts = config.options || {};
  const mods = new Set(config.modules || []);
  const readingList = config.lookups?.readingList || [];
  const exercises = config.lookups?.commonExercises || [];

  let s;
  let existing;
  let photo;
  let form;
  const pickerMode = {};

  // ---------- markup ----------

  const isOn = (field, v, bool) => (bool ? s[field] === (v === 'yes') : String(s[field]) === String(v));

  const seg = (field, values = [], { labels, bool } = {}) => `
    <div class="seg" role="radiogroup" data-seg="${field}"${bool ? ' data-bool' : ''}>
      ${values.map((v, i) => `<button type="button" role="radio" data-value="${esc(v)}" aria-checked="${isOn(field, v, bool)}">${esc(labels ? labels[i] : cap(v))}</button>`).join('')}
    </div>`;

  const chips = (field, values = [], { multi, labels } = {}) => `
    <div class="chips" data-chips="${field}"${multi ? ' data-multi' : ''}>
      ${values.map((v, i) => {
        const on = multi ? s[field].includes(v) : String(s[field]) === v;
        return `<button type="button" data-value="${esc(v)}" aria-pressed="${on}">${esc(labels ? labels[i] : cap(v))}</button>`;
      }).join('')}
    </div>`;

  const text = (field, { placeholder = '', max = 200 } = {}) =>
    `<input class="input" type="text" id="f-${field}" data-field="${field}" value="${esc(s[field])}" placeholder="${esc(placeholder)}" maxlength="${max}" autocomplete="off">`;

  const field = (label, control, { show, forId } = {}) => `
    <div class="field"${show ? ` data-show="${show}"` : ''}>
      ${forId ? `<label class="label" for="${forId}">${label}</label>` : `<span class="label">${label}</span>`}
      ${control}
    </div>`;

  const prio = (mod, done, title, body) => !mods.has(mod) ? '' : `
    <section class="prio${s[done] ? ' open' : ''}" data-prio="${done}">
      <button type="button" class="prio-head" data-act="toggle" data-done="${done}" aria-expanded="${s[done]}">
        <span class="prio-check" aria-hidden="true"></span>
        <span class="prio-title">${title}</span>
        <span class="prio-hint">${s[done] ? 'happened' : 'tap if it happened'}</span>
      </button>
      <div class="prio-body"${s[done] ? '' : ' inert'}><div class="prio-inner"><div class="prio-content">${body}</div></div></div>
    </section>`;

  function markup() {
    return `
      <header class="topbar">
        <div class="topbar-lead">
          <a class="icon-btn" href="#home" aria-label="Back to Home">${ICONS.back}</a>
          <h1 class="section-title" data-title></h1>
        </div>
      </header>
      <div data-notice></div>

      <section class="card form-card">
        ${field('Date', `<input class="input input-date" type="date" id="f-date" data-field="date" max="${today}" value="${s.date}" required>`, { forId: 'f-date' })}
        ${mods.has('sleep') ? field('Sleep (hours)', chips('sleep', opts.sleep || ['<7', '7-8', '8+'])) : ''}
        ${mods.has('eating') ? field('Eating', seg('eating', opts.eating)) : ''}
        ${mods.has('smoke') ? field('Smoke', seg('smoke', ['no', 'yes'], { bool: true, labels: ['No', 'Yes'] })) : ''}
      </section>

      <div class="form-heading">
        <h2 class="section-title section-title-sm">Priorities</h2>
        <span class="label">Tap a row if it happened.</span>
      </div>

      ${prio('exercise', 'exerciseDone', 'Exercise', `
        ${field('Type', chips('exerciseType', opts.exerciseTypes))}
        ${field('Describe it', text('exerciseOther', { placeholder: 'What did you do?' }), { show: 'exerciseType=other', forId: 'f-exerciseOther' })}
        ${field('Duration (min)', chips('exerciseDuration', opts.exerciseDuration))}
        ${field('Lifts', '<div data-lifts></div>', { show: 'exerciseType=lift' })}`)}

      ${prio('read', 'readDone', 'Read', `
        ${field('Minutes', `
          <div class="stepper">
            <button type="button" data-act="step" data-field="readMinutes" data-delta="-5" aria-label="5 fewer minutes">−</button>
            <input class="input" type="number" id="f-readMinutes" inputmode="numeric" min="0" step="5" data-field="readMinutes" value="${esc(s.readMinutes)}">
            <button type="button" data-act="step" data-field="readMinutes" data-delta="5" aria-label="5 more minutes">+</button>
          </div>`, { forId: 'f-readMinutes' })}
        ${field('Title', '<div data-picker="readTitle"></div>')}`)}

      ${prio('sadie', 'sadieDone', 'Sadie', `
        ${field('A memory or event', `<textarea class="input" id="f-sadieMemory" data-field="sadieMemory" rows="3" maxlength="500" placeholder="What happened with Sadie today?">${esc(s.sadieMemory)}</textarea>`, { forId: 'f-sadieMemory' })}`)}

      ${prio('sarah', 'sarahDone', 'Sarah', `
        ${field('In or out', seg('sarahInOut', opts.sarahInOut))}
        ${field('Note (optional)', text('sarahNote'), { forId: 'f-sarahNote' })}`)}

      ${prio('newexp', 'newExpDone', 'New experience', `
        ${field('What was it', text('newExpText'), { forId: 'f-newExpText' })}`)}

      ${prio('friends', 'friendsDone', 'Friends', `
        ${field('How', seg('friendsMode', opts.friendsMode))}
        ${field('Who', text('friendsWho', { max: 120 }), { forId: 'f-friendsWho' })}
        ${field('Note (optional)', text('friendsNote'), { forId: 'f-friendsNote' })}`)}

      ${prio('utawork', 'utaDone', 'UTA work', `
        ${field('Level', seg('utaLevel', opts.utaLevel))}
        ${field('90+ min deep work block', seg('deepWorkDone', ['no', 'yes'], { bool: true, labels: ['No', 'Yes'] }))}
        ${field('What was it', text('deepWorkWhat'), { show: 'deepWorkDone', forId: 'f-deepWorkWhat' })}`)}

      <section class="card form-card closer">
        ${mods.has('dayrating') ? field('Day rating', seg('dayRating', ['1', '2', '3', '4', '5'])) : ''}
        ${field('Note', text('note', { placeholder: 'One line, optional' }), { forId: 'f-note' })}
        ${mods.has('photo') ? field('Photo of the day', '<div data-photo></div>') : ''}
      </section>

      <div data-errors></div>
      <button class="btn" type="submit" data-save>Save</button>
      <input type="file" accept="image/*" data-photo-input hidden>`;
  }

  // ---------- partial renders ----------

  const $ = sel => form.querySelector(sel);

  function updateTitle() {
    $('[data-title]').textContent = existing ? `Edit ${dayLabel(s.date)}` : s.date === today ? 'Log today' : `Log ${dayLabel(s.date)}`;
  }

  function updateVisibility() {
    form.querySelectorAll('[data-show]').forEach(el => {
      const [, f, op, v] = /^(\w+)(?:([=~])(.+))?$/.exec(el.dataset.show);
      const val = s[f];
      el.hidden = !(op === '=' ? String(val) === v : op === '~' ? (val || []).includes(v) : !!val);
    });
  }

  function pickList(items, q, attrs, otherAttrs) {
    const needle = q.trim().toLowerCase();
    const hits = items.filter(it => !needle || `${it.name} ${it.sub}`.toLowerCase().includes(needle)).slice(0, 6);
    return (
      hits.map(it => `<li><button type="button" ${attrs(it)}><span>${esc(it.name)}</span><span class="sub">${esc(it.sub)}</span></button></li>`).join('') +
      `<li><button type="button" ${otherAttrs}><span>Other</span><span class="sub">describe it</span></button></li>`
    );
  }

  const readingItems = () => readingList.map(r => ({ name: r.title, sub: r.author || r.status }));
  const exerciseItems = () => exercises.map(x => ({ name: x.name, sub: x.category }));

  function renderPicker(field) {
    const box = $(`[data-picker="${field}"]`);
    if (!box) return;
    if (pickerMode[field] === 'other') {
      box.innerHTML = `
        <div class="pick-other">
          <input class="input" type="text" data-field="${field}" value="${esc(s[field])}" placeholder="Describe it" maxlength="200" autocomplete="off">
          <button type="button" class="link-btn" data-act="pick-clear" data-field="${field}">Back to list</button>
        </div>`;
    } else if (s[field]) {
      box.innerHTML = `
        <div class="picked">
          <span>${esc(s[field])}</span>
          <button type="button" class="link-btn" data-act="pick-clear" data-field="${field}">Change</button>
        </div>`;
    } else {
      box.innerHTML = `
        <input class="input" type="search" data-search="${field}" placeholder="Search your reading list" autocomplete="off" aria-label="Search your reading list">
        <ul class="pick-list" data-list="${field}"></ul>`;
      renderPickList(field, '');
    }
  }

  function renderPickList(field, q) {
    $(`[data-list="${field}"]`).innerHTML = pickList(
      readingItems(), q,
      it => `data-act="pick" data-field="${field}" data-value="${esc(it.name)}"`,
      `data-act="pick-other" data-field="${field}"`
    );
  }

  function liftRow(l, i) {
    if (!l.exercise) {
      return `
        <div class="lift">
          <div class="lift-head">
            <span class="label">Exercise ${i + 1}</span>
            <button type="button" class="link-btn" data-act="lift-remove" data-index="${i}">Remove</button>
          </div>
          <input class="input" type="search" data-lift-search="${i}" placeholder="Search exercises" autocomplete="off" aria-label="Search exercises">
          <ul class="pick-list" data-lift-list="${i}"></ul>
        </div>`;
    }
    const num = (f, label, mode) => `
      <label><span class="label">${label}</span>
        <input class="input" type="number" inputmode="${mode}" min="0" step="any" data-lift-index="${i}" data-lift-field="${f}" value="${esc(l[f])}">
      </label>`;
    const name = l.exercise === 'Other'
      ? `<input class="input" type="text" data-lift-index="${i}" data-lift-field="exerciseOther" value="${esc(l.exerciseOther)}" placeholder="Describe the exercise" maxlength="120" aria-label="Describe the exercise">`
      : `<span class="lift-name">${esc(l.exercise)}</span>`;
    return `
      <div class="lift">
        <div class="lift-head">${name}
          <button type="button" class="link-btn" data-act="lift-remove" data-index="${i}">Remove</button>
        </div>
        <div class="lift-nums">${num('weight', 'Weight', 'decimal')}${num('reps', 'Reps', 'numeric')}${num('sets', 'Sets', 'numeric')}</div>
      </div>`;
  }

  function renderLifts(focusIndex) {
    const box = $('[data-lifts]');
    if (!box) return;
    box.innerHTML = s.lifts.map(liftRow).join('') + '<button type="button" class="btn btn-quiet" data-act="lift-add">Add exercise</button>';
    s.lifts.forEach((l, i) => !l.exercise && renderLiftList(i, ''));
    if (focusIndex !== undefined) box.querySelector(`[data-lift-search="${focusIndex}"], [data-lift-index="${focusIndex}"]`)?.focus();
  }

  function renderLiftList(i, q) {
    $(`[data-lift-list="${i}"]`).innerHTML = pickList(
      exerciseItems(), q,
      it => `data-act="lift-pick" data-index="${i}" data-value="${esc(it.name)}"`,
      `data-act="lift-pick" data-index="${i}" data-value="Other"`
    );
  }

  function renderPhoto(status) {
    const box = $('[data-photo]');
    if (!box) return;
    const thumb = photo.mode === 'new' ? photo.thumb : s.photoThumb;
    const actions = `
      <button type="button" class="link-btn" data-act="photo-add">Replace</button>
      <button type="button" class="link-btn" data-act="photo-remove">Remove</button>`;
    if (status) {
      box.innerHTML = `<div class="picked"><span>${esc(status)}</span></div>`;
    } else if (thumb) {
      box.innerHTML = `<img class="photo-thumb" src="${thumb}" alt="Photo of the day"><div class="photo-actions">${actions}</div>`;
    } else if (s.photoUrl) {
      box.innerHTML = `
        <div class="picked"><span>Photo saved</span>
          <span><a class="link-btn" href="${esc(s.photoUrl)}" target="_blank" rel="noopener">View</a>${actions}</span>
        </div>`;
    } else {
      box.innerHTML = '<button type="button" class="btn btn-quiet" data-act="photo-add">Add a photo</button>';
    }
  }

  function notice(html, tone = 'notice-ok') {
    $('[data-notice]').innerHTML = html ? `<div class="notice ${tone}">${html}</div>` : '';
  }

  // ---------- state changes ----------

  function setSeg(group, value) {
    const f = group.dataset.seg;
    const bool = group.hasAttribute('data-bool');
    if (bool) s[f] = value === 'yes';
    else s[f] = String(s[f]) === value ? '' : value; // tap again to clear
    group.querySelectorAll('button').forEach(b => b.setAttribute('aria-checked', String(isOn(f, b.dataset.value, bool))));
    changed(f);
  }

  function setChip(box, value) {
    const f = box.dataset.chips;
    if (box.hasAttribute('data-multi')) {
      s[f] = s[f].includes(value) ? s[f].filter(v => v !== value) : [...s[f], value];
      box.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(s[f].includes(b.dataset.value))));
    } else {
      s[f] = s[f] === value ? '' : value;
      box.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(s[f] === b.dataset.value)));
    }
    changed(f);
  }

  function toggle(done) {
    s[done] = !s[done];
    const sec = $(`[data-prio="${done}"]`);
    sec.classList.toggle('open', s[done]);
    sec.querySelector('.prio-head').setAttribute('aria-expanded', String(s[done]));
    sec.querySelector('.prio-hint').textContent = s[done] ? 'happened' : 'tap if it happened';
    sec.querySelector('.prio-body').toggleAttribute('inert', !s[done]);
  }

  function changed(f) {
    updateVisibility();
    $(`input[data-field="${f}"]`)?.classList.remove('invalid');
    if (f === 'exerciseType' && s.exerciseType === 'lift' && !s.lifts.length) {
      s.lifts.push({ exercise: '', exerciseOther: '', weight: '', reps: '', sets: '' });
      renderLifts();
    }
  }

  function onDateChange(date) {
    if (!date || date === s.date) return;
    if (date > today) {
      $('input[data-field="date"]').value = s.date;
      return notice("You can't log a day that hasn't happened yet.", 'notice-warn');
    }
    const saved = ctx.entries.find(e => e.date === date);
    if (saved) {
      load(date);
      return notice(`Loaded your saved entry for ${dayLabel(date)}.`);
    }
    // Backfill: keep what's been filled in, as a new day.
    s.date = date;
    existing = null;
    updateTitle();
    notice('');
  }

  async function onPhotoPicked(file) {
    if (!file) return;
    const save = $('[data-save]');
    save.disabled = true;
    renderPhoto('Preparing photo…');
    try {
      const { blob, thumb } = await resizePhoto(file);
      photo = { mode: 'new', blob, thumb };
      renderPhoto();
    } catch (err) {
      console.warn('photo:', err);
      renderPhoto();
      notice("Couldn't read that photo. Try another.", 'notice-error');
    } finally {
      save.disabled = false;
    }
  }

  // ---------- save ----------

  function validate() {
    const errs = [];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s.date)) errs.push(['date', 'Pick a date.']);
    else if (s.date > today) errs.push(['date', "You can't log a day that hasn't happened yet."]);
    if (s.exerciseDone && s.exerciseType === 'other' && !s.exerciseOther.trim()) errs.push(['exerciseOther', 'Describe the exercise.']);
    if (s.utaDone && s.deepWorkDone && !s.deepWorkWhat.trim()) errs.push(['deepWorkWhat', 'Say what the deep work block was.']);
    return errs;
  }

  function build() {
    const on = (flag, v) => (flag ? v : '');
    const num = v => (v === '' || v == null ? '' : Number(v));
    const userId = config.user.id;
    const deep = s.utaDone && s.deepWorkDone;
    const lifting = s.exerciseDone && s.exerciseType === 'lift';
    const entry = {
      entryId: `${userId}_${s.date}`,
      date: s.date,
      userId,
      sleep: s.sleep,
      eating: s.eating,
      smoke: !!s.smoke,
      exerciseDone: s.exerciseDone,
      exerciseType: on(s.exerciseDone, s.exerciseType),
      exerciseOther: on(s.exerciseDone && s.exerciseType === 'other', s.exerciseOther.trim()),
      exerciseDuration: on(s.exerciseDone, s.exerciseDuration),
      readDone: s.readDone,
      readMinutes: on(s.readDone, num(s.readMinutes)),
      readTitle: on(s.readDone, s.readTitle.trim()),
      sadieDone: s.sadieDone,
      sadieMemory: on(s.sadieDone, s.sadieMemory.trim()),
      sarahDone: s.sarahDone,
      sarahInOut: on(s.sarahDone, s.sarahInOut),
      sarahNote: on(s.sarahDone, s.sarahNote.trim()),
      newExpDone: s.newExpDone,
      newExpText: on(s.newExpDone, s.newExpText.trim()),
      friendsDone: s.friendsDone,
      friendsMode: on(s.friendsDone, s.friendsMode),
      friendsWho: on(s.friendsDone, s.friendsWho.trim()),
      friendsNote: on(s.friendsDone, s.friendsNote.trim()),
      utaDone: s.utaDone,
      utaLevel: on(s.utaDone, s.utaLevel),
      deepWorkDone: deep,
      deepWorkWhat: on(deep, s.deepWorkWhat.trim()),
      dayRating: num(s.dayRating),
      note: s.note.trim(),
      photoUrl: photo.mode === 'removed' ? '' : s.photoUrl,
      photoThumb: photo.mode === 'new' ? photo.thumb : photo.mode === 'removed' ? '' : s.photoThumb,
      lifts: lifting
        ? s.lifts
            .filter(l => l.exercise && (l.exercise !== 'Other' || l.exerciseOther.trim()))
            .map((l, i) => ({
              seq: i + 1,
              exercise: l.exercise,
              exerciseOther: l.exercise === 'Other' ? l.exerciseOther.trim() : '',
              weight: num(l.weight),
              reps: num(l.reps),
              sets: num(l.sets),
            }))
        : [],
    };
    const photoArg = photo.mode === 'new' ? photo.blob : photo.mode === 'removed' ? null : undefined;
    return { entry, photo: photoArg };
  }

  async function submit(e) {
    e.preventDefault();
    form.querySelectorAll('.invalid').forEach(el => el.classList.remove('invalid'));
    const errs = validate();
    const box = $('[data-errors]');
    if (errs.length) {
      box.innerHTML = `<div class="notice notice-error" role="alert">${errs.map(([, m]) => esc(m)).join('<br>')}</div>`;
      errs.forEach(([f]) => $(`input[data-field="${f}"]`)?.classList.add('invalid'));
      const first = $(`input[data-field="${errs[0][0]}"]`);
      (first || box).scrollIntoView({ behavior: 'smooth', block: 'center' });
      first?.focus({ preventScroll: true });
      return;
    }
    box.innerHTML = '';
    const save = $('[data-save]');
    save.disabled = true;
    save.textContent = 'Saving…';
    try {
      await ctx.onSave(build());
    } catch (err) {
      console.error('save failed', err);
      box.innerHTML = `<div class="notice notice-error" role="alert">Couldn't save on this phone: ${esc(err.message || err)}</div>`;
      save.disabled = false;
      save.textContent = 'Save';
    }
  }

  // ---------- wiring ----------

  function wire() {
    form.addEventListener('submit', submit);

    form.addEventListener('click', e => {
      const btn = e.target.closest('button');
      if (!btn || btn.type === 'submit') return;
      const group = btn.closest('[data-seg]');
      if (group) return setSeg(group, btn.dataset.value);
      const chipBox = btn.closest('[data-chips]');
      if (chipBox) return setChip(chipBox, btn.dataset.value);

      const { act, field: f, index } = btn.dataset;
      const i = Number(index);
      switch (act) {
        case 'toggle':
          return toggle(btn.dataset.done);
        case 'step': {
          const n = Math.max(0, (Number(s[f]) || 0) + Number(btn.dataset.delta));
          s[f] = String(n);
          $(`input[data-field="${f}"]`).value = s[f];
          return;
        }
        case 'pick':
          s[f] = btn.dataset.value;
          pickerMode[f] = 'search';
          return renderPicker(f);
        case 'pick-other':
          s[f] = '';
          pickerMode[f] = 'other';
          renderPicker(f);
          return $(`[data-picker="${f}"] input`)?.focus();
        case 'pick-clear':
          s[f] = '';
          pickerMode[f] = 'search';
          renderPicker(f);
          return $(`[data-search="${f}"]`)?.focus();
        case 'lift-add':
          s.lifts.push({ exercise: '', exerciseOther: '', weight: '', reps: '', sets: '' });
          return renderLifts(s.lifts.length - 1);
        case 'lift-pick':
          s.lifts[i].exercise = btn.dataset.value;
          return renderLifts(i);
        case 'lift-remove':
          s.lifts.splice(i, 1);
          return renderLifts();
        case 'photo-add':
          return $('[data-photo-input]').click();
        case 'photo-remove':
          photo = { mode: 'removed', blob: null };
          s.photoThumb = '';
          s.photoUrl = '';
          return renderPhoto();
      }
    });

    form.addEventListener('input', e => {
      const el = e.target;
      if (el.dataset.field && el.dataset.field !== 'date') {
        s[el.dataset.field] = el.value;
        el.classList.remove('invalid');
      } else if (el.dataset.search) {
        renderPickList(el.dataset.search, el.value);
      } else if (el.dataset.liftSearch !== undefined) {
        renderLiftList(Number(el.dataset.liftSearch), el.value);
      } else if (el.dataset.liftField) {
        s.lifts[Number(el.dataset.liftIndex)][el.dataset.liftField] = el.value;
      }
    });

    form.addEventListener('change', e => {
      if (e.target.dataset.field === 'date') onDateChange(e.target.value);
      else if (e.target.hasAttribute('data-photo-input')) {
        onPhotoPicked(e.target.files?.[0]);
        e.target.value = '';
      }
    });
  }

  function load(date) {
    existing = ctx.entries.find(e => e.date === date) || null;
    s = existing ? fromEntry(existing) : blank(date);
    photo = { mode: 'keep', blob: null };
    pickerMode.readTitle = s.readTitle && !readingList.some(r => r.title === s.readTitle) ? 'other' : 'search';

    form = document.createElement('form');
    form.className = 'entry';
    form.noValidate = true;
    form.innerHTML = markup();
    root.replaceChildren(form);
    wire();
    updateTitle();
    updateVisibility();
    renderPicker('readTitle');
    renderLifts();
    renderPhoto();
  }

  load(ctx.date);
}
