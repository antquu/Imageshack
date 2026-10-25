/*
 * ImageShack by antquu (github.com/antquu)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Picks the language before the page renders. Order: manual choice, then the
// country cookie set by middleware.js, then the browser language.
// French-speaking countries get French, everyone else gets English.
(() => {
  const FRANCOPHONES = [
    'FR', 'BE', 'CH', 'LU', 'MC',
    // French overseas territories
    'GP', 'MQ', 'GF', 'RE', 'YT', 'PM', 'NC', 'PF', 'WF', 'BL', 'MF',
    // Africa, Indian Ocean, Caribbean, Pacific
    'SN', 'CI', 'ML', 'BF', 'NE', 'TG', 'BJ', 'GN', 'CM', 'GA', 'CG', 'CD', 'CF', 'TD',
    'MG', 'DJ', 'KM', 'BI', 'RW', 'SC', 'MU', 'HT', 'VU', 'MA', 'DZ', 'TN',
  ];

  let langue = null;
  try { langue = localStorage.getItem('imageshack.langue'); } catch { /* storage unavailable */ }
  if (langue !== 'fr' && langue !== 'en') {
    const m = /(?:^|;\s*)is_pays=([A-Z]{2})(?:-([A-Z0-9]{1,3}))?/.exec(document.cookie);
    if (m) langue = FRANCOPHONES.includes(m[1]) || (m[1] === 'CA' && m[2] === 'QC') ? 'fr' : 'en';
    else langue = /^fr\b/i.test(navigator.language || '') ? 'fr' : 'en';
  }

  const html = document.documentElement;
  html.lang = langue;
  html.dataset.langue = langue;
  if (langue === 'en') {
    if (html.dataset.titreEn) document.title = html.dataset.titreEn;
    if (html.dataset.descriptionEn) {
      document.querySelectorAll('meta[name="description"], meta[property="og:description"]')
        .forEach((m) => m.setAttribute('content', html.dataset.descriptionEn));
    }
    if (html.dataset.titreEn) {
      const og = document.querySelector('meta[property="og:title"]');
      if (og) og.setAttribute('content', html.dataset.titreEn);
    }
  }
  window.LANGUE = langue;
})();
