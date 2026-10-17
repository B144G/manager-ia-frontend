'use strict';
// Petit serveur local pour essayer le site (aucune dépendance). Lancez : npm start  ->  http://localhost:5173
const http = require('http');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
let port = 5173;
try { const m = /^\s*PORT\s*=\s*(\d+)/m.exec(fs.readFileSync(path.join(root, '.env'), 'utf8')); if (m) port = Number(m[1]); } catch { /* défaut */ }
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon' };
http.createServer((req, res) => {
  let p = decodeURIComponent((req.url || '/').split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.normalize(path.join(root, p));
  if (!file.startsWith(root + path.sep) || /(^|[\\/])(\.|scripts[\\/]|node_modules[\\/])/.test(path.relative(root, file))) { res.writeHead(404); return res.end('Introuvable'); } // jamais .env ni scripts
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Page introuvable'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}).listen(port, () => console.log(`Site MANAGER-IA : http://localhost:${port}  (serveur attendu sur ${(/^\s*API_BASE\s*=\s*(.*)$/m.exec((() => { try { return fs.readFileSync(path.join(root, '.env'), 'utf8'); } catch { return ''; } })()) || [])[1] || 'non défini'})`));
