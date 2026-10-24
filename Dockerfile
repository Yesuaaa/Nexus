# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@12.7.0 --activate
WORKDIR /workspace

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile

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
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm --filter @nexus/api install --prod --frozen-lockfile
COPY --from=api-build /workspace/apps/api/dist /workspace/apps/api/dist
WORKDIR /workspace/apps/api
EXPOSE 3001
USER node
CMD ["node", "dist/index.js"]

FROM nginx:stable-alpine AS web
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=web-build /workspace/apps/web/dist /usr/share/nginx/html
EXPOSE 80
