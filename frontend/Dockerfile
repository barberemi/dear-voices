# --- ÉTAPE 1 : La base de développement (Vite) ---
FROM node:20-alpine AS dev
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY . .
# On expose le port de Vite (défini dans vite.config.js)
EXPOSE 3000
# Commande pour le hot-reload
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# --- ÉTAPE 2 : Le Build (Compilation) ---
FROM dev AS builder
RUN npm run build

# --- ÉTAPE 3 : La Production (Nginx) ---
FROM nginx:alpine AS prod
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]