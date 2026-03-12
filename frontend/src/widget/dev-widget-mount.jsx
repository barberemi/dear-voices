/**
 * Point d'entrée DEV uniquement – monte le widget directement via React+Vite
 * pour bénéficier du hot-reload complet (HMR).
 * N'est PAS utilisé dans le build IIFE de production.
 */
import { createRoot } from 'react-dom/client';
import Widget from './Widget';
import './widget.css'; // Vite l'injecte normalement en dev (pas Shadow DOM)

const API  = 'http://localhost:8000';
const ID   = 'output_803b790a.wav';   // ← change ici si besoin
const VAST = 'http://localhost:8000/test-vast';
const VMAP = 'http://localhost:8000/test-vmap';

// ── Sans pub ──────────────────────────────────────────────────────────────────
const elNoVast = document.getElementById('widget-no-vast');
if (elNoVast) {
  createRoot(elNoVast).render(
    <Widget
      audioUrl={`${API}/audio/${ID}`}
      duration={0}
      vmapUrl=""
    />
  );
}

// ── Avec VMAP PRE-roll ────────────────────────────────────────────────────────
const elWithVast = document.getElementById('widget-with-pre-roll');
if (elWithVast) {
  createRoot(elWithVast).render(
    <Widget
      audioUrl={`${API}/audio/${ID}`}
      duration={0}
      vmapUrl={VAST}
    />
  );
}

// ── Avec VMAP ALL-ROLL (pre + mid + post) ─────────────────────────────────────
const elWithAllRoll = document.getElementById('widget-with-all-roll');
if (elWithAllRoll) {
  createRoot(elWithAllRoll).render(
    <Widget
      audioUrl={`${API}/audio/${ID}`}
      duration={0}
      vmapUrl={VMAP}
    />
  );
}
