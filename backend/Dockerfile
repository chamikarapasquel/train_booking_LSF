# ── Stage 1: builder ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src

# Build the main application (src/ → dist/)
RUN npm run build

# Compile the seed file separately — it lives in prisma/ (outside rootDir),
# run tsc directly on just that one file.
RUN node_modules/.bin/tsc \
    --module CommonJS \
    --target ES2020 \
    --esModuleInterop true \
    --skipLibCheck true \
    --outDir dist/prisma \
    prisma/seed.ts

# ── Stage 2: lean production runner ───────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache openssl

# Production-only dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Compiled application
COPY --from=builder /app/dist                  ./dist

# Prisma client (generated in builder, not in prod node_modules yet)
COPY --from=builder /app/node_modules/.prisma  ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma  ./node_modules/@prisma

# Migration files (prisma migrate deploy reads these at runtime)
COPY prisma ./prisma

# On startup:
#   1. Apply any pending DB migrations
#   2. Run the idempotent seed (upserts stations/coaches/seats — safe to re-run)
#   3. Start the Express server
CMD ["sh", "-c", \
  "npx prisma migrate deploy && node dist/prisma/seed.js && node dist/index.js"]
