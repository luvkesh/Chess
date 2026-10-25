# Chacklate game server: website, web game, admin console, API and WebSocket play in one process.
# Build from the repository root:  docker build -t chacklate .
FROM node:22-slim

ENV NODE_ENV=production \
    PORT=8080 \
    CHACKLATE_DB=/data/chacklate.db \
    CHACKLATE_TRUST_PROXY=1

WORKDIR /app
# Only what the server reads at runtime. No npm install: there are no dependencies.
COPY packages/chess-core/src packages/chess-core/src
COPY packages/content/*.json packages/content/
COPY apps/website/index.html apps/website/
COPY apps/admin/index.html apps/admin/
COPY apps/web-prototype/dist apps/web-prototype/dist
COPY apps/web-prototype/public apps/web-prototype/public
COPY services/game-server/package.json services/game-server/
COPY services/game-server/src services/game-server/src

ARG VERSION=dev
ENV CHACKLATE_VERSION=$VERSION

RUN mkdir -p /data /backups && chown node:node /data /backups
USER node
VOLUME ["/data"]
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

WORKDIR /app/services/game-server
CMD ["node", "--disable-warning=ExperimentalWarning", "src/server.js"]
