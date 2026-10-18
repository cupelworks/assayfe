# Assay's front end as a container: the app built with Node, then served by nginx (unprivileged,
# port 8080), which also forwards /api to the API. Both images are pinned by digest.
#
#   docker build --build-arg VERSION=2.5.0 --build-arg REVISION=$(git rev-parse HEAD) -t assay-fe:2.5.0 .
#   docker run --rm -p 8080:8080 -e ASSAY_API_URL=http://host.docker.internal:8000 assay-fe:2.5.0

FROM node:26.12.0-alpine@sha256:6f08a523443ddedf52941874c203475b0ad503e859ad70cb26ab8be9a517dbd5 AS build

WORKDIR /app

# The dependencies first, so a change to the code alone reuses them. No install script runs.
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund

COPY angular.json tsconfig.json tsconfig.app.json ./
COPY public/ ./public/
COPY src/ ./src/
RUN npx ng build

FROM nginxinc/nginx-unprivileged:1.30.6-alpine@sha256:782bb89768cc87b7f95c18b95baa1af250e5d451f26794f59363540161147c01

# The release, as the deploy pipeline passes it: package.json's version and the commit.
ARG VERSION=dev
ARG REVISION=unknown
LABEL org.opencontainers.image.title="assay-fe" \
      org.opencontainers.image.description="Assay's front end: the web interface for Assay's API" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${REVISION}" \
      org.opencontainers.image.source="https://github.com/cupelworks/assayfe" \
      org.opencontainers.image.url="https://github.com/cupelworks/assayfe" \
      org.opencontainers.image.licenses="AGPL-3.0-only"

# The largest upload nginx lets through to the API, in MB: one more than the API's own limit
# (ASSAY_DATASET_UPLOAD_MAX_MB, 10 by default), for the form around the file. ASSAY_API_URL, the
# API's address, has no default: the container stops at once without it.
ENV ASSAY_UPLOAD_MAX_MB=11 \
    NGINX_ENVSUBST_FILTER=^ASSAY_

COPY nginx/05-assay-env.envsh /docker-entrypoint.d/
COPY nginx/security-headers.conf /etc/nginx/assay/
COPY nginx/default.conf.template /etc/nginx/templates/
COPY --from=build /app/dist/AssayFE/browser/ /usr/share/nginx/html/

EXPOSE 8080
