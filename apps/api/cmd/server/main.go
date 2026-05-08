package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"
	"time"

	catalogapplication "github.com/amfit/api/internal/catalog/application"
	cataloghandlers "github.com/amfit/api/internal/catalog/handlers"
	cataloginfra "github.com/amfit/api/internal/catalog/infrastructure"
	execapplication "github.com/amfit/api/internal/execution/application"
	exechandlers "github.com/amfit/api/internal/execution/handlers"
	execinfra "github.com/amfit/api/internal/execution/infrastructure"
	identityapplication "github.com/amfit/api/internal/identity/application"
	identityhandlers "github.com/amfit/api/internal/identity/handlers"
	identityinfra "github.com/amfit/api/internal/identity/infrastructure"
	progressapplication "github.com/amfit/api/internal/progress/application"
	progresshandlers "github.com/amfit/api/internal/progress/handlers"
	progressinfra "github.com/amfit/api/internal/progress/infrastructure"
	trainingapplication "github.com/amfit/api/internal/training/application"
	traininghandlers "github.com/amfit/api/internal/training/handlers"
	traininginfra "github.com/amfit/api/internal/training/infrastructure"
	"github.com/amfit/api/pkg/auth"
	"github.com/amfit/api/pkg/cache"
	"github.com/amfit/api/pkg/config"
	"github.com/amfit/api/pkg/database"
	"github.com/amfit/api/pkg/middleware"
	"github.com/amfit/api/pkg/storage"
	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/cors"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

