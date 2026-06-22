# Multi-stage build for CursorFusion
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .
RUN npm run build

# Production stage
FROM node:22-alpine AS runner

RUN addgroup -S -g 1001 cursorfusion \
    && adduser -S -u 1001 -G cursorfusion -s /bin/sh -d /app cursorfusion

WORKDIR /app

COPY --from=builder --chown=cursorfusion:cursorfusion /app/node_modules ./node_modules
COPY --from=builder --chown=cursorfusion:cursorfusion /app/dist ./dist
COPY --from=builder --chown=cursorfusion:cursorfusion /app/package.json ./package.json

USER cursorfusion

EXPOSE 3000

ENTRYPOINT ["node", "dist/index.js"]
CMD ["--help"]
