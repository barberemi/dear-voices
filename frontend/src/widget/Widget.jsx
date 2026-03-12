import { useState, useRef, useEffect } from 'react';
import { useVmap } from './useVmap';
import AdOverlay from './AdOverlay';

// ─── Composant principal ─────────────────────────────────────────────────────
export default function Widget({ audioUrl, duration = 0, vmapUrl = '' }) {
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

  // ── Callbacks VMAP ────────────────────────────────────────────────────────
  // Pre-roll terminé → lancer le contenu
  const handlePreRollEnded = () => {
    audioRef.current?.play().catch(() => {});
    setIsPlaying(true);
  };

  // Mid-roll démarre → pauser le contenu
  const handleMidRollStart = () => {
    audioRef.current?.pause();
    setIsPlaying(false);
  };

  // Mid-roll terminé → reprendre le contenu
  const handleMidRollEnded = () => {
    audioRef.current?.play().catch(() => {});
    setIsPlaying(true);
  };

  // Post-roll terminé → reset complet
  const handlePostRollEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    setProgress(0);
    if (audioRef.current) {
      audioRef.current.pause();      // certains navigateurs relancent la lecture au seek sur un élément "ended"
      audioRef.current.currentTime = 0;
    }
  };

  const vmap = useVmap(vmapUrl, {
    onPreRollEnded:  handlePreRollEnded,
    onMidRollStart:  handleMidRollStart,
    onMidRollEnded:  handleMidRollEnded,
    onPostRollEnded: handlePostRollEnded,
  });

  // ── Contrôles audio principal ─────────────────────────────────────────────
  const togglePlay = () => {
    // Pub en cours ou en chargement → rien
    if (vmap.adState === 'loading' || vmap.isAdPlaying) return;

    const audio = audioRef.current;
    if (!audio) return;

    // Premier clic avec pre-roll → lance la pub avant le contenu
    if (vmap.hasPreRoll && !vmap.preRollPlayed) {
      vmap.loadPreRoll();
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
    // Vérifie si un mid-roll doit se déclencher à ce timestamp
    vmap.checkMidRoll(a.currentTime, a.duration);
  };

  const handleLoadedMetadata = () => setTotalDuration(audioRef.current?.duration || duration);

  const handleEnded = () => {
    // Post-roll : joue la pub de fin avant de resetter
    if (vmap.hasPostRoll && !vmap.postRollPlayed) {
      vmap.loadPostRoll();
      return;
    }
    setIsPlaying(false);
    setCurrentTime(0);
    setProgress(0);
    if (audioRef.current) audioRef.current.currentTime = 0;
  };

  const handleProgressClick = (e) => {
    if (vmap.isAdPlaying) return;
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

  // ── Dérivés UI ─────────────────────────────────────────────────────────────
  const showAdOverlay = vmap.adState === 'loading' || vmap.isAdPlaying;
  const btnDisabled   = showAdOverlay;
  const showPause     = btnDisabled || isPlaying;
  const companion     = vmap.companion;

  return (
    <div className={`dv-widget ${showAdOverlay ? 'dv-widget--ad' : ''}`}>

      {/* ── Élément audio de la pub (caché) ── */}
      {vmap.adAudioUrl && (
        <audio
          ref={vmap.adRef}
          src={vmap.adAudioUrl}
          onTimeUpdate={vmap.handleAdTimeUpdate}
          onLoadedMetadata={vmap.handleAdLoaded}
          onEnded={vmap.handleAdEnded}
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
            adState={vmap.adState}
            adProgress={vmap.adProgress}
            adRemaining={vmap.adRemaining}
            adClickUrl={vmap.adClickUrl}
            adSkipOffset={vmap.adSkipOffset}
            canSkip={vmap.canSkip}
            skipCountdown={vmap.skipCountdown}
            onSkip={vmap.handleSkip}
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
        <a className="dv-brand" href="http://localhost:3000/" target="_blank" rel="noreferrer">
          🎙
        </a>
      )}
    </div>
  );
}
