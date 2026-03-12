# DearVoices

Clone ta voix et lis n'importe quel texte avec elle.
Stack : **FastAPI** + **Coqui XTTS v2** + **React / Vite** + **Docker**

---

## Prérequis

- [Docker](https://docs.docker.com/get-docker/) + Docker Compose
- [Node.js 20+](https://nodejs.org/) (pour le dev frontend local)
- Le modèle XTTS v2 dans `~/.local/share/tts/` _(téléchargé automatiquement au 1er démarrage, ~2 GB)_

---

## Structure du projet

```
DearVoices/
├── docker-compose.yml            # Orchestre backend + frontend
├── Makefile                      # Toutes les commandes utiles
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── ads/                       # GIFs companion pour les tests pub (servis sur /ads/*)
│   └── main.py                   # API FastAPI
└── frontend/
    ├── Dockerfile
    ├── vite.config.js             # Config Vite (app + widget IIFE)
    ├── index.html                 # App principale
    ├── dev-widget.html            # Sandbox widget avec hot-reload
    ├── public/
    ├── dist/                      # Build app principale (npm run build)
    ├── dist-widget/               # Build widget IIFE (npm run build:widget)
    └── src/
        ├── App.jsx
        ├── components/            # VoiceRecorder, TextToSpeech, AudioPlayer
        └── widget/
            ├── Widget.jsx         # Composant player embarquable
            ├── AdOverlay.jsx      # UI pub (barre, badge, skip, compte à rebours)
            ├── useVmap.js         # Hook VMAP (pre / mid / post-roll, tracking IAB)
            ├── widget-entry.jsx   # Point d'entrée IIFE (production, paramètre ?vmap=)
            ├── dev-widget-mount.jsx # Point d'entrée dev (HMR)
            └── widget.css         # Styles isolés (injectés dans le Shadow DOM)
```

---

## Lancement rapide

```bash
# 1. Installer les dépendances (une seule fois)
make install

# 2. Lancer toute la stack
make start
```

### URLs en dev

| Service | URL | Description |
|---|---|---|
| **Application** | http://localhost:3000 | Frontend React (Vite dev server) |
| **API** | http://localhost:8000 | Backend FastAPI |
| **Swagger** | http://localhost:8000/docs | Documentation interactive de l'API |
| **Widget sandbox** | http://localhost:3000/dev-widget.html | Page de test du widget (hot-reload) |

> Le frontend proxifie automatiquement `/api/*` vers le backend (`http://localhost:8000`).

---

## Utilisation

1. **Enregistre ta voix** — clique sur _Démarrer l'enregistrement_ et lis un texte ~15 secondes
2. **Tape ton texte** — choisis la langue et saisis le texte à lire
3. **Génère l'audio** — clique sur _Générer l'audio_ et attends le résultat
4. **Écoute / télécharge** — le player apparaît avec une barre de progression

Les fichiers sont sauvegardés dans :
- `backend/uploads/ma_voix.wav` — voix de référence
- `backend/outputs/output_xxxx.wav` — audios générés

---

## Widget embarquable

Le widget est un player audio autonome intégrable sur n'importe quel site via une balise `<script>`.
Il supporte le **VMAP** (Video Multiple Ad Playlist) avec pre-roll, mid-roll et post-roll audio, skip, tracking IAB et Companion GIF.

### Dev avec hot-reload

La sandbox widget est accessible dès que `make start` tourne — pas de commande séparée :

```
http://localhost:3000/dev-widget.html
```

La page affiche 3 instances du widget :
- Sans pub
- Avec **VAST** seul (pre-roll uniquement)
- Avec **VMAP** complet (pre + mid + post-roll)

Pour changer l'audio testé ou l'URL pub, édite `src/widget/dev-widget-mount.jsx` :

```js
const ID   = 'output_mon_fichier.wav';        // ← nom du fichier généré
const VAST = 'http://localhost:8000/test-vast'; // ← pre-roll seul
const VMAP = 'http://localhost:8000/test-vmap'; // ← pre + mid + post-roll
```

### Build production

```bash
cd frontend && npm run build:widget
# → frontend/dist-widget/widget.iife.js
```

### Intégrer sur un site

```html
<script src="https://ton-domaine.com/widget.iife.js?id=output_xxxx.wav&api=https://ton-domaine.com:8000&vmap=https://adserver.com/tag.xml"></script>
```

**Paramètres URL disponibles :**

| Paramètre | Obligatoire | Description | Exemple |
|---|---|---|---|
| `id` | ✅ | Nom du fichier audio généré | `output_a1b2c3.wav` |
| `api` | ✅ | URL de base de l'API | `https://ton-domaine.com:8000` |
| `vmap` | — | URL du tag VMAP (pub optionnelle) | `https://adserver.com/vmap.xml` |
| `title` | — | Titre affiché dans le player | `Mon podcast` |

### Fonctionnement VMAP

Le hook `useVmap.js` parse le XML VMAP et orchestre automatiquement :

| `timeOffset` | Type | Comportement |
|---|---|---|
| `start` | Pre-roll | Joue la pub **avant** le contenu, dès le 1er clic Play |
| `50%` ou `HH:MM:SS` | Mid-roll | Pause le contenu au point donné, joue la pub, puis reprend |
| `end` | Post-roll | Joue la pub **après** la fin du contenu |

Chaque break supporte : skip (avec délai configurable), tracking IAB (impression / start / quartiles / complete / skip), et Companion GIF cliquable.

### Tester les pubs en local

L'API expose deux endpoints de test :

| Route | Description |
|---|---|
| `GET /test-vast` | VAST avec pre-roll 10s + Companion GIF |
| `GET /test-vmap` | VMAP avec pre + mid (à 50%) + post-roll, chacun 10s + Companion GIF |
| `GET /vast-ping` | Reçoit les events de tracking (impression, start, skip, complete…) |

---

## API — Routes disponibles

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/` | Santé de l'API |
| `GET` | `/voice-status` | Vérifie si une voix de référence existe |
| `POST` | `/upload-voice` | Upload de la voix de référence (converti en WAV 22kHz mono) |
| `POST` | `/generate` | Génère un audio à partir d'un texte (`text`, `language`) |
| `GET` | `/audio/{filename}` | Stream / télécharge un audio généré |
| `GET` | `/share/{filename}` | Métadonnées publiques (durée, url) — utilisé par le widget |
| `GET` | `/test-vast` | Tag VAST de test (pre-roll + Companion) |
| `GET` | `/test-vmap` | Tag VMAP de test (pre + mid + post-roll + Companion) |
| `GET` | `/vast-ping` | Endpoint de tracking VAST/VMAP |

---

## Commandes disponibles

```bash
make help   # Liste toutes les commandes
```

| Commande | Description |
|---|---|
| `make install` | `npm install` + `pip install` (dépendances locales) |
| `make start` | Lance toute la stack Docker en mode dev (hot-reload, port 3000 + 8000) |
| `make stop` | Arrête tous les services Docker |
| `make build-prod` | Build les images Docker de production |
| `make logs` | Logs live de tous les services Docker |
| `make check-gpu` | Vérifie si le GPU NVIDIA est détecté dans le conteneur backend |

---

## Variables d'environnement

| Variable | Fichier | Description |
|---|---|---|
| `VITE_API_URL` | `frontend/.env` | URL du backend appelée par le frontend |

---

## GPU (optionnel)

Pour activer le GPU NVIDIA, décommente le bloc `deploy.resources` dans `docker-compose.yml` :

```yaml
deploy:
  resources:
    reservations:
      devices:
        - driver: nvidia
          count: 1
          capabilities: [gpu]
```
