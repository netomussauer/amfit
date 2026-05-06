package database

import (
	"errors"
	"fmt"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/rs/zerolog/log"
)

// RunMigrations aplica todas as migrations pendentes no banco.
// migrationsPath deve ser um caminho relativo ou absoluto para o diretório de migrations,
// sem o prefixo "file://".
func RunMigrations(databaseURL, migrationsPath string) error {
	source := "file://" + migrationsPath

	m, err := migrate.New(source, databaseURL)
	if err != nil {
		return fmt.Errorf("migrate: init: %w", err)
	}
	defer func() {
		srcErr, dbErr := m.Close()
		if srcErr != nil {
			log.Error().Err(srcErr).Msg("migrate: close source error")
		}
		if dbErr != nil {
			log.Error().Err(dbErr).Msg("migrate: close db error")
		}
	}()

	if err := m.Up(); err != nil {
		if errors.Is(err, migrate.ErrNoChange) {
			log.Info().Msg("migrate: no pending migrations")
			return nil
		}
		return fmt.Errorf("migrate: up: %w", err)
	}

	version, dirty, err := m.Version()
	if err != nil {
		log.Warn().Err(err).Msg("migrate: could not read version after up")
		return nil
	}

	log.Info().
		Uint("version", version).
		Bool("dirty", dirty).
		Msg("migrate: migrations applied successfully")

	return nil
}
