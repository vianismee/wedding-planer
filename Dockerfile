FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

FROM node:24-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Worker pengingat termin: hanya butuh bullmq dan ioredis.
FROM node:24-alpine AS worker
WORKDIR /app
ENV NODE_ENV=production
RUN npm init -y >/dev/null && npm install --omit=dev --ignore-scripts bullmq@6 ioredis@6 >/dev/null
COPY src/worker ./src/worker
USER node
CMD ["node", "src/worker/index.ts"]

FROM node:24-alpine AS app
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/drizzle ./drizzle
USER node
EXPOSE 3000
CMD ["node", "server.js"]
