/*
 * ImageShack by antquu (github.com/antquu)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// YouTube download service, run on the home VM with yt-dlp and ffmpeg. No dependencies.
//
//   POST /                 start a download (needs "Authorization: Api-Key <key>",
//                          added by middleware.js) -> { status: "job", statusUrl }
//   GET  /jobs/<id>?t=...  progress of a download (polled by the browser)
//   GET  /files/<id>?t=... the finished file, as an attachment
//
// Env: PORT, PUBLIC_URL, API_KEY, ALLOWED_ORIGINS, YTDLP, STATE_DIRECTORY (systemd)
import http from 'node:http';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const PORT = Number(process.env.PORT || 9200);
const PUBLIC_URL = (process.env.PUBLIC_URL || `http://127.0.0.1:${PORT}/`).replace(/\/?$/, '/');
const API_KEY = process.env.API_KEY || '';
const YTDLP = process.env.YTDLP || '/opt/imageshack/bin/yt-dlp';
const DOSSIER = process.env.STATE_DIRECTORY || '/var/lib/imageshack-yt';
const ORIGINES = (process.env.ALLOWED_ORIGINS || 'https://imageshack.vercel.app,http://localhost:3000')
  .split(',').map((o) => o.trim()).filter(Boolean);

const DUREE_MAX = 3600;           // longest video, in seconds
const TELECHARGEMENTS_MAX = 2;    // downloads running at the same time
const GARDER = 30 * 60 * 1000;    // finished files are deleted after 30 minutes
const DELAI_MAX = 15 * 60 * 1000; // a download is stopped after 15 minutes
const QUALITES = ['144', '240', '360', '480', '720', '1080', '1440', '2160', 'max'];

if (!API_KEY) {
  console.error('API_KEY is not set');
  process.exit(1);
}
fs.mkdirSync(DOSSIER, { recursive: true });

const travaux = new Map();

// ---------- yt-dlp ----------
function argumentsYtdlp(qualite, mode, sortie) {
  const h = qualite === 'max' ? '' : `[height<=${qualite}]`;
  const communs = [
    '--no-playlist', '--no-warnings', '--newline', '--no-cache-dir', '--no-mtime',
    '--match-filter', `duration <= ${DUREE_MAX} & !is_live`,
    '--print', 'before_dl:TITRE:%(title)s',
    '--print', 'after_move:FICHIER:%(filepath)s',
    '--no-simulate',
    '-o', path.join(sortie, 'media.%(ext)s'),
  ];
  if (mode === 'audio') return [...communs, '-f', 'ba/b', '-x', '--audio-format', 'mp3', '--audio-quality', '2'];
  if (mode === 'mute') return [...communs, '-f', `bv*${h}[vcodec^=avc1]/bv*${h}`, '--remux-video', 'mp4'];
  return [...communs, '-f', `bv*${h}[vcodec^=avc1]+ba[ext=m4a]/b${h}[ext=mp4]/bv*${h}+ba/b${h}`, '--merge-output-format', 'mp4'];
}

// Error codes understood by youtube.js
function codeErreur(sortie) {
  if (/Private video/i.test(sortie)) return 'error.api.content.video.private';
  if (/confirm your age|age-restricted/i.test(sortie)) return 'error.api.content.video.age';
  if (/not a bot/i.test(sortie)) return 'error.api.youtube.login';
  if (/does not pass filter/i.test(sortie)) return /is_live/.test(sortie) ? 'error.api.content.video.live' : 'error.api.content.too_long';
  if (/live event|is live/i.test(sortie)) return 'error.api.content.video.live';
  if (/not available in your country|geo.?restrict/i.test(sortie)) return 'error.api.content.video.region';
  if (/members-only|requires payment|purchase/i.test(sortie)) return 'error.api.content.paid';
  if (/DRM/i.test(sortie)) return 'error.api.youtube.drm';
  if (/Video unavailable|has been removed|not available/i.test(sortie)) return 'error.api.content.video.unavailable';
  return 'error.api.fetch.fail';
}

const nomPropre = (titre) => titre.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 150) || 'video';

function lancer(travail) {
  const sortie = path.join(DOSSIER, travail.id);
  fs.mkdirSync(sortie, { recursive: true });
  travail.etat = 'download';
  const enfant = spawn(YTDLP, [...argumentsYtdlp(travail.qualite, travail.mode, sortie), travail.url], {
    cwd: sortie,
    env: { ...process.env, HOME: DOSSIER, XDG_CACHE_HOME: path.join(DOSSIER, '.cache') },
  });
  let journal = '';
  let flux = 0;
  const lire = (morceau) => {
    const texte = morceau.toString();
    journal = (journal + texte).slice(-8000);
    for (const ligne of texte.split(/\r?\n/)) {
      const titre = /^TITRE:(.*)$/.exec(ligne);
      if (titre) travail.titre = titre[1];
      const fichier = /^FICHIER:(.*)$/.exec(ligne);
      if (fichier) travail.fichier = fichier[1].trim();
      if (/\[download\] Destination:/.test(ligne)) flux += 1;
      const p = /\[download\]\s+([\d.]+)%/.exec(ligne);
      if (p) {
        // video + audio are two downloads in a row: show them as one bar
        const n = travail.mode === 'auto' ? 2 : 1;
        travail.progres = Math.min(99, Math.round(((Math.max(flux, 1) - 1) * 100 + Number(p[1])) / n));
      }
      if (/\[(Merger|ExtractAudio|VideoRemuxer)\]/.test(ligne)) travail.etat = 'convert';
    }
  };
  enfant.stdout.on('data', lire);
  enfant.stderr.on('data', lire);
  const minuteur = setTimeout(() => enfant.kill('SIGKILL'), DELAI_MAX);
  enfant.on('close', (code) => {
    clearTimeout(minuteur);
    if (code === 0 && travail.fichier && fs.existsSync(travail.fichier) && fs.statSync(travail.fichier).size > 0) {
      const ext = path.extname(travail.fichier);
      const suffixe = travail.mode === 'audio' ? '' : travail.qualite === 'max' ? '' : ` (${travail.qualite}p)`;
      travail.nom = nomPropre(travail.titre || 'video') + suffixe + ext;
      travail.etat = 'done';
      travail.progres = 100;
    } else {
      travail.etat = 'error';
      travail.code = codeErreur(journal);
      console.error(`job ${travail.id} failed (${code}): ${journal.slice(-400).replace(/\s+/g, ' ')}`);
    }
    travail.fini = Date.now();
    demarrerSuivant();
  });
}

function demarrerSuivant() {
  const enCours = [...travaux.values()].filter((t) => t.etat === 'download' || t.etat === 'convert').length;
  for (const t of travaux.values()) {
    if (enCours >= TELECHARGEMENTS_MAX) break;
    if (t.etat === 'queued') return lancer(t);
  }
}

// Old jobs and their files are removed
setInterval(() => {
  const limite = Date.now() - GARDER;
  for (const [id, t] of travaux) {
    if ((t.fini && t.fini < limite) || t.cree < Date.now() - 2 * GARDER) {
      fs.rmSync(path.join(DOSSIER, id), { recursive: true, force: true });
      travaux.delete(id);
    }
  }
}, 60 * 1000).unref();

// ---------- HTTP ----------
function idVideo(lien) {
  let u;
  try { u = new URL(lien); } catch { return null; }
  const hote = u.hostname.replace(/^(www|m|music)\./, '');
  let id = null;
  if (hote === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
  else if (hote === 'youtube.com' || hote === 'youtube-nocookie.com') {
    id = u.searchParams.get('v') || (/^\/(?:shorts|embed|live|v)\/([^/?#]+)/.exec(u.pathname) || [])[1];
  }
  return id && /^[\w-]{11}$/.test(id) ? id : null;
}

const egal = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

function json(res, status, corps, entetes = {}) {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store', ...entetes });
  res.end(JSON.stringify(corps));
}
const erreur = (res, code, status = 200, entetes) => json(res, status, { status: 'error', error: { code } }, entetes);

async function lireCorps(req) {
  let taille = 0;
  const morceaux = [];
  for await (const m of req) {
    taille += m.length;
    if (taille > 10000) throw new Error('too large');
    morceaux.push(m);
  }
  return JSON.parse(Buffer.concat(morceaux).toString() || '{}');
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://local');
  const origine = req.headers.origin || '';
  const cors = ORIGINES.includes(origine)
    ? { 'access-control-allow-origin': origine, 'access-control-allow-methods': 'GET, OPTIONS', vary: 'Origin' }
    : {};

  // Start a download (only through middleware.js, which knows the key)
  if (req.method === 'POST' && url.pathname === '/') {
    const auth = /^Api-Key (.+)$/.exec(req.headers.authorization || '');
    if (!auth || !egal(auth[1], API_KEY)) return erreur(res, 'error.api.auth.key.invalid', 401);
    let corps;
    try { corps = await lireCorps(req); } catch { return erreur(res, 'error.api.invalid_body', 400); }
    const id = idVideo(corps.url || '');
    if (!id) return erreur(res, 'error.api.link.invalid');
    const mode = ['auto', 'audio', 'mute'].includes(corps.downloadMode) ? corps.downloadMode : 'auto';
    const qualite = QUALITES.includes(String(corps.videoQuality)) ? String(corps.videoQuality) : '720';
    const enAttente = [...travaux.values()].filter((t) => t.etat === 'queued').length;
    if (enAttente >= 5) return erreur(res, 'error.api.rate_exceeded');

    const travail = {
      id: crypto.randomUUID(),
      jeton: crypto.randomBytes(18).toString('base64url'),
      url: `https://www.youtube.com/watch?v=${id}`,
      mode,
      qualite,
      etat: 'queued',
      progres: 0,
      cree: Date.now(),
    };
    travaux.set(travail.id, travail);
    demarrerSuivant();
    return json(res, 200, { status: 'job', statusUrl: `${PUBLIC_URL}jobs/${travail.id}?t=${travail.jeton}` });
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(cors['access-control-allow-origin'] ? 204 : 403, cors);
    return res.end();
  }

  const m = /^\/(jobs|files)\/([0-9a-f-]{36})$/.exec(url.pathname);
  const travail = m && travaux.get(m[2]);
  if (!travail || req.method !== 'GET' || !egal(url.searchParams.get('t') || '', travail.jeton)) {
    return erreur(res, 'imageshack.job_not_found', 404, cors);
  }

  if (m[1] === 'jobs') {
    const etat = { state: travail.etat, progress: travail.progres };
    if (travail.etat === 'done') {
      etat.filename = travail.nom;
      etat.url = `${PUBLIC_URL}files/${travail.id}?t=${travail.jeton}`;
    }
    if (travail.etat === 'error') etat.code = travail.code;
    return json(res, 200, etat, cors);
  }

  if (travail.etat !== 'done') return erreur(res, 'imageshack.not_ready', 409, cors);
  const taille = fs.statSync(travail.fichier).size;
  const ascii = travail.nom.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, "'");
  res.writeHead(200, {
    'content-type': travail.mode === 'audio' ? 'audio/mpeg' : 'video/mp4',
    'content-length': taille,
    'content-disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(travail.nom)}`,
    'cache-control': 'no-store',
    ...cors,
  });
  fs.createReadStream(travail.fichier).pipe(res);
}).listen(PORT, '127.0.0.1', () => {
  console.log(`YouTube service on http://127.0.0.1:${PORT}/ (public ${PUBLIC_URL})`);
});
