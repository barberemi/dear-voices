import { useState, useRef, useEffect, useCallback } from 'react';

// ─── Utilitaire : parse un VAST XML et retourne le premier MediaFile audio ───
function parseVast(xmlText) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'text/xml');

    // Suit les redirections InLine / Wrapper (1 niveau)
    const wrapper = doc.querySelector('VASTAdTagURI');
    if (wrapper) return { wrapperUrl: wrapper.textContent.trim() };

    // Cherche un MediaFile audio (mp3, wav, ogg, aac…)
    const mediaFiles = Array.from(doc.querySelectorAll('MediaFile'));
    const audioFile = mediaFiles.find(mf => {
      const type = (mf.getAttribute('type') || '').toLowerCase();
      return type.includes('audio') || type.includes('mp3') || type.includes('wav') || type.includes('ogg') || type.includes('aac');
    }) || mediaFiles[0]; // fallback sur le premier si aucun audio explicite

    if (!audioFile) return null;

    const url = audioFile.textContent.trim();

    // Récupère les pixels de tracking (Impression, Start, Complete…)
    const trackers = {};
    doc.querySelectorAll('Tracking').forEach(t => {
      const event = t.getAttribute('event');
      if (!trackers[event]) trackers[event] = [];
      trackers[event].push(t.textContent.trim());
    });
    const impression = doc.querySelector('Impression')?.textContent?.trim();
    const clickThrough = doc.querySelector('ClickThrough')?.textContent?.trim();

    return { url, trackers, impression, clickThrough };
  } catch {
    return null;
  }
}

function fireTrackers(list = []) {
  list.forEach(url => { try { fetch(url, { mode: 'no-cors' }); } catch {} });
}

