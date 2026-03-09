import { useState, useRef, useEffect } from 'react';

export default function Widget({ audioUrl, duration = 0 }) {
  const audioRef = useRef(null);
  const progressRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setProgress(0);
  }, [audioUrl]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      setLoading(true);
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    setCurrentTime(audio.currentTime);
    setProgress((audio.currentTime / audio.duration) * 100);
  };

  const handleLoadedMetadata = () => {
    setTotalDuration(audioRef.current?.duration || duration);
    setLoading(false);
  };

  const handleCanPlay = () => setLoading(false);

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    setProgress(0);
    if (audioRef.current) audioRef.current.currentTime = 0;
  };

  const handleProgressClick = (e) => {
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

  return (
    <div className="dv-widget">
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onCanPlay={handleCanPlay}
        onEnded={handleEnded}
        preload="metadata"
      />

      <div className="dv-left">
        <button
          className={`dv-play ${loading ? 'dv-loading' : ''}`}
          onClick={togglePlay}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {loading ? (
            <span className="dv-spinner" />
          ) : isPlaying ? (
            <svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
          )}
        </button>
      </div>

      <div className="dv-right">
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
      </div>

      <a className="dv-brand" href="https://dearvoices.com" target="_blank" rel="noreferrer">
        🎙
      </a>
    </div>
  );
}
