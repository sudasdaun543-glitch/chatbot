FROM node:24-slim AS base
RUN npm install -g pnpm@10

# ---- Build stage ----
FROM base AS builder
WORKDIR /app
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY lib/db/package.json ./lib/db/
COPY lib/api-spec/package.json ./lib/api-spec/
COPY lib/api-zod/package.json ./lib/api-zod/
COPY lib/api-client-react/package.json ./lib/api-client-react/
COPY artifacts/chat-simulator/package.json ./artifacts/chat-simulator/
COPY artifacts/api-server/package.json ./artifacts/api-server/
RUN pnpm install --frozen-lockfile
COPY tsconfig.base.json tsconfig.json ./
COPY lib/ ./lib/
COPY artifacts/ ./artifacts/
RUN pnpm run typecheck:libs
ENV NODE_ENV=production
ENV PORT=3000
ENV BASE_PATH=/
RUN pnpm --filter @workspace/chat-simulator run build
RUN pnpm --filter @workspace/api-server run build

# ---- Final image ----
FROM node:24-slim AS runner
WORKDIR /app
RUN npm install -g pnpm@10
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY lib/db/package.json ./lib/db/
COPY lib/api-zod/package.json ./lib/api-zod/
COPY artifacts/api-server/package.json ./artifacts/api-server/
RUN pnpm install --prod --frozen-lockfile
COPY lib/db/ ./lib/db/
COPY lib/api-zod/ ./lib/api-zod/
COPY --from=builder /app/artifacts/api-server/dist ./artifacts/api-server/dist
COPY --from=builder /app/artifacts/chat-simulator/dist/public ./artifacts/api-server/dist/public
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["node", "--enable-source-maps", "./artifacts/api-server/dist/index.mjs"]
