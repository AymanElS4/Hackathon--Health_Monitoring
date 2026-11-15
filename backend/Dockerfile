# syntax=docker/dockerfile:1
# Build context is the repository root (see docker-compose.yml).

# Build stage: install all dependencies, compile TypeScript, drop dev dependencies.
FROM node:24-alpine AS build
WORKDIR /app
# The backend imports the shared contracts from libs/contracts/src (via backend/src/shared/contracts.ts).
COPY libs/contracts/src libs/contracts/src
# Copy manifests first so the dependency layer is cached until they change.
COPY backend/package.json backend/package-lock.json backend/
RUN cd backend && npm ci --no-audit --no-fund
# Contracts sit outside backend/, so their "zod" import would not find backend/node_modules at compile time.
# Link it so TypeScript resolves the same dependency for libs/ (compiled output lives under backend/ at runtime).
RUN ln -s /app/backend/node_modules /app/libs/node_modules
COPY backend/ backend/
RUN cd backend && npm run build && npm prune --omit=dev

# Runtime stage: only production dependencies, compiled output, migrations and static assets.
FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app/backend
COPY --from=build /app/backend/package.json ./
COPY --from=build /app/backend/node_modules ./node_modules
COPY --from=build /app/backend/dist ./dist
COPY --from=build /app/backend/migrations ./migrations
COPY --from=build /app/backend/public ./public
# Run as the unprivileged user shipped with the node image.
USER node
EXPOSE 3000
CMD ["node", "dist/backend/src/main.js"]
