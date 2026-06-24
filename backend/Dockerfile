FROM node:20-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma

RUN npm ci --omit=dev

COPY src ./src
COPY test-client.js ./
COPY docker-entrypoint.sh ./docker-entrypoint.sh

RUN chown -R node:node /app

USER node

EXPOSE 3001

CMD ["sh", "./docker-entrypoint.sh"]
