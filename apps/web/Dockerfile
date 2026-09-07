FROM node:22-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-workspace.yaml ./
COPY apps/web ./apps/web

RUN pnpm install --filter web --ignore-scripts
RUN pnpm --filter web build

FROM nginx:alpine AS runner

# Copy built frontend
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# Copy nginx config with API proxy
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 5004

CMD ["nginx", "-g", "daemon off;"]
