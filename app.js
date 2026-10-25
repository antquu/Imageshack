/*
 * ImageShack by antquu (github.com/antquu)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Upload logic for the home page and the dedicated upload pages.
// Files go to Catbox first (/catbox/api.php) and small images fall back to
// NoelShack (/noelshack/envoi.json). Both are rewrites in vercel.json.
(() => {
  'use strict';

  const CATBOX_URL = '/catbox/api.php';
  const NOELSHACK_ENVOI = '/noelshack/envoi.json';
  const NOELSHACK_URL = '/noelshack/telecharger.json?url=';
  const MO = 1024 * 1024;
  const MAX_CATBOX = 200 * MO;
  const MAX_GIF_CATBOX = 20 * MO; // Catbox rejects GIFs over 20 MB
  const MAX_NOELSHACK = 4 * MO;
  const MAX_PAR_LOT = 20;
  const TYPES_IMAGE = /(\.|\/)(gif|jpe?g|jpe|png|svg|svg\+xml|bmp|tif|tiff|psd|webp)$/i;
  const TYPES_NOELSHACK = /(\.|\/)(gif|jpe?g|jpe|png|svg|svg\+xml|bmp|tif|tiff|psd)$/i;
  const TYPES_VIDEO = /(\.|\/)(mp4|webm|mov|quicktime|m4v|mkv|x-matroska|avi|x-msvideo|ogv|ogg)$/i;

  const $ = (sel) => document.querySelector(sel);
  const zone = $('#zone-depot');
  const inputFichiers = $('#input-fichiers');
  const liste = $('#liste-envois');
  const blocFile = $('#file');
  const tplEnvoi = $('#tpl-envoi');
  const t = IS.t;

  // ---------- Dedicated upload pages (same page, different title) ----------
  const VARIANTES = {
    '/upload-photo': {
      titrePage: t('Héberger une photo', 'Upload a photo'),
      titre: t('Hébergez vos <span>photos</span>', 'Upload your <span>photos</span>'),
      sous: t('Vos souvenirs en ligne en un clic.<br>Déposez vos photos ici ou cliquez pour parcourir.', 'Your memories online in one click.<br>Drop your photos here or click to browse.'),
      petit: t('JPG, PNG, WEBP, BMP, TIFF &middot; 200 Mo max par photo', 'JPG, PNG, WEBP, BMP, TIFF &middot; 200 MB max per photo'),
      accept: 'image/jpeg,image/png,image/webp,image/bmp,image/tiff,.jpg,.jpeg,.png,.webp,.bmp,.tif,.tiff',
    },
    '/upload-gif': {
      titrePage: t('Héberger un GIF', 'Upload a GIF'),
      titre: t('Hébergez vos <span>GIF</span>', 'Upload your <span>GIFs</span>'),
      sous: t('Vos GIF animés restent animés.<br>Déposez vos GIF ici ou cliquez pour parcourir.', 'Animated GIFs stay animated.<br>Drop your GIFs here or click to browse.'),
      petit: t('GIF animés ou fixes &middot; 20 Mo max par GIF', 'Animated or still GIFs &middot; 20 MB max per GIF'),
      accept: 'image/gif,.gif',
    },
    '/upload-video': {
      titrePage: t('Héberger une vidéo', 'Upload a video'),
      titre: t('Hébergez vos <span>vidéos</span>', 'Upload your <span>videos</span>'),
      sous: t('Vos vidéos en ligne, sans inscription.<br>Déposez vos vidéos ici ou cliquez pour parcourir.', 'Your videos online, no sign-up.<br>Drop your videos here or click to browse.'),
      petit: t('MP4, WEBM, MOV, MKV, AVI &middot; 200 Mo max par vidéo', 'MP4, WEBM, MOV, MKV, AVI &middot; 200 MB max per video'),
      accept: 'video/*,.mkv,.mov,.avi',
    },
    '/upload-screenshot': {
      titrePage: t('Héberger une capture', 'Upload a screenshot'),
      titre: t('Hébergez vos <span>captures</span>', 'Upload your <span>screenshots</span>'),
      sous: t("Faites une capture d'écran puis appuyez sur <strong>Ctrl+V</strong> sur cette page.<br>Vous pouvez aussi déposer le fichier ou cliquer pour parcourir.", 'Take a screenshot, then press <strong>Ctrl+V</strong> on this page.<br>You can also drop the file or click to browse.'),
      petit: t('Impr. écran ou Windows + Maj + S, puis Ctrl+V', 'Print Screen or Windows + Shift + S, then Ctrl+V'),
      accept: 'image/*',
    },
    '/bulk-upload': {
      titrePage: t('Envoi multiple', 'Bulk upload'),
      titre: t('Envoi <span>multiple</span>', 'Bulk <span>upload</span>'),
      sous: t("Jusqu'à 20 fichiers d'un coup, envoyés les uns après les autres.<br>Sélectionnez-les tous ou glissez-les ici.", 'Up to 20 files at once, uploaded one after the other.<br>Select them all or drag them here.'),
      petit: t("Jusqu'à 20 images ou vidéos &middot; 200 Mo max par fichier", 'Up to 20 images or videos &middot; 200 MB max per file'),
    },
  };
  zone.setAttribute('aria-label', t('Choisir des images ou vidéos à envoyer', 'Choose images or videos to upload'));
  const variante = VARIANTES[location.pathname.replace(/\/+$/, '')];
  if (variante) {
    document.title = variante.titrePage + ' - ImageShack';
    $('.depot-titre').innerHTML = variante.titre;
    $('.depot-sous').innerHTML = variante.sous;
    $('.depot-petit').innerHTML = variante.petit;
    if (variante.accept) inputFichiers.accept = variante.accept;
  }

  // ---------- Upload ----------
  // Posts a form with upload progress and resolves with the response text
  function poster(url, fd, onProgres) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url);
      if (onProgres) xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgres(e.loaded / e.total); };
      xhr.onload = () => {
        if (xhr.status === 413) return reject(new Error(t('Fichier trop gros pour passer par le site.', 'File too large to go through the site.')));
        if (xhr.status >= 400) return reject(new Error(t('Erreur serveur (', 'Server error (') + xhr.status + ').'));
        resolve(xhr.responseText);
      };
      xhr.onerror = () => reject(new Error(t('Erreur lors du transfert de données.', 'Error while transferring data.')));
      xhr.send(fd);
    });
  }

  // Catbox answers in plain text: the file URL or an error message
  function lireCatbox(texte) {
    const r = String(texte || '').trim();
    if (/^https:\/\/files\.catbox\.moe\/[a-z0-9]+\.[a-z0-9]+$/i.test(r)) return r;
    throw new Error('Catbox : ' + (r.slice(0, 160) || t('réponse vide', 'empty response')));
  }

  async function envoyerCatbox(fichier, onProgres) {
    const fd = new FormData();
    fd.append('reqtype', 'fileupload');
    fd.append('userhash', '');
    fd.append('fileToUpload', fichier, fichier.name || 'fichier');
    return lireCatbox(await poster(CATBOX_URL, fd, onProgres));
  }

  async function catboxDepuisUrl(url) {
    const fd = new FormData();
    fd.append('reqtype', 'urlupload');
    fd.append('userhash', '');
    fd.append('url', url);
    return lireCatbox(await poster(CATBOX_URL, fd));
  }

  // NoelShack always answers in French, so known messages are translated
  function traduireErreur(msg) {
    if (IS.LANGUE !== 'en') return msg;
    if (/dimensions, le format ou le poids/i.test(msg)) return "The image's dimensions, format or file size were rejected. Please change your image.";
    return 'NoelShack refused the image: ' + msg;
  }

  function lireNoelShack(texte) {
    let r;
    try { r = JSON.parse(texte); } catch { throw new Error(t('Réponse illisible du serveur.', 'Unreadable response from the server.')); }
    if (r.erreurs && r.erreurs !== 'null') {
      throw new Error(traduireErreur(Array.isArray(r.erreurs) ? r.erreurs.join(' ') : String(r.erreurs)));
    }
    if (!r.url) throw new Error(t("Le serveur n'a pas renvoyé de lien.", 'The server did not return a link.'));
    return {
      hebergeur: 'noelshack',
      nom: r.nom,
      url: r.url,
      page: r.chats,
      mini: r.mini,
      type: 'image',
      date: Date.now(),
    };
  }

  async function envoyerNoelShack(fichier, onProgres) {
    const fd = new FormData();
    fd.append('fichier[]', fichier, fichier.name || 'image.png');
    return lireNoelShack(await poster(NOELSHACK_ENVOI, fd, onProgres));
  }

  async function noelshackDepuisUrl(url) {
    const r = await fetch(NOELSHACK_URL + encodeURIComponent(url));
    if (!r.ok) throw new Error(t('Erreur serveur (', 'Server error (') + r.status + ').');
    return lireNoelShack(await r.text());
  }

  const estVideoFichier = (f) => TYPES_VIDEO.test(f.type) || TYPES_VIDEO.test(f.name);
  const peutAllerSurNoelShack = (f) => !estVideoFichier(f) && f.size <= MAX_NOELSHACK
    && (TYPES_NOELSHACK.test(f.type) || TYPES_NOELSHACK.test(f.name));

  // Catbox first, then NoelShack for images that fit its limits
  async function envoyer(f, ligne, vignette) {
    const video = estVideoFichier(f);
    try {
      const url = await envoyerCatbox(f, ligne.progres);
      return { hebergeur: 'catbox', nom: f.name, url, type: video ? 'video' : 'image', vignette, date: Date.now() };
    } catch (e) {
      if (!peutAllerSurNoelShack(f)) throw e;
      ligne.progres(0);
      ligne.etat(t('Catbox indisponible, envoi sur NoelShack...', 'Catbox unavailable, trying NoelShack...'));
      return envoyerNoelShack(f, (p) => {
        ligne.progres(p);
        if (p < 1) ligne.etat(t('NoelShack : ', 'NoelShack: ') + Math.round(p * 100) + t(' %', '%'));
      });
    }
  }

  // Grabs a small frame from the local video file before uploading
  function capturerVignette(fichier) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(fichier);
      const v = document.createElement('video');
      let fini = false;
      const finir = (res) => {
        if (fini) return;
        fini = true;
        URL.revokeObjectURL(url);
        resolve(res);
      };
      setTimeout(() => finir(null), 4000);
      v.muted = true;
      v.preload = 'metadata';
      v.playsInline = true;
      v.addEventListener('loadeddata', () => { v.currentTime = Math.min(1, (v.duration || 2) / 4); });
      v.addEventListener('seeked', () => {
        try {
          const l = 160;
          const h = Math.round(l * (v.videoHeight / v.videoWidth || 0.5625));
          const c = document.createElement('canvas');
          c.width = l;
          c.height = h;
          c.getContext('2d').drawImage(v, 0, 0, l, h);
          finir(c.toDataURL('image/jpeg', 0.7));
        } catch { finir(null); }
      });
      v.addEventListener('error', () => finir(null));
      v.src = url;
    });
  }

  // ---------- Upload list rows ----------
  function creerLigne(nom, apercu) {
    const li = tplEnvoi.content.firstElementChild.cloneNode(true);
    li.querySelector('.envoi-nom').textContent = nom;
    const vign = li.querySelector('.envoi-vignette');
    const img = vign.querySelector('img');
    if (apercu) img.src = apercu; else img.remove();
    blocFile.hidden = false;
    liste.prepend(li);
    const etat = (txt) => { li.querySelector('.envoi-etat').textContent = txt; };
    return {
      etat,
      apercu(src) {
        if (!src) return;
        const im = document.createElement('img');
        im.src = src;
        im.alt = '';
        vign.replaceChildren(im);
      },
      progres(p) {
        li.querySelector('.barre > div').style.width = Math.round(p * 100) + '%';
        etat(p < 1 ? t('Envoi... ', 'Uploading... ') + Math.round(p * 100) + t(' %', '%') : t('Traitement...', 'Processing...'));
      },
      erreur(msg) {
        li.classList.add('erreur');
        li.querySelector('.barre > div').style.width = '100%';
        etat(msg);
      },
      ok(res) {
        const l = IS.liens(res);
        li.classList.add('ok');
        li.dataset.url = l.direct;
        li.querySelector('.envoi-nom').textContent = l.nom;
        const a = document.createElement('a');
        a.href = l.page;
        a.append(IS.vignette(res));
        vign.replaceChildren(a);
        const liens = li.querySelector('.envoi-liens');
        liens.replaceChildren(IS.champsLiens(res));
        liens.hidden = false;
      },
    };
  }

  // ---------- Queue (one upload at a time) ----------
  let fileAttente = Promise.resolve();

  function verifier(f) {
    const image = TYPES_IMAGE.test(f.type) || TYPES_IMAGE.test(f.name);
    if (!image && !estVideoFichier(f)) return t("Ce type de fichier n'est pas autorisé (images et vidéos seulement).", 'This file type is not allowed (images and videos only).');
    if (f.size < 1) return t('Fichier vide.', 'Empty file.');
    if (/(\.|\/)gif$/i.test(f.type) || /\.gif$/i.test(f.name)) {
      if (f.size > MAX_GIF_CATBOX) return t('GIF trop lourd (20 Mo max). Convertissez-le en vidéo MP4 ou WEBM.', 'GIF too large (20 MB max). Convert it to an MP4 or WEBM video.');
    }
    if (f.size > MAX_CATBOX) return t('Fichier trop volumineux (200 Mo max).', 'File too large (200 MB max).');
    return null;
  }

  function traiterFichiers(fichiers) {
    let lot = Array.from(fichiers);
    if (!lot.length) return;
    if (lot.length > MAX_PAR_LOT) {
      IS.toast(t(`Maximum ${MAX_PAR_LOT} fichiers à la fois, les autres sont ignorés.`, `Maximum ${MAX_PAR_LOT} files at once, the others were skipped.`));
      lot = lot.slice(0, MAX_PAR_LOT);
    }
    for (const f of lot) {
      const video = estVideoFichier(f);
      const apercu = !video && f.type.startsWith('image/') && f.type !== 'image/vnd.adobe.photoshop' ? URL.createObjectURL(f) : null;
      const ligne = creerLigne(f.name || t('image collée', 'pasted image'), apercu);
      const pb = verifier(f);
      if (pb) { ligne.erreur(pb); continue; }
      const vignette = video ? capturerVignette(f) : Promise.resolve(null);
      vignette.then(ligne.apercu);
      fileAttente = fileAttente.then(async () => {
        try {
          const res = await envoyer(f, ligne, await vignette);
          ligne.ok(res);
          IS.ajouterHisto(res);
        } catch (e) {
          ligne.erreur(e.message);
        } finally {
          if (apercu) URL.revokeObjectURL(apercu);
        }
      });
    }
    blocFile.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // Called by the "From a URL" bar in the header (commun.js)
  IS.envoyerUrl = (url) => {
    const btn = $('#form-url button');
    const ligne = creerLigne(url, null);
    ligne.progres(1);
    btn.disabled = true;
    fileAttente = fileAttente.then(async () => {
      try {
        let res;
        try {
          const lien = await catboxDepuisUrl(url);
          res = {
            hebergeur: 'catbox',
            nom: decodeURIComponent(url.split(/[?#]/)[0].split('/').pop() || '') || lien.split('/').pop(),
            url: lien,
            type: IS.EXT_VIDEO.test(lien) ? 'video' : 'image',
            date: Date.now(),
          };
        } catch {
          ligne.etat(t('Catbox indisponible, envoi sur NoelShack...', 'Catbox unavailable, trying NoelShack...'));
          res = await noelshackDepuisUrl(url);
        }
        ligne.ok(res);
        IS.ajouterHisto(res);
        $('#input-url').value = '';
      } catch (err) {
        ligne.erreur(err.message);
      } finally {
        btn.disabled = false;
      }
    });
    blocFile.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  // ---------- Events ----------
  zone.addEventListener('click', () => inputFichiers.click());
  zone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputFichiers.click(); }
  });
  inputFichiers.addEventListener('change', () => {
    traiterFichiers(inputFichiers.files);
    inputFichiers.value = '';
  });

  // Drag and drop anywhere on the page
  let profondeur = 0;
  const aDesFichiers = (e) => e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files');
  window.addEventListener('dragenter', (e) => {
    if (!aDesFichiers(e)) return;
    profondeur++;
    document.body.classList.add('glisse');
  });
  window.addEventListener('dragleave', (e) => {
    if (!aDesFichiers(e)) return;
    if (--profondeur <= 0) { profondeur = 0; document.body.classList.remove('glisse'); }
  });
  window.addEventListener('dragover', (e) => { if (aDesFichiers(e)) e.preventDefault(); });
  window.addEventListener('drop', (e) => {
    if (!aDesFichiers(e)) return;
    e.preventDefault();
    profondeur = 0;
    document.body.classList.remove('glisse');
    traiterFichiers(e.dataTransfer.files);
  });

  // Paste a screenshot with Ctrl+V
  window.addEventListener('paste', (e) => {
    const items = Array.from(e.clipboardData?.items || []);
    const images = items.filter((i) => i.kind === 'file' && i.type.startsWith('image/')).map((i) => {
      const f = i.getAsFile();
      const ext = (f.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
      return f.name && f.name !== 'image.png' ? f : new File([f], `capture-${Date.now()}.${ext}`, { type: f.type });
    });
    if (images.length) { e.preventDefault(); traiterFichiers(images); }
  });

  // Upload list actions
  $('#copier-tout').addEventListener('click', (e) => {
    e.preventDefault();
    const urls = Array.from(liste.querySelectorAll('.envoi.ok')).map((li) => li.dataset.url).reverse();
    IS.copier(urls.join('\n'), IS.nbLiens(urls.length));
  });
  $('#effacer-liste').addEventListener('click', (e) => {
    e.preventDefault();
    liste.replaceChildren();
    blocFile.hidden = true;
  });

  // /?url=... : upload started from the header bar on another page
  const urlParam = new URLSearchParams(location.search).get('url');
  if (urlParam && /^https?:\/\/.+/i.test(urlParam)) {
    history.replaceState(null, '', location.pathname);
    IS.envoyerUrl(urlParam);
  }
})();
