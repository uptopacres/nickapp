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

/** Appends objects as rows, placing each value under its header; unknown keys are dropped. */
function appendRows_(name, objs) {
  if (!objs.length) return;
  const sh = sheet_(name);
  const headers = headers_(sh);
  const rows = objs.map(o => headers.map(h => (o[h] === undefined || o[h] === null ? '' : o[h])));
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
}
