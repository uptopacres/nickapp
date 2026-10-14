/**
 * Per-user identity from the URL token (spec §2). A bearer secret for stamping who
 * logged what; never used to gate analytics.
 */

function userFromToken_(token) {
  if (!token || String(token).length < 32) throw new Error('bad-token');
  const row = readTable_('Users').rows.find(r => r.token === token && NickPacing.isTrue(r.active));
  if (!row) throw new Error('bad-token');
  const modules = String(row.modules || '').split(',').map(s => s.trim()).filter(Boolean);
  return {
    userId: String(row.userId),
    name: String(row.name),
    displayName: String(row.displayName || row.name),
    modules: modules.length ? modules : DEFAULT_MODULES,
  };
}

/** 64 hex chars. */
function newToken_() {
  return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
}
