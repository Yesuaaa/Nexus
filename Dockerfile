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
CMD ["pnpm", "dev", "--host", "0.0.0.0"]

FROM deps AS api-build
COPY apps/api apps/api
RUN pnpm --filter @nexus/api build

FROM deps AS web-build
COPY apps/web apps/web
# Nginx serves /api through the internal Docker network, so the browser uses a same-origin URL.
ENV VITE_API_URL=
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

FROM nginx:stable-alpine AS web
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=web-build /workspace/apps/web/dist /usr/share/nginx/html
EXPOSE 80
