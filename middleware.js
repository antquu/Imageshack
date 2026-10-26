/*
 * ImageShack by antquu (github.com/antquu)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Vercel Routing Middleware.
// - /noelshack/* is forwarded to NoelShack with a plain fetch: a vercel.json rewrite
//   would add an X-Forwarded-Host header, and NoelShack answers 404 to those requests.
// - /youtube/api is relayed to the download service on the home VM with its API key
//   added, so the key never reaches the browser (YT_API_URL and YT_API_KEY env vars).
// - Every page gets the is_pays cookie (e.g. FR, US, CA-QC), which langue.js reads
//   to pick French or English.
import { geolocation, next, rewrite } from '@vercel/functions';

export const config = {
  // Pages, /noelshack/* and /youtube/api: skip proxied files and root assets
  matcher: '/((?!i/|m/|c/|pubs/|[^/]+\\.(?:css|js|svg|png|jpg|ico|txt|xml|json)$).*)',
};

const NOELSHACK = {
  '/noelshack/envoi.json': 'https://www.noelshack.com/envoi.json',
  '/noelshack/telecharger.json': 'https://www.noelshack.com/telecharger.json',
};

async function relaisNoelShack(request, cible) {
  const url = new URL(request.url);
  const entetes = { 'user-agent': 'Mozilla/5.0 (compatible; ImageShack)' };
  const type = request.headers.get('content-type');
  if (type) entetes['content-type'] = type;
  const avecCorps = request.method !== 'GET' && request.method !== 'HEAD';
  const r = await fetch(cible + url.search, {
    method: request.method,
    headers: entetes,
    body: avecCorps ? await request.arrayBuffer() : undefined,
  });
  return new Response(r.body, {
    status: r.status,
    headers: { 'content-type': r.headers.get('content-type') || 'application/json' },
  });
}

function erreurYoutube(code, status) {
  return new Response(JSON.stringify({ status: 'error', error: { code } }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function relaisYoutube(request) {
  const cible = process.env.YT_API_URL;
  const cle = process.env.YT_API_KEY;
  if (!cible || !cle) return erreurYoutube('imageshack.not_configured', 503);
  if (request.method !== 'POST') return erreurYoutube('imageshack.method', 405);

  const entetes = new Headers();
  entetes.set('accept', 'application/json');
  entetes.set('content-type', 'application/json');
  entetes.set('authorization', `Api-Key ${cle}`);
  return rewrite(new URL(cible), { request: { headers: entetes } });
}

export default function middleware(request) {
  const chemin = new URL(request.url).pathname;
  if (NOELSHACK[chemin]) return relaisNoelShack(request, NOELSHACK[chemin]);
  if (chemin === '/youtube/api') return relaisYoutube(request);

  const { country = '', countryRegion = '' } = geolocation(request);
  const pays = country.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
  if (!pays) return next();
  const region = countryRegion.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
  const valeur = region ? `${pays}-${region}` : pays;
  return next({
    headers: { 'set-cookie': `is_pays=${valeur}; Path=/; Max-Age=86400; SameSite=Lax; Secure` },
  });
}
