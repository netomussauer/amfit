BINARY     := bin/server
MAIN       := ./cmd/server
MIGRATIONS := migrations
DB_URL     ?= postgres://amfit:amfit@localhost:5432/amfit?sslmode=disable

.PHONY: dev build test lint migrate-up migrate-down keys docker-up

## dev: executa o servidor com go run (hot path para desenvolvimento)
dev:
	go run $(MAIN)

## build: compila o binário otimizado em bin/server
build:
	go build -ldflags="-s -w" -o $(BINARY) $(MAIN)

## test: executa todos os testes com race detector
test:
	go test ./... -race -count=1

## lint: executa o linter completo
lint:
	golangci-lint run ./...

## migrate-up: aplica todas as migrations pendentes
migrate-up:
	migrate -path $(MIGRATIONS) -database "$(DB_URL)" up

## migrate-down: reverte a última migration aplicada
migrate-down:
	migrate -path $(MIGRATIONS) -database "$(DB_URL)" down 1

## keys: gera par de chaves RSA-4096 para JWT em keys/
keys:
	@mkdir -p keys
	openssl genrsa -out keys/private.pem 4096
	openssl rsa -in keys/private.pem -pubout -out keys/public.pem
	@echo "Keys generated: keys/private.pem  keys/public.pem"

## docker-up: sobe os serviços de infraestrutura via docker compose na raiz do monorepo
docker-up:
	docker compose -f ../../docker-compose.yml up -d
