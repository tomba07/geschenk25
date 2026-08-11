FROM node:22-alpine AS build

WORKDIR /app
ARG VITE_API_URL=https://geschenk.mteschke.com
ENV VITE_API_URL=$VITE_API_URL

COPY package*.json ./
COPY apps ./apps
RUN npm ci
RUN npm run build:web

FROM nginx:1.27-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
