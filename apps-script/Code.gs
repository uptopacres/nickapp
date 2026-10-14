/**
 * NickApp data service. One doPost, routed by `action`.
 * Body arrives as text/plain JSON to avoid a CORS preflight from GitHub Pages.
 * Request:  { action, token, ...args }   (token may also ride on ?u=)
 * Response: { ok: true, data } | { ok: false, error }
 */

const ACTIONS = {
  getConfig: (user) => getConfig_(user),
  getHome: (user) => getHome_(user),
  getEntries: (user) => getEntries_(user),
};

function doPost(e) {
  let req;
  try {
    req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ ok: false, error: 'bad-json' });
  }

  try {
    return json_({ ok: true, data: route_(req, e) });
  } catch (err) {
    console.error(req.action, err && err.stack ? err.stack : err);
    return json_({ ok: false, error: String((err && err.message) || err) });
  }
}

function route_(req, e) {
  if (req.action === 'ping') return { serverTime: new Date().toISOString() };
  const handler = ACTIONS[req.action];
  if (!handler) throw new Error('unknown-action');
  const user = userFromToken_(req.token || (e && e.parameter && e.parameter.u));
  return handler(user, req);
}

function doGet() {
  return json_({ ok: true, data: { service: 'nickapp', serverTime: new Date().toISOString() } });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
