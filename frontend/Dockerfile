# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# freelancer-invoices · frontend image (Nuxt 4 -> .output/, nitro node-server)
# Multi-stage: build -> runtime (only .output, non-root).
#
# IMPORTANT (TrueNAS / reverse-proxy setups):
#   NUXT_PUBLIC_API_BASE is a *public* runtimeConfig value, so it is read by the
#   browser at runtime, not by the server. It MUST be the URL the *browser* can
#   reach — e.g. `http://truenas.local:4400/api`. Never `http://backend:4400/api`
#   (that name only resolves inside the Compose network).
# ---------------------------------------------------------------------------

# --- Stage 1: build the Nuxt app -------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

# Build-time fallback only. The real value is supplied at RUNTIME by Compose
# (environment:) and overrides this baked-in default.
ARG NUXT_PUBLIC_API_BASE=http://localhost:4400/api
ENV NUXT_PUBLIC_API_BASE=${NUXT_PUBLIC_API_BASE} \
    NITRO_PRESET=node-server

# `npm ci` requires the lockfile; it must be committed.
COPY package.json package-lock.json ./
# Build-time tooling (tailwind, @tailwindcss/vite) lives in devDependencies, so
# it MUST be installed here — NODE_ENV=production would make npm skip it.
RUN npm ci --include=dev

COPY . .
RUN npm run build

# --- Stage 2: runtime (self-contained nitro output) -------------------------
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    NITRO_PRESET=node-server \
    HOST=0.0.0.0 \
    PORT=3000 \
    NUXT_PORT=3000 \
    NUXT_PUBLIC_API_BASE=http://localhost:4400/api

COPY --from=build --chown=node:node /app/.output ./.output

# Least privilege: never run as root.
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", ".output/server/index.mjs"]