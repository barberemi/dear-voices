import { createRoot } from 'react-dom/client';
import Widget from './Widget';

// Garde une référence au script AVANT tout appel async
// (document.currentScript devient null après le premier await)
const CURRENT_SCRIPT = document.currentScript;

function getScriptParams() {
  const src = CURRENT_SCRIPT?.src || '';
  const url = new URL(src, window.location.href);
  return {
    id:    url.searchParams.get('id')    || '',
    title: url.searchParams.get('title') || '',
    api:   url.searchParams.get('api')   || 'http://localhost:8000',
    vmap:  url.searchParams.get('vmap')  || '',   // ← tag VMAP optionnel
  };
}

async function mount() {
  const { id, title, api, vmap } = getScriptParams();
  if (!id) {
    console.warn('[DearVoices widget] Paramètre ?id= manquant.');
    return;
  }

  // Récupère la durée depuis l'API (le reste n'est pas nécessaire)
  let duration = 0;
  try {
    const res = await fetch(`${api}/share/${id}`);
    if (res.ok) {
      const meta = await res.json();
      duration = meta.duration || 0;
    }
  } catch (_) {}

  // Insère le widget juste après la balise <script> dans la page
  const host = document.createElement('div');
  host.id = 'dearvoices-widget';
  if (CURRENT_SCRIPT) {
    CURRENT_SCRIPT.insertAdjacentElement('afterend', host);
  } else {
    document.body.appendChild(host);
  }

  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = WIDGET_CSS;
  shadow.appendChild(style);

  const container = document.createElement('div');
  shadow.appendChild(container);

  createRoot(container).render(
    <Widget
      audioUrl={`${api}/audio/${id}`}
      title={title}
      duration={duration}
      vmapUrl={vmap}
    />
  );
}

mount();
