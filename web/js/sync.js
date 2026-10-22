// Outbox (spec §9). Save writes the phone first; flush() uploads when there's signal.
// Upsert-by-entryId on the server makes every retry safe.
import * as api from './api.js';
import * as db from './db.js';
import { blobToBase64 } from './photo.js';

const MAX_BACKOFF_MS = 10 * 60 * 1000;
let running = null;

/**
 * Queues a day and writes it to the local entries cache.
 *  photo: Blob = new photo, null = no photo (removed), undefined = keep any photo
 *         still waiting from an earlier save of the same day.
 */
export async function enqueue(entry, photo) {
  const prev = await db.get('outbox', entry.entryId);
  await db.put('outbox', {
    entryId: entry.entryId,
    entry,
    photo: photo === undefined ? prev?.photo || null : photo,
    queuedAt: Date.now(),
    attempts: 0,
    nextAttemptAt: 0,
    lastError: null,
  });
  await db.put('entries', entry);
}

/** Drops a day that never left the phone. False when it already uploaded (nothing dropped). */
export async function discard(entryId) {
  if (!(await db.get('outbox', entryId))) return false;
  await db.del('outbox', entryId);
  await db.del('entries', entryId);
  return true;
}

/**
 * Uploads due outbox items oldest first; stops at the first failure. One run at a time.
 * force: ignore backoff (the connection just came back, or the user asked).
 */
export function flush(force = false) {
  running ||= run(force).finally(() => (running = null));
  return running;
}

async function payload(item) {
  const { lifts = [], photoThumb, ...entry } = item.entry;
  return {
    entry,
    lifts,
    photo: item.photo ? { base64: await blobToBase64(item.photo), mimeType: item.photo.type || 'image/jpeg' } : null,
  };
}

// The item may have been re-saved while it was uploading; only touch the version we sent.
async function stillCurrent(item) {
  const current = await db.get('outbox', item.entryId);
  return current && current.queuedAt === item.queuedAt ? current : null;
}

async function run(force) {
  const items = (await db.getAll('outbox')).sort((a, b) => a.queuedAt - b.queuedAt);
  let sent = 0;
  let lastError = null;

  for (const item of items) {
    if (!navigator.onLine) break;
    if (!force && item.nextAttemptAt > Date.now()) continue;
    try {
      const { entry: saved } = await api.call('saveEntry', await payload(item), { timeoutMs: 90000 });
      if (await stillCurrent(item)) {
        await db.del('outbox', item.entryId);
        await db.put('entries', { ...saved, photoThumb: item.entry.photoThumb || '' });
      }
      sent++;
    } catch (err) {
      lastError = err.message || String(err);
      const current = await stillCurrent(item);
      if (current) {
        const attempts = current.attempts + 1;
        await db.put('outbox', {
          ...current,
          attempts,
          lastError,
          nextAttemptAt: Date.now() + Math.min(MAX_BACKOFF_MS, 5000 * 2 ** attempts),
        });
      }
      break;
    }
  }
  return { sent, lastError };
}