func main() {
	// ── Logger ────────────────────────────────────────────────────────
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})

	// ── Config ────────────────────────────────────────────────────────
	cfg := config.Load()

	if cfg.Env == "development" {
		zerolog.SetGlobalLevel(zerolog.DebugLevel)
	} else {
		zerolog.SetGlobalLevel(zerolog.InfoLevel)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// ── PostgreSQL ────────────────────────────────────────────────────
	pool, err := database.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatal().Err(err).Msg("failed to connect to PostgreSQL")
	}
	defer pool.Close()
	log.Info().Msg("PostgreSQL connected")

	// ── Migrations ────────────────────────────────────────────────────
	if err := database.RunMigrations(cfg.DatabaseURL, "migrations"); err != nil {
		log.Fatal().Err(err).Msg("failed to run migrations")
	}

	// ── Redis ─────────────────────────────────────────────────────────
	redisClient, err := cache.Connect(ctx, cfg.RedisURL)
	if err != nil {
		log.Fatal().Err(err).Msg("failed to connect to Redis")
	}
	defer redisClient.Close()
	log.Info().Msg("Redis connected")

	// ── MinIO ─────────────────────────────────────────────────────────
	minioClient, err := storage.NewClient(
		cfg.MinioEndpoint,
		cfg.MinioAccessKey,
		cfg.MinioSecretKey,
		cfg.MinioUseSSL,
	)
	if err != nil {
		log.Fatal().Err(err).Msg("failed to connect to MinIO")
	}

	startupCtx, startupCancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer startupCancel()

	for _, b := range []string{"exercicios", "evolucao", "coach-videos"} {
		if err := minioClient.EnsureBucket(startupCtx, b, "us-east-1"); err != nil {
			log.Fatal().Err(err).Str("bucket", b).Msg("failed to ensure MinIO bucket")
		}
	}
	log.Info().Msg("MinIO connected and buckets ensured")

	// Apenas o bucket de exercícios é público — evolucao e coach-videos
	// permanecem privados (acesso via presigned URL nas próximas fatias).
	if err := minioClient.SetBucketPublicRead(startupCtx, "exercicios"); err != nil {
		log.Warn().Err(err).Msg("falha ao aplicar policy public-read em exercicios — continuando")
	}

	// ── JWT keys ──────────────────────────────────────────────────────
	privateKey, publicKey, err := auth.LoadKeys(cfg.JWTPrivateKeyPath, cfg.JWTPublicKeyPath)
	if err != nil {
		log.Fatal().Err(err).Msg("failed to load JWT keys — run 'make keys' first")
	}
	log.Info().Msg("JWT keys loaded")

	// ── Wiring de dependências ────────────────────────────────────────

	// Identity
	identityRepos := identityinfra.NewPostgresRepositories(pool)
	identitySvc := identityapplication.NewIdentityService(
		identityRepos.Personal,
		identityRepos.Aluno,
		identityRepos.Credencial,
		identityRepos.RefreshTokens,
		privateKey,
		publicKey,
	)
	identityH := identityhandlers.NewIdentityHandler(identitySvc)

	// Catalog
	catalogRepos := cataloginfra.NewPostgresRepositories(pool)
	catalogStorage := cataloginfra.NewMinioStorage(minioClient, cfg.MidiaPublicURL)
	catalogSvc := catalogapplication.NewCatalogService(
		catalogRepos.GruposMusculares,
		catalogRepos.Exercicios,
		catalogStorage,
	)
	catalogH := cataloghandlers.NewCatalogHandler(catalogSvc)

	// Training
	trainingRepos := traininginfra.NewPostgresRepositories(pool)
	trainingSvc := trainingapplication.NewTrainingService(
		trainingRepos.Fichas,
		trainingRepos.Treinos,
		trainingRepos.Itens,
		trainingRepos.FichaCompleta,
		trainingRepos.TreinoHoje,
		trainingRepos.AlunoLookup,
	)
	trainingH := traininghandlers.NewTrainingHandler(trainingSvc)

	// Execution
	execRepos := execinfra.NewPostgresRepositories(pool)
	_ = execRepos
	execSvc := execapplication.NewExecutionService(nil, nil)
	execH := exechandlers.NewExecutionHandler(execSvc)

	// Progress
	progressRepos := progressinfra.NewPostgresRepositories(pool)
	_ = progressRepos
	progressSvc := progressapplication.NewProgressService(nil, nil)
	progressH := progresshandlers.NewProgressHandler(progressSvc)

	// ── Fiber app ─────────────────────────────────────────────────────
	app := fiber.New(fiber.Config{
		AppName:      "AMFIT API",
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second,
	})

	app.Use(middleware.Recovery())
	app.Use(middleware.Logger())
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowMethods: "GET,POST,PUT,PATCH,DELETE,OPTIONS",
		AllowHeaders: "Origin,Content-Type,Authorization",
	}))

	// ── Rotas públicas ────────────────────────────────────────────────
	app.Get("/healthz", func(c fiber.Ctx) error {
		if err := database.Healthcheck(c.Context(), pool); err != nil {
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
				"status": "degraded",
				"db":     err.Error(),
			})
		}
		return c.JSON(fiber.Map{"status": "ok"})
	})

	app.Get("/readyz", func(c fiber.Ctx) error {
		dbErr := database.Healthcheck(c.Context(), pool)
		redisErr := cache.Ping(c.Context(), redisClient)

		if dbErr != nil || redisErr != nil {
			body := fiber.Map{"status": "not_ready"}
			if dbErr != nil {
				body["db"] = dbErr.Error()
			}
			if redisErr != nil {
				body["redis"] = redisErr.Error()
			}
			return c.Status(fiber.StatusServiceUnavailable).JSON(body)
		}
		return c.JSON(fiber.Map{"status": "ready"})
	})

	// ── Rotas de API ──────────────────────────────────────────────────
	api := app.Group("/api/v1")

	// Públicas (auth: register-personal, login, refresh)
	identityH.RegisterPublic(api)

	protected := api.Group("", middleware.NewAuthMiddleware(publicKey))

	// Autenticadas (qualquer role): /auth/logout
	identityH.RegisterAuthenticated(protected)

	// Restritas a PERSONAL: CRUD de alunos + gestão de fichas/treinos
	personalOnly := protected.Group("", middleware.RequireRole("PERSONAL"))
	identityH.RegisterPersonalRoutes(personalOnly)
	trainingH.RegisterPersonalRoutes(personalOnly)

	// Restritas a ALUNO: /alunos/me, /alunos/me/treino-hoje, /alunos/me/ficha
	alunoOnly := protected.Group("", middleware.RequireRole("ALUNO"))
	identityH.RegisterAlunoRoutes(alunoOnly)
	trainingH.RegisterAlunoRoutes(alunoOnly)

	catalogH.Register(protected)
	execH.Register(protected)
	progressH.Register(protected)

	// ── Graceful shutdown ─────────────────────────────────────────────
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGTERM, syscall.SIGINT)

	go func() {
		<-quit
		log.Info().Msg("shutting down server...")
		if err := app.ShutdownWithTimeout(10 * time.Second); err != nil {
			log.Error().Err(err).Msg("server shutdown error")
		}
	}()

	log.Info().Str("port", cfg.Port).Msg("starting AMFIT API")
	if err := app.Listen(":" + cfg.Port); err != nil {
		log.Fatal().Err(err).Msg("server error")
	}
}
