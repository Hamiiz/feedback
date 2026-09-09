# syntax = docker/dockerfile:1

ARG NODE_VERSION=22.21.1
FROM node:${NODE_VERSION}-slim AS base

LABEL fly_launch_runtime="Node.js/Prisma"

WORKDIR /app

ENV NODE_ENV="production"

# ─────────────────────────────────────────────
# Build stage
# ─────────────────────────────────────────────
FROM base AS build

RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y \
    build-essential \
    node-gyp \
    openssl \
    pkg-config \
    python-is-python3 && \
    rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY package-lock.json package.json ./

RUN npm install --include=dev

# Prisma schema
COPY prisma ./prisma

# Generate Prisma client
RUN npx prisma generate

# Application source
COPY . .

# Build application
RUN npm run build

# ─────────────────────────────────────────────
# Production stage
# ─────────────────────────────────────────────
FROM base

RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y openssl && \
    rm -rf /var/lib/apt/lists/* /var/cache/apt/archives

COPY --from=build /app /app

EXPOSE 8080

CMD ["sh", "-c", "npm run prisma:migrate && npm run start"]