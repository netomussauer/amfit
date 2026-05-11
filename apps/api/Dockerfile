# syntax=docker/dockerfile:1.7

# Stage 1 — build do binario Go com cache de modulos
# bookworm (Debian) ja vem com git pre-instalado, evitando dependencia
# de dl-cdn.alpinelinux.org durante o build (egress do no k3s-worker-cicd
# ainda apresenta intermitencia para esse host especifico).
FROM golang:1.22-bookworm AS builder

WORKDIR /src

# Cache layer de modulos. Kaniko nao suporta --mount=type=cache; em troca,
# go mod download popula /go/pkg/mod e o go.sum automaticamente. GOFLAGS=-mod=mod
# permite atualizar go.sum se ele estiver vazio/incompleto.
ENV GOFLAGS=-mod=mod
COPY go.mod go.sum ./
RUN go mod download

# Codigo da aplicacao
COPY cmd/        ./cmd/
COPY internal/   ./internal/
COPY pkg/        ./pkg/
COPY migrations/ ./migrations/

ARG VERSION=dev
ARG COMMIT=unknown

# Build estatico (CGO_DISABLED) com flags de tamanho minimo
RUN CGO_ENABLED=0 GOOS=linux go build \
        -trimpath \
        -ldflags="-s -w -X main.Version=${VERSION} -X main.Commit=${COMMIT}" \
        -o /out/server \
        ./cmd/server

# Stage 2 — runtime distroless
# - Sem package manager (evita apt/apk com egress restrito)
# - ca-certificates ja incluso
# - User nonroot (uid 65532) ja configurado pela imagem base
# - tag :nonroot e debian12-based
FROM gcr.io/distroless/static-debian12:nonroot

WORKDIR /app

COPY --from=builder --chown=nonroot:nonroot /out/server      /app/server
COPY --from=builder --chown=nonroot:nonroot /src/migrations/ /app/migrations/

USER nonroot:nonroot
EXPOSE 8080

# As chaves JWT vem montadas via Secret no K8s em /etc/jwt/
# (JWT_PRIVATE_KEY_PATH e JWT_PUBLIC_KEY_PATH apontam pra la)
ENTRYPOINT ["/app/server"]
