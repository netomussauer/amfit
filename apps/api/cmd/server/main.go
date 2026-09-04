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
	notificationapplication "github.com/amfit/api/internal/notification/application"
	notificationhandlers "github.com/amfit/api/internal/notification/handlers"
	notificationinfra "github.com/amfit/api/internal/notification/infrastructure"
	notificationworker "github.com/amfit/api/internal/notification/worker"
	progressapplication "github.com/amfit/api/internal/progress/application"
	progressdomain "github.com/amfit/api/internal/progress/domain"
	progresshandlers "github.com/amfit/api/internal/progress/handlers"
	progressinfra "github.com/amfit/api/internal/progress/infrastructure"
	trainingapplication "github.com/amfit/api/internal/training/application"
	trainingdomain "github.com/amfit/api/internal/training/domain"
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
	"github.com/google/uuid"
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
		trainingRepos.Templates,
	)
	trainingH := traininghandlers.NewTrainingHandler(trainingSvc)

	// Notification
	notificationRepos := notificationinfra.NewPostgresRepositories(pool)
	notificationSvc := notificationapplication.NewNotificationService(
		notificationRepos.Tokens,
		notificationRepos.Notifs,
	)
	notificationH := notificationhandlers.NewNotificationHandler(notificationSvc)

	// Execution
	execRepos := execinfra.NewPostgresRepositories(pool)
	execSvc := execapplication.NewExecutionService(
		execRepos.Sessoes,
		execRepos.Registros,
		execRepos.TreinoLookup,
		execRepos.AlunoLookup,
		// notificationSvc satisfaz execapplication.Notifier por assinatura de
		// método (mesmo padrão do templateMatcherAdapter abaixo, mas aqui não
		// precisa de adapter — as assinaturas já batem).
		notificationSvc,
	)
	execH := exechandlers.NewExecutionHandler(execSvc)

	// Progress
	progressRepos := progressinfra.NewPostgresRepositories(pool)
	progressSvc := progressapplication.NewProgressService(
		progressRepos.Historico,
		progressRepos.Dashboard,
		progressRepos.Access,
		progressRepos.Anamnese,
		templateMatcherAdapter{templates: trainingRepos.Templates},
	)
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
		// Fiber v3 mudou estes campos de string para []string.
		AllowOrigins: []string{"*"},
		AllowMethods: []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders: []string{"Origin", "Content-Type", "Authorization"},
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
	//
	// Em Fiber v3, fiber.Router.Group("", middleware) muta o router pai e
	// contamina rotas registradas depois — uma chamada como
	// `api.Group("", auth, requirePersonal)` faz com que TODAS as rotas
	// registradas posteriormente em `api` (mesmo via outros sub-grupos)
	// herdem `requirePersonal`. Por isso aplicamos os middlewares POR ROTA
	// via `middleware.Chain` dentro de cada Register*; o router `api` fica
	// "limpo", sem middlewares acumulados.
	auth := middleware.NewAuthMiddleware(publicKey)
	requirePersonal := middleware.RequireRole("PERSONAL")
	requireAluno := middleware.RequireRole("ALUNO")

	api := app.Group("/api/v1")

	// Públicas (sem middleware): register-personal, login, refresh
	identityH.RegisterPublic(api)

	// Autenticadas (qualquer role): /auth/logout, /grupos-musculares,
	// /exercicios (GET), /push-token.
	identityH.RegisterAuthenticated(api, auth)
	catalogH.Register(api, auth)
	notificationH.RegisterAuthenticated(api, auth)

	// IMPORTANTE: registramos as rotas do ALUNO ANTES das do PERSONAL.
	// Fiber v3 resolve rotas pela ORDEM DE REGISTRO (não por especificidade),
	// então `/alunos/me` precisa estar registrada antes de `/alunos/:id` para
	// não cair na rota paramétrica. Mesmo raciocínio para `/alunos/me/sessoes`
	// vs `/alunos/:alunoId/sessoes`.

	// Restritas a ALUNO: /alunos/me, /alunos/me/treino-hoje, /alunos/me/ficha,
	// /sessoes/*, /alunos/me/sessoes (historico) e /alunos/me/progresso/*.
	identityH.RegisterAlunoRoutes(api, auth, requireAluno)
	trainingH.RegisterAlunoRoutes(api, auth, requireAluno)
	execH.RegisterAlunoRoutes(api, auth, requireAluno)
	progressH.RegisterAlunoRoutes(api, auth, requireAluno)

	// Restritas a PERSONAL: CRUD de alunos + gestao de fichas/treinos +
	// /alunos/:id/progresso/* + /dashboard.
	identityH.RegisterPersonalRoutes(api, auth, requirePersonal)
	trainingH.RegisterPersonalRoutes(api, auth, requirePersonal)
	execH.RegisterPersonalRoutes(api, auth, requirePersonal)
	progressH.RegisterPersonalRoutes(api, auth, requirePersonal)

	// ── Notification Dispatcher (worker em background) ─────────────────
	//
	// Primeiro processo de longa duração deste binário (todo o resto é
	// request/response) — roda sob um contexto próprio, cancelado no
	// graceful shutdown junto com o servidor HTTP.
	workerCtx, cancelWorker := context.WithCancel(context.Background())
	dispatcher := notificationworker.NewDispatcher(
		notificationRepos.Notifs,
		notificationRepos.Tokens,
		notificationinfra.NewExpoPushClient(),
		30*time.Second,
	)
	go dispatcher.Run(workerCtx)
	log.Info().Msg("notification dispatcher started")

	// ── Graceful shutdown ─────────────────────────────────────────────
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGTERM, syscall.SIGINT)

	go func() {
		<-quit
		log.Info().Msg("shutting down server...")
		cancelWorker()
		if err := app.ShutdownWithTimeout(10 * time.Second); err != nil {
			log.Error().Err(err).Msg("server shutdown error")
		}
	}()

	log.Info().Str("port", cfg.Port).Msg("starting AMFIT API")
	if err := app.Listen(":" + cfg.Port); err != nil {
		log.Fatal().Err(err).Msg("server error")
	}
}

// templateMatcherAdapter implementa progressdomain.TemplateMatcher em cima
// de trainingdomain.TemplateTreinoRepository. Vive aqui (não em nenhum dos
// dois pacotes de infrastructure) porque é o único lugar que já importa
// ambos os bounded contexts — nem Progress nem Training precisam conhecer
// o tipo de retorno um do outro.
type templateMatcherAdapter struct {
	templates trainingdomain.TemplateTreinoRepository
}

func (a templateMatcherAdapter) MelhorMatch(
	ctx context.Context,
	personalID uuid.UUID,
	nivel, objetivo string,
) (*progressdomain.TemplateMatch, error) {
	t, err := a.templates.MelhorMatch(ctx, personalID, nivel, objetivo)
	if err != nil {
		return nil, err
	}
	if t == nil {
		return nil, nil
	}
	return &progressdomain.TemplateMatch{ID: t.ID, Nome: t.Nome}, nil
}
