# syntax=docker/dockerfile:1.7
# Single-image deploy: the API serves the built web app. Build:  docker build -t digitalburj-os .
FROM node:22-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci --omit=dev --workspace @digitalburj/api --include-workspace-root=false --no-audit --no-fund && npm cache clean --force
COPY --from=build /repo/apps/api/dist apps/api/dist
COPY --from=build /repo/apps/api/migrations apps/api/migrations
COPY --from=build /repo/apps/web/dist apps/web/dist
RUN mkdir -p /app/apps/api/uploads && chown -R node:node /app/apps/api/uploads
USER node
WORKDIR /app/apps/api
ENV PORT=3001 UPLOAD_DIR=/app/apps/api/uploads
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD wget -qO- http://127.0.0.1:3001/healthz || exit 1
# migrations run automatically on boot (idempotent, transactional per file)
CMD ["node", "dist/index.js"]
