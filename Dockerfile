# syntax=docker/dockerfile:1
FROM node:24.22.1-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
# Optional corporate CA for TLS-inspecting builders; never copied to the image.
RUN --mount=type=secret,id=build_ca \
    if [ -f /run/secrets/build_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build_ca; fi; \
    npm ci --include=dev
COPY . .
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY \
    VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID
RUN npm run build:node

FROM node:24.22.1-bookworm-slim AS production
WORKDIR /app
ENV NODE_ENV=production TPEC_RUNTIME=node HOST=0.0.0.0 PORT=3000 \
    TPEC_DATA_DIR=/var/lib/tpecia SERVER_SHUTDOWN_TIMEOUT=1560
COPY --from=build --chown=node:node /app/.output ./.output
COPY --from=build --chown=node:node /app/scripts/start.mjs /app/scripts/worker.mjs /app/scripts/check-config.mjs /app/scripts/queue.mjs ./scripts/
COPY --from=build --chown=node:node /app/src/lib/runtime/config.server.ts /app/src/lib/runtime/queue.server.ts ./src/lib/runtime/
COPY --from=build --chown=node:node /app/package.json ./package.json
RUN mkdir -p /var/lib/tpecia && chown node:node /var/lib/tpecia && chmod 700 /var/lib/tpecia
USER node
EXPOSE 3000
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD ["node", "-e", "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "scripts/start.mjs"]
