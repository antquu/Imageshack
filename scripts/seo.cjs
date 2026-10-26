/*
 * ImageShack by antquu (github.com/antquu)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Generates robots.txt and sitemap.xml for the production domain.
// Runs on every Vercel deployment (npm run build). The domain comes from
// SITE_URL, or from VERCEL_PROJECT_PRODUCTION_URL when it is not set.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const brut = process.env.SITE_URL
  || (process.env.VERCEL_PROJECT_PRODUCTION_URL && 'https://' + process.env.VERCEL_PROJECT_PRODUCTION_URL)
  || 'https://imageshack.vercel.app';
const SITE = brut.replace(/\/+$/, '');

// Indexed pages (my-images, view and 404 are noindex)
const PAGES = [
  ['/', '1.0', 'weekly'],
  ['/upload-photo', '0.8', 'monthly'],
  ['/upload-gif', '0.8', 'monthly'],
  ['/upload-video', '0.8', 'monthly'],
  ['/upload-screenshot', '0.8', 'monthly'],
  ['/bulk-upload', '0.8', 'monthly'],
  ['/youtube-downloader', '0.8', 'monthly'],
  ['/how-it-works', '0.6', 'monthly'],
  ['/help', '0.6', 'monthly'],
  ['/terms', '0.3', 'yearly'],
  ['/privacy', '0.3', 'yearly'],
  ['/thanks', '0.3', 'yearly'],
  ['/sitemap', '0.2', 'yearly'],
];
const aujourdhui = new Date().toISOString().slice(0, 10);

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${PAGES.map(([p, prio, freq]) => `  <url>
    <loc>${SITE}${p}</loc>
    <lastmod>${aujourdhui}</lastmod>
    <changefreq>${freq}</changefreq>
    <priority>${prio}</priority>
  </url>`).join('\n')}
</urlset>
`;

const robots = `# ImageShack
User-agent: *
Allow: /
Disallow: /noelshack/

Sitemap: ${SITE}/sitemap.xml
`;

fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), sitemap);
fs.writeFileSync(path.join(ROOT, 'robots.txt'), robots);
console.log(`robots.txt and sitemap.xml generated for ${SITE}`);
