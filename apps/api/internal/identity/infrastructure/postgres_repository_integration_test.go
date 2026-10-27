//go:build integration

package infrastructure_test

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/amfit/api/internal/identity/domain"
	"github.com/amfit/api/internal/identity/infrastructure"
	"github.com/amfit/api/internal/testsupport/pgtest"
	"github.com/google/uuid"
)

func novoRepo(t *testing.T) *infrastructure.PostgresRepositories {
	t.Helper()
	return infrastructure.NewPostgresRepositories(pgtest.NewDB(t))
}

func novoPersonal(t *testing.T, r *infrastructure.PostgresRepositories, email string) *domain.PersonalTrainer {
	t.Helper()
	codigo, err := domain.GerarCodigoConvite()
	if err != nil {
		t.Fatal(err)
	}
	pt := &domain.PersonalTrainer{
		ID: uuid.New(), Nome: "Personal " + email, Email: email, Ativo: true, Codigo: codigo,
	}
	if err := r.Personal.Create(context.Background(), pt); err != nil {
		t.Fatalf("criar personal %s: %v", email, err)
	}
	return pt
}

func novoAluno(t *testing.T, r *infrastructure.PostgresRepositories, personal uuid.UUID, nome, email string) *domain.Aluno {
	t.Helper()
	a := &domain.Aluno{ID: uuid.New(), PersonalID: personal, Nome: nome, Email: email, Ativo: true}
	if err := r.Aluno.Create(context.Background(), a); err != nil {
		t.Fatalf("criar aluno %s: %v", email, err)
	}
	return a
}

// ── PersonalTrainer ────────────────────────────────────────────────────────

func TestPersonal_CreateEBuscas(t *testing.T) {
	ctx := context.Background()
	r := novoRepo(t)

	pt := &domain.PersonalTrainer{
		ID: uuid.New(), Nome: "Ana", Email: "ana@amfit.test", Telefone: "11999990000",
		CREF: "123456-G/SP", Ativo: true, Codigo: "ABCDEFGH",
	}
	if err := r.Personal.Create(ctx, pt); err != nil {
		t.Fatalf("Create: %v", err)
	}
	if pt.CriadoEm.IsZero() || pt.AtualizadoEm.IsZero() {
		t.Error("Create deveria preencher criado_em/atualizado_em via RETURNING")
	}

	for nome, busca := range map[string]func() (*domain.PersonalTrainer, error){
		"FindByID":     func() (*domain.PersonalTrainer, error) { return r.Personal.FindByID(ctx, pt.ID) },
		"FindByEmail":  func() (*domain.PersonalTrainer, error) { return r.Personal.FindByEmail(ctx, "ana@amfit.test") },
		"FindByCodigo": func() (*domain.PersonalTrainer, error) { return r.Personal.FindByCodigo(ctx, "ABCDEFGH") },
	} {
		got, err := busca()
		if err != nil {
			t.Fatalf("%s: %v", nome, err)
		}
		if got.ID != pt.ID || got.Nome != "Ana" || got.Telefone != "11999990000" || got.CREF != "123456-G/SP" || !got.Ativo {
			t.Errorf("%s: personal inesperado: %+v", nome, got)
		}
	}
}

func TestPersonal_TelefoneECREFVaziosViramNullEVoltamVazios(t *testing.T) {
	ctx := context.Background()
	r := novoRepo(t)
	pt := novoPersonal(t, r, "sem-contato@amfit.test")

	got, err := r.Personal.FindByID(ctx, pt.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.Telefone != "" || got.CREF != "" {
		t.Errorf("telefone/cref deveriam voltar vazios, got %q / %q", got.Telefone, got.CREF)
	}
}

func TestPersonal_NaoEncontrado(t *testing.T) {
	ctx := context.Background()
	r := novoRepo(t)

	if _, err := r.Personal.FindByID(ctx, uuid.New()); !errors.Is(err, domain.ErrPersonalNotFound) {
		t.Errorf("FindByID: %v", err)
	}
	if _, err := r.Personal.FindByEmail(ctx, "x@y.z"); !errors.Is(err, domain.ErrPersonalNotFound) {
		t.Errorf("FindByEmail: %v", err)
	}
	if _, err := r.Personal.FindByCodigo(ctx, "ZZZZZZZZ"); !errors.Is(err, domain.ErrPersonalNotFound) {
		t.Errorf("FindByCodigo: %v", err)
	}
}

func TestPersonal_Create_ColisaoDeEmailECodigoSaoErrosDistintos(t *testing.T) {
	ctx := context.Background()
	r := novoRepo(t)
	base := novoPersonal(t, r, "base@amfit.test")

	dupEmail := &domain.PersonalTrainer{ID: uuid.New(), Nome: "X", Email: "base@amfit.test", Ativo: true, Codigo: "QQQQQQQQ"}
	if err := r.Personal.Create(ctx, dupEmail); !errors.Is(err, domain.ErrEmailAlreadyExists) {
		t.Errorf("email repetido: got %v, want ErrEmailAlreadyExists", err)
	}

	dupCodigo := &domain.PersonalTrainer{ID: uuid.New(), Nome: "Y", Email: "outro@amfit.test", Ativo: true, Codigo: base.Codigo}
	if err := r.Personal.Create(ctx, dupCodigo); !errors.Is(err, domain.ErrCodigoEmUso) {
		t.Errorf("codigo repetido: got %v, want ErrCodigoEmUso", err)
	}
}

func TestPersonal_UpdateCodigo(t *testing.T) {
	ctx := context.Background()
	r := novoRepo(t)
	a := novoPersonal(t, r, "a@amfit.test")
	b := novoPersonal(t, r, "b@amfit.test")

	if err := r.Personal.UpdateCodigo(ctx, a.ID, "NOVOCOD2"); err != nil {
		t.Fatalf("UpdateCodigo: %v", err)
	}
	got, _ := r.Personal.FindByID(ctx, a.ID)
	if got.Codigo != "NOVOCOD2" {
		t.Errorf("codigo = %q", got.Codigo)
	}

	if err := r.Personal.UpdateCodigo(ctx, b.ID, "NOVOCOD2"); !errors.Is(err, domain.ErrCodigoEmUso) {
		t.Errorf("colisao: got %v, want ErrCodigoEmUso", err)
	}
	if err := r.Personal.UpdateCodigo(ctx, uuid.New(), "OUTROCOD"); !errors.Is(err, domain.ErrPersonalNotFound) {
		t.Errorf("inexistente: got %v, want ErrPersonalNotFound", err)
	}
}

func TestPersonal_Update(t *testing.T) {
	ctx := context.Background()
	r := novoRepo(t)
	a := novoPersonal(t, r, "a@amfit.test")
	novoPersonal(t, r, "b@amfit.test")

	a.Nome, a.Telefone, a.CREF, a.Ativo = "Ana Maria", "11988887777", "999-G/RJ", false
	antes := a.AtualizadoEm
	time.Sleep(5 * time.Millisecond)
	if err := r.Personal.Update(ctx, a); err != nil {
		t.Fatalf("Update: %v", err)
	}
	if !a.AtualizadoEm.After(antes) {
		t.Error("atualizado_em deveria avancar")
	}
	got, _ := r.Personal.FindByID(ctx, a.ID)
	if got.Nome != "Ana Maria" || got.Telefone != "11988887777" || got.CREF != "999-G/RJ" || got.Ativo {
		t.Errorf("Update nao persistiu: %+v", got)
	}

	a.Email = "b@amfit.test"
	if err := r.Personal.Update(ctx, a); !errors.Is(err, domain.ErrEmailAlreadyExists) {
		t.Errorf("email de outro personal: got %v", err)
	}
	ghost := &domain.PersonalTrainer{ID: uuid.New(), Nome: "G", Email: "g@amfit.test"}
	if err := r.Personal.Update(ctx, ghost); !errors.Is(err, domain.ErrPersonalNotFound) {
		t.Errorf("inexistente: got %v", err)
	}
}

// ── Aluno ──────────────────────────────────────────────────────────────────

func TestAluno_CreateEFind_PreservaCamposOpcionais(t *testing.T) {
	ctx := context.Background()
	r := novoRepo(t)
	p := novoPersonal(t, r, "p@amfit.test")

	nasc := time.Date(1995, 3, 14, 0, 0, 0, 0, time.UTC)
	sexo := domain.SexoFeminino
	a := &domain.Aluno{
		ID: uuid.New(), PersonalID: p.ID, Nome: "Bia", Email: "bia@amfit.test",
		DataNascimento: &nasc, Sexo: &sexo, Telefone: "11977776666", Ativo: true,
	}
	if err := r.Aluno.Create(ctx, a); err != nil {
		t.Fatalf("Create: %v", err)
	}

	got, err := r.Aluno.FindByID(ctx, a.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.DataNascimento == nil || !got.DataNascimento.Equal(nasc) || got.Sexo == nil || *got.Sexo != domain.SexoFeminino || got.Telefone != "11977776666" {
		t.Errorf("campos opcionais perdidos: %+v", got)
	}

	semOpcionais := novoAluno(t, r, p.ID, "Caio", "caio@amfit.test")
	got2, _ := r.Aluno.FindByEmail(ctx, "caio@amfit.test")
	if got2.ID != semOpcionais.ID || got2.DataNascimento != nil || got2.Sexo != nil || got2.Telefone != "" {
		t.Errorf("opcionais ausentes deveriam voltar nulos/vazios: %+v", got2)
	}
}

func TestAluno_Erros(t *testing.T) {
	ctx := context.Background()
	r := novoRepo(t)
	p := novoPersonal(t, r, "p@amfit.test")
	novoAluno(t, r, p.ID, "Dora", "dora@amfit.test")

	dup := &domain.Aluno{ID: uuid.New(), PersonalID: p.ID, Nome: "Outra", Email: "dora@amfit.test", Ativo: true}
	if err := r.Aluno.Create(ctx, dup); !errors.Is(err, domain.ErrEmailAlreadyExists) {
		t.Errorf("email repetido: got %v", err)
	}

	semPersonal := &domain.Aluno{ID: uuid.New(), PersonalID: uuid.New(), Nome: "Orfao", Email: "orfao@amfit.test", Ativo: true}
	err := r.Aluno.Create(ctx, semPersonal)
	if err == nil || errors.Is(err, domain.ErrEmailAlreadyExists) {
		t.Errorf("FK de personal inexistente deveria falhar com erro generico, got %v", err)
	}

	if _, err := r.Aluno.FindByID(ctx, uuid.New()); !errors.Is(err, domain.ErrAlunoNotFound) {
		t.Errorf("FindByID: %v", err)
	}
	if _, err := r.Aluno.FindByEmail(ctx, "nada@amfit.test"); !errors.Is(err, domain.ErrAlunoNotFound) {
		t.Errorf("FindByEmail: %v", err)
	}
}

func TestAluno_UpdateEDeactivate(t *testing.T) {
	ctx := context.Background()
	r := novoRepo(t)
	p := novoPersonal(t, r, "p@amfit.test")
	a := novoAluno(t, r, p.ID, "Eva", "eva@amfit.test")
	outro := novoAluno(t, r, p.ID, "Fabio", "fabio@amfit.test")

	a.Nome, a.Telefone = "Eva Lima", "11955554444"
	if err := r.Aluno.Update(ctx, a); err != nil {
		t.Fatalf("Update: %v", err)
	}
	got, _ := r.Aluno.FindByID(ctx, a.ID)
	if got.Nome != "Eva Lima" || got.Telefone != "11955554444" {
		t.Errorf("Update nao persistiu: %+v", got)
	}

	a.Email = outro.Email
	if err := r.Aluno.Update(ctx, a); !errors.Is(err, domain.ErrEmailAlreadyExists) {
		t.Errorf("email repetido no update: got %v", err)
	}
	if err := r.Aluno.Update(ctx, &domain.Aluno{ID: uuid.New(), Nome: "G", Email: "g@amfit.test"}); !errors.Is(err, domain.ErrAlunoNotFound) {
		t.Errorf("Update inexistente: got %v", err)
	}

	if err := r.Aluno.Deactivate(ctx, a.ID); err != nil {
		t.Fatalf("Deactivate: %v", err)
	}
	got, _ = r.Aluno.FindByID(ctx, a.ID)
	if got.Ativo {
		t.Error("aluno deveria estar inativo")
	}
	if err := r.Aluno.Deactivate(ctx, uuid.New()); !errors.Is(err, domain.ErrAlunoNotFound) {
		t.Errorf("Deactivate inexistente: got %v", err)
	}
}

func TestAluno_ListByPersonal(t *testing.T) {
	ctx := context.Background()
	r := novoRepo(t)
	p := novoPersonal(t, r, "p@amfit.test")
	outroPersonal := novoPersonal(t, r, "q@amfit.test")

	novoAluno(t, r, p.ID, "Carla", "carla@amfit.test")
	novoAluno(t, r, p.ID, "Ana", "ana@amfit.test")
	inativo := novoAluno(t, r, p.ID, "Bruno", "bruno@amfit.test")
	novoAluno(t, r, p.ID, "100% Fit", "fit@amfit.test")
	novoAluno(t, r, p.ID, "Ana_Paula", "paula@amfit.test")
	novoAluno(t, r, outroPersonal.ID, "Ana Alheia", "alheia@amfit.test")
	if err := r.Aluno.Deactivate(ctx, inativo.ID); err != nil {
		t.Fatal(err)
	}

	nomes := func(as []*domain.Aluno) []string {
		out := make([]string, len(as))
		for i, a := range as {
			out[i] = a.Nome
		}
		return out
	}
	boolp := func(b bool) *bool { return &b }

	t.Run("ordena por nome e nunca mistura alunos de outro personal", func(t *testing.T) {
		got, total, err := r.Aluno.ListByPersonal(ctx, p.ID, domain.AlunoFilter{})
		if err != nil {
			t.Fatal(err)
		}
		want := []string{"100% Fit", "Ana", "Ana_Paula", "Bruno", "Carla"}
		if total != 5 || fmt.Sprint(nomes(got)) != fmt.Sprint(want) {
			t.Errorf("total=%d nomes=%v, want 5 %v", total, nomes(got), want)
		}
	})

	t.Run("filtra por ativo", func(t *testing.T) {
		got, total, _ := r.Aluno.ListByPersonal(ctx, p.ID, domain.AlunoFilter{Ativo: boolp(false)})
		if total != 1 || len(got) != 1 || got[0].Nome != "Bruno" {
			t.Errorf("inativos: total=%d %v", total, nomes(got))
		}
		_, totalAtivos, _ := r.Aluno.ListByPersonal(ctx, p.ID, domain.AlunoFilter{Ativo: boolp(true)})
		if totalAtivos != 4 {
			t.Errorf("ativos total = %d, want 4", totalAtivos)
		}
	})

	t.Run("busca por nome e case-insensitive", func(t *testing.T) {
		got, total, _ := r.Aluno.ListByPersonal(ctx, p.ID, domain.AlunoFilter{Busca: "carl"})
		if total != 1 || got[0].Nome != "Carla" {
			t.Errorf("busca carl: %d %v", total, nomes(got))
		}
	})

	t.Run("curingas do LIKE sao tratados como texto literal", func(t *testing.T) {
		_, totalPct, _ := r.Aluno.ListByPersonal(ctx, p.ID, domain.AlunoFilter{Busca: "%"})
		if totalPct != 1 { // so "100% Fit"; sem escape casaria todos
			t.Errorf("busca '%%': total = %d, want 1", totalPct)
		}
		got, totalUnd, _ := r.Aluno.ListByPersonal(ctx, p.ID, domain.AlunoFilter{Busca: "Ana_"})
		if totalUnd != 1 || got[0].Nome != "Ana_Paula" { // sem escape, "_" casaria "Ana " e o proprio "Ana"
			t.Errorf("busca 'Ana_': %d %v", totalUnd, nomes(got))
		}
	})

	t.Run("pagina e informa o total geral", func(t *testing.T) {
		p1, total, _ := r.Aluno.ListByPersonal(ctx, p.ID, domain.AlunoFilter{Page: 1, PerPage: 2})
		p3, _, _ := r.Aluno.ListByPersonal(ctx, p.ID, domain.AlunoFilter{Page: 3, PerPage: 2})
		pVazia, _, _ := r.Aluno.ListByPersonal(ctx, p.ID, domain.AlunoFilter{Page: 9, PerPage: 2})
		if total != 5 || len(p1) != 2 || len(p3) != 1 || len(pVazia) != 0 {
			t.Errorf("paginacao: total=%d p1=%d p3=%d vazia=%d", total, len(p1), len(p3), len(pVazia))
		}
	})

	t.Run("page/perPage invalidos caem nos defaults (pagina 1, 20 por pagina)", func(t *testing.T) {
		got, total, err := r.Aluno.ListByPersonal(ctx, p.ID, domain.AlunoFilter{Page: -3, PerPage: 0})
		if err != nil || total != 5 || len(got) != 5 {
			t.Errorf("defaults: err=%v total=%d len=%d", err, total, len(got))
		}
	})

	t.Run("personal sem alunos devolve lista vazia, nao nil", func(t *testing.T) {
		vazio := novoPersonal(t, r, "vazio@amfit.test")
		got, total, err := r.Aluno.ListByPersonal(ctx, vazio.ID, domain.AlunoFilter{})
		if err != nil || total != 0 || got == nil || len(got) != 0 {
			t.Errorf("err=%v total=%d got=%#v", err, total, got)
		}
	})
}

// ── Credencial ─────────────────────────────────────────────────────────────

func TestCredencial(t *testing.T) {
	ctx := context.Background()
	r := novoRepo(t)
	owner := uuid.New() // credencial nao tem FK para o dono (ele pode ser personal ou aluno)

	c := &domain.Credencial{ID: uuid.New(), OwnerID: owner, OwnerType: domain.OwnerTypeAluno, PasswordHash: "hash-1"}
	if err := r.Credencial.Create(ctx, c); err != nil {
		t.Fatalf("Create: %v", err)
	}

	got, err := r.Credencial.FindByOwner(ctx, owner, domain.OwnerTypeAluno)
	if err != nil || got.ID != c.ID || got.PasswordHash != "hash-1" || got.OwnerType != domain.OwnerTypeAluno || got.UltimoAcesso != nil {
		t.Fatalf("FindByOwner: %+v err=%v", got, err)
	}

	// Mesmo owner_id com outro owner_type nao e a mesma credencial.
	if _, err := r.Credencial.FindByOwner(ctx, owner, domain.OwnerTypePersonal); !errors.Is(err, domain.ErrInvalidCredentials) {
		t.Errorf("owner_type diferente: got %v, want ErrInvalidCredentials", err)
	}
	if _, err := r.Credencial.FindByOwner(ctx, uuid.New(), domain.OwnerTypeAluno); !errors.Is(err, domain.ErrInvalidCredentials) {
		t.Errorf("owner inexistente: got %v, want ErrInvalidCredentials", err)
	}

	dup := &domain.Credencial{ID: uuid.New(), OwnerID: owner, OwnerType: domain.OwnerTypeAluno, PasswordHash: "x"}
	if err := r.Credencial.Create(ctx, dup); err == nil {
		t.Error("UNIQUE (owner_id, owner_type) deveria impedir a segunda credencial")
	}

	if err := r.Credencial.UpdatePasswordHash(ctx, c.ID, "hash-2"); err != nil {
		t.Fatalf("UpdatePasswordHash: %v", err)
	}
	if err := r.Credencial.UpdatePasswordHash(ctx, uuid.New(), "h"); err == nil {
		t.Error("UpdatePasswordHash de credencial inexistente deveria falhar")
	}

	if err := r.Credencial.UpdateUltimoAcesso(ctx, c.ID); err != nil {
		t.Fatalf("UpdateUltimoAcesso: %v", err)
	}
	got, _ = r.Credencial.FindByOwner(ctx, owner, domain.OwnerTypeAluno)
	if got.PasswordHash != "hash-2" || got.UltimoAcesso == nil || time.Since(*got.UltimoAcesso) > time.Minute {
		t.Errorf("estado final inesperado: %+v", got)
	}
}

// ── RefreshToken ───────────────────────────────────────────────────────────

func TestRefreshToken(t *testing.T) {
	ctx := context.Background()
	r := novoRepo(t)
	dono, outro := uuid.New(), uuid.New()
	expira := time.Now().Add(24 * time.Hour).UTC().Truncate(time.Microsecond)

	novo := func(owner uuid.UUID, jti string) *domain.RefreshToken {
		rt := &domain.RefreshToken{ID: uuid.New(), OwnerID: owner, JTI: jti, ExpiraEm: expira}
		if err := r.RefreshTokens.Create(ctx, rt); err != nil {
			t.Fatalf("Create %s: %v", jti, err)
		}
		return rt
	}

	rt := novo(dono, "jti-1")
	if rt.CriadoEm.IsZero() {
		t.Error("Create deveria preencher criado_em")
	}
	got, err := r.RefreshTokens.FindByJTI(ctx, "jti-1")
	if err != nil || got.OwnerID != dono || got.Revogado || !got.ExpiraEm.Equal(expira) {
		t.Fatalf("FindByJTI: %+v err=%v", got, err)
	}

	dup := &domain.RefreshToken{ID: uuid.New(), OwnerID: dono, JTI: "jti-1", ExpiraEm: expira}
	if err := r.RefreshTokens.Create(ctx, dup); err == nil {
		t.Error("jti e UNIQUE: segunda insercao deveria falhar")
	}

	if _, err := r.RefreshTokens.FindByJTI(ctx, "nao-existe"); !errors.Is(err, domain.ErrInvalidRefreshToken) {
		t.Errorf("FindByJTI inexistente: got %v", err)
	}

	if err := r.RefreshTokens.RevokeByJTI(ctx, "jti-1"); err != nil {
		t.Fatalf("RevokeByJTI: %v", err)
	}
	got, _ = r.RefreshTokens.FindByJTI(ctx, "jti-1")
	if !got.Revogado {
		t.Error("token deveria estar revogado")
	}
	if err := r.RefreshTokens.RevokeByJTI(ctx, "nao-existe"); !errors.Is(err, domain.ErrInvalidRefreshToken) {
		t.Errorf("RevokeByJTI inexistente: got %v", err)
	}

	// RevokeAllByOwner revoga todos os do dono e nenhum de outro dono.
	novo(dono, "jti-2")
	novo(dono, "jti-3")
	novo(outro, "jti-outro")
	if err := r.RefreshTokens.RevokeAllByOwner(ctx, dono); err != nil {
		t.Fatalf("RevokeAllByOwner: %v", err)
	}
	for _, jti := range []string{"jti-1", "jti-2", "jti-3"} {
		if g, _ := r.RefreshTokens.FindByJTI(ctx, jti); !g.Revogado {
			t.Errorf("%s deveria estar revogado", jti)
		}
	}
	if g, _ := r.RefreshTokens.FindByJTI(ctx, "jti-outro"); g.Revogado {
		t.Error("RevokeAllByOwner nao pode afetar tokens de outro dono")
	}
	if err := r.RefreshTokens.RevokeAllByOwner(ctx, uuid.New()); err != nil {
		t.Errorf("dono sem tokens nao e erro: %v", err)
	}
}

// ── TenantConfig ───────────────────────────────────────────────────────────

func TestTenantConfig(t *testing.T) {
	ctx := context.Background()
	r := novoRepo(t)
	p := novoPersonal(t, r, "p@amfit.test")

	got, err := r.TenantConfig.FindByPersonalID(ctx, p.ID)
	if err != nil || got != nil {
		t.Fatalf("sem config ainda deveria devolver (nil, nil), got %+v err=%v", got, err)
	}

	cfg := &domain.TenantConfig{
		PersonalID: p.ID, LogoURL: "https://cdn/logo.png",
		CorPrimaria: "112233", CorSecundaria: "445566", NomeApp: "Studio Ana",
	}
	if err := r.TenantConfig.Upsert(ctx, cfg); err != nil {
		t.Fatalf("Upsert (insert): %v", err)
	}
	got, _ = r.TenantConfig.FindByPersonalID(ctx, p.ID)
	if got == nil || *got != (domain.TenantConfig{
		PersonalID: p.ID, LogoURL: "https://cdn/logo.png", CorPrimaria: "112233",
		CorSecundaria: "445566", NomeApp: "Studio Ana", AtualizadoEm: got.AtualizadoEm,
	}) {
		t.Fatalf("config inesperada: %+v", got)
	}

	// Segundo Upsert atualiza a mesma linha; strings vazias viram NULL e voltam vazias.
	cfg2 := &domain.TenantConfig{PersonalID: p.ID, CorPrimaria: "aabbcc", CorSecundaria: "ddeeff"}
	if err := r.TenantConfig.Upsert(ctx, cfg2); err != nil {
		t.Fatalf("Upsert (update): %v", err)
	}
	got, _ = r.TenantConfig.FindByPersonalID(ctx, p.ID)
	if got.CorPrimaria != "aabbcc" || got.LogoURL != "" || got.NomeApp != "" {
		t.Errorf("update deveria limpar logo/nome_app: %+v", got)
	}

	orfao := &domain.TenantConfig{PersonalID: uuid.New(), CorPrimaria: "000000", CorSecundaria: "ffffff"}
	if err := r.TenantConfig.Upsert(ctx, orfao); err == nil {
		t.Error("FK para personal_trainer deveria impedir config de personal inexistente")
	}
}
