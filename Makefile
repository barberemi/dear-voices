.PHONY: help build up down restart logs logs-backend logs-frontend \
        dev-backend dev-frontend dev-widget install-frontend clean prune shell-backend \
        rebuild rebuild-backend build-widget

# Couleurs
CYAN  := \033[36m
RESET := \033[0m
BOLD  := \033[1m

help: ## 📋 Affiche cette aide
	@echo ""
	@echo "$(BOLD)DearVoices – Commandes disponibles$(RESET)"
	@echo "────────────────────────────────────────"
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z_-]+:.*##/ { printf "  $(CYAN)%-20s$(RESET) %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
	@echo ""

# ─────────────────────────────────────────
# DOCKER – Production
# ─────────────────────────────────────────

build: ## 🔨 Build les images Docker (backend + frontend)
	docker compose build

up: ## 🚀 Lance tous les services en arrière-plan
	docker compose up -d

down: ## 🛑 Arrête tous les services
	docker compose down

restart: ## 🔄 Redémarre tous les services
	docker compose restart

rebuild: ## ♻️  Stop, rebuild et relance tout
	docker compose down
	docker compose build --no-cache
	docker compose up -d

rebuild-backend: ## 🔁 Rebuild uniquement le backend (si requirements.txt a changé)
	docker compose build backend
	docker compose up -d --no-deps backend

# ─────────────────────────────────────────
# WIDGET
# ─────────────────────────────────────────



build-widget: ## 📦 Build le widget IIFE → frontend/dist-widget/widget.iife.js
	cd frontend && npm run build:widget
	@echo "$(CYAN)✓ Widget buildé dans frontend/dist-widget/$(RESET)"

# ─────────────────────────────────────────
# LOGS
# ─────────────────────────────────────────

logs: ## 📜 Affiche les logs de tous les services (live)
	docker compose logs -f

logs-backend: ## 📜 Logs du backend FastAPI uniquement
	docker compose logs -f backend

logs-frontend: ## 📜 Logs du frontend Nginx uniquement
	docker compose logs -f frontend

# ─────────────────────────────────────────
# DÉVELOPPEMENT LOCAL (sans Docker)
# ─────────────────────────────────────────

install-frontend: ## 📦 Installe les dépendances npm du frontend
	cd frontend && npm install

dev-frontend: ## ⚡ Lance le serveur de dev Vite (hot reload, exposé sur le réseau)
	cd frontend && npm run dev -- --host

dev-backend: ## 🐍 Lance FastAPI en local (sans Docker) & check /docs swagger
	cd backend && uvicorn main:app --reload --host 0.0.0.0 --port 8000

dev-widget: ## 🔥 Lance le widget en mode dev avec hot-reload (http://localhost:3000/dev-widget.html)
	cd frontend && npm run dev:widget

dev: ## 🧪 Lance backend + frontend + widget en dev (3 terminaux parallèles)
	@echo "$(CYAN)Lance le backend, frontend et widget en parallèle…$(RESET)"
	@make -j3 dev-backend dev-frontend dev-widget

# ─────────────────────────────────────────
# UTILITAIRES
# ─────────────────────────────────────────

shell-backend: ## 🐚 Ouvre un shell dans le conteneur backend
	docker compose exec backend bash

clean: ## 🧹 Supprime les fichiers générés (outputs audio)
	rm -f backend/outputs/*.wav frontend/dist -rf

prune: ## 💣 Supprime les images/volumes Docker inutilisés
	docker system prune -f
	docker volume prune -f
