// Package pgtest sobe um PostgreSQL descartável (testcontainers) para os testes
// de integração dos repositórios.
//
// Um único container por binário de teste: na primeira chamada ele é criado e
// as migrations do projeto são aplicadas num banco-template. Cada teste recebe
// um banco próprio, clonado desse template (CREATE DATABASE ... TEMPLATE), o
// que dá isolamento total em milissegundos, sem reaplicar migrations.
//
// Os testes que usam este pacote devem ficar atrás da build tag `integration`
// (`go test -tags=integration ./...`): o `go test ./...` do CI roda num pod sem
// acesso ao Docker.
//
// O container é removido pelo Ryuk (reaper do testcontainers) ao fim do
// processo. Nunca aponte estes testes para o Postgres compartilhado do lab.
package pgtest

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"runtime"
	"sync"
	"testing"
	"time"

	"github.com/amfit/api/pkg/database"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/wait"
)

const (
	defaultImage = "postgres:16-alpine"
	templateDB   = "amfit_template"
)

type server struct {
	baseURL *url.URL // aponta para o banco administrativo "postgres"
}

var (
	once    sync.Once
	srv     *server
	srvErr  error
	srvLock sync.Mutex
)

// NewDB devolve um pool conectado a um banco novo, já migrado e vazio. O banco
// é removido ao fim do teste.
func NewDB(t testing.TB) *pgxpool.Pool {
	t.Helper()

	s := shared(t)
	ctx := context.Background()

	name := "t_" + randomHex(6)

	admin, err := pgx.Connect(ctx, s.baseURL.String())
	if err != nil {
		t.Fatalf("pgtest: conectar como admin: %v", err)
	}
	defer admin.Close(ctx)

	if _, err := admin.Exec(ctx, fmt.Sprintf(`CREATE DATABASE %s TEMPLATE %s`, name, templateDB)); err != nil {
		t.Fatalf("pgtest: clonar template: %v", err)
	}

	pool, err := pgxpool.New(ctx, s.dbURL(name))
	if err != nil {
		t.Fatalf("pgtest: abrir pool: %v", err)
	}

	t.Cleanup(func() {
		pool.Close()
		conn, err := pgx.Connect(ctx, s.baseURL.String())
		if err != nil {
			return
		}
		defer conn.Close(ctx)
		_, _ = conn.Exec(ctx, fmt.Sprintf(`DROP DATABASE IF EXISTS %s WITH (FORCE)`, name))
	})

	return pool
}

func shared(t testing.TB) *server {
	t.Helper()
	srvLock.Lock()
	defer srvLock.Unlock()

	once.Do(func() { srv, srvErr = start() })
	if srvErr != nil {
		t.Fatalf("pgtest: subir PostgreSQL de teste (Docker disponivel?): %v", srvErr)
	}
	return srv
}

func start() (*server, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
	defer cancel()

	image := os.Getenv("PGTEST_IMAGE")
	if image == "" {
		image = defaultImage
	}

	ctr, err := postgres.RunContainer(ctx,
		testcontainers.WithImage(image),
		postgres.WithDatabase("postgres"),
		postgres.WithUsername("test"),
		postgres.WithPassword("test"),
		testcontainers.WithWaitStrategy(
			wait.ForLog("database system is ready to accept connections").
				WithOccurrence(2).
				WithStartupTimeout(90*time.Second),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("run container: %w", err)
	}

	connStr, err := ctr.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		return nil, fmt.Errorf("connection string: %w", err)
	}
	base, err := url.Parse(connStr)
	if err != nil {
		return nil, fmt.Errorf("parse connection string: %w", err)
	}
	s := &server{baseURL: base}

	admin, err := pgx.Connect(ctx, base.String())
	if err != nil {
		return nil, fmt.Errorf("conectar como admin: %w", err)
	}
	defer admin.Close(ctx)

	if _, err := admin.Exec(ctx, `CREATE DATABASE `+templateDB); err != nil {
		return nil, fmt.Errorf("criar template: %w", err)
	}
	if err := database.RunMigrations(s.dbURL(templateDB), migrationsDir()); err != nil {
		return nil, fmt.Errorf("migrations: %w", err)
	}
	return s, nil
}

func (s *server) dbURL(db string) string {
	u := *s.baseURL
	u.Path = "/" + db
	return u.String()
}

// migrationsDir resolve apps/api/migrations a partir deste arquivo, para os
// testes funcionarem de qualquer diretório de pacote.
func migrationsDir() string {
	_, file, _, _ := runtime.Caller(0)
	return filepath.Join(filepath.Dir(file), "..", "..", "..", "migrations")
}

func randomHex(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
