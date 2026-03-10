import { useState, useRef, useEffect } from 'react';
import { useVast } from './useVast';
import AdOverlay from './AdOverlay';

// ─── Composant principal ─────────────────────────────────────────────────────
export default function Widget({ audioUrl, duration = 0, vastUrl = '' }) {
  const audioRef    = useRef(null);
  const progressRef = useRef(null);

  const [isPlaying,     setIsPlaying]     = useState(false);
  const [currentTime,   setCurrentTime]   = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration);
  const [progress,      setProgress]      = useState(0);

  // Reset quand l'URL audio change
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setProgress(0);
  }, [audioUrl]);

  // ── Callback appelé par useVast quand la pub se termine ─────────────────
  const handleAdEnded = () => {
    audioRef.current?.play().catch(() => {});
    setIsPlaying(true);
  };

  const vast = useVast(vastUrl, handleAdEnded);

  // ── Contrôles audio WAV ──────────────────────────────────────────────────
  const togglePlay = () => {
    // Pub en cours ou en chargement → rien
    if (vast.adState === 'loading' || vast.isAdPlaying) return;

    const audio = audioRef.current;
    if (!audio) return;

    // Premier clic avec VAST → lance la pub
    if (vast.hasAd && vast.adState === 'idle') {
      vast.loadVast();
      return;
    }

    // Play / pause classique
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    const a = audioRef.current;
    if (!a?.duration) return;
    setCurrentTime(a.currentTime);
    setProgress((a.currentTime / a.duration) * 100);
  };

  const handleLoadedMetadata = () => setTotalDuration(audioRef.current?.duration || duration);

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    setProgress(0);
    if (audioRef.current) audioRef.current.currentTime = 0;
  };

  const handleProgressClick = (e) => {
    if (vast.isAdPlaying) return;
    const bar = progressRef.current;
    if (!bar || !audioRef.current?.duration) return;
    const rect  = bar.getBoundingClientRect();
    const ratio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    audioRef.current.currentTime = ratio * audioRef.current.duration;
    setProgress(ratio * 100);
  };

  const fmt = (s) => {
    if (!s || isNaN(s)) return '0:00';
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  };

  // ── Dérivés UI ───────────────────────────────────────────────────────────
  const showAdOverlay = vast.adState === 'loading' || vast.isAdPlaying;
  const btnDisabled   = showAdOverlay;
  const showPause     = btnDisabled || isPlaying;
  const companion     = vast.companion; // null si pas de Companion dans le VAST

  return (
    <div className={`dv-widget ${showAdOverlay ? 'dv-widget--ad' : ''}`}>

      {/* ── Élément audio de la pub (caché) ── */}
      {vast.adAudioUrl && (
        <audio
          ref={vast.adRef}
          src={vast.adAudioUrl}
          onTimeUpdate={vast.handleAdTimeUpdate}
          onLoadedMetadata={vast.handleAdLoaded}
          onEnded={vast.handleAdEnded}
          preload="auto"
        />
      )}

      {/* ── Élément audio principal ── */}
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        preload="metadata"
      />

      {/* ── Bouton play / pause ── */}
      <div className="dv-left">
        <button
          className={`dv-play ${btnDisabled ? 'dv-play--disabled' : ''}`}
          onClick={togglePlay}
          disabled={btnDisabled}
          aria-label={showPause ? 'Pause' : 'Play'}
        >
          {showPause ? (
            <svg viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16"/>
              <rect x="14" y="4" width="4" height="16"/>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5,3 19,12 5,21"/>
            </svg>
          )}
        </button>
      </div>

      <div className="dv-right">
        {/* ── Barre de pub ── */}
        {showAdOverlay && (
          <AdOverlay
            adState={vast.adState}
            adProgress={vast.adProgress}
            adRemaining={vast.adRemaining}
            adClickUrl={vast.adClickUrl}
            adSkipOffset={vast.adSkipOffset}
            canSkip={vast.canSkip}
            skipCountdown={vast.skipCountdown}
            onSkip={vast.handleSkip}
          />
        )}

        {/* ── Timeline audio principal ── */}
        {!showAdOverlay && (
          <div className="dv-timeline">
            <div className="dv-bar" ref={progressRef} onClick={handleProgressClick}>
              <div className="dv-fill"  style={{ width: `${progress}%` }} />
              <div className="dv-thumb" style={{ left:  `${progress}%` }} />
            </div>
            <div className="dv-times">
              <span>{fmt(currentTime)}</span>
              <span>{fmt(totalDuration)}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Companion (GIF pub) ou brand icon ── */}
      {companion ? (
        companion.clickUrl ? (
          <a href={companion.clickUrl} target="_blank" rel="noreferrer" className="dv-companion">
            <img src={companion.imgUrl} alt="Publicité" className="dv-companion-img" />
          </a>
        ) : (
          <div className="dv-companion">
            <img src={companion.imgUrl} alt="Publicité" className="dv-companion-img" />
          </div>
        )
      ) : (
        <a className="dv-brand" href="https://dearvoices.com" target="_blank" rel="noreferrer">
          🎙
        </a>
      )}
    </div>
  );
}
