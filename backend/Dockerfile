# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# freelancer-invoices · backend image (Express 5 + TypeScript, built to dist/)
# Multi-stage: deps -> build -> runtime (prod deps only, non-root).
# Target platform: TrueNAS SCALE (Docker) and any Compose v2 host.
# ---------------------------------------------------------------------------

# --- Stage 1: install every dependency (incl. devDependencies) -------------
FROM node:22-alpine AS deps
WORKDIR /app
# `npm ci` requires the lockfile; it must be committed.
COPY package.json package-lock.json ./
RUN npm ci

# --- Stage 2: compile TypeScript ------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
# `npm run build` is `tsc -p tsconfig.build.json`, which extends tsconfig.json —
# copy every tsconfig so the build works whichever configs the app ships.
COPY package.json package-lock.json ./
COPY tsconfig*.json ./
COPY src ./src
# Migration SQL + journal. Copied into dist/drizzle in the runtime stage so the
# programmatic migrator finds it regardless of whether it resolves the folder
# relative to the process CWD (./drizzle) or to this file (../drizzle).
COPY drizzle ./drizzle
RUN npm run build

# --- Stage 3: runtime (production dependencies only) -----------------------
FROM node:22-alpine AS runtime
WORKDIR /app

# HOST: the API binds 127.0.0.1 by default (hardening, see src/server.ts);
# inside a container it must listen on all interfaces so the frontend's
# /api proxy can reach it over the internal Docker network. Nothing publishes
# this port — only the frontend is exposed.
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4400 \
    RUN_MIGRATIONS=true

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/drizzle ./drizzle
COPY --from=build --chown=node:node /app/drizzle ./dist/drizzle

# Least privilege: never run as root.
USER node

EXPOSE 4400

# Dependency-free healthcheck (busybox has no curl by default; node does).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4400)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Apply pending migrations, then exec the server (PID 1 receives SIGTERM).
CMD ["sh", "-c", "if [ \"${RUN_MIGRATIONS:-true}\" = \"true\" ]; then node dist/db/migrate.js || exit 1; fi; exec node dist/server.js"]