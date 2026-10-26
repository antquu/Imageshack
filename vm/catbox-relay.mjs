/*
 * ImageShack by antquu (github.com/antquu)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Catbox relay, run on the home VM. Catbox refuses uploads coming from Vercel's
// servers, so the browser sends the file here (through Tailscale Funnel) and the
// relay forwards it to catbox.moe from the home connection. No dependencies.
//
// Env: PORT (default 9100), ALLOWED_ORIGINS (comma-separated site origins).
import http from 'node:http';
import { Readable } from 'node:stream';

const PORT = Number(process.env.PORT || 9100);
const CHEMIN = '/catbox-relay';
const CATBOX = 'https://catbox.moe/user/api.php';
const TAILLE_MAX = 210 * 1024 * 1024; // Catbox allows 200 MB, plus multipart overhead
const ORIGINES = (process.env.ALLOWED_ORIGINS || 'https://imageshack.vercel.app,http://localhost:3000')
  .split(',').map((o) => o.trim()).filter(Boolean);

// Basic per-IP limit, so the relay can't be used to flood Catbox
const FENETRE = 60 * 1000;
const MAX_PAR_FENETRE = 30;
const compteurs = new Map();
function tropDeRequetes(ip) {
  const maintenant = Date.now();
  const c = compteurs.get(ip);
  if (!c || maintenant - c.debut > FENETRE) {
    compteurs.set(ip, { debut: maintenant, n: 1 });
    return false;
  }
  c.n += 1;
  return c.n > MAX_PAR_FENETRE;
}
setInterval(() => {
  const limite = Date.now() - FENETRE;
  for (const [ip, c] of compteurs) if (c.debut < limite) compteurs.delete(ip);
}, FENETRE).unref();

function repondre(res, status, texte, entetes = {}) {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', ...entetes });
  res.end(texte);
}

http.createServer(async (req, res) => {
  const origine = req.headers.origin || '';
  const autorisee = ORIGINES.includes(origine);
  const cors = autorisee
    ? {
      'access-control-allow-origin': origine,
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'content-type',
      'access-control-max-age': '86400',
      vary: 'Origin',
    }
    : {};

  if (req.url !== CHEMIN) return repondre(res, 404, 'Not found');
  if (req.method === 'OPTIONS') return repondre(res, autorisee ? 204 : 403, '', cors);
  if (req.method !== 'POST') return repondre(res, 405, 'Method not allowed', cors);
  if (!autorisee) return repondre(res, 403, 'Origin not allowed');

  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  if (tropDeRequetes(ip)) return repondre(res, 429, 'Too many uploads, try again in a minute.', cors);

  const taille = Number(req.headers['content-length'] || 0);
  if (taille > TAILLE_MAX) return repondre(res, 413, 'File too large (200 MB max).', cors);
  const type = req.headers['content-type'] || '';
  if (!type.startsWith('multipart/form-data')) return repondre(res, 400, 'Expected multipart/form-data.', cors);

  try {
    const r = await fetch(CATBOX, {
      method: 'POST',
      headers: {
        'content-type': type,
        ...(taille ? { 'content-length': String(taille) } : {}),
        'user-agent': 'ImageShack relay (github.com/antquu/Imageshack)',
      },
      body: Readable.toWeb(req),
      duplex: 'half',
    });
    repondre(res, r.status, await r.text(), cors);
  } catch (e) {
    repondre(res, 502, 'Relay error: ' + e.message, cors);
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Catbox relay on http://127.0.0.1:${PORT}${CHEMIN} for ${ORIGINES.join(', ')}`);
});
