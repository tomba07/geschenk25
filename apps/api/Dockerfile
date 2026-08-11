FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
COPY apps ./apps
RUN npm ci
RUN npm run build:api

ENV NODE_ENV=production \
    PORT=3000 \
    RUN_MIGRATIONS_ON_START=true

EXPOSE 3000
CMD ["npm", "run", "start:api"]
