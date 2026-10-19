# Production image: SvelteKit adapter-node build, SQLite on a volume at /data.
FROM node:24-slim AS deps
WORKDIR /app
# Toolchain for a native build when no prebuilt better-sqlite3 binary matches.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:24-slim AS run
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_PATH=/data/time-keep.db \
    PROTOCOL_HEADER=x-forwarded-proto \
    HOST_HEADER=x-forwarded-host \
    ADDRESS_HEADER=X-Forwarded-For \
    XFF_DEPTH=1 \
    BODY_SIZE_LIMIT=100M
COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/drizzle ./drizzle
RUN mkdir /data && chown node:node /data
USER node
EXPOSE 3000
VOLUME /data
HEALTHCHECK CMD node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "build"]
