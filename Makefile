# Couleurs pour le terminal
CYAN  := $(shell tput setaf 6)
GREEN := $(shell tput setaf 2)
RESET := $(shell tput sgr0)

.PHONY: help install start stop logs check-gpu build-prod

help: ## 📋 Affiche cette aide
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ─────────────────────────────────────────
# INSTALLATION & INIT
# ─────────────────────────────────────────

install: ## 📦 Installation des dépendances locales (pour l'IDE / VS Code)
	@echo "$(CYAN)Installation des dépendances Frontend & Backend...$(RESET)"
	cd frontend && npm install
	pip install -r backend/requirements.txt
	@echo "$(GREEN)Prêt pour le développement !$(RESET)"

# ─────────────────────────────────────────
# DÉVELOPPEMENT (Docker)
# ─────────────────────────────────────────

start: ## 🐳 Lance l'app complète en mode DEV (Hot-reload + GPU + Vite)
	@echo "$(CYAN)Démarrage de DearVoices (Mode Dev)...$(RESET)"
	docker compose up --build

stop: ## 🛑 Arrête tous les services
	docker compose down

# ─────────────────────────────────────────
# PRODUCTION (Build final)
# ─────────────────────────────────────────

build-prod: ## 🏗️  Génère l'image de PRODUCTION (Frontend compilé + Nginx)
	@echo "$(CYAN)Construction des images de production...$(RESET)"
	# On utilise la cible 'prod' définie dans ton Dockerfile frontend
	docker build --target prod -t dearvoices-frontend:latest ./frontend
	docker build -t dearvoices-backend:latest ./backend
	@echo "$(GREEN)Images de production prêtes !$(RESET)"

# ─────────────────────────────────────────
# DÉBOGAGE & MAINTENANCE
# ─────────────────────────────────────────

logs: ## 📜 Affiche les logs de tous les services
	docker compose logs -f

check-gpu: ## 🏎️  Vérifie si le GPU NVIDIA est bien détecté
	docker exec -it dearvoices_backend nvidia-smi
