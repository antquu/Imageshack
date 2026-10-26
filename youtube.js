/*
 * ImageShack by antquu (github.com/antquu)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// YouTube downloader page. The link is sent to /youtube/api, which middleware.js
// relays to the download service on the home VM (vm/yt-service.mjs, yt-dlp) with its
// API key. The service prepares the file, the page follows its progress, then the
// browser downloads the file straight from the VM.
(() => {
  'use strict';

  const t = IS.t;
  const $ = (id) => document.getElementById(id);
  const form = $('yt-form');
  const champ = $('yt-url');
  const bouton = $('yt-bouton');
  const mode = $('yt-mode');
  const qualite = $('yt-qualite');
  const apercu = $('yt-apercu');
  const miniature = $('yt-miniature');
  const etat = $('yt-etat');
  const roue = $('yt-roue');
  const resultat = $('yt-resultat');

  // Labels of the <option> elements in the current language
  document.querySelectorAll('option[data-fr]').forEach((o) => { o.textContent = t(o.dataset.fr, o.dataset.en); });

  // Same spinner as the video player, with grey bars
  for (let i = 0; i < 12; i++) {
    const barre = document.createElement('i');
    barre.style.transform = `rotate(${i * 30}deg)`;
    barre.style.opacity = String(0.15 + (i / 11) * 0.85);
    roue.append(barre);
  }

  mode.addEventListener('change', () => { $('yt-qualite-bloc').hidden = mode.value === 'audio'; });

  // Video id from the usual YouTube link shapes (watch, youtu.be, shorts, embed, live, music)
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

  const MESSAGES = {
    'imageshack.not_configured': ["Le téléchargeur n'est pas encore branché à son serveur.", "The downloader isn't connected to its server yet."],
    'imageshack.unreachable': ['Le serveur de téléchargement ne répond pas. Réessayez plus tard.', "The download server isn't responding. Try again later."],
    'imageshack.job_not_found': ['Ce téléchargement a expiré. Relancez-le.', 'This download has expired. Start it again.'],
    'imageshack.timeout': ['La préparation prend trop de temps. Réessayez avec une qualité plus basse.', 'Preparing the file is taking too long. Try a lower quality.'],
    'error.api.fetch.fail': ["Impossible de récupérer cette vidéo pour le moment. Réessayez plus tard.", "Couldn't fetch this video right now. Try again later."],
    'error.api.link.invalid': ["Ce lien n'est pas reconnu. Vérifiez que c'est bien une vidéo YouTube.", "This link isn't recognized. Check that it's a YouTube video."],
    'error.api.link.unsupported': ["Ce lien n'est pas reconnu. Vérifiez que c'est bien une vidéo YouTube.", "This link isn't recognized. Check that it's a YouTube video."],
    'error.api.content.video.unavailable': ["Cette vidéo n'est pas disponible.", 'This video is not available.'],
    'error.api.content.video.private': ['Cette vidéo est privée.', 'This video is private.'],
    'error.api.content.video.age': ['Cette vidéo est réservée aux adultes et ne peut pas être téléchargée.', "This video is age-restricted and can't be downloaded."],
    'error.api.content.video.live': ['Cette vidéo est en direct. Réessayez quand le direct sera terminé.', 'This video is live. Try again once the stream has ended.'],
    'error.api.content.video.region': ["Cette vidéo n'est pas disponible dans le pays du serveur.", "This video isn't available in the server's country."],
    'error.api.content.too_long': ['Cette vidéo est trop longue (1 heure maximum).', 'This video is too long (1 hour maximum).'],
    'error.api.content.paid': ['Cette vidéo est payante.', 'This video requires a purchase.'],
    'error.api.youtube.drm': ['Cette vidéo est protégée et ne peut pas être téléchargée.', "This video is protected and can't be downloaded."],
    'error.api.youtube.login': ['YouTube bloque le serveur pour le moment. Réessayez dans quelques minutes.', 'YouTube is blocking the server for now. Try again in a few minutes.'],
    'error.api.youtube.token_expired': ['YouTube bloque le serveur pour le moment. Réessayez dans quelques minutes.', 'YouTube is blocking the server for now. Try again in a few minutes.'],
    'error.api.youtube.no_session_tokens': ['YouTube bloque le serveur pour le moment. Réessayez dans quelques minutes.', 'YouTube is blocking the server for now. Try again in a few minutes.'],
    'error.api.rate_exceeded': ['Trop de téléchargements en même temps. Réessayez dans une minute.', 'Too many downloads at once. Try again in a minute.'],
    'error.api.fetch.rate': ['Trop de téléchargements en même temps. Réessayez dans une minute.', 'Too many downloads at once. Try again in a minute.'],
    'error.api.fetch.empty': ['Aucune vidéo trouvée à ce lien.', 'No video found at this link.'],
  };
  const message = (code) => {
    const m = MESSAGES[code] || MESSAGES[String(code).replace(/^(?!error\.api\.|imageshack\.)/, 'error.api.')];
    return m ? t(m[0], m[1]) : t('Le téléchargement a échoué', 'The download failed') + ` (${code}).`;
  };

  function afficherEtat(texte, chargement) {
    etat.textContent = texte;
    roue.hidden = !chargement;
  }

  function lienFichier(url, nom, libelle) {
    const a = document.createElement('a');
    a.className = 'yt-fichier';
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener';
    if (nom) a.download = nom;
    a.textContent = libelle;
    return a;
  }

  // The service prepares the file on the VM: poll its progress until it's ready
  const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));
  async function suivreTravail(statusUrl) {
    const fin = Date.now() + 16 * 60 * 1000;
    while (Date.now() < fin) {
      let e;
      try { e = await (await fetch(statusUrl, { cache: 'no-store' })).json(); } catch { e = null; }
      if (e && e.state === 'done') return { status: 'tunnel', url: e.url, filename: e.filename };
      if (e && (e.state === 'error' || e.status === 'error')) return { status: 'error', error: { code: e.code || (e.error && e.error.code) } };
      if (e && e.state === 'queued') afficherEtat(t("En file d'attente...", 'Waiting in line...'), true);
      else if (e && e.state === 'convert') afficherEtat(t('Assemblage du fichier...', 'Putting the file together...'), true);
      else if (e) afficherEtat(t('Préparation de la vidéo... ', 'Preparing the video... ') + (e.progress || 0) + t(' %', '%'), true);
      await pause(1500);
    }
    return { status: 'error', error: { code: 'imageshack.timeout' } };
  }

  function afficherResultat(r) {
    resultat.replaceChildren();
    if (r.status === 'tunnel' || r.status === 'redirect') {
      afficherEtat(t('Votre fichier est prêt :', 'Your file is ready:'), false);
      const nom = document.createElement('div');
      nom.className = 'yt-nom';
      nom.textContent = r.filename || '';
      resultat.append(nom, lienFichier(r.url, r.filename, t('▼ Enregistrer le fichier', '▼ Save the file')));
    } else if (r.status === 'picker' && Array.isArray(r.picker)) {
      afficherEtat(t('Plusieurs fichiers sont disponibles :', 'Several files are available:'), false);
      r.picker.forEach((p, i) => resultat.append(lienFichier(p.url, null, `▼ ${t('Fichier', 'File')} ${i + 1} (${p.type})`)));
    } else if (r.status === 'error') {
      afficherEtat(message(r.error && r.error.code), false);
      return;
    } else {
      afficherEtat(t("Ce format n'est pas pris en charge. Essayez en MP4 ou en MP3.", "This format isn't supported. Try MP4 or MP3."), false);
      return;
    }
    resultat.hidden = false;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const lien = champ.value.trim();
    const id = idVideo(lien);
    if (!id) {
      IS.toast(t('Collez un lien de vidéo YouTube (youtube.com ou youtu.be).', 'Paste a YouTube video link (youtube.com or youtu.be).'));
      champ.focus();
      return;
    }

    apercu.hidden = false;
    resultat.hidden = true;
    miniature.src = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    afficherEtat(t('Récupération de la vidéo...', 'Fetching the video...'), true);
    bouton.disabled = true;

    try {
      const reponse = await fetch('/youtube/api', {
        method: 'POST',
        headers: { accept: 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify({
          url: `https://www.youtube.com/watch?v=${id}`,
          downloadMode: mode.value,
          videoQuality: qualite.value,
          audioFormat: 'mp3',
          filenameStyle: 'pretty',
          youtubeVideoCodec: 'h264',
          youtubeVideoContainer: 'mp4',
        }),
      });
      let r;
      try { r = await reponse.json(); } catch { r = { status: 'error', error: { code: 'imageshack.unreachable' } }; }
      if (r.status === 'job' && r.statusUrl) r = await suivreTravail(r.statusUrl);
      afficherResultat(r);
    } catch {
      afficherResultat({ status: 'error', error: { code: 'imageshack.unreachable' } });
    } finally {
      bouton.disabled = false;
    }
  });

  // ?url=... prefills the field (and starts right away)
  const param = new URLSearchParams(location.search).get('url');
  if (param) {
    champ.value = param;
    form.requestSubmit();
  }
})();
