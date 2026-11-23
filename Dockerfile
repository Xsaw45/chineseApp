# Yidiano : build Vite de l'app, puis serveur Fastify (server/) qui la sert avec la connexion par e-mail et la synchro.
FROM node:24-alpine AS web
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:24-alpine
ENV NODE_ENV=production PORT=8080 DB_PATH=/data/yidiano.db PUBLIC_DIR=/app/public
WORKDIR /app
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --omit=dev --no-audit --no-fund
COPY server/ ./server/
# grammaire et lectures : le serveur sert le contenu Yidiano+ (content/split.js)
COPY content/ ./content/
COPY src/data/readingLines.js ./src/data/readingLines.js
COPY --from=web /src/dist/ ./public/
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 8080
CMD ["node", "--disable-warning=ExperimentalWarning", "server/server.js"]
