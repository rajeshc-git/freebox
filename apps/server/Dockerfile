FROM node:22-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-workspace.yaml ./
COPY apps/server ./apps/server

RUN pnpm install --filter server --ignore-scripts

WORKDIR /app/apps/server
ENV DATABASE_URL="file:./dev.db"
RUN pnpm prisma:generate
RUN pnpm build

FROM node:22-alpine AS runner

WORKDIR /app/apps/server

COPY package.json /app/
COPY pnpm-workspace.yaml /app/
COPY apps/server/package.json ./
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/apps/server/dist ./dist
COPY --from=builder /app/apps/server/prisma ./prisma
COPY --from=builder /app/apps/server/node_modules ./node_modules

EXPOSE 5005

CMD ["sh", "-c", "npx prisma db push --skip-generate && node --max-old-space-size=384 dist/main.js"]

