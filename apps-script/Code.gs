/**
 * NickApp data service. One doPost, routed by `action`.
 * Body arrives as text/plain JSON to avoid a CORS preflight from GitHub Pages.
 */

function doPost(e) {
  let req;
  try {
    req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ ok: false, error: 'bad-json' });
  }

  switch (req.action) {
    case 'ping':
      return json_({ ok: true, action: 'ping', serverTime: new Date().toISOString() });
    default:
      return json_({ ok: false, error: 'unknown-action', action: req.action || null });
  }
}

function doGet() {
  return json_({ ok: true, service: 'nickapp', serverTime: new Date().toISOString() });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
