/*
 * ImageShack by antquu (github.com/antquu)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Custom video player styled after mid-2000s web players.
// Keyboard: Space/K play, arrows seek 5 s, M mute, F full screen.
// Usage: IS.lecteurVideo({ src, poster, nom, surErreur }) returns the player element.
(() => {
  'use strict';

  const t = IS.t;
  const ICONES = {
    lire: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9-5.5z"/></svg>',
    pause: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 2.5h3v11h-3zM9.5 2.5h3v11h-3z"/></svg>',
    stop: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 3.5h9v9h-9z"/></svg>',
    son: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 6h3l4-3.5v11L5 10H2z"/><path d="M11 5.2a4 4 0 0 1 0 5.6M12.8 3.4a6.5 6.5 0 0 1 0 9.2" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
    muet: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 6h3l4-3.5v11L5 10H2z"/><path d="M11 5.5l4 5M15 5.5l-4 5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
    plein: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
  };

  const format = (s) => {
    if (!isFinite(s) || s < 0) s = 0;
    s = Math.floor(s);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = String(s % 60).padStart(2, '0');
    return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
  };

  function bouton(classe, icone, titre) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'lv-bouton ' + classe;
    b.innerHTML = icone;
    b.title = titre;
    b.setAttribute('aria-label', titre);
    return b;
  }

  function lecteurVideo({ src, poster, nom, surErreur }) {
    const racine = document.createElement('div');
    racine.className = 'lv';
    racine.tabIndex = 0;
    racine.setAttribute('role', 'region');
    racine.setAttribute('aria-label', t('Lecteur vidéo', 'Video player') + (nom ? ' : ' + nom : ''));

    // Screen
    const ecran = document.createElement('div');
    ecran.className = 'lv-ecran';
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.playsInline = true;
    if (poster) video.poster = poster;
    video.src = src;
    const gros = document.createElement('button');
    gros.type = 'button';
    gros.className = 'lv-gros';
    gros.textContent = t('▶ Lire la vidéo', '▶ Play the video');
    // Loading spinner: 12 bars rotating in steps
    const attente = document.createElement('div');
    attente.className = 'lv-attente';
    attente.hidden = true;
    attente.setAttribute('role', 'status');
    const roue = document.createElement('div');
    roue.className = 'lv-roue';
    for (let i = 0; i < 12; i++) {
      const barreRoue = document.createElement('i');
      barreRoue.style.transform = `rotate(${i * 30}deg)`;
      barreRoue.style.opacity = String(0.15 + (i / 11) * 0.85);
      roue.append(barreRoue);
    }
    const texteAttente = document.createElement('span');
    texteAttente.className = 'lv-attente-texte';
    texteAttente.textContent = t('Chargement...', 'Loading...');
    attente.append(roue, texteAttente);
    ecran.append(video, gros, attente);

    // Control bar
    const barre = document.createElement('div');
    barre.className = 'lv-barre';
    const bLecture = bouton('lv-lecture', ICONES.lire, t('Lire', 'Play'));
    const bStop = bouton('lv-stop', ICONES.stop, t('Arrêter', 'Stop'));
    const temps = document.createElement('span');
    temps.className = 'lv-temps';
    temps.textContent = '0:00 / 0:00';

    const piste = document.createElement('div');
    piste.className = 'lv-piste';
    piste.tabIndex = 0;
    piste.setAttribute('role', 'slider');
    piste.setAttribute('aria-label', t('Position dans la vidéo', 'Position in the video'));
    piste.setAttribute('aria-valuemin', '0');
    const tampon = document.createElement('div');
    tampon.className = 'lv-tampon';
    const avance = document.createElement('div');
    avance.className = 'lv-avance';
    const curseur = document.createElement('div');
    curseur.className = 'lv-curseur';
    piste.append(tampon, avance, curseur);

    const bSon = bouton('lv-son', ICONES.son, t('Couper le son', 'Mute'));
    const volume = document.createElement('input');
    volume.type = 'range';
    volume.className = 'lv-volume';
    volume.min = '0';
    volume.max = '1';
    volume.step = '0.05';
    volume.value = '1';
    volume.setAttribute('aria-label', t('Volume', 'Volume'));
    const bPlein = bouton('lv-plein', ICONES.plein, t('Plein écran', 'Full screen'));
    const marque = document.createElement('span');
    marque.className = 'lv-marque';
    marque.innerHTML = 'image<b>shack</b> player';

    barre.append(bLecture, bStop, temps, piste, bSon, volume, bPlein, marque);
    racine.append(ecran, barre);

    // Starting from the beginning shows the spinner for a moment first
    const ATTENTE_DEPART = 1800;
    let demarrage = false;
    const roulette = (oui) => { attente.hidden = !oui; };
    const lire = () => {
      if (demarrage) return;
      const depuisDebut = video.ended || video.currentTime === 0;
      if (!depuisDebut) { video.play().catch(() => {}); return; }
      demarrage = true;
      roulette(true);
      majLecture();
      video.preload = 'auto';
      video.load(); // start buffering while the spinner turns
      setTimeout(() => {
        video.play().catch(() => {
          demarrage = false;
          roulette(false);
          majLecture();
        });
      }, ATTENTE_DEPART);
    };
    const basculer = () => (video.paused || video.ended ? lire() : video.pause());

    function majLecture() {
      const enPause = video.paused || video.ended;
      bLecture.innerHTML = enPause ? ICONES.lire : ICONES.pause;
      const titre = enPause ? t('Lire', 'Play') : t('Pause', 'Pause');
      bLecture.title = titre;
      bLecture.setAttribute('aria-label', titre);
      gros.hidden = !enPause || demarrage;
      gros.textContent = video.ended ? t('↻ Revoir la vidéo', '↻ Watch again') : video.currentTime > 0 ? t('▶ Reprendre', '▶ Resume') : t('▶ Lire la vidéo', '▶ Play the video');
      racine.classList.toggle('lv-en-lecture', !enPause);
    }
    function majTemps() {
      const d = video.duration || 0;
      const p = d ? video.currentTime / d : 0;
      avance.style.width = p * 100 + '%';
      curseur.style.left = p * 100 + '%';
      temps.textContent = `${format(video.currentTime)} / ${format(d)}`;
      piste.setAttribute('aria-valuemax', String(Math.floor(d)));
      piste.setAttribute('aria-valuenow', String(Math.floor(video.currentTime)));
      piste.setAttribute('aria-valuetext', format(video.currentTime));
    }
    function majTampon() {
      const d = video.duration;
      if (!d || !video.buffered.length) return;
      tampon.style.width = (video.buffered.end(video.buffered.length - 1) / d) * 100 + '%';
    }
    function majSon() {
      const muet = video.muted || video.volume === 0;
      bSon.innerHTML = muet ? ICONES.muet : ICONES.son;
      const titre = muet ? t('Remettre le son', 'Unmute') : t('Couper le son', 'Mute');
      bSon.title = titre;
      bSon.setAttribute('aria-label', titre);
      volume.value = video.muted ? '0' : String(video.volume);
      volume.style.setProperty('--niveau', (video.muted ? 0 : video.volume) * 100 + '%');
    }

    gros.addEventListener('click', lire);
    video.addEventListener('click', basculer);
    bLecture.addEventListener('click', basculer);
    bStop.addEventListener('click', () => { video.pause(); video.currentTime = 0; });
    bSon.addEventListener('click', () => {
      if (video.muted || video.volume === 0) { video.muted = false; if (video.volume === 0) video.volume = 0.5; }
      else video.muted = true;
    });
    volume.addEventListener('input', () => { video.volume = Number(volume.value); video.muted = video.volume === 0; });
    bPlein.addEventListener('click', () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else if (racine.requestFullscreen) racine.requestFullscreen();
      else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen(); // iOS
    });

    // Seek bar: click or drag
    const allerA = (e) => {
      const r = piste.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      if (video.duration) video.currentTime = p * video.duration;
    };
    piste.addEventListener('pointerdown', (e) => {
      piste.setPointerCapture(e.pointerId);
      piste.classList.add('lv-glisse');
      allerA(e);
    });
    piste.addEventListener('pointermove', (e) => { if (piste.hasPointerCapture(e.pointerId)) allerA(e); });
    piste.addEventListener('pointerup', () => piste.classList.remove('lv-glisse'));

    racine.addEventListener('keydown', (e) => {
      if (e.target === volume) return;
      const k = e.key.toLowerCase();
      if (k === ' ' || k === 'k') { e.preventDefault(); basculer(); }
      else if (k === 'arrowright') { e.preventDefault(); video.currentTime = Math.min(video.duration || 0, video.currentTime + 5); }
      else if (k === 'arrowleft') { e.preventDefault(); video.currentTime = Math.max(0, video.currentTime - 5); }
      else if (k === 'm') { e.preventDefault(); bSon.click(); }
      else if (k === 'f') { e.preventDefault(); bPlein.click(); }
    });

    video.addEventListener('play', majLecture);
    video.addEventListener('pause', majLecture);
    video.addEventListener('ended', majLecture);
    video.addEventListener('timeupdate', majTemps);
    video.addEventListener('loadedmetadata', () => { majTemps(); majTampon(); });
    video.addEventListener('durationchange', majTemps);
    video.addEventListener('progress', majTampon);
    video.addEventListener('volumechange', majSon);
    video.addEventListener('waiting', () => roulette(true));
    video.addEventListener('seeking', () => { if (!video.paused) roulette(true); });
    video.addEventListener('playing', () => { demarrage = false; roulette(false); majLecture(); });
    video.addEventListener('canplay', () => { if (!demarrage) roulette(false); });
    video.addEventListener('error', () => { if (surErreur) surErreur(racine); });
    // Full screen: the control bar hides after 2.5 s of inactivity
    let minuteurBarre;
    const montrerBarre = () => {
      racine.classList.remove('lv-barre-cachee');
      clearTimeout(minuteurBarre);
      if (!racine.classList.contains('lv-plein-ecran')) return;
      minuteurBarre = setTimeout(() => {
        if (!video.paused && !barre.matches(':hover')) racine.classList.add('lv-barre-cachee');
      }, 2500);
    };
    ['mousemove', 'pointerdown', 'keydown', 'touchstart'].forEach((ev) => racine.addEventListener(ev, montrerBarre));
    video.addEventListener('pause', montrerBarre);
    video.addEventListener('play', montrerBarre);
    document.addEventListener('fullscreenchange', () => {
      racine.classList.toggle('lv-plein-ecran', document.fullscreenElement === racine);
      montrerBarre();
    });

    majLecture();
    majSon();
    return racine;
  }

  IS.lecteurVideo = lecteurVideo;
})();
