# syntax=docker/dockerfile:1

# ---- build: compile TypeScript -> dist ----
FROM node:24-slim AS build
WORKDIR /app
# Toolchain for native modules (argon2) if no prebuilt binary is available.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- prod-deps: production-only node_modules (argon2 compiled for runtime) ----
# Separate stage so the runtime image carries no dev dependencies. Same glibc base
# as runtime, so the native argon2 binary is ABI-compatible.
FROM node:24-slim AS prod-deps
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---- runtime: minimal, non-root ----
FROM node:24-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
# Run as the image's built-in unprivileged user.
USER node
EXPOSE 4000
# Node 24 ships a global fetch; no curl/wget needed in the slim image.
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||4000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server.js"]
