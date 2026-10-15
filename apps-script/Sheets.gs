/** Header-name access to Sheet tabs, so column inserts and reorders never break reads. */

function sheet_(name) {
  const sh = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sh) throw new Error('missing-tab:' + name);
  return sh;
}

function headers_(sh) {
  if (sh.getLastColumn() === 0) return [];
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
}

/** All non-blank rows of a tab as objects keyed by header. */
function readTable_(name) {
  const values = sheet_(name).getDataRange().getValues();
  const headers = values.shift().map(String);
  const rows = values
    .filter(r => r.some(v => v !== ''))
    .map(r => {
      const o = {};
      headers.forEach((h, i) => {
        if (h) o[h] = cellOut_(h, r[i]);
      });
      return o;
    });
  return { headers, rows };
}

function cellOut_(header, v) {
  if (v instanceof Date) {
    return Utilities.formatDate(v, TZ, DATE_COLS[header] ? 'yyyy-MM-dd' : "yyyy-MM-dd'T'HH:mm:ssXXX");
  }
  return v;
}

function cellIn_(v) {
  return v === undefined || v === null ? '' : v;
}

/** Number formats for a row: typed columns get theirs, everything else keeps `current`. */
function rowFormats_(headers, current) {
  return headers.map((h, i) => CELL_FORMATS[COLUMN_TYPES[h]] || current[i]);
}

/** Appends objects as rows, placing each value under its header; unknown keys are dropped. */
function appendRows_(name, objs) {
  if (!objs.length) return;
  const sh = sheet_(name);
  const headers = headers_(sh);
  const range = sh.getRange(sh.getLastRow() + 1, 1, objs.length, headers.length);
  const formats = range.getNumberFormats().map(f => rowFormats_(headers, f));
  range.setNumberFormats(formats);
  range.setValues(objs.map(o => headers.map(h => cellIn_(o[h]))));
}

/**
 * Writes `obj` into the row whose `keyHeader` matches, or appends it. Columns not in
 * `obj` keep their current values, so admin-added columns survive an upsert.
 */
function upsertRow_(name, keyHeader, obj) {
  const sh = sheet_(name);
  const headers = headers_(sh);
  const keyCol = headers.indexOf(keyHeader);
  if (keyCol < 0) throw new Error('missing-column:' + keyHeader);

  const last = sh.getLastRow();
  let rowIdx = -1;
  if (last > 1) {
    const keys = sh.getRange(2, keyCol + 1, last - 1, 1).getValues();
    const i = keys.findIndex(r => String(r[0]) === String(obj[keyHeader]));
    if (i >= 0) rowIdx = i + 2;
  }

  const range = sh.getRange(rowIdx > 0 ? rowIdx : last + 1, 1, 1, headers.length);
  const current = range.getValues()[0];
  range.setNumberFormats([rowFormats_(headers, range.getNumberFormats()[0])]);
  range.setValues([headers.map((h, i) => (h in obj ? cellIn_(obj[h]) : current[i]))]);
}

/** Deletes every row whose `header` equals `value`. */
function deleteRowsWhere_(name, header, value) {
  deleteRows_(name, r => String(r[header]) === String(value));
}

/** Deletes every row for which match(rowObject) is true (bottom-up, in contiguous runs). */
function deleteRows_(name, match) {
  const sh = sheet_(name);
  const last = sh.getLastRow();
  if (last < 2) return;
  const headers = headers_(sh);
  const hit = sh.getRange(2, 1, last - 1, headers.length).getValues().map(r => {
    const o = {};
    headers.forEach((h, i) => (o[h] = cellOut_(h, r[i])));
    return match(o);
  });
  for (let i = hit.length - 1; i >= 0; ) {
    if (!hit[i]) { i--; continue; }
    let start = i;
    while (start > 0 && hit[start - 1]) start--;
    sh.deleteRows(start + 2, i - start + 1);
    i = start - 1;
  }
}
