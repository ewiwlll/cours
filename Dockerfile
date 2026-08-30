# ==============================================================================
# Dockerfile — Cours (Revision OS)
# Multi-stage build pour Node.js 20 Alpine
# ==============================================================================

# --- Étape 1 : Build de l'application Web React 19 ---
FROM node:20-alpine AS web-builder
WORKDIR /app/web

# Installation des dépendances web
COPY web/package*.json ./
RUN npm ci

# Copie du code source et compilation
COPY web/ ./
RUN npm run build

# --- Étape 2 : Image d'exécution finale ---
FROM node:20-alpine AS runner
WORKDIR /app

# Définition des variables d'environnement
ENV NODE_ENV=production
ENV BIOMIA_PORT=3002
ENV PORT=3002

# Installation des dépendances racine
COPY package*.json ./
RUN npm ci --omit=dev

# Copie des fichiers backend et configuration
COPY server.mjs ./
COPY automation.mjs ./
COPY learning-engine.mjs ./
COPY recall-correction.mjs ./
COPY shared-utils.mjs ./
COPY start.mjs ./
COPY .env.example ./.env.example

# Dossiers statiques et données
COPY data/ ./data/
COPY public/ ./public/
COPY landing/ ./landing/
COPY bin/ ./bin/
COPY scripts/ ./scripts/

# Copie du build Web généré dans le dossier public servi statiquement
COPY --from=web-builder /app/web/dist/ ./public/

# Exposition du port applicatif
EXPOSE 3002

# Commande de démarrage
CMD ["node", "server.mjs"]
