/*
 * ImageShack by antquu (github.com/antquu)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Local development server (not used on Vercel). Serves the static files and
// mirrors the rewrites and clean URLs from vercel.json. No dependencies.
// Simulate a visitor country with: PAYS=US npm run dev
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const { listerPubs } = require('./scripts/pubs.cjs');

// COBALT_API_URL and COBALT_API_KEY can be set in .env.local (same as on Vercel)
try {
  for (const ligne of fs.readFileSync(path.join(__dirname, '.env.local'), 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(ligne);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
} catch { /* no .env.local */ }

const PORT = process.env.PORT || 3000;
const PAYS = (process.env.PAYS || '').toUpperCase().replace(/[^A-Z0-9-]/g, '');
const ROOT = __dirname;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

// Same external rewrites as vercel.json
const PROXYS = [
  [/^\/c\/([a-z0-9]+\.[a-z0-9]+)$/i, 'https://files.catbox.moe/$1'],
  [/^\/catbox\/api\.php$/, 'https://catbox.moe/user/api.php'],
pi.php$//d
  [/^\/noelshack\/(envoi\.json|telecharger\.json)/, 'https://www.noelshack.com/$1'],
  [/^\/i\/(.+)/, 'https://image.noelshack.com/fichiers/$1'],
  [/^\/m\/(.+)/, 'https://image.noelshack.com/minis/$1'],
];

// Upload pages served by index.html
const PAGES_ENVOI = ['/upload-photo', '/upload-gif', '/upload-video', '/upload-screenshot', '/bulk-upload'];

async function proxy(req, res, target) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  try {
    const entetes = {
      'content-type': req.headers['content-type'] || '',
      'user-agent': req.headers['user-agent'] || 'Mozilla/5.0',
    };
    if (req.headers.range) entetes.range = req.headers.range; // needed to seek in videos
    const r = await fetch(target, {
      method: req.method,
      headers: entetes,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(chunks),
    });
    const retour = { 'content-type': r.headers.get('content-type') || 'application/octet-stream' };
    // fetch decompresses the body, so the original length only holds for uncompressed responses
    const enTetesUtiles = r.headers.get('content-encoding') ? ['content-range', 'accept-ranges'] : ['content-length', 'content-range', 'accept-ranges'];
    for (const h of enTetesUtiles) {
      if (r.headers.get(h)) retour[h] = r.headers.get(h);
    }
    res.writeHead(r.status, retour);
    if (!r.body || req.method === 'HEAD') return res.end();
    Readable.fromWeb(r.body).on('error', () => res.destroy()).pipe(res);
  } catch (e) {
    res.writeHead(502, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ erreurs: ['Local proxy: ' + e.message] }));
  }
}

async function relaisCobalt(req, res) {
  const json = (status, corps) => {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(corps));
  };
  const cible = process.env.COBALT_API_URL;
  const cle = process.env.COBALT_API_KEY;
  if (!cible || !cle) return json(503, { status: 'error', error: { code: 'imageshack.not_configured' } });
  if (req.method !== 'POST') return json(405, { status: 'error', error: { code: 'imageshack.method' } });
  const chunks = [];
  for await (const c of req) chunks.push(c);
  try {
    const r = await fetch(cible, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json', authorization: `Api-Key ${cle}` },
      body: Buffer.concat(chunks),
    });
    res.writeHead(r.status, { 'content-type': r.headers.get('content-type') || 'application/json' });
    res.end(Buffer.from(await r.arrayBuffer()));
  } catch {
    json(502, { status: 'error', error: { code: 'imageshack.unreachable' } });
  }
}

function servir(res, file, status = 200) {
  fs.readFile(file, (err, data) => {
    if (err) {
      if (status === 404) { res.writeHead(404); return res.end('404'); }
      return servir(res, path.join(ROOT, '404.html'), 404);
    }
    const entetes = { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' };
    if (PAYS && file.endsWith('.html')) entetes['set-cookie'] = `is_pays=${PAYS}; Path=/; Max-Age=86400; SameSite=Lax`;
    res.writeHead(status, entetes);
    res.end(data);
  });
}

http.createServer((req, res) => {
  const [chemin, query = ''] = req.url.split('?');
  // Same relay as middleware.js: Cobalt with the API key added on the server side
  if (chemin === '/youtube/api') return relaisCobalt(req, res);
  // Ad list built on the fly, so new images in pubs/ show up without a rebuild
  if (chemin === '/pubs/index.json') {
    res.writeHead(200, { 'content-type': TYPES['.json'] });
    return res.end(JSON.stringify(listerPubs()));
  }
  for (const [motif, cible] of PROXYS) {
    if (motif.test(chemin)) return proxy(req, res, chemin.replace(motif, cible) + (query ? '?' + query : ''));
  }

  let p = decodeURIComponent(chemin);
  if (p.startsWith('/v/')) p = '/view';
  if (PAGES_ENVOI.includes(p.replace(/\/+$/, ''))) p = '/index';
  if (p.endsWith('/')) p += 'index';
  if (!path.extname(p)) p += '.html'; // cleanUrls
  const file = path.join(ROOT, path.normalize(p));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  servir(res, file);
}).listen(PORT, () => console.log(`ImageShack running on http://localhost:${PORT}`));
