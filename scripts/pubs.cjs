/*
 * ImageShack by antquu (github.com/antquu)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Lists the ad images found in pubs/ and writes pubs/index.json, which the
// right column reads to pick an ad. Drop a PNG, JPG, GIF or WEBP in pubs/ and
// it is picked up on the next build. Optional click targets go in pubs/liens.json:
//   { "my-ad.png": "https://example.com" }
const fs = require('fs');
const path = require('path');

const DOSSIER = path.join(__dirname, '..', 'pubs');
const IMAGES = /\.(png|jpe?g|gif|webp)$/i;

function listerPubs() {
  if (!fs.existsSync(DOSSIER)) return [];
  let liens = {};
  try { liens = JSON.parse(fs.readFileSync(path.join(DOSSIER, 'liens.json'), 'utf8')); } catch { /* no links file */ }
  return fs.readdirSync(DOSSIER)
    .filter((f) => IMAGES.test(f))
    .sort()
    .map((f) => ({ image: '/pubs/' + encodeURIComponent(f), lien: liens[f] || null }));
}

if (require.main === module) {
  const pubs = listerPubs();
  fs.mkdirSync(DOSSIER, { recursive: true });
  fs.writeFileSync(path.join(DOSSIER, 'index.json'), JSON.stringify(pubs, null, 2) + '\n');
  console.log(`pubs/index.json generated (${pubs.length} ad${pubs.length === 1 ? '' : 's'})`);
}

module.exports = { listerPubs };
