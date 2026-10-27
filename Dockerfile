# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@12.7.0 --activate
WORKDIR /workspace

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches patches
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS api-dev
COPY apps/api apps/api
COPY certs/supabase-root-2021.crt /workspace/certs/supabase-root-2021.crt
ENV NODE_EXTRA_CA_CERTS=/workspace/certs/supabase-root-2021.crt
WORKDIR /workspace/apps/api
EXPOSE 3001
CMD ["pnpm", "dev"]

FROM deps AS web-dev
COPY apps/web apps/web
WORKDIR /workspace/apps/web
EXPOSE 5173
# Watchpack polling supports source mounts on Docker Desktop.
CMD ["pnpm", "dev", "--webpack"]

FROM deps AS api-build
COPY apps/api apps/api
RUN pnpm --filter @nexus/api build

FROM deps AS web-build
COPY apps/web apps/web
# Next.js rewrites are resolved at build time for the internal API service.
ARG API_PROXY_TARGET=http://api:3001
ENV API_PROXY_TARGET=$API_PROXY_TARGET
ENV NEXT_PUBLIC_API_URL=
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @nexus/web build

FROM base AS api
ENV NODE_ENV=production
ENV NODE_EXTRA_CA_CERTS=/workspace/certs/supabase-root-2021.crt
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm --filter @nexus/api install --prod --frozen-lockfile
COPY certs/supabase-root-2021.crt /workspace/certs/supabase-root-2021.crt
COPY --from=api-build /workspace/apps/api/dist /workspace/apps/api/dist
WORKDIR /workspace/apps/api
EXPOSE 3001
USER node
CMD ["node", "dist/index.js"]

FROM base AS web
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=5173
COPY --from=web-build --chown=node:node /workspace/apps/web/.next/standalone ./
EXPOSE 5173
USER node
CMD ["node", "apps/web/server.js"]
