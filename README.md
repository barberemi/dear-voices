# 🎙️ DearVoices

Clone ta voix et lis n'importe quel texte avec elle.  
Stack : **FastAPI** + **Coqui XTTS v2** + **React / Vite** + **Docker**

---

## Prérequis

- [Docker](https://docs.docker.com/get-docker/) + Docker Compose
- [Node.js 20+](https://nodejs.org/) (pour le dev frontend local)
- Le modèle XTTS v2 téléchargé localement dans `~/.local/share/tts/`  
  _(si absent, il sera téléchargé automatiquement au premier démarrage, ~2 GB)_

---

## Structure du projet

```
DearVoices/
├── docker-compose.yml        # Orchestre backend + frontend
├── Makefile                  # Toutes les commandes (voir ci-dessous)
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── main.py               # API FastAPI (upload voix, génération, stream audio)
└── frontend/
    ├── Dockerfile
    ├── vite.config.js
    ├── dev-widget.html       # Page de dev widget (hot reload)
    ├── src/
    │   ├── App.jsx           # Application principale
    │   ├── components/       # VoiceRecorder, TextToSpeech, AudioPlayer
    │   └── widget/
    │       ├── Widget.jsx          # Composant player embarquable
    │       ├── AdOverlay.jsx       # UI pub VAST (barre, skip, compte à rebours)
    │       ├── useVast.js          # Hook logique VAST (parse, tracking, skip, companion)
    │       ├── widget-entry.jsx    # Point d'entrée IIFE (production)
    │       ├── dev-widget-mount.jsx # Point d'entrée dev (HMR, pas IIFE)
    │       └── widget.css          # Styles isolés (injectés dans le Shadow DOM)
```

---

## 🚀 Lancement rapide

### Option A — Docker (recommandé pour la prod)

```bash
make install-frontend   # Une seule fois (installe npm)
make build              # Build les images Docker
make up                 # Lance backend + frontend
```

| Service | URL |
|---|---|
| **Application** | http://localhost:3000 |
| **API (Swagger)** | http://localhost:8000/docs |

---

### Option B — Développement local (hot reload complet)

Lance chaque service dans un terminal séparé :

```bash
# Terminal 1 — Backend FastAPI (hot reload)
make dev-backend        # → http://localhost:8000

# Terminal 2 — Frontend React/Vite (hot reload)
make dev-frontend       # → http://localhost:3000

# Terminal 3 — Widget en mode dev (hot reload)
make dev-widget         # → http://localhost:3000/dev-widget.html
```

> **`make dev-widget`** ouvre directement la page de test du widget avec HMR activé.  
> Chaque modification dans `src/widget/` est rechargée instantanément, **sans aucun build**.

---

## 🧩 Widget embarquable

Le widget est un player audio autonome intégrable sur n'importe quel site via une balise `<script>`.  
Il supporte le **VAST pré-roll audio** (pub, skip, tracking IAB, Companion GIF).

### Développement du widget

```bash
make dev-widget
# Ouvre http://localhost:3000/dev-widget.html
# → hot reload complet, deux instances (avec et sans VAST)
```

Pour changer l'audio testé, édite directement `src/widget/dev-widget-mount.jsx` :

```js
const ID   = 'output_mon_fichier.wav';   // ← nom du fichier généré
const VAST = 'http://localhost:8000/test-vast'; // ← ou '' pour tester sans pub
```

### Build de production

```bash
make build-widget
# → génère frontend/dist-widget/widget.iife.js
```

### Intégrer sur un site

```html
<script src="https://ton-domaine.com/widget.iife.js?id=output_xxxx.wav&api=https://ton-domaine.com:8000"></script>
```

**Paramètres URL disponibles :**

| Paramètre | Description | Exemple |
|---|---|---|
| `id` | Nom du fichier audio généré | `output_a1b2c3.wav` |
| `api` | URL de base de l'API | `https://ton-domaine.com:8000` |
| `vast` | URL du tag VAST (optionnel) | `https://adserver.com/tag.xml` |
| `title` | Titre affiché dans le player (optionnel) | `Mon podcast` |

---

## Utilisation

1. **Enregistre ta voix** — clique sur _Démarrer l'enregistrement_ et lis un texte pendant ~15 secondes
2. **Tape ton texte** — choisis la langue et saisis le texte à lire
3. **Génère l'audio** — clique sur _Générer l'audio_ et attends le résultat
4. **Écoute / télécharge** — le player apparaît avec une barre de progression

Les fichiers sont sauvegardés dans :
- `backend/uploads/ma_voix.wav` — ta voix de référence
- `backend/outputs/output_xxxx.wav` — les audios générés

---

## Commandes disponibles

```bash
make help   # Liste toutes les commandes avec description
```

| Commande | Description |
|---|---|
| `make build` | Build les images Docker |
| `make up` | Lance tous les services (Docker) |
| `make down` | Arrête tous les services |
| `make restart` | Redémarre tous les services |
| `make rebuild` | Stop + build --no-cache + relance |
| `make rebuild-backend` | Rebuild uniquement le backend |
| `make logs` | Logs live de tous les services |
| `make logs-backend` | Logs FastAPI uniquement |
| `make logs-frontend` | Logs Nginx uniquement |
| `make dev-backend` | FastAPI en local avec hot reload (`:8000`) |
| `make dev-frontend` | Vite en local avec hot reload (`:3000`) |
| `make dev` | Backend + frontend en parallèle |
| `make dev-widget` | Widget en dev avec hot reload (`:3000/dev-widget.html`) |
| `make build-widget` | Build le widget IIFE → `dist-widget/widget.iife.js` |
| `make install-frontend` | `npm install` du frontend |
| `make shell-backend` | Shell dans le conteneur backend |
| `make clean` | Supprime les fichiers audio générés |
| `make prune` | Nettoie les images/volumes Docker inutilisés |

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

---

## API — Routes disponibles

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/` | Santé de l'API |
| `GET` | `/voice-status` | Vérifie si une voix de référence existe |
| `POST` | `/upload-voice` | Upload de la voix de référence (converti en WAV) |
| `POST` | `/generate` | Génère un audio à partir d'un texte |
| `GET` | `/audio/{filename}` | Stream / télécharge un audio généré |
| `GET` | `/share/{filename}` | Métadonnées publiques (utilisé par le widget) |
| `GET` | `/test-vast` | Tag VAST de test avec pre-roll + Companion GIF |
| `GET` | `/vast-ping` | Endpoint de tracking VAST (impression, start, skip…) |

Clone ta voix et lis n'importe quel texte avec elle.  
Stack : **FastAPI** + **Coqui XTTS v2** + **React / Vite** + **Docker**

---

## Prérequis

- [Docker](https://docs.docker.com/get-docker/) + Docker Compose
- [Node.js 20+](https://nodejs.org/) (pour le dev frontend local)
- Le modèle XTTS v2 téléchargé localement dans `~/.local/share/tts/`  
  _(si absent, il sera téléchargé automatiquement au premier démarrage, ~2 GB)_

---

## Structure du projet

```
DearVoices/
├── docker-compose.yml        # Orchestre backend + frontend
├── Makefile                  # Toutes les commandes (voir ci-dessous)
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── main.py               # API FastAPI (upload voix, génération, stream audio)
└── frontend/
    ├── Dockerfile
    ├── vite.config.js
    ├── src/
    │   ├── App.jsx            # Application principale
    │   └── components/        # VoiceRecorder, TextToSpeech, AudioPlayer
    └── widget/
        ├── Widget.jsx         # Composant player embarquable
        └── widget-entry.jsx   # Point d'entrée du widget IIFE
```

---

## Lancement rapide (Docker)

```bash
# 1. Installer les dépendances frontend (une seule fois)
make install-frontend

# 2. Builder les images Docker
make build

# 3. Lancer les services
make up
```

| Service | URL |
|---|---|
| **Application** | http://localhost:3000 |
| **API (Swagger)** | http://localhost:8000/docs |

---

## Développement local (sans Docker)

> **Sans hot reload**, `make up` suffit. Les modifications backend sont prises en compte instantanément (volume bind mount). Pour les modifications frontend, relance `make build && make up`.

Si tu veux le hot reload complet (frontend rechargé instantanément à chaque modif), lance deux terminaux :

```bash
# Terminal 1 — Backend FastAPI avec hot reload
make dev-backend

# Terminal 2 — Frontend Vite avec hot reload
make dev-frontend
```

> Le frontend sera accessible sur **http://localhost:3000** et proxifie automatiquement les appels vers le backend sur le port 8000.

---

## Utilisation

1. **Enregistre ta voix** — clique sur _Démarrer l'enregistrement_ et lis un texte pendant ~15 secondes
2. **Tape ton texte** — choisis la langue et saisis le texte à lire
3. **Génère l'audio** — clique sur _Générer l'audio_ et attends le résultat
4. **Écoute / télécharge** — le player apparaît avec une barre de progression

Les fichiers sont sauvegardés dans :
- `backend/uploads/ma_voix.wav` — ta voix de référence
- `backend/outputs/output_xxxx.wav` — les audios générés

---

## Widget embarquable

Le widget est un player audio autonome intégrable sur n'importe quel site.

### Générer le widget

```bash
# Build le widget (→ frontend/dist-widget/widget.iife.js)
cd frontend && npm run build:widget
```

### Intégrer sur un site

```html
<script src="https://ton-domaine.com/widget.iife.js?id=output_xxxx.wav&api=https://ton-domaine.com:8000"></script>
```

Le widget s'insère automatiquement juste après la balise `<script>`.

### Tester en local

```bash
# Build + serveur de test sur http://localhost:4000
make test-widget
```

---

## Commandes disponibles

```bash
make help              # Liste toutes les commandes
```

| Commande | Description |
|---|---|
| `make build` | Build les images Docker |
| `make up` | Lance tous les services |
| `make down` | Arrête tous les services |
| `make restart` | Redémarre tous les services |
| `make rebuild` | Stop + build --no-cache + relance |
| `make rebuild-backend` | Rebuild uniquement le backend |
| `make logs` | Logs live de tous les services |
| `make logs-backend` | Logs FastAPI uniquement |
| `make logs-frontend` | Logs Nginx uniquement |
| `make dev-backend` | FastAPI en local avec hot reload |
| `make dev-frontend` | Vite en local avec hot reload |
| `make dev` | Backend + frontend en parallèle |
| `make install-frontend` | `npm install` du frontend |
| `make test-widget` | Build + test du widget sur :4000 |
| `make shell-backend` | Shell dans le conteneur backend |
| `make clean` | Supprime les fichiers audio générés |
| `make prune` | Nettoie les images/volumes Docker inutilisés |

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

---

## API — Routes disponibles

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/` | Santé de l'API |
| `GET` | `/voice-status` | Vérifie si une voix de référence existe |
| `POST` | `/upload-voice` | Upload de la voix de référence (converti en WAV) |
| `POST` | `/generate` | Génère un audio à partir d'un texte |
| `GET` | `/audio/{filename}` | Stream / télécharge un audio généré |
| `GET` | `/share/{filename}` | Métadonnées publiques (utilisé par le widget) |

