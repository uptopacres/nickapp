// Local preview of web/ exactly as Pages serves it (copies the shared pace rule in first).
// Run: node tools/serve.js [port]   then open http://localhost:8080/?demo
const fs = require('fs');
const http = require('http');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'web');
const PORT = Number(process.argv[2]) || 8080;
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json',
};

fs.copyFileSync(path.join(__dirname, '..', 'apps-script', 'Pacing.js'), path.join(ROOT, 'js', 'pacing.js'));

http.createServer((req, res) => {
  let file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!file.startsWith(ROOT)) return res.writeHead(403).end();
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  fs.readFile(file, (err, body) => {
    if (err) return res.writeHead(404).end('not found');
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  });
}).listen(PORT, () => console.log(`serving web/ on http://localhost:${PORT}/?demo`));
