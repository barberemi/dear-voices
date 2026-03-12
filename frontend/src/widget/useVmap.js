import { useState, useRef, useEffect, useCallback } from 'react';

// ─── Utilitaires ──────────────────────────────────────────────────────────────
function vastTimeToSeconds(str = '') {
  if (!str) return null;
  const parts = str.trim().split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return null;
}

// Parse un élément DOM VAST (ou un fragment du document VMAP) →
// retourne les données de l'annonce ou null
function parseVastFromEl(root) {
  try {
    const wrapper = root.querySelector('VASTAdTagURI');
    if (wrapper) return { wrapperUrl: wrapper.textContent.trim() };

    const mediaFiles = Array.from(root.querySelectorAll('MediaFile'));
    const audioFile  = mediaFiles.find(mf => {
      const type = (mf.getAttribute('type') || '').toLowerCase();
      return ['audio', 'mp3', 'wav', 'ogg', 'aac'].some(t => type.includes(t));
    }) || mediaFiles[0];
    if (!audioFile) return null;

    const url = audioFile.textContent.trim();

    const trackers = {};
    root.querySelectorAll('Tracking').forEach(t => {
      const event = t.getAttribute('event');
      if (!trackers[event]) trackers[event] = [];
      trackers[event].push(t.textContent.trim());
    });

    const impression   = root.querySelector('Impression')?.textContent?.trim();
    const clickThrough = root.querySelector('ClickThrough')?.textContent?.trim();
    const vastDuration = vastTimeToSeconds(root.querySelector('Duration')?.textContent?.trim());

    const linear     = root.querySelector('Linear');
    const skipRaw    = linear?.getAttribute('skipoffset') || '';
    const skipOffset = skipRaw.endsWith('%') ? skipRaw : vastTimeToSeconds(skipRaw);

    const companionEl = root.querySelector('Companion');
    let companion = null;
    if (companionEl) {
      const imgUrl   = companionEl.querySelector('StaticResource')?.textContent?.trim();
      const clickUrl = companionEl.querySelector('CompanionClickThrough')?.textContent?.trim();
      const width    = companionEl.getAttribute('width');
      const height   = companionEl.getAttribute('height');
      if (imgUrl) companion = { imgUrl, clickUrl: clickUrl || null, width, height };
    }

    return { url, trackers, impression, clickThrough, vastDuration, skipOffset, companion };
  } catch {
    return null;
  }
}

// Parse le XML VMAP → tableau de breaks { offset, adData }
// offset : 'start' | 'end' | number (secondes) | string (ex : '50%')
function parseVmap(xmlText) {
  try {
    const parser  = new DOMParser();
    const doc     = parser.parseFromString(xmlText, 'text/xml');
    const NS_VMAP = 'http://www.iab.net/vmap-1.0';

    const breaks   = [];
    const breakEls = doc.getElementsByTagNameNS(NS_VMAP, 'AdBreak');

    Array.from(breakEls).forEach(breakEl => {
      const timeOffset  = breakEl.getAttribute('timeOffset') || '';
      const vastDataEl  = breakEl.getElementsByTagNameNS(NS_VMAP, 'VASTAdData')[0];
      if (!vastDataEl) return;

      const adData = parseVastFromEl(vastDataEl);
      if (!adData?.url) return;

      let offset;
      if      (timeOffset === 'start')       offset = 'start';
      else if (timeOffset === 'end')         offset = 'end';
      else if (timeOffset.endsWith('%'))     offset = timeOffset;           // ex : '50%'
      else                                   offset = vastTimeToSeconds(timeOffset); // ex : '00:01:30'

      breaks.push({ offset, adData });
    });

    return breaks;
  } catch {
    return [];
  }
}

function fireTrackers(list = []) {
  list.forEach(url => { try { fetch(url, { mode: 'no-cors' }); } catch {} });
}

// ─── Hook useVmap ─────────────────────────────────────────────────────────────
/**
 * Gère le cycle de vie complet d'une campagne VMAP (pre/mid/post-roll).
 *
 * @param {string}   vmapUrl         - URL du tag VMAP (vide = pas de pub)
 * @param {Function} onPreRollEnded  - Appelé quand le pre-roll se termine → lancer le contenu
 * @param {Function} onMidRollStart  - Appelé quand un mid-roll démarre   → pauser le contenu
 * @param {Function} onMidRollEnded  - Appelé quand un mid-roll se termine → reprendre le contenu
 * @param {Function} onPostRollEnded - Appelé quand le post-roll se termine → reset du contenu
 */
