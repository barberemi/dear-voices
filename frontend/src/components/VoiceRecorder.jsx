import React, { useState, useRef } from 'react';
import './VoiceRecorder.css';

export default function VoiceRecorder({ apiUrl, onUploaded }) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [status, setStatus] = useState('idle'); // idle | recording | uploading | success | error
  const [errorMsg, setErrorMsg] = useState('');

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  const startRecording = async () => {
    setErrorMsg('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        uploadAudio();
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setStatus('recording');
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime(t => t + 1);
      }, 1000);
    } catch (err) {
      setStatus('error');
      setErrorMsg("Impossible d'accéder au microphone. Vérifie les permissions.");
    }
  };

  const stopRecording = () => {
    clearInterval(timerRef.current);
    setIsRecording(false);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const uploadAudio = async () => {
    setStatus('uploading');
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
    const formData = new FormData();
    formData.append('file', blob, 'ma_voix.webm');

    try {
      const res = await fetch(`${apiUrl}/upload-voice`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Erreur lors de l\'upload.');
      }
      setStatus('success');
      onUploaded();
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message);
    }
  };

  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="recorder">
      <div className="recorder-controls">
        {!isRecording ? (
          <button
            className="btn btn--record"
            onClick={startRecording}
            disabled={status === 'uploading'}
          >
            <span className="btn-icon">🔴</span>
            {status === 'success' ? 'Ré-enregistrer' : 'Démarrer l\'enregistrement'}
          </button>
        ) : (
          <button className="btn btn--stop" onClick={stopRecording}>
            <span className="btn-icon pulse">⏹</span>
            Arrêter ({formatTime(recordingTime)})
          </button>
        )}
      </div>

      {status === 'recording' && (
        <div className="recording-hint">
          <div className="waveform">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="waveform-bar" style={{ animationDelay: `${i * 0.07}s` }} />
            ))}
          </div>
          <p>Lis un texte à voix haute… visez 15 secondes minimum.</p>
        </div>
      )}

      {status === 'uploading' && (
        <div className="status-msg status-msg--loading">
          ⏳ Upload en cours…
        </div>
      )}

      {status === 'success' && (
        <div className="status-msg status-msg--success">
          ✅ Voix de référence enregistrée !
        </div>
      )}

      {status === 'error' && (
        <div className="status-msg status-msg--error">
          ❌ {errorMsg}
        </div>
      )}
    </div>
  );
}
