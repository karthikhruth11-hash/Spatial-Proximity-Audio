FROM node:22-alpine AS base
WORKDIR /app
RUN npm install -g pnpm@12.11.2

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/server apps/server

RUN pnpm install --frozen-lockfile=false
RUN pnpm --filter @proxispeak/shared build
RUN pnpm --filter @proxispeak/server build

EXPOSE 4000
CMD ["pnpm", "--filter", "@proxispeak/server", "start"]
