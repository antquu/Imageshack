/*
 * ImageShack by antquu (github.com/antquu)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Vercel Routing Middleware: stores the visitor's country (e.g. FR, US, CA-QC)
// in the is_pays cookie, which langue.js reads to pick French or English.
import { geolocation, next } from '@vercel/functions';

export const config = {
  // Pages only: skip proxied files, uploads and root assets
  matcher: '/((?!i/|m/|c/|catbox/|noelshack/|pubs/|[^/]+\\.(?:css|js|svg|png|jpg|ico|txt|xml|json)$).*)',
};

export default function middleware(request) {
  const { country = '', countryRegion = '' } = geolocation(request);
  const pays = country.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
  if (!pays) return next();
  const region = countryRegion.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
  const valeur = region ? `${pays}-${region}` : pays;
  return next({
    headers: { 'set-cookie': `is_pays=${valeur}; Path=/; Max-Age=86400; SameSite=Lax; Secure` },
  });
}
