# Two-stage build: Vite frontend + zero-dependency Node API in one image.
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8787 \
    HOST=0.0.0.0
COPY --from=build /app/dist ./dist
COPY server ./server
COPY scripts ./scripts
COPY package.json ./package.json
RUN mkdir -p data
EXPOSE 8787
VOLUME ["/app/data"]
CMD ["node", "server/index.mjs"]
