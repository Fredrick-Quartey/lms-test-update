# Frontend image: build with Node, serve the static build with nginx.
FROM node:22-alpine AS build
WORKDIR /repo
COPY packages/api-client ./packages/api-client
COPY apps/frontend/package.json apps/frontend/package-lock.json ./apps/frontend/
RUN cd apps/frontend && npm ci
COPY apps/frontend ./apps/frontend
ARG VITE_API_BASE_URL=/api/v1
ARG VITE_USE_MOCKS=true
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL VITE_USE_MOCKS=$VITE_USE_MOCKS
RUN cd apps/frontend && npm run build

FROM nginx:1.27-alpine
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/frontend/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK CMD wget -qO- http://localhost/ >/dev/null || exit 1
