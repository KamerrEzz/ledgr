FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

FROM base AS deps
WORKDIR /app
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/db/package.json packages/db/
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/event-bus/package.json packages/event-bus/
COPY apps/backend/package.json apps/backend/
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/packages/shared-types/node_modules ./packages/shared-types/node_modules
COPY --from=deps /app/packages/event-bus/node_modules ./packages/event-bus/node_modules
COPY --from=deps /app/apps/backend/node_modules ./apps/backend/node_modules
COPY . .
RUN pnpm --filter @ledgr/db build
RUN pnpm --filter @ledgr/shared-types build
RUN pnpm --filter @ledgr/event-bus build
RUN pnpm --filter @ledgr/backend build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/backend/dist ./dist
COPY --from=builder /app/apps/backend/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/db/dist ../packages/db/dist
COPY --from=builder /app/packages/db/package.json ../packages/db/
COPY --from=builder /app/packages/shared-types/dist ../packages/shared-types/dist
COPY --from=builder /app/packages/shared-types/package.json ../packages/shared-types/
COPY --from=builder /app/packages/event-bus/dist ../packages/event-bus/dist
COPY --from=builder /app/packages/event-bus/package.json ../packages/event-bus/
EXPOSE 3001
CMD ["node", "dist/index.js"]
