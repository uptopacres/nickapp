// Data-service client. text/plain body keeps the POST "simple" (no CORS preflight).
import { API_URL } from './config.js';

let token = null;

export function setToken(t) {
  token = t;
}

/** Calls an action; resolves to `data`, rejects with Error(code) on any failure. */
export async function call(action, args = {}, { timeoutMs = 30000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, token, ...args }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error('http-' + res.status);
    let body;
    try {
      body = await res.json();
    } catch {
      throw new Error('bad-response'); // e.g. Google's HTML sign-in/consent page
    }
    if (!body.ok) throw new Error(body.error || 'server-error');
    return body.data;
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('timeout');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
