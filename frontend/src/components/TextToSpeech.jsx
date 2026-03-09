import React, { useState } from 'react';
import './TextToSpeech.css';

const LANGUAGES = [
  { code: 'fr', label: '🇫🇷 Français' },
  { code: 'en', label: '🇬🇧 English' },
  { code: 'es', label: '🇪🇸 Español' },
  { code: 'de', label: '🇩🇪 Deutsch' },
  { code: 'it', label: '🇮🇹 Italiano' },
  { code: 'pt', label: '🇧🇷 Português' },
];

export default function TextToSpeech({ apiUrl, disabled, onGenerated }) {
  const [text, setText] = useState('');
  const [language, setLanguage] = useState('fr');
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [errorMsg, setErrorMsg] = useState('');

  const handleGenerate = async () => {
    if (!text.trim()) return;
    setStatus('loading');
    setErrorMsg('');

    const formData = new FormData();
    formData.append('text', text.trim());
    formData.append('language', language);

    try {
      const res = await fetch(`${apiUrl}/generate`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Erreur lors de la génération.');

      setStatus('success');
      onGenerated(`${apiUrl}${data.url}`, data.filename);
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message);
    }
  };

  const charCount = text.length;
  const maxChars = 500;

  return (
    <div className="tts">
      <div className="tts-lang">
        {LANGUAGES.map(l => (
          <button
            key={l.code}
            className={`lang-btn ${language === l.code ? 'lang-btn--active' : ''}`}
            onClick={() => setLanguage(l.code)}
            disabled={disabled}
          >
            {l.label}
          </button>
        ))}
      </div>

      <div className="tts-textarea-wrap">
        <textarea
          className="tts-textarea"
          placeholder="Tape ici le texte à lire avec ta voix…"
          value={text}
          onChange={e => {
            if (e.target.value.length <= maxChars) setText(e.target.value);
          }}
          disabled={disabled}
          rows={5}
        />
        <span className={`char-count ${charCount > maxChars * 0.9 ? 'char-count--warn' : ''}`}>
          {charCount} / {maxChars}
        </span>
      </div>

      <button
        className="btn btn--generate"
        onClick={handleGenerate}
        disabled={disabled || !text.trim() || status === 'loading'}
      >
        {status === 'loading' ? (
          <>
            <span className="spinner" /> Génération en cours…
          </>
        ) : (
          <>🎙️ Générer l'audio</>
        )}
      </button>

      {status === 'success' && (
        <div className="status-msg status-msg--success">✅ Audio généré ! Écoute ci-dessous.</div>
      )}
      {status === 'error' && (
        <div className="status-msg status-msg--error">❌ {errorMsg}</div>
      )}
    </div>
  );
}
