import { useState, useRef, useEffect, useCallback } from 'react';

// ─── Convertit "HH:MM:SS" ou "MM:SS" en secondes ────────────────────────────
function vastTimeToSeconds(str = '') {
  if (!str) return null;
  const parts = str.trim().split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return null;
}

// ─── Parse le XML VAST ───────────────────────────────────────────────────────
function parseVast(xmlText) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'text/xml');

    const wrapper = doc.querySelector('VASTAdTagURI');
    if (wrapper) return { wrapperUrl: wrapper.textContent.trim() };

    const mediaFiles = Array.from(doc.querySelectorAll('MediaFile'));
    const audioFile = mediaFiles.find(mf => {
      const type = (mf.getAttribute('type') || '').toLowerCase();
      return ['audio', 'mp3', 'wav', 'ogg', 'aac'].some(t => type.includes(t));
    }) || mediaFiles[0];

    if (!audioFile) return null;

    const url = audioFile.textContent.trim();

    const trackers = {};
    doc.querySelectorAll('Tracking').forEach(t => {
      const event = t.getAttribute('event');
      if (!trackers[event]) trackers[event] = [];
      trackers[event].push(t.textContent.trim());
    });

    const impression   = doc.querySelector('Impression')?.textContent?.trim();
    const clickThrough = doc.querySelector('ClickThrough')?.textContent?.trim();
    const vastDuration = vastTimeToSeconds(doc.querySelector('Duration')?.textContent?.trim());

    const linear  = doc.querySelector('Linear');
    const skipRaw = linear?.getAttribute('skipoffset') || '';
    const skipOffset = skipRaw.endsWith('%')
      ? skipRaw
      : vastTimeToSeconds(skipRaw);

    // ── Companion banner (image affichée à côté du player) ──────────────────
    const companionEl  = doc.querySelector('Companion');
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

function fireTrackers(list = []) {
  list.forEach(url => { try { fetch(url, { mode: 'no-cors' }); } catch {} });
}

// ─── Hook useVast ────────────────────────────────────────────────────────────
/**
 * Gère le cycle de vie complet d'une pub VAST audio :
 *   chargement XML → lecture → tracking IAB → skip → enchaînement audio principal
 *
 * @param {string}   vastUrl    - URL du tag VAST (vide = pas de pub)
 * @param {Function} onAdEnded  - callback appelé quand la pub est terminée/skippée
 */
export function useVast(vastUrl, onAdEnded) {
  const adRef        = useRef(null);
  const startedRef   = useRef(false);

  // État de la pub
  const [adState,       setAdState]      = useState('idle'); // idle|loading|playing|done|error
  const [adAudioUrl,    setAdAudioUrl]   = useState('');
  const [adCurrentTime, setAdCurrentTime]= useState(0);
  const [adDuration,    setAdDuration]   = useState(0);
  const [adMaxDuration, setAdMaxDuration]= useState(null);
  const [adSkipOffset,  setAdSkipOffset] = useState(null);
  const [adTrackers,    setAdTrackers]   = useState({});
  const [adClickUrl,    setAdClickUrl]   = useState('');
  const [canSkip,       setCanSkip]      = useState(false);
  const [companion,     setCompanion]    = useState(null); // { imgUrl, clickUrl, width, height }

  const isAdPlaying = adState === 'playing';
  const hasAd       = !!vastUrl;

  // Lance la pub quand l'élément <audio> est monté et l'URL prête
  useEffect(() => {
    if (adState === 'playing' && adAudioUrl && adRef.current) {
      adRef.current.play().catch(() => setAdState('error'));
    }
  }, [adState, adAudioUrl]);

  // ── Chargement + parse du VAST ───────────────────────────────────────────
  const loadVast = useCallback(async () => {
    if (!vastUrl) return;
    setAdState('loading');
    try {
      let xml = await fetch(vastUrl).then(r => r.text());
      let parsed = parseVast(xml);

      // Résolution d'un seul niveau de Wrapper
      if (parsed?.wrapperUrl) {
        xml    = await fetch(parsed.wrapperUrl).then(r => r.text());
        parsed = parseVast(xml);
      }

      if (!parsed?.url) { setAdState('done'); return; }

      setAdAudioUrl(parsed.url);
      setAdTrackers(parsed.trackers || {});
      setAdClickUrl(parsed.clickThrough || '');
      if (parsed.impression) fireTrackers([parsed.impression]);
      if (parsed.vastDuration) {
        setAdMaxDuration(parsed.vastDuration);
        setAdDuration(parsed.vastDuration);
      }
      if (parsed.skipOffset !== null) setAdSkipOffset(parsed.skipOffset);
      if (parsed.companion)           setCompanion(parsed.companion);

      setAdState('playing');
    } catch {
      setAdState('error');
    }
  }, [vastUrl]);

  // ── Fin de pub (naturelle ou skip) ──────────────────────────────────────
  const endAd = useCallback((isSkip = false) => {
    fireTrackers(isSkip ? adTrackers['skip'] : adTrackers['complete']);
    setAdState('done');
    setCanSkip(false);
    setCompanion(null);
    startedRef.current = false;
    onAdEnded?.();
  }, [adTrackers, onAdEnded]);

  // ── Handlers pour l'élément <audio> de la pub ────────────────────────────
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

  const handleAdEnded  = () => endAd(false);
  const handleSkip     = () => { if (canSkip && adRef.current) { adRef.current.pause(); endAd(true); } };

  // Données calculées utiles pour l'UI
  const adRemaining   = adDuration > 0 ? Math.max(0, Math.ceil(adDuration - adCurrentTime)) : null;
  const adProgress    = adDuration > 0 ? Math.min(100, (adCurrentTime / adDuration) * 100) : 0;
  const skipCountdown = adSkipOffset !== null && !canSkip
    ? Math.max(0, Math.ceil(adSkipOffset - adCurrentTime))
    : null;

  return {
    adRef,
    adState, isAdPlaying, hasAd,
    adAudioUrl, adClickUrl,
    companion,
    adRemaining, adProgress, adSkipOffset, canSkip, skipCountdown,
    loadVast, handleSkip,
    handleAdLoaded, handleAdTimeUpdate, handleAdEnded,
  };
}
