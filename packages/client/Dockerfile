FROM node:22-alpine
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/client/package.json packages/client/
RUN pnpm install --frozen-lockfile
COPY packages/shared/ packages/shared/
COPY packages/client/ packages/client/
CMD ["sh", "-c", "rm -rf packages/client/node_modules/.vite && pnpm --filter @mercuria/client dev --host"]
