// Phone-sized screenshot of a URL via headless Edge/Chrome and the DevTools protocol.
// Waits for a selector (the app renders after IndexedDB/network, past the load event),
// and prints console messages and exceptions. Fresh profile each run.
// Run: node tools/shot.js <url> <out.png> [selector] [--offline-reload] [--eval=<file.js>] [--cdp=<file.js>] [--viewport]
//   --eval runs the file in the page (as an async function body) after it renders and
//   prints what it returns; use it to drive a flow (fill the form, save) before the shot.
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const args = process.argv.slice(2);
const flags = args.filter(a => a.startsWith('--'));
const [url, out, selector = '.prow, .notice'] = args.filter(a => !a.startsWith('--'));
const offlineReload = flags.includes('--offline-reload');
const evalFile = flags.find(f => f.startsWith('--eval='))?.slice(7);
const viewportOnly = flags.includes('--viewport'); // capture what is on screen, not the full page
// --cdp=<file.js>: a Node module exporting async ({ send, evaluate, sleep }) => result, for
// protocol-level input (real touch events) that page scripts can't produce.
const cdpFile = flags.find(f => f.startsWith('--cdp='))?.slice(6);
if (!url || !out) {
  console.error('usage: node tools/shot.js <url> <out.png> [selector] [--offline-reload]');
  process.exit(2);
}

const BROWSERS = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];
const browser = BROWSERS.find(p => fs.existsSync(p));
const port = 9300 + Math.floor(Math.random() * 500);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'nickapp-shot-'));
const proc = spawn(browser, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    await sleep(200);
    try {
      target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === 'page');
    } catch {}
  }
  if (!target) throw new Error('browser did not start');

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let seq = 0;
  const pending = new Map();
  ws.onmessage = ({ data }) => {
    const msg = JSON.parse(data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    } else if (msg.method === 'Runtime.consoleAPICalled') {
      console.log(`console.${msg.params.type}:`, msg.params.args.map(a => a.value ?? a.description).join(' '));
    } else if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      console.log('EXCEPTION:', d.exception?.description || d.text);
    }
  };
  const send = (method, params = {}) =>
    new Promise((res, rej) => {
      const id = ++seq;
      pending.set(id, m => (m.error ? rej(new Error(`${method}: ${m.error.message}`)) : res(m.result)));
      ws.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result.value;

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });

  async function load(label) {
    const t0 = Date.now();
    await send('Page.navigate', { url });
    let found = false;
    while (!found && Date.now() - t0 < 30000) {
      await sleep(250);
      found = await evaluate(`!!document.querySelector(${JSON.stringify(selector)})`).catch(() => false);
    }
    console.log(`${label}: ${found ? 'rendered' : 'NOT rendered'} in ${Date.now() - t0} ms; fonts ${await evaluate('document.fonts.status')}`);
  }

  await load('online');
  if (offlineReload) {
    await sleep(1500); // let the service worker finish installing
    await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    await load('offline reload');
  }

  if (evalFile) {
    const body = fs.readFileSync(evalFile, 'utf8');
    const r = await send('Runtime.evaluate', { expression: `(async () => {${body}
})()`, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) console.log('eval EXCEPTION:', r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    else console.log('eval:', JSON.stringify(r.result.value));
  }

  if (cdpFile) {
    const run = require(path.resolve(cdpFile));
    console.log('cdp:', JSON.stringify(await run({ send, evaluate, sleep })));
  }

  await sleep(900); // fonts settle, motion finishes
  const { cssContentSize } = await send('Page.getLayoutMetrics');
  const shot = await send(
    'Page.captureScreenshot',
    viewportOnly
      ? { format: 'png' }
      : {
          format: 'png',
          captureBeyondViewport: true,
          clip: { x: 0, y: 0, width: 390, height: Math.max(844, Math.ceil(cssContentSize.height)), scale: 1 },
        }
  );
  fs.writeFileSync(out, Buffer.from(shot.data, 'base64'));
  console.log('wrote', out);
  ws.close();
}

main()
  .catch(err => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => {
    proc.kill();
    setTimeout(() => fs.rmSync(profile, { recursive: true, force: true }), 1500);
  });
