FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package.json package-lock.json tsconfig.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/
COPY apps/server/package.json ./apps/server/

# Install all dependencies including devDependencies for build
RUN npm ci

# Copy full source trees
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web
COPY apps/server ./apps/server
COPY vite.config.ts index.html ./

# Build production web bundle into dist/
RUN npm run build

# Production runner stage
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/server/package.json ./apps/server/

RUN npm ci --omit=dev

COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/apps/server ./apps/server
COPY --from=builder /app/dist ./dist

EXPOSE 8080

CMD ["npx", "tsx", "apps/server/src/index.ts"]