export function useVmap(vmapUrl, {
  onPreRollEnded  = null,
  onMidRollStart  = null,
  onMidRollEnded  = null,
  onPostRollEnded = null,
} = {}) {
  const adRef           = useRef(null);
  const startedRef      = useRef(false);  // tracking "start" envoyé ?
  const currentBreakRef = useRef(null);   // index du break en cours (ref = jamais stale)
  const adEndedRef      = useRef(false);  // guard anti-double-appel de endAd

  // ── Données VMAP chargées ───────────────────────────────────────────────
  const [adBreaks,     setAdBreaks]     = useState([]); // [{offset, adData}]
  const [playedBreaks, setPlayedBreaks] = useState(new Set()); // indices des breaks joués

  // ── État de la pub en cours ─────────────────────────────────────────────
  const [currentBreak,  setCurrentBreak]  = useState(null); // index dans adBreaks
  const [adState,       setAdState]       = useState('idle'); // idle|loading|playing|done|error
  const [adAudioUrl,    setAdAudioUrl]    = useState('');
  const [adCurrentTime, setAdCurrentTime] = useState(0);
  const [adDuration,    setAdDuration]    = useState(0);
  const [adMaxDuration, setAdMaxDuration] = useState(null);
  const [adSkipOffset,  setAdSkipOffset]  = useState(null);
  const [adTrackers,    setAdTrackers]    = useState({});
  const [adClickUrl,    setAdClickUrl]    = useState('');
  const [canSkip,       setCanSkip]       = useState(false);
  const [companion,     setCompanion]     = useState(null);

  const isAdPlaying = adState === 'playing';

  // Dérivés sur les breaks disponibles
  const preRollIdx   = adBreaks.findIndex(b => b.offset === 'start');
  const postRollIdx  = adBreaks.findIndex(b => b.offset === 'end');
  const hasPreRoll   = preRollIdx  !== -1;
  const hasPostRoll  = postRollIdx !== -1;
  const preRollPlayed  = hasPreRoll  && playedBreaks.has(preRollIdx);
  const postRollPlayed = hasPostRoll && playedBreaks.has(postRollIdx);

  // ── Chargement VMAP au montage ──────────────────────────────────────────
  useEffect(() => {
    if (!vmapUrl) return;
    fetch(vmapUrl)
      .then(r => r.text())
      .then(xml => setAdBreaks(parseVmap(xml)))
      .catch(() => {});
  }, [vmapUrl]);

  // ── Lance la lecture dès que l'<audio> pub et l'URL sont prêts ─────────
  useEffect(() => {
    if (adState === 'playing' && adAudioUrl && adRef.current) {
      adRef.current.play().catch(() => setAdState('error'));
    }
  }, [adState, adAudioUrl]);

  // ── Applique les données d'un break à l'état de la pub ─────────────────
  const applyBreak = useCallback((idx) => {
    const { adData } = adBreaks[idx];
    setAdAudioUrl(adData.url);
    setAdTrackers(adData.trackers || {});
    setAdClickUrl(adData.clickThrough || '');
    if (adData.impression) fireTrackers([adData.impression]);
    if (adData.vastDuration) {
      setAdMaxDuration(adData.vastDuration);
      setAdDuration(adData.vastDuration);
    } else {
      setAdMaxDuration(null);
      setAdDuration(0);
    }
    setAdSkipOffset(adData.skipOffset ?? null);
    setCompanion(adData.companion ?? null);
    setAdCurrentTime(0);
    setCanSkip(false);
    startedRef.current = false;
    adEndedRef.current = false;        // réarme le guard pour ce break
    currentBreakRef.current = idx;     // mise à jour immédiate (pas de stale closure)
    setCurrentBreak(idx);
    // Marque immédiatement comme joué pour éviter double-déclenchement
    setPlayedBreaks(prev => { const s = new Set(prev); s.add(idx); return s; });
    // Repart toujours depuis le début, même si l'élément <audio> existait déjà
    if (adRef.current) adRef.current.currentTime = 0;
    setAdState('playing');
  }, [adBreaks]);

  // ── Fin d'une pub (naturelle ou skip) ──────────────────────────────────
  // Utilise currentBreakRef (ref) plutôt que l'état currentBreak pour éviter
  // tout problème de stale closure, et adEndedRef pour rejeter les double-appels.
  const endAd = useCallback((isSkip = false) => {
    if (adEndedRef.current) return; // double-appel → on ignore
    adEndedRef.current = true;

    fireTrackers(isSkip ? adTrackers['skip'] : adTrackers['complete']);

    const idx    = currentBreakRef.current;
    const offset = idx !== null ? adBreaks[idx]?.offset : null;
    currentBreakRef.current = null;

    setAdState('done');
    setAdAudioUrl('');   // démonte l'élément <audio> pub → empêche tout onEnded parasite
    setCanSkip(false);
    setCompanion(null);
    setCurrentBreak(null);
    startedRef.current = false;

    if      (offset === 'start') onPreRollEnded?.();
    else if (offset === 'end')   onPostRollEnded?.();
    else if (offset !== null)    onMidRollEnded?.();
    // si offset === null (break introuvable), on ne fait rien
  }, [adTrackers, adBreaks, onPreRollEnded, onMidRollEnded, onPostRollEnded]);

  // ── API publique : lancer pre/post-roll ────────────────────────────────
  const loadPreRoll = useCallback(() => {
    if (preRollIdx !== -1 && !playedBreaks.has(preRollIdx)) {
      setAdState('loading');
      applyBreak(preRollIdx);
    }
  }, [preRollIdx, playedBreaks, applyBreak]);

  const loadPostRoll = useCallback(() => {
    if (postRollIdx !== -1 && !playedBreaks.has(postRollIdx)) {
      setAdState('loading');
      applyBreak(postRollIdx);
    }
  }, [postRollIdx, playedBreaks, applyBreak]);

  // ── Vérification mid-roll (appelée par Widget sur chaque timeUpdate) ────
  const checkMidRoll = useCallback((currentTime, duration) => {
    if (isAdPlaying || adState === 'loading') return;
    if (!duration || duration <= 0) return;

    for (let i = 0; i < adBreaks.length; i++) {
      if (playedBreaks.has(i)) continue;
      const { offset } = adBreaks[i];
      if (offset === 'start' || offset === 'end') continue;

      let threshold;
      if (typeof offset === 'string' && offset.endsWith('%')) {
        threshold = (parseFloat(offset) / 100) * duration;
      } else if (typeof offset === 'number') {
        threshold = offset;
      } else continue;

      if (currentTime >= threshold) {
        onMidRollStart?.();
        setAdState('loading');
        applyBreak(i);
        return;
      }
    }
  }, [adBreaks, playedBreaks, isAdPlaying, adState, onMidRollStart, applyBreak]);

  // ── Handlers pour l'élément <audio> de la pub ─────────────────────────
  const handleAdLoaded = () => {
    const realDur = adRef.current?.duration || 0;
    setAdDuration(prev    => prev > 0 ? prev : realDur);
    setAdMaxDuration(prev => prev !== null ? prev : realDur);
    setAdSkipOffset(prev  => {
      if (typeof prev === 'string' && prev.endsWith('%'))
        return Math.round((parseFloat(prev) / 100) * realDur);
      return prev;
    });
  };

  const handleAdTimeUpdate = () => {
    const a = adRef.current;
    if (!a?.duration) return;
    setAdCurrentTime(a.currentTime);

    if (adSkipOffset !== null && a.currentTime >= adSkipOffset) setCanSkip(true);

    if (adMaxDuration !== null && a.currentTime >= adMaxDuration) {
      a.pause();
      endAd(false);
      return;
    }

    if (!startedRef.current && a.currentTime > 0) {
      startedRef.current = true;
      fireTrackers(adTrackers['start']);
    }
    const dur = adMaxDuration ?? a.duration;
    const pct = a.currentTime / dur;
    if (pct >= 0.25 && pct < 0.26) fireTrackers(adTrackers['firstQuartile']);
    if (pct >= 0.50 && pct < 0.51) fireTrackers(adTrackers['midpoint']);
    if (pct >= 0.75 && pct < 0.76) fireTrackers(adTrackers['thirdQuartile']);
  };

  const handleAdEnded = () => endAd(false);
  const handleSkip    = () => {
    if (canSkip && adRef.current) { adRef.current.pause(); endAd(true); }
  };

  // Données calculées pour l'UI
  const adRemaining   = adDuration > 0 ? Math.max(0, Math.ceil(adDuration - adCurrentTime)) : null;
  const adProgress    = adDuration > 0 ? Math.min(100, (adCurrentTime / adDuration) * 100) : 0;
  const skipCountdown = adSkipOffset !== null && !canSkip
    ? Math.max(0, Math.ceil(adSkipOffset - adCurrentTime))
    : null;

  return {
    adRef,
    adState, isAdPlaying,
    hasPreRoll, hasPostRoll, preRollPlayed, postRollPlayed,
    adAudioUrl, adClickUrl, companion,
    adRemaining, adProgress, adSkipOffset, canSkip, skipCountdown,
    loadPreRoll, loadPostRoll, checkMidRoll, handleSkip,
    handleAdLoaded, handleAdTimeUpdate, handleAdEnded,
  };
}