// ─── Composant principal ─────────────────────────────────────────────────────
export default function Widget({ audioUrl, duration = 0, vastUrl = '' }) {
  const audioRef    = useRef(null);
  const progressRef = useRef(null);

  // État audio principal
  const [isPlaying,    setIsPlaying]    = useState(false);
  const [currentTime,  setCurrentTime]  = useState(0);
  const [totalDuration,setTotalDuration]= useState(duration);
  const [progress,     setProgress]     = useState(0);

  // État VAST / pub
  const [adState,      setAdState]      = useState('idle'); // idle | loading | playing | done | error
  const [adAudioUrl,   setAdAudioUrl]   = useState('');
  const [adCurrentTime,setAdCurrentTime]= useState(0);
  const [adDuration,   setAdDuration]   = useState(0);
  const [adTrackers,   setAdTrackers]   = useState({});
  const [adClickUrl,   setAdClickUrl]   = useState('');
  const adRef = useRef(null);
  const adStartedRef = useRef(false); // tracking "start" envoyé une seule fois
  const adMaxDuration = 10; // secondes max pour la pub

  const isAdPlaying = adState === 'playing';
  const hasAd = !!vastUrl;

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setProgress(0);
  }, [audioUrl]);

  // ── Charge et parse le VAST ───────────────────────────────────────────────
  const loadVast = useCallback(async (url) => {
    setAdState('loading');
    try {
      let vastXml;
      const res = await fetch(url);
      vastXml = await res.text();
      let parsed = parseVast(vastXml);

      // Un seul niveau de wrapper
      if (parsed?.wrapperUrl) {
        const res2 = await fetch(parsed.wrapperUrl);
        vastXml = await res2.text();
        parsed = parseVast(vastXml);
      }

      if (!parsed?.url) { setAdState('done'); return; }

      setAdAudioUrl(parsed.url);
      setAdTrackers(parsed.trackers || {});
      setAdClickUrl(parsed.clickThrough || '');
      if (parsed.impression) fireTrackers([parsed.impression]);
      setAdState('playing');
    } catch {
      setAdState('error');
    }
  }, []);

  // ── Quand l'élément <audio> de la pub est prêt, on le lance ───────────────
  useEffect(() => {
    if (adState === 'playing' && adAudioUrl && adRef.current) {
      adRef.current.play().catch(() => setAdState('error'));
    }
  }, [adState, adAudioUrl]);

  // ── Événements audio pub ──────────────────────────────────────────────────
  const handleAdTimeUpdate = () => {
    const a = adRef.current;
    if (!a?.duration) return;
    setAdCurrentTime(a.currentTime);
    setAdDuration(Math.min(a.duration, adMaxDuration));

    // Coupe la pub si elle dépasse adMaxDuration secondes
    if (a.currentTime >= adMaxDuration) {
      a.pause();
      handleAdEnded();
      return;
    }

    // Tracking IAB
    if (!adStartedRef.current && a.currentTime > 0) {
      adStartedRef.current = true;
      fireTrackers(adTrackers['start']);
    }
    const pct = a.currentTime / a.duration;
    if (pct >= 0.25 && pct < 0.26) fireTrackers(adTrackers['firstQuartile']);
    if (pct >= 0.50 && pct < 0.51) fireTrackers(adTrackers['midpoint']);
    if (pct >= 0.75 && pct < 0.76) fireTrackers(adTrackers['thirdQuartile']);
  };

  const handleAdEnded = () => {
    fireTrackers(adTrackers['complete']);
    setAdState('done');
    adStartedRef.current = false;
    // Enchaîne avec l'audio principal
    const audio = audioRef.current;
    if (audio) {
      audio.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleAdLoaded = () => {
    const dur = adRef.current?.duration || 0;
    setAdDuration(Math.min(dur, adMaxDuration));
  };

  // ── Événements audio principal ────────────────────────────────────────────
  const togglePlay = () => {
    // Pub en cours ou en chargement VAST → rien du tout
    if (adState === 'loading' || isAdPlaying) return;

    const audio = audioRef.current;
    if (!audio) return;

    // Sans VAST (ou erreur VAST) : play/pause classique dès le premier clic
    if (!hasAd || adState === 'error') {
      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
      } else {
        audio.play().catch(() => {});
        setIsPlaying(true);
      }
      return;
    }

    // Avec VAST, premier clic → démarre la pub
    if (adState === 'idle') { loadVast(vastUrl); return; }

    // Pub terminée → play/pause classique sur le WAV
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio?.duration) return;
    setCurrentTime(audio.currentTime);
    setProgress((audio.currentTime / audio.duration) * 100);
  };

  const handleLoadedMetadata = () => {
    setTotalDuration(audioRef.current?.duration || duration);
  };

  const handleCanPlay = () => {};

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    setProgress(0);
    if (audioRef.current) audioRef.current.currentTime = 0;
  };

  const handleProgressClick = (e) => {
    if (isAdPlaying) return; // pas de scrub pendant la pub
    const bar = progressRef.current;
    if (!bar || !audioRef.current?.duration) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    audioRef.current.currentTime = ratio * audioRef.current.duration;
    setProgress(ratio * 100);
  };

  const fmt = (s) => {
    if (!s || isNaN(s)) return '0:00';
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  };

  const adRemaining = adDuration > 0 ? Math.max(0, Math.ceil(adDuration - adCurrentTime)) : null;
  const adProgress  = adDuration > 0 ? (adCurrentTime / adDuration) * 100 : 0;

  const showAdOverlay = adState === 'loading' || isAdPlaying;

  // Pendant la pub/chargement VAST → bouton désactivé, icône pause fixe
  // Après la pub → icône reflète l'état du WAV
  const isAdActive  = adState === 'loading' || isAdPlaying;
  const showPause   = isAdActive || isPlaying;
  const btnDisabled = isAdActive;

  return (
    <div className={`dv-widget ${showAdOverlay ? 'dv-widget--ad' : ''}`}>
      {/* Audio pub (invisible) */}
      {adAudioUrl && (
        <audio
          ref={adRef}
          src={adAudioUrl}
          onTimeUpdate={handleAdTimeUpdate}
          onLoadedMetadata={handleAdLoaded}
          onEnded={handleAdEnded}
          preload="auto"
        />
      )}

      {/* Audio principal */}
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onCanPlay={handleCanPlay}
        onEnded={handleEnded}
        preload="metadata"
      />

      {/* Bouton play / pause */}
      <div className="dv-left">
        <button
          className={`dv-play ${btnDisabled ? 'dv-play--disabled' : ''}`}
          onClick={togglePlay}
          disabled={btnDisabled}
          aria-label={showPause ? 'Pause' : 'Play'}
        >
          {showPause ? (
            <svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
          )}
        </button>
      </div>

      <div className="dv-right">
        {/* ── Barre de pub ── */}
        {showAdOverlay && (
          <div className="dv-ad-overlay">
            <div className="dv-ad-bar">
              <div className="dv-ad-fill" style={{ width: `${adProgress}%` }} />
            </div>
            <div className="dv-ad-meta">
              <span className="dv-ad-badge">
                {adClickUrl
                  ? <a href={adClickUrl} target="_blank" rel="noreferrer" className="dv-ad-link">Publicité</a>
                  : 'Publicité'}
              </span>
              {adRemaining !== null && (
                <span className="dv-ad-remaining">
                  {adState === 'loading' ? '…' : `${adRemaining}s`}
                </span>
              )}
            </div>
          </div>
        )}

        {/* ── Timeline principale (masquée pendant la pub) ── */}
        {!showAdOverlay && (
          <div className="dv-timeline">
            <div
              className="dv-bar"
              ref={progressRef}
              onClick={handleProgressClick}
            >
              <div className="dv-fill" style={{ width: `${progress}%` }} />
              <div className="dv-thumb" style={{ left: `${progress}%` }} />
            </div>
            <div className="dv-times">
              <span>{fmt(currentTime)}</span>
              <span>{fmt(totalDuration)}</span>
            </div>
          </div>
        )}
      </div>

      <a className="dv-brand" href="https://dearvoices.com" target="_blank" rel="noreferrer">
        🎙
      </a>
    </div>
  );
}
