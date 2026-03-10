import React, { useRef, useState, useEffect } from 'react';
import './AudioPlayer.css';

export default function AudioPlayer({ src, filename, apiUrl }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const progressBarRef = useRef(null);
  const [copied, setCopied] = useState(false);

  // Construit le tag <script> prêt à intégrer sur un site externe
  const widgetApiUrl = apiUrl || 'http://localhost:8000';
  const widgetSrc = `${widgetApiUrl}/widget/widget.iife.js`;
  const embedCode = `<!-- Sans publicité -->
<script src="${widgetSrc}?id=${filename}&api=${widgetApiUrl}"></script>

<!-- Avec VAST pre-roll (remplace l'URL vast=) -->
<script src="${widgetSrc}?id=${filename}&api=${widgetApiUrl}&vast=https://ton-adserver.com/vast.xml"></script>`;

  useEffect(() => {
    // Quand une nouvelle source arrive, on remet à zéro
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
    setDuration(0);
  }, [src]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
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
    setDuration(audioRef.current?.duration || 0);
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
    if (audioRef.current) audioRef.current.currentTime = 0;
  };

  const handleProgressClick = (e) => {
    const bar = progressBarRef.current;
    if (!bar || !audioRef.current) return;
    const rect = bar.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const newTime = ratio * audioRef.current.duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    setProgress(ratio * 100);
  };

  const formatTime = (s) => {
    if (!s || isNaN(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(embedCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="player">
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
      />

      <div className="player-controls">
        <button className="play-btn" onClick={togglePlay} aria-label={isPlaying ? 'Pause' : 'Play'}>
          {isPlaying ? '⏸' : '▶'}
        </button>

        <div className="player-timeline">
          <div
            className="progress-bar"
            ref={progressBarRef}
            onClick={handleProgressClick}
          >
            <div
              className="progress-fill"
              style={{ width: `${progress}%` }}
            />
            <div
              className="progress-thumb"
              style={{ left: `${progress}%` }}
            />
          </div>
          <div className="player-times">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>

      <a
        className="download-btn"
        href={src}
        download={filename || 'dearvoices_output.wav'}
      >
        ⬇ Télécharger le fichier WAV
      </a>

      {/* ─── Encart "Intégrer sur mon site" ─── */}
      <div className="embed-block">
        <div className="embed-block__header">
          <span>🌐 Intégrer ce player sur ton site</span>
          <button
            className={`copy-btn ${copied ? 'copy-btn--done' : ''}`}
            onClick={handleCopy}
          >
            {copied ? '✓ Copié !' : '📋 Copier'}
          </button>
        </div>
        <pre className="embed-block__code">{embedCode}</pre>
        <p className="embed-block__hint">
          Colle ce code HTML là où tu veux afficher le player sur ton site.
        </p>
      </div>
    </div>
  );
}
