/*
 * ImageShack by antquu (github.com/antquu)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Shared layout (header, side columns, footer) and helpers used by every page.
// Each page provides empty #haut, #col-gauche, #col-droite and #bas containers.
(() => {
  'use strict';

  const GITHUB = 'https://github.com/antquu/Imageshack';
  const GRELINES = 'https://grelines.fr/';
  const CLE_HISTO = 'imageshack.historique';
  const CLE_LANGUE = 'imageshack.langue';
  const MAX_HISTO = 200;

  const LANGUE = window.LANGUE === 'en' ? 'en' : 'fr';
  const t = (fr, en) => (LANGUE === 'en' ? en : fr);

  const $ = (sel) => document.querySelector(sel);
  const page = location.pathname.replace(/\.html$/, '').replace(/\/index$/, '/').replace(/(.)\/+$/, '$1') || '/';
  // Upload pages, all served by index.html (see vercel.json)
  const ACCUEILS = ['/', '/upload-photo', '/upload-gif', '/upload-video', '/upload-screenshot', '/bulk-upload'];
  const estAccueil = ACCUEILS.includes(page);
  const actif = (href) => (href === page || (href === '/' && estAccueil) ? ' class="actif"' : '');
  const lienLangue = t(
    '<a href="#" data-action="langue" data-langue="en" lang="en">English</a>',
    '<a href="#" data-action="langue" data-langue="fr" lang="fr">Français</a>',
  );

  // ---------- Templates ----------
  const BANDEAU = `
<div id="bandeau-retraite" role="note">
  <div class="page retraite-inner">
    <span class="retraite-icone" aria-hidden="true">i</span>
    <p class="retraite-texte">${t(
      "<strong>Merci d'avoir fait partie de l'aventure ImageShack.</strong> Service retiré le 31 octobre 2014.",
      '<strong>Thank you for being part of ImageShack.</strong> Retired on October 31, 2014.',
    )}</p>
    <a class="retraite-lien" href="/thanks">${t('EN SAVOIR PLUS', 'LEARN MORE')} &#9656;</a>
  </div>
</div>`;

  const HAUT = `
<div id="promo">
  <div class="page promo-inner">
    <a href="/" class="promo-logo"><img src="/logo.svg" alt="ImageShack" width="120" height="54"></a>
    <p class="promo-txt">${t('On vous a écoutés... <strong>Le nouvel Image Heberg et Noelshack est arrivé</strong>', 'We listened... <strong>The new Image Heberg &amp; Noelshack is here</strong>')}</p>
    <a href="/#upload" class="promo-cta">${t('ENVOYER UNE IMAGE', 'UPLOAD AN IMAGE')} &#9656;</a>
  </div>
  <div class="arc-en-ciel" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>
</div>
${BANDEAU}

<div id="utilbar">
  <div class="page utilbar-inner">
    <span>${t('<strong>Gratuit</strong> et sans inscription. <a href="/#upload">Héberger maintenant.</a>', '<strong>Free</strong>, no sign-up. <a href="/#upload">Upload now.</a>')}</span>
    <span id="date-du-jour"></span>
    <span class="utilbar-liens"><a href="/my-images">${t('Mes images', 'My images')}</a> | <a href="/help">${t('Aide', 'Help')}</a> | <a href="${GITHUB}" target="_blank" rel="noopener">GitHub</a> | ${lienLangue}</span>
  </div>
</div>

<header id="entete">
  <div class="page entete-inner">
    <a href="/" class="grand-logo"><img src="/logo-blanc.svg" alt="${t('ImageShack, accueil', 'ImageShack, home')}" width="186" height="84"></a>
    <div class="recherche" id="url">
      <nav class="onglets" aria-label="${t('Rubriques', 'Sections')}">
        <a href="/"${actif('/')}>${t('Envoyer', 'Upload')}</a> |
        <a href="/#url" data-focus-url>${t('Depuis une URL', 'From a URL')}</a> |
        <a href="/my-images"${actif('/my-images')}>${t('Mes images', 'My images')}</a> |
        <a href="/how-it-works"${actif('/how-it-works')}>${t('Comment ça marche', 'How it works')}</a> |
        <a href="/help"${actif('/help')}>${t('Aide', 'Help')}</a>
      </nav>
      <form id="form-url" class="champ-recherche" autocomplete="off">
        <input type="url" id="input-url" placeholder="${t("Collez l'adresse d'une image ou d'une vidéo (http://...)", 'Paste the address of an image or video (http://...)')}" aria-label="${t("Adresse d'une image à héberger", 'Address of an image to upload')}">
        <button type="submit" class="btn-orange">${t('envoyer', 'upload')}</button>
        <span class="marque">shack</span>
      </form>
      <p class="suggestions">${t(
        'Astuces : <a href="/help#tips">Glissez-déposez vos images</a> | <a href="/help#screenshot">Ctrl+V pour coller</a> | <a href="/my-images">Retrouvez vos liens</a>',
        'Tips: <a href="/help#tips">Drag and drop your images</a> | <a href="/help#screenshot">Ctrl+V to paste</a> | <a href="/my-images">Find your links</a>',
      )}</p>
    </div>
    <a class="meteo" href="/my-images" title="${t('Voir mes images', 'See my images')}">
      <div class="meteo-chiffre"><span id="compteur">0</span></div>
      <div class="meteo-lieu">${t('fichier(s) hébergé(s)<br>sur ce PC', 'file(s) uploaded<br>from this PC')}</div>
    </a>
  </div>
</header>

<div id="grille">
  <div class="page grille-inner">
    <ul class="raccourcis">
      <li><a href="/#upload">${t('Envoyer', 'Upload')}</a></li>
      <li><a href="/my-images">${t('Mes images', 'My images')}</a></li>
      <li><a href="/#url" data-focus-url>${t('Depuis une URL', 'From a URL')}</a></li>
      <li><a href="/help">${t('Aide', 'Help')}</a></li>
    </ul>
    <ul class="cats">
      <li><a href="/upload-photo">${t('Héberger une photo', 'Upload a photo')}</a></li>
      <li><a href="/upload-gif">${t('Héberger un GIF', 'Upload a GIF')}</a></li>
      <li><a href="/upload-video">${t('Héberger une vidéo', 'Upload a video')}</a> <sup class="new">NEW</sup></li>
      <li><a href="/upload-screenshot">${t('Héberger une capture', 'Upload a screenshot')}</a></li>
      <li><a href="/bulk-upload">${t('Envoi multiple', 'Bulk upload')}</a></li>
      <li><a href="/how-it-works#links">${t('Liens courts', 'Short links')}</a> <sup class="new">NEW</sup></li>
      <li><a href="/how-it-works#bbcode">${t('Codes BBCode', 'BBCode')}</a></li>
      <li><a href="/how-it-works#html">${t('Codes HTML', 'HTML code')}</a></li>
      <li><a href="/how-it-works#thumbnails">${t('Miniatures', 'Thumbnails')}</a></li>
      <li><a href="/my-images">${t('Historique', 'History')}</a></li>
      <li><a href="/my-images#all">${t('Copier tous les liens', 'Copy all links')}</a></li>
      <li><a href="/help#formats">${t('Formats acceptés', 'Supported formats')}</a></li>
      <li><a href="/help#size">${t('Taille maximale', 'Maximum size')}</a></li>
      <li><a href="/help">${t('Questions fréquentes', 'FAQ')}</a></li>
      <li><a href="/privacy">${t('Vie privée', 'Privacy')}</a></li>
      <li><a href="/terms">${t("Conditions d'utilisation", 'Terms of use')}</a></li>
    </ul>
  </div>
</div>`;

  const GAUCHE = `
<div class="bloc-gauche">
  <h3>&#9656; ${t('Mon ImageShack', 'My ImageShack')}</h3>
  <ul>
    <li><a href="/my-images">${t('Voir mes images', 'See my images')}</a></li>
    <li><a href="#" data-action="copier-histo">${t('Copier tous mes liens', 'Copy all my links')}</a></li>
    <li><a href="#" data-action="vider-histo">${t("Vider l'historique", 'Clear history')}</a></li>
  </ul>
</div>
<div class="bloc-gauche bloc-blanc">
  <h4><span class="ico-env">&#9993;</span> ${t('Astuces', 'Tips')}</h4>
  <p>${t(
    "Faites glisser vos images et vidéos n'importe où sur l'accueil, ou faites <strong>Ctrl+V</strong> après une capture d'écran.",
    'Drag your images and videos anywhere on the home page, or press <strong>Ctrl+V</strong> after taking a screenshot.',
  )}</p>
  <p>&#9656; <a href="/help#tips">${t('En savoir plus', 'Learn more')}</a></p>
</div>
<div class="bloc-gauche">
  <h3>${t('Formats acceptés', 'Supported formats')}</h3>
  <p class="formats">JPG &middot; PNG &middot; GIF &middot; WEBP &middot; BMP &middot; SVG &middot; TIFF &middot; PSD</p>
  <p class="formats">MP4 &middot; WEBM &middot; MOV &middot; MKV &middot; AVI</p>
  <p class="petit">${t('<a href="/help#size">200 Mo maximum</a> par fichier (GIF : 20 Mo).', '<a href="/help#size">200 MB maximum</a> per file (GIF: 20 MB).')}</p>
</div>
<div class="bloc-gauche">
  <h3>${t('Rubriques', 'Sections')}</h3>
  <ul class="puces">
    <li><a href="/upload-photo">${t('Héberger une photo', 'Upload a photo')}</a></li>
    <li><a href="/upload-gif">${t('Héberger un GIF', 'Upload a GIF')}</a></li>
    <li><a href="/upload-video">${t('Héberger une vidéo', 'Upload a video')}</a></li>
    <li><a href="/upload-screenshot">${t('Héberger une capture', 'Upload a screenshot')}</a></li>
    <li><a href="/bulk-upload">${t('Envoi multiple', 'Bulk upload')}</a></li>
    <li><a href="/#url" data-focus-url>${t('Envoyer depuis le Web', 'Upload from the Web')}</a></li>
    <li><a href="/how-it-works#bbcode">${t('Partager sur un forum', 'Share on a forum')}</a></li>
    <li><a href="/how-it-works#html">${t('Partager sur un blog', 'Share on a blog')}</a></li>
    <li><a href="/help">${t('Questions fréquentes', 'FAQ')}</a></li>
    <li><a href="/terms">${t("Conditions d'utilisation", 'Terms of use')}</a></li>
  </ul>
</div>
<div class="bloc-gauche bloc-blanc annonces">
  <p class="annonces-titre">${t('Liens commerciaux', 'Sponsored links')}</p>
  <a class="annonce" href="${GRELINES}" target="_blank" rel="noopener sponsored">
    <span class="annonce-titre">${t('GreLines : horaires en direct', 'GreLines: live timetables')}</span>
    <span class="annonce-txt">${t('Bus, tram, TER, vélos. Tous vos transports sur un seul écran. Gratuit !', 'Bus, tram, trains, bikes. All your transport on one screen. Free!')}</span>
    <span class="annonce-url">www.grelines.fr</span>
  </a>
</div>`;

  const DROITE = `
<div class="pub" id="pub-grelines">
  <a class="pub-lien" href="${GRELINES}" target="_blank" rel="noopener sponsored" aria-label="${t('GreLines : tous vos transports sur un seul écran', 'GreLines: all your transport on one screen')}">
    <div class="pub-entete">
      <img class="pub-gl" src="/grelines-gl.png" alt="GreLines" width="44" height="44">
      <p class="pub-haut">${t('TON TRAM ARRIVE DANS...', 'YOUR TRAM ARRIVES IN...')}</p>
    </div>
    <div class="led" aria-hidden="true">
      <div><b>A</b> Fontaine La Poya <span>2 min</span></div>
      <div><b>B</b> Gières Plaine des Sports <span>5 min</span></div>
      <div><b>C</b> Seyssins Le Prisme <span>8 min</span></div>
    </div>
    <p class="pub-gros">${t('TOUS VOS TRANSPORTS<br>SUR UN SEUL <span>ÉCRAN.</span>', 'ALL YOUR TRANSPORT<br>ON ONE <span>SCREEN.</span>')}</p>
    <p class="pub-villes">Grenoble &middot; Lyon &middot; Nancy<br>Saint-Étienne &middot; Clermont</p>
    <span class="pub-bouton">${t('CLIQUEZ ICI !', 'CLICK HERE!')} &raquo;</span>
  </a>
</div>
<div class="sous-pub"><span>${t('Publicité', 'Advertisement')}</span><a href="/help#ad">${t('Avis sur la pub', 'Ad feedback')}</a></div>

<div id="recent-images" class="bloc-droite">
  <div class="titre-bloc">
    <h3><a href="/my-images">${t('Mes images récentes', 'My recent images')}</a></h3>
    <span class="ctrl">
      <a href="/my-images" title="${t('Voir toutes mes images', 'See all my images')}">+</a><button type="button" data-action="replier" title="${t('Replier', 'Collapse')}" aria-expanded="true">&minus;</button>
    </span>
  </div>
  <div class="replie-contenu">
    <div id="galerie" class="galerie"></div>
    <p id="galerie-vide" class="vide">${t("Aucune image pour l'instant.", 'No images yet.')} <a href="/#upload">${t('Envoyez la première !', 'Upload the first one!')}</a></p>
    <p class="plus"><a href="/my-images">${t('Toutes mes images', 'All my images')} &raquo;</a></p>
  </div>
</div>`;

  const BAS = `
<footer id="pied">
  <div class="page">
    <p class="pied-liens">
      <a href="${GITHUB}" target="_blank" rel="noopener">GitHub</a> |
      <a href="/help">${t('Aide', 'Help')}</a> |
      <a href="/terms">${t("Conditions d'utilisation", 'Terms of use')}</a> |
      <a href="/privacy">${t('Vie privée', 'Privacy')}</a> |
      <a href="/sitemap">${t('Plan du site', 'Site map')}</a> |
      ${lienLangue} |
      <a href="#top" data-action="haut">${t('Haut de page', 'Back to top')}</a>
    </p>
    <p class="copyright">&copy; 2026 ImageShack. An Antoine Adam Production.</p>
  </div>
</footer>
<div id="toast" role="status" aria-live="polite"></div>`;

  function poser(sel, html) {
    const el = $(sel);
    if (el && !el.children.length) el.innerHTML = html;
  }
  poser('#haut', HAUT);
  poser('#col-gauche', GAUCHE);
  poser('#col-droite', DROITE);
  poser('#bas', BAS);

  // ---------- Ad rotation ----------
  // On each page load, one chance in two to replace the GreLines ad with a random
  // image from pubs/ (listed in pubs/index.json by scripts/pubs.cjs).
  // The slot always stays blank for a short random delay, like an ad server loading.
  function choisirPub() {
    const pub = $('#pub-grelines');
    if (!pub) return;
    pub.classList.add('pub-choix');
    const debut = Date.now();
    const latence = 300 + Math.random() * 700;
    let fini = false;
    const finir = () => {
      if (fini) return;
      fini = true;
      setTimeout(() => pub.classList.remove('pub-choix'), Math.max(0, latence - (Date.now() - debut)));
    };
    setTimeout(finir, 2500);
    if (Math.random() < 0.5) return finir();

    fetch('/pubs/index.json')
      .then((r) => (r.ok ? r.json() : []))
      .then((liste) => {
        if (!Array.isArray(liste) || !liste.length) return finir();
        const choix = liste[Math.floor(Math.random() * liste.length)];
        const img = document.createElement('img');
        img.className = 'pub-image';
        img.alt = t('Publicité', 'Advertisement');
        img.addEventListener('error', finir);
        img.addEventListener('load', () => {
          if (fini) return;
          let contenu = img;
          if (/^https?:\/\//i.test(choix.lien || '')) {
            contenu = document.createElement('a');
            contenu.className = 'pub-lien';
            contenu.href = choix.lien;
            contenu.target = '_blank';
            contenu.rel = 'noopener sponsored';
            contenu.append(img);
          }
          // Same 300 px width as the GreLines ad, height taken from the image (e.g. 300x600)
          img.width = 300;
          img.height = Math.round((300 * img.naturalHeight) / img.naturalWidth) || 250;
          pub.classList.add('pub-perso');
          pub.replaceChildren(contenu);
          finir();
        });
        img.src = choix.image;
      })
      .catch(finir);
  }
  choisirPub();

  // ---------- Upload history (localStorage, per browser) ----------
  function lireHisto() {
    try { return JSON.parse(localStorage.getItem(CLE_HISTO)) || []; } catch { return []; }
  }
  function ecrireHisto(h) {
    try { localStorage.setItem(CLE_HISTO, JSON.stringify(h.slice(0, MAX_HISTO))); } catch { /* storage unavailable */ }
    afficherGalerie();
    window.dispatchEvent(new Event('imageshack:histo'));
  }
  function ajouterHisto(img) {
    ecrireHisto([img, ...lireHisto().filter((x) => x.url !== img.url)]);
  }
  function retirerHisto(url) {
    ecrireHisto(lireHisto().filter((x) => x.url !== url));
  }

  // ---------- Links (no database) ----------
  // Catbox:    /c/<id>    raw file proxied from files.catbox.moe
  //            /v/c/<id>  viewer page
  // NoelShack: /i/<path>  raw file proxied from image.noelshack.com/fichiers
  //            /m/<path>  thumbnail
  //            /v/<path>  viewer page
  const CHEMIN_OK = /^\d{4}\/\d{1,2}\/\d{1,2}\/[\w.\-]+$/;
  const CATBOX_OK = /^[a-z0-9]{6,12}\.[a-z0-9]{2,5}$/i;
  const EXT_VIDEO = /\.(mp4|webm|mov|m4v|mkv|avi|ogv)$/i;

  function cheminDe(url, dossier) {
    const m = new RegExp('/' + dossier + '/(.+)$').exec(url || '');
    return m && CHEMIN_OK.test(m[1]) ? m[1] : null;
  }
  function idCatbox(url) {
    const m = /^https:\/\/files\.catbox\.moe\/([^/?#]+)$/.exec(url || '');
    return m && CATBOX_OK.test(m[1]) ? m[1] : null;
  }
  const estVideo = (img) => img.type === 'video' || EXT_VIDEO.test(img.url || '');
  const echapper = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  function liens(img) {
    const o = location.origin;
    const id = idCatbox(img.url);
    if (id) {
      const video = estVideo(img);
      const page = `${o}/v/c/${id}`;
      const nom = img.nom || id;
      return {
        hebergeur: 'catbox',
        video,
        nom,
        page,
        direct: `${o}/c/${id}`,
        original: img.url,
        mini: video ? img.vignette || null : img.url,
        bbcode: video ? `[url=${page}]${nom}[/url]` : `[url=${page}][img]${img.url}[/img][/url]`,
        html: video
          ? `<a href="${page}">${echapper(nom)}</a>`
          : `<a href="${page}"><img src="${img.url}" alt="${echapper(nom)}"></a>`,
      };
    }

    const chemin = cheminDe(img.url, 'fichiers');
    const cheminMini = cheminDe(img.mini, 'minis') || chemin;
    const direct = chemin ? `${o}/i/${chemin}` : img.url;
    const page = chemin ? `${o}/v/${chemin}` : img.page;
    const mini = cheminMini ? `${o}/m/${cheminMini}` : img.mini || img.url;
    const nom = img.nom || (chemin || '').split('/').pop() || 'image';
    return {
      hebergeur: 'noelshack',
      video: false,
      nom,
      page,
      direct,
      original: img.url,
      mini,
      bbcode: `[url=${page}][img]${mini}[/img][/url]`,
      html: `<a href="${page}"><img src="${mini}" alt="${echapper(nom)}"></a>`,
    };
  }

  let idChamp = 0;
  function champsLiens(img) {
    const l = liens(img);
    const frag = document.createDocumentFragment();
    [
      [t('Lien brut', 'Raw link'), l.direct],
      [t('Page ImageShack', 'ImageShack page'), l.page],
      [t('Forum (BBCode)', 'Forum (BBCode)'), l.bbcode],
      [t('Site / blog (HTML)', 'Website / blog (HTML)'), l.html],
      l.hebergeur === 'catbox'
        ? [t('Lien Catbox', 'Catbox link'), l.original]
        : [t('Lien NoelShack (JVC)', 'NoelShack link (JVC)'), l.original],
    ].forEach(([label, valeur]) => {
      const id = 'lien-' + (++idChamp);
      const lab = document.createElement('label');
      lab.htmlFor = id;
      lab.textContent = label + t(' :', ':');
      const input = document.createElement('input');
      input.id = id;
      input.readOnly = true;
      input.value = valeur || '';
      input.addEventListener('focus', () => input.select());
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn-xp';
      btn.textContent = t('Copier', 'Copy');
      btn.addEventListener('click', () => copier(input.value, t(label + ' copié !', label + ' copied!')));
      frag.append(lab, input, btn);
    });
    return frag;
  }

  // Thumbnail: the image, the frame captured from a video, or a placeholder tile
  function vignette(img) {
    const l = liens(img);
    if (l.mini) {
      const im = document.createElement('img');
      im.src = l.mini;
      im.alt = l.nom;
      im.loading = 'lazy';
      if (!l.video) return im;
      const boite = document.createElement('span');
      boite.className = 'vignette-video';
      boite.append(im);
      return boite;
    }
    const tuile = document.createElement('span');
    tuile.className = 'vignette-video vignette-vide';
    tuile.title = l.nom;
    return tuile;
  }

  // ---------- Recent images (right column) ----------
  function afficherGalerie() {
    const h = lireHisto();
    const galerie = $('#galerie');
    if (galerie) {
      galerie.replaceChildren(...h.slice(0, 16).map((img) => {
        const l = liens(img);
        const a = document.createElement('a');
        a.href = l.page;
        a.title = l.nom + t(' (voir)', ' (view)');
        const x = document.createElement('button');
        x.type = 'button';
        x.textContent = '×';
        x.title = t("Retirer de l'historique", 'Remove from history');
        x.addEventListener('click', (e) => { e.preventDefault(); retirerHisto(img.url); });
        a.append(vignette(img), x);
        return a;
      }));
      $('#galerie-vide').hidden = h.length > 0;
    }
    const c = $('#compteur');
    if (c) c.textContent = h.length;
  }

  // ---------- Dial-up style image loading ----------
  // Waits for the real image, then reveals it from top to bottom in uneven steps (~10 s).
  function chargerCommeModem(img) {
    let boite = img.parentElement;
    if (!boite || !boite.classList.contains('modem')) {
      boite = document.createElement('span');
      boite.className = 'modem';
      img.replaceWith(boite);
      boite.append(img);
    }
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const devoiler = (p) => boite.style.setProperty('--devoile', p * 100 + '%');
    devoiler(0);
    img.decode().catch(() => {}).finally(() => {
      let p = 0;
      const etape = () => {
        p = Math.min(1, p + 0.01 + Math.random() * 0.035);
        devoiler(p);
        if (p >= 1) return;
        setTimeout(etape, Math.random() < 0.12 ? 600 + Math.random() * 900 : 60 + Math.random() * 180);
      };
      setTimeout(etape, 700);
    });
  }

  // ---------- Clipboard and toast ----------
  async function copier(texte, msg) {
    if (!texte) return toast(t('Rien à copier pour le moment.', 'Nothing to copy yet.'));
    try {
      await navigator.clipboard.writeText(texte);
    } catch {
      const zone = document.createElement('textarea');
      zone.value = texte;
      document.body.append(zone);
      zone.select();
      document.execCommand('copy');
      zone.remove();
    }
    toast(msg || t('Copié !', 'Copied!'));
  }

  let minuteurToast;
  function toast(msg) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('visible');
    clearTimeout(minuteurToast);
    minuteurToast = setTimeout(() => el.classList.remove('visible'), 2400);
  }

  const nbLiens = (n) => t(n + ' lien(s) copié(s) !', n + ' link(s) copied!');
  function copierHisto() {
    const urls = lireHisto().map((x) => liens(x).direct);
    copier(urls.join('\n'), nbLiens(urls.length));
  }
  function viderHisto() {
    if (!lireHisto().length) return toast(t("L'historique est déjà vide.", 'History is already empty.'));
    if (!confirm(t(
      "Vider l'historique de ce navigateur ?\n(Les images restent en ligne.)",
      'Clear the history of this browser?\n(The images stay online.)',
    ))) return;
    ecrireHisto([]);
    toast(t('Historique vidé.', 'History cleared.'));
  }

  // ---------- "From a URL" bar ----------
  function focusUrl() {
    const input = $('#input-url');
    if (!input) return;
    input.focus();
    input.closest('.champ-recherche').classList.add('flash');
    setTimeout(() => input.closest('.champ-recherche').classList.remove('flash'), 900);
  }
  const form = $('#form-url');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const url = $('#input-url').value.trim();
      if (!/^https?:\/\/.+/i.test(url)) return toast(t('Entrez une adresse qui commence par http:// ou https://', 'Enter an address starting with http:// or https://'));
      if (typeof IS.envoyerUrl === 'function') IS.envoyerUrl(url);
      else location.href = '/?url=' + encodeURIComponent(url);
    });
  }
  if (estAccueil && location.hash === '#url') setTimeout(focusUrl, 50);

  // ---------- Click actions ----------
  document.addEventListener('click', (e) => {
    const focus = e.target.closest('[data-focus-url]');
    if (focus && estAccueil) { e.preventDefault(); focusUrl(); return; }
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;
    if (action === 'haut') { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    else if (action === 'copier-histo') { e.preventDefault(); copierHisto(); }
    else if (action === 'vider-histo') { e.preventDefault(); viderHisto(); }
    else if (action === 'langue') {
      e.preventDefault();
      try { localStorage.setItem(CLE_LANGUE, el.dataset.langue); } catch { /* storage unavailable */ }
      location.reload();
    } else if (action === 'replier') {
      const bloc = el.closest('.bloc-droite');
      const replie = bloc.classList.toggle('replie');
      el.textContent = replie ? '+' : '−';
      el.title = replie ? t('Déplier', 'Expand') : t('Replier', 'Collapse');
      el.setAttribute('aria-expanded', String(!replie));
    }
  });

  // Portal-style date
  const dateEl = $('#date-du-jour');
  if (dateEl) {
    const d = new Date().toLocaleDateString(t('fr-FR', 'en-US'), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    dateEl.textContent = d.charAt(0).toUpperCase() + d.slice(1);
  }

  afficherGalerie();

  console.clear();
  console.log([
    ' _                                      _                   _',
    '(_) _ __ ___    __ _   __ _   ___  ___ | |__    __ _   ___ | | __',
    '| || \'_ ` _ \\  / _` | / _` | / _ \\/ __|| \'_ \\  / _` | / __|| |/ /',
    '| || | | | | || (_| || (_| ||  __/\\__ \\| | | || (_| || (__ |   <',
    '|_||_| |_| |_| \\__,_| \\__, | \\___||___/|_| |_| \\__,_| \\___||_|\\_\\',
    '                      |___/',
    '',
    '       made by antquu • github.com/antquu',
  ].join('\n'));

  const IS = window.IS = {
    LANGUE, t,
    lireHisto, ajouterHisto, retirerHisto, viderHisto, copierHisto, nbLiens,
    liens, champsLiens, vignette, chargerCommeModem, cheminDe, idCatbox, estVideo, CHEMIN_OK, CATBOX_OK, EXT_VIDEO, copier, toast, echapper,
    envoyerUrl: null,
  };
})();
