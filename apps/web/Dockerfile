FROM node:22-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm@12.11.2

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web

RUN pnpm install --frozen-lockfile=false
RUN pnpm --filter @proxispeak/shared build
RUN pnpm --filter @proxispeak/web build

FROM nginx:alpine AS runner
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
