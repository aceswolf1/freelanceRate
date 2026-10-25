# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# freelancer-invoices · frontend image (Nuxt 4 -> .output/, nitro node-server)
# Multi-stage: build -> runtime (only .output, non-root).
#
# The browser only ever talks to this container: it calls same-origin `/api`,
# and Nitro proxies that to the backend on the internal network
# (NUXT_API_INTERNAL_BASE, default http://backend:4400). The API is never
# published, so no API URL or CORS origin has to match the NAS hostname.
# ---------------------------------------------------------------------------

# --- Stage 1: build the Nuxt app -------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

ENV NITRO_PRESET=node-server

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
    NUXT_API_INTERNAL_BASE=http://backend:4400

COPY --from=build --chown=node:node /app/.output ./.output

# Least privilege: never run as root.
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", ".output/server/index.mjs"]