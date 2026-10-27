//go:build integration

package infrastructure_test

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/amfit/api/internal/notification/domain"
	"github.com/amfit/api/internal/notification/infrastructure"
	"github.com/amfit/api/internal/testsupport/pgtest"
	"github.com/google/uuid"
)

type env struct {
	*pgtest.Seed
	repos *infrastructure.PostgresRepositories
}

func novoEnv(t *testing.T) *env {
	t.Helper()
	pool := pgtest.NewDB(t)
	return &env{Seed: pgtest.NewSeed(t, pool), repos: infrastructure.NewPostgresRepositories(pool)}
}

func (e *env) token(owner uuid.UUID, tipo domain.OwnerTipo, token string, plat domain.Plataforma) *domain.PushToken {
	t := &domain.PushToken{ID: uuid.New(), OwnerID: owner, OwnerTipo: tipo, Token: token, Plataforma: plat}
	if err := e.repos.Tokens.Upsert(e.Ctx, t); err != nil {
		e.T.Fatalf("upsert token %q: %v", token, err)
	}
	return t
}

// ── PushToken ──────────────────────────────────────────────────────────────

func TestPushToken_UpsertEListaAtivos(t *testing.T) {
	e := novoEnv(t)
	dono := uuid.New()

	a := e.token(dono, domain.OwnerAluno, "ExponentPushToken[aaa]", domain.PlataformaAndroid)
	if a.RegistradoEm.IsZero() || a.AtualizadoEm.IsZero() {
		t.Error("Upsert deveria preencher registrado_em/atualizado_em")
	}
	e.token(dono, domain.OwnerAluno, "ExponentPushToken[bbb]", domain.PlataformaIOS)
	// Mesmo UUID com outro owner_tipo e outro dono nao se misturam.
	e.token(dono, domain.OwnerPersonal, "ExponentPushToken[ccc]", domain.PlataformaAndroid)
	e.token(uuid.New(), domain.OwnerAluno, "ExponentPushToken[ddd]", domain.PlataformaAndroid)

	got, err := e.repos.Tokens.ListaAtivosPorOwner(e.Ctx, dono, domain.OwnerAluno)
	if err != nil || len(got) != 2 {
		t.Fatalf("len=%d err=%v, want 2", len(got), err)
	}
	for _, tk := range got {
		if tk.OwnerID != dono || tk.OwnerTipo != domain.OwnerAluno || !tk.Ativo {
			t.Errorf("token fora do filtro: %+v", tk)
		}
	}

	vazio, err := e.repos.Tokens.ListaAtivosPorOwner(e.Ctx, uuid.New(), domain.OwnerAluno)
	if err != nil || vazio == nil || len(vazio) != 0 {
		t.Errorf("owner sem tokens: %#v err=%v", vazio, err)
	}
}

func TestPushToken_ReRegistroReativaEPreservaIdentidade(t *testing.T) {
	e := novoEnv(t)
	dono := uuid.New()
	original := e.token(dono, domain.OwnerAluno, "ExponentPushToken[xyz]", domain.PlataformaAndroid)

	// O token foi desativado (ex.: app desinstalado) e depois o mesmo aparelho registra de novo.
	e.Exec(`UPDATE push_token SET ativo = FALSE WHERE id = $1`, original.ID)
	if ativos, _ := e.repos.Tokens.ListaAtivosPorOwner(e.Ctx, dono, domain.OwnerAluno); len(ativos) != 0 {
		t.Fatalf("token inativo nao deveria ser listado: %+v", ativos)
	}

	time.Sleep(10 * time.Millisecond)
	novo := &domain.PushToken{ID: uuid.New(), OwnerID: dono, OwnerTipo: domain.OwnerAluno, Token: "ExponentPushToken[xyz]", Plataforma: domain.PlataformaIOS}
	if err := e.repos.Tokens.Upsert(e.Ctx, novo); err != nil {
		t.Fatal(err)
	}

	if novo.ID != original.ID {
		t.Errorf("o upsert deveria devolver o ID da linha existente: %s vs %s", novo.ID, original.ID)
	}
	if !novo.RegistradoEm.Equal(original.RegistradoEm) {
		t.Errorf("registrado_em deve ser preservado: %v vs %v", novo.RegistradoEm, original.RegistradoEm)
	}
	if !novo.AtualizadoEm.After(original.AtualizadoEm) {
		t.Errorf("atualizado_em deveria avancar: %v -> %v", original.AtualizadoEm, novo.AtualizadoEm)
	}

	ativos, _ := e.repos.Tokens.ListaAtivosPorOwner(e.Ctx, dono, domain.OwnerAluno)
	if len(ativos) != 1 || ativos[0].Plataforma != domain.PlataformaIOS || !ativos[0].Ativo {
		t.Errorf("deveria reativar e atualizar a plataforma, sem duplicar: %+v", ativos)
	}
}

func TestPushToken_PlataformaInvalida(t *testing.T) {
	e := novoEnv(t)
	tk := &domain.PushToken{ID: uuid.New(), OwnerID: uuid.New(), OwnerTipo: domain.OwnerAluno, Token: "t", Plataforma: "WINDOWS_PHONE"}
	if err := e.repos.Tokens.Upsert(e.Ctx, tk); err == nil {
		t.Error("plataforma fora do enum deveria falhar")
	}
}

// ── Notificacao ────────────────────────────────────────────────────────────

func (e *env) notif(titulo string, extras json.RawMessage) *domain.Notificacao {
	n := &domain.Notificacao{
		ID: uuid.New(), DestinatarioID: uuid.New(), DestinatarioTipo: domain.OwnerPersonal,
		Titulo: titulo, Corpo: "corpo " + titulo, Tipo: domain.TipoTreinoConcluido,
		DadosExtras: extras, Status: domain.StatusPendente,
	}
	if err := e.repos.Notifs.Criar(e.Ctx, n); err != nil {
		e.T.Fatalf("criar notificacao %q: %v", titulo, err)
	}
	return n
}

func TestNotificacao_CriarEListarPendentes(t *testing.T) {
	e := novoEnv(t)

	n1 := e.notif("primeira", json.RawMessage(`{"sessao_id":"abc","series":12}`))
	n2 := e.notif("segunda", nil)
	n3 := e.notif("terceira", nil)
	if n1.CriadoEm.IsZero() {
		t.Error("Criar deveria preencher criado_em")
	}
	// Garante ordem estavel: criado_em explicito e crescente.
	for i, n := range []*domain.Notificacao{n1, n2, n3} {
		e.Exec(`UPDATE notificacao SET criado_em = NOW() - make_interval(mins => $2) WHERE id = $1`, n.ID, 30-10*i)
	}

	got, err := e.repos.Notifs.ListarPendentes(e.Ctx, 10)
	if err != nil || len(got) != 3 {
		t.Fatalf("len=%d err=%v", len(got), err)
	}
	if got[0].ID != n1.ID || got[1].ID != n2.ID || got[2].ID != n3.ID {
		t.Errorf("deveria vir do mais antigo para o mais novo (FIFO): %v %v %v", got[0].Titulo, got[1].Titulo, got[2].Titulo)
	}

	var extras map[string]any
	if err := json.Unmarshal(got[0].DadosExtras, &extras); err != nil || extras["sessao_id"] != "abc" || extras["series"] != float64(12) {
		t.Errorf("dados_extras (JSONB) nao fez o round trip: %s (%v)", got[0].DadosExtras, err)
	}
	if got[1].DadosExtras != nil {
		t.Errorf("sem dados_extras deveria voltar nulo, got %s", got[1].DadosExtras)
	}
	if got[0].Tipo != domain.TipoTreinoConcluido || got[0].DestinatarioTipo != domain.OwnerPersonal ||
		got[0].Status != domain.StatusPendente || got[0].ErroDetalhe != nil || got[0].EnviadoEm != nil {
		t.Errorf("notificacao inesperada: %+v", got[0])
	}

	limitado, _ := e.repos.Notifs.ListarPendentes(e.Ctx, 2)
	if len(limitado) != 2 || limitado[0].ID != n1.ID || limitado[1].ID != n2.ID {
		t.Errorf("limit 2 deveria devolver as 2 mais antigas: %d", len(limitado))
	}

	vazio, err := novoEnv(t).repos.Notifs.ListarPendentes(e.Ctx, 10)
	if err != nil || vazio == nil || len(vazio) != 0 {
		t.Errorf("sem pendentes: %#v err=%v", vazio, err)
	}
}

func TestNotificacao_MarcarEnviadaEErro_SaemDaFilaDePendentes(t *testing.T) {
	e := novoEnv(t)
	enviada := e.notif("vai ser enviada", nil)
	falhou := e.notif("vai falhar", nil)
	pendente := e.notif("continua pendente", nil)

	if err := e.repos.Notifs.MarcarEnviada(e.Ctx, enviada.ID); err != nil {
		t.Fatal(err)
	}
	if err := e.repos.Notifs.MarcarErro(e.Ctx, falhou.ID, "DeviceNotRegistered"); err != nil {
		t.Fatal(err)
	}

	var status string
	var enviadoEm *time.Time
	var erro *string
	row := func(id uuid.UUID) {
		if err := e.Pool.QueryRow(e.Ctx, `SELECT status::text, enviado_em, erro_detalhe FROM notificacao WHERE id = $1`, id).
			Scan(&status, &enviadoEm, &erro); err != nil {
			t.Fatal(err)
		}
	}
	row(enviada.ID)
	if status != "ENVIADA" || enviadoEm == nil || time.Since(*enviadoEm) > time.Minute || erro != nil {
		t.Errorf("enviada: %s %v %v", status, enviadoEm, erro)
	}
	row(falhou.ID)
	if status != "ERRO" || erro == nil || *erro != "DeviceNotRegistered" || enviadoEm != nil {
		t.Errorf("com erro: %s %v %v", status, enviadoEm, erro)
	}

	pendentes, _ := e.repos.Notifs.ListarPendentes(e.Ctx, 10)
	if len(pendentes) != 1 || pendentes[0].ID != pendente.ID {
		t.Errorf("so a ultima deveria continuar pendente: %+v", pendentes)
	}

	// Ids inexistentes nao sao erro (UPDATE sem linhas).
	if err := e.repos.Notifs.MarcarEnviada(e.Ctx, uuid.New()); err != nil {
		t.Errorf("MarcarEnviada inexistente: %v", err)
	}
	if err := e.repos.Notifs.MarcarErro(e.Ctx, uuid.New(), "x"); err != nil {
		t.Errorf("MarcarErro inexistente: %v", err)
	}
}

func TestNotificacao_CriarComEnumInvalido(t *testing.T) {
	e := novoEnv(t)
	n := &domain.Notificacao{ID: uuid.New(), DestinatarioID: uuid.New(), DestinatarioTipo: "ADMIN",
		Titulo: "t", Corpo: "c", Tipo: domain.TipoTreinoConcluido, Status: domain.StatusPendente}
	if err := e.repos.Notifs.Criar(e.Ctx, n); err == nil {
		t.Error("destinatario_tipo fora do enum deveria falhar")
	}
}
