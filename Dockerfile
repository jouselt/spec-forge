# Multi-stage: build the Angular app, then serve it with nginx.
# Nobody needs Node installed locally — `docker compose up` builds everything.
#
# --platform=$BUILDPLATFORM pins the build stage to the host's native arch even when
# cross-building for another target. The build output (static HTML/JS/CSS) is
# arch-independent, so there is no reason to run npm under QEMU, and emulated npm
# installs are known to corrupt esbuild/rollup's platform-specific native binaries,
# which surfaces as unrelated-looking module-resolution errors.
FROM --platform=$BUILDPLATFORM node:22-alpine AS build
WORKDIR /app

# husky's prepare script has nothing to install inside a container with no git dir.
ENV HUSKY=0

COPY package.json package-lock.json* ./
RUN npm ci 2>/dev/null || npm install

COPY . .

# BASE_HREF defaults to / for a root deploy. GitHub Pages serves a subpath, so the
# Pages workflow passes --build-arg BASE_HREF=/spec-forge/.
ARG BASE_HREF=/
RUN npm run typecheck && npx ng build --base-href "$BASE_HREF"

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/spec-forge /usr/share/nginx/html
