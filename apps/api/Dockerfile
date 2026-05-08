# syntax=docker/dockerfile:1.7

# Stage 1 — build do binario Go com cache de modulos
FROM golang:1.22-alpine AS builder

RUN apk add --no-cache git

WORKDIR /src

# Cache layer de modulos
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go mod download

# Codigo da aplicacao
COPY cmd/      ./cmd/
COPY internal/ ./internal/
COPY pkg/      ./pkg/

ARG VERSION=dev
ARG COMMIT=unknown

# Build estatico (CGO_DISABLED) com flags de tamanho minimo
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux go build \
        -trimpath \
        -ldflags="-s -w -X main.Version=${VERSION} -X main.Commit=${COMMIT}" \
        -o /out/server \
        ./cmd/server

# Stage 2 — runtime minimo
FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata && \
    addgroup -g 1000 amfit && \
    adduser -u 1000 -G amfit -D -h /app amfit

WORKDIR /app

COPY --from=builder /out/server     /app/server
COPY --chown=amfit:amfit migrations/ /app/migrations/

USER amfit:amfit
EXPOSE 8080

# As chaves JWT vem montadas via Secret no K8s em /etc/jwt/
# (JWT_PRIVATE_KEY_PATH e JWT_PUBLIC_KEY_PATH apontam pra la)
ENTRYPOINT ["/app/server"]
