# KAFD Ops Console — Cloud Run image.
# Stage 1: typecheck + Vite build (base '/', unlike the GitHub Pages build).
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: nginx serves the static bundle on Cloud Run's $PORT.
# The official image templates /etc/nginx/templates/*.template with envsubst.
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.default.conf.template /etc/nginx/templates/default.conf.template
ENV PORT=8080
EXPOSE 8080
