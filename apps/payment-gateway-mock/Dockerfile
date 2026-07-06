FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

FROM base AS deps
WORKDIR /app
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/payment-gateway-mock/package.json apps/payment-gateway-mock/
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/payment-gateway-mock/node_modules ./apps/payment-gateway-mock/node_modules
COPY . .
RUN pnpm --filter @ledgr/payment-gateway-mock build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/payment-gateway-mock/dist ./dist
COPY --from=builder /app/apps/payment-gateway-mock/package.json ./
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3002
CMD ["node", "dist/index.js"]
