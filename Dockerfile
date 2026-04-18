# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
WORKDIR /app

# Install prod dependencies using lockfile
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy app source
COPY . .

# Ensure data/uploads dirs exist even before volume mount (harmless fallback)
RUN mkdir -p /var/data /var/data/uploads

ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/var/data \
    UPLOADS_DIR=/var/data/uploads

EXPOSE 3000

# seed.js is idempotent (checks existing users), so it's safe to run on each start
CMD ["sh", "-c", "node seed.js && node server.js"]
