import React, { useState, useEffect } from 'react';
import VoiceRecorder from './components/VoiceRecorder';
import TextToSpeech from './components/TextToSpeech';
import AudioPlayer from './components/AudioPlayer';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function App() {
  const [hasVoice, setHasVoice] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioFilename, setAudioFilename] = useState(null);
  const [step, setStep] = useState(1); // 1 = enregistrer voix, 2 = générer

  useEffect(() => {
    fetch(`${API_URL}/voice-status`)
      .then(r => r.json())
      .then(data => {
        if (data.has_voice) {
          setHasVoice(true);
          setStep(2);
        }
      })
      .catch(() => {});
  }, []);

  const handleVoiceUploaded = () => {
    setHasVoice(true);
    setStep(2);
  };

  const handleAudioGenerated = (url, filename) => {
    // On construit une URL absolue vers le backend pour que le téléchargement fonctionne
    const absoluteUrl = url.startsWith('http') ? url : `${API_URL}${url}`;
    setAudioUrl(absoluteUrl);
    setAudioFilename(filename);
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="logo">
          <span className="logo-icon">🎙️</span>
          <span className="logo-text">Dear<strong>Voices</strong></span>
        </div>
        <p className="tagline">Clone ta voix. Parle à travers le texte.</p>
      </header>

      <main className="app-main">
        {/* Étape 1 : Enregistrement de la voix */}
        <section className={`card ${step === 1 ? 'card--active' : ''} ${hasVoice ? 'card--done' : ''}`}>
          <div className="card-header">
            <div className="step-badge">{hasVoice ? '✓' : '1'}</div>
            <div>
              <h2>Enregistre ta voix</h2>
              <p className="card-subtitle">
                {hasVoice
                  ? 'Voix de référence enregistrée. Tu peux la remplacer.'
                  : 'Lis un texte pendant ~15 secondes pour créer ton clone vocal.'}
              </p>
            </div>
          </div>
          <VoiceRecorder apiUrl={API_URL} onUploaded={handleVoiceUploaded} />
        </section>

        {/* Étape 2 : Génération */}
        <section className={`card ${step === 2 ? 'card--active' : ''} ${!hasVoice ? 'card--disabled' : ''}`}>
          <div className="card-header">
            <div className="step-badge">2</div>
            <div>
              <h2>Tape ton texte</h2>
              <p className="card-subtitle">Le moteur XTTS v2 va lire ce texte avec ta voix.</p>
            </div>
          </div>
          <TextToSpeech
            apiUrl={API_URL}
            disabled={!hasVoice}
            onGenerated={handleAudioGenerated}
          />
        </section>

        {/* Lecteur audio */}
        {audioUrl && (
          <section className="card card--player">
            <div className="card-header">
              <div className="step-badge">🔊</div>
              <div>
                <h2>Écoute le résultat</h2>
                <p className="card-subtitle">{audioFilename}</p>
              </div>
            </div>
            <AudioPlayer src={audioUrl} apiUrl={API_URL} filename={audioFilename} />
          </section>
        )}
      </main>
    </div>
  );
}
