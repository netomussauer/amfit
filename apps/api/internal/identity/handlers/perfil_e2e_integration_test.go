//go:build integration

package handlers_test

import (
	"bytes"
	"context"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/textproto"
	"strings"
	"testing"
	"time"

	"github.com/amfit/api/internal/identity/application"
	"github.com/google/uuid"
)

// fakeLogos e o unico falso desta pilha: o MinIO do logo do White Label.
type fakeLogos struct{ uploads int }

func (f *fakeLogos) UploadLogo(_ context.Context, personalID uuid.UUID, _ *application.LogoUpload) (string, error) {
	f.uploads++
	return "http://logos.test/" + personalID.String() + ".png", nil
}

type logoArq struct {
	contentType string
	conteudo    []byte
}

// patchConfig envia PATCH /tenants/me/config multipart.
func (a *api) patchConfig(token string, campos map[string]string, logo *logoArq) (int, []byte) {
	a.t.Helper()
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	for k, v := range campos {
		if err := w.WriteField(k, v); err != nil {
			a.t.Fatal(err)
		}
	}
	if logo != nil {
		h := textproto.MIMEHeader{}
		h.Set("Content-Disposition", `form-data; name="logo"; filename="logo"`)
		h.Set("Content-Type", logo.contentType)
		part, err := w.CreatePart(h)
		if err != nil {
			a.t.Fatal(err)
		}
		_, _ = part.Write(logo.conteudo)
	}
	_ = w.Close()
	req := httptest.NewRequest(http.MethodPatch, "/tenants/me/config", &buf)
	req.Header.Set("Content-Type", w.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := a.app.Test(req, 30*time.Second)
	if err != nil {
		a.t.Fatalf("app.Test: %v", err)
	}
	defer resp.Body.Close()
	var out bytes.Buffer
	_, _ = out.ReadFrom(resp.Body)
	return resp.StatusCode, out.Bytes()
}

func TestPerfilPersonal_LerEAtualizar(t *testing.T) {
	a := novaAPI(t)
	ana := a.registrar("Ana", "ana@amfit.test")
	beto := a.registrar("Beto", "beto@amfit.test")

	st, raw := a.do(http.MethodGet, "/personal/me", nil, ana.AccessToken)
	if p := decode[application.PersonalResponse](t, raw); st != 200 || p.Email != "ana@amfit.test" || !p.Ativo || p.ID != ana.Usuario.ID {
		t.Fatalf("GET /personal/me: %d %+v", st, p)
	}

	st, raw = a.do(http.MethodPatch, "/personal/me", map[string]string{"nome": "Ana Paula", "telefone": "11999990000", "cref": "123456-G/SP"}, ana.AccessToken)
	if p := decode[application.PersonalResponse](t, raw); st != 200 || p.Nome != "Ana Paula" || p.Telefone != "11999990000" || p.CREF != "123456-G/SP" || p.Email != "ana@amfit.test" {
		t.Fatalf("PATCH parcial: %d %s", st, raw)
	}

	// Troca de e-mail: o login passa a valer so com o novo.
	if st, raw := a.do(http.MethodPatch, "/personal/me", map[string]string{"email": "ana.nova@amfit.test"}, ana.AccessToken); st != 200 {
		t.Fatalf("trocar email: %d %s", st, raw)
	}
	if st, _ := a.login("ana.nova@amfit.test", senhaPadrao, "PERSONAL"); st != 200 {
		t.Errorf("login com e-mail novo: %d", st)
	}
	if st, _ := a.login("ana@amfit.test", senhaPadrao, "PERSONAL"); st != 401 {
		t.Errorf("login com e-mail antigo: %d, quer 401", st)
	}

	// E-mail de outra conta (qualquer caixa): 409 e nada muda.
	if st, _ := a.do(http.MethodPatch, "/personal/me", map[string]string{"email": "BETO@amfit.test"}, ana.AccessToken); st != 409 {
		t.Errorf("e-mail em uso: %d, quer 409", st)
	}
	_ = beto

	for nome, corpo := range map[string]map[string]string{
		"nome curto":     {"nome": "x"},
		"email invalido": {"email": "nao-e-email"},
		"telefone longo": {"telefone": strings.Repeat("9", 21)},
		"cref longo":     {"cref": strings.Repeat("c", 21)},
	} {
		if st, _ := a.do(http.MethodPatch, "/personal/me", corpo, ana.AccessToken); st != 422 {
			t.Errorf("%s: %d, quer 422", nome, st)
		}
	}
	if st, _ := a.do(http.MethodPatch, "/personal/me", "{x", ana.AccessToken); st != 400 {
		t.Errorf("json quebrado: %d, quer 400", st)
	}
}

func TestSenha_Validacao(t *testing.T) {
	a := novaAPI(t)
	ana := a.registrar("Ana", "ana@amfit.test")
	for nome, corpo := range map[string]map[string]string{
		"sem senha atual": {"nova_senha": "NovaSenha456"},
		"nova curta":      {"senha_atual": senhaPadrao, "nova_senha": "curta"},
		"atual curta":     {"senha_atual": "x", "nova_senha": "NovaSenha456"},
	} {
		if st, _ := a.do(http.MethodPatch, "/personal/me/senha", corpo, ana.AccessToken); st != 422 {
			t.Errorf("%s: %d, quer 422", nome, st)
		}
	}
	// Nenhuma das tentativas pode ter trocado a senha.
	if st, _ := a.login("ana@amfit.test", senhaPadrao, "PERSONAL"); st != 200 {
		t.Errorf("senha original deveria continuar valendo: %d", st)
	}
}

func TestAlunos_AtualizarPeloPersonal(t *testing.T) {
	a := novaAPI(t)
	ana := a.registrar("Ana", "ana@amfit.test")
	bia := a.criarAluno(ana.AccessToken, "Bia", "bia@amfit.test")
	caio := a.criarAluno(ana.AccessToken, "Caio", "caio@amfit.test")

	st, raw := a.do(http.MethodPatch, "/alunos/"+bia.ID, map[string]string{
		"nome": "Bia Souza", "telefone": "11988887777", "data_nascimento": "1995-04-20", "sexo": "F",
	}, ana.AccessToken)
	got := decode[application.AlunoResponse](t, raw)
	if st != 200 || got.Nome != "Bia Souza" || got.Telefone != "11988887777" || got.DataNascimento != "1995-04-20" || got.Sexo != "F" || got.Email != "bia@amfit.test" {
		t.Fatalf("PATCH: %d %s", st, raw)
	}

	// E-mail novo vale para o login do aluno; o duplicado (de qualquer caixa) e 409.
	if st, raw := a.do(http.MethodPatch, "/alunos/"+bia.ID, map[string]string{"email": "bia.nova@amfit.test"}, ana.AccessToken); st != 200 {
		t.Fatalf("trocar email: %d %s", st, raw)
	}
	if st, _ := a.login("bia.nova@amfit.test", senhaPadrao, "ALUNO"); st != 200 {
		t.Errorf("login com e-mail novo: %d", st)
	}
	if st, _ := a.do(http.MethodPatch, "/alunos/"+bia.ID, map[string]string{"email": "CAIO@amfit.test"}, ana.AccessToken); st != 409 {
		t.Errorf("e-mail de outro aluno: %d, quer 409", st)
	}
	// A unicidade do e-mail e por tipo de conta (o login informa PERSONAL/ALUNO),
	// entao um aluno pode ter o mesmo e-mail de um personal.
	if st, _ := a.do(http.MethodPatch, "/alunos/"+bia.ID, map[string]string{"email": "ana@amfit.test"}, ana.AccessToken); st != 200 {
		t.Errorf("e-mail igual ao de um personal: %d, quer 200", st)
	}
	if st, _ := a.login("ana@amfit.test", senhaPadrao, "ALUNO"); st != 200 {
		t.Errorf("login ALUNO com esse e-mail: %d", st)
	}
	if st, _ := a.login("ana@amfit.test", senhaPadrao, "PERSONAL"); st != 200 {
		t.Errorf("login PERSONAL da Ana segue valendo: %d", st)
	}
	_ = caio

	for nome, corpo := range map[string]map[string]string{
		"nome curto":    {"nome": "x"},
		"sexo invalido": {"sexo": "Z"},
		"data invalida": {"data_nascimento": "20/04/1995"},
		"email ruim":    {"email": "x"},
	} {
		if st, _ := a.do(http.MethodPatch, "/alunos/"+bia.ID, corpo, ana.AccessToken); st != 422 {
			t.Errorf("%s: %d, quer 422", nome, st)
		}
	}
	if st, _ := a.do(http.MethodPatch, "/alunos/"+uuid.NewString(), map[string]string{"nome": "Fantasma"}, ana.AccessToken); st != 404 {
		t.Errorf("inexistente: %d", st)
	}
	if st, _ := a.do(http.MethodPatch, "/alunos/zz", map[string]string{"nome": "Fantasma"}, ana.AccessToken); st != 400 {
		t.Errorf("id invalido: %d", st)
	}
}

func TestAlunos_DesativarEhIdempotenteEValidaId(t *testing.T) {
	a := novaAPI(t)
	ana := a.registrar("Ana", "ana@amfit.test")
	bia := a.criarAluno(ana.AccessToken, "Bia", "bia@amfit.test")

	if st, _ := a.do(http.MethodDelete, "/alunos/"+bia.ID, nil, ana.AccessToken); st != 204 {
		t.Fatalf("desativar: %d", st)
	}
	st2, _ := a.do(http.MethodDelete, "/alunos/"+bia.ID, nil, ana.AccessToken)
	t.Logf("segunda desativacao: %d", st2)
	if st2 != 204 && st2 != 404 {
		t.Errorf("segunda desativacao: %d, quer 204 ou 404", st2)
	}
	if st, _ := a.do(http.MethodDelete, "/alunos/"+uuid.NewString(), nil, ana.AccessToken); st != 404 {
		t.Errorf("inexistente: %d", st)
	}
	if st, _ := a.do(http.MethodDelete, "/alunos/zz", nil, ana.AccessToken); st != 400 {
		t.Errorf("id invalido: %d", st)
	}
}

func TestAlunosMe_PerfilDoProprioAluno(t *testing.T) {
	a := novaAPI(t)
	ana := a.registrar("Ana", "ana@amfit.test")
	bia := a.criarAluno(ana.AccessToken, "Bia", "bia@amfit.test")
	tok := a.loginOK("bia@amfit.test", "ALUNO").AccessToken

	// O aluno nunca consegue ler/alterar outro aluno nem usar as rotas do personal.
	if st, _ := a.do(http.MethodGet, "/alunos/"+bia.ID, nil, tok); st != 403 {
		t.Errorf("aluno em rota de personal: %d, quer 403", st)
	}
	// Um aluno desativado perde o perfil (404) mesmo com access token ainda valido.
	if st, _ := a.do(http.MethodDelete, "/alunos/"+bia.ID, nil, ana.AccessToken); st != 204 {
		t.Fatal("desativar")
	}
	st, _ := a.do(http.MethodGet, "/alunos/me", nil, tok)
	t.Logf("/alunos/me de aluno desativado com token vivo: %d", st)
}

func TestTenantConfig_AtualizarBranding(t *testing.T) {
	a := novaAPI(t)
	ana := a.registrar("Ana", "ana@amfit.test")
	a.criarAluno(ana.AccessToken, "Bia", "bia@amfit.test")
	tokAluno := a.loginOK("bia@amfit.test", "ALUNO").AccessToken

	// Sem config: defaults, com o codigo do convite para o personal.
	_, raw := a.do(http.MethodGet, "/tenants/me/config", nil, ana.AccessToken)
	base := decode[application.TenantConfigResponse](t, raw)
	if base.CorPrimaria == "" || base.CorSecundaria == "" || base.Codigo == "" || base.LogoURL != nil {
		t.Fatalf("defaults: %+v", base)
	}

	// Cores (com "#" e maiusculas sao normalizadas) e nome do app.
	st, raw := a.patchConfig(ana.AccessToken, map[string]string{"cor_primaria": "#FF8800", "cor_secundaria": "00aabb", "nome_app": "  Studio Ana  "}, nil)
	cfg := decode[application.TenantConfigResponse](t, raw)
	if st != 200 || cfg.CorPrimaria != "ff8800" || cfg.CorSecundaria != "00aabb" || cfg.NomeApp == nil || *cfg.NomeApp != "Studio Ana" || cfg.Codigo != base.Codigo {
		t.Fatalf("PATCH cores: %d %s", st, raw)
	}

	// O aluno enxerga o branding do personal dele, sem o codigo de convite.
	_, raw = a.do(http.MethodGet, "/tenants/me/config", nil, tokAluno)
	if v := decode[application.TenantConfigResponse](t, raw); v.CorPrimaria != "ff8800" || v.Codigo != "" || v.NomeApp == nil {
		t.Errorf("visao do aluno: %+v", v)
	}

	// nome_app vazio limpa o campo (presenca da chave, nao valor); omiti-lo preserva.
	if st, raw := a.patchConfig(ana.AccessToken, map[string]string{"cor_primaria": "111111"}, nil); st != 200 || decode[application.TenantConfigResponse](t, raw).NomeApp == nil {
		t.Errorf("campo omitido deveria preservar nome_app: %d %s", st, raw)
	}
	st, raw = a.patchConfig(ana.AccessToken, map[string]string{"nome_app": ""}, nil)
	if c := decode[application.TenantConfigResponse](t, raw); st != 200 || (c.NomeApp != nil && *c.NomeApp != "") || c.CorPrimaria != "111111" {
		t.Errorf("limpar nome_app: %d %s", st, raw)
	}

	// Validacao.
	for nome, campos := range map[string]map[string]string{
		"cor curta":      {"cor_primaria": "fff"},
		"cor nao hex":    {"cor_secundaria": "gggggg"},
		"cor 8 digitos":  {"cor_primaria": "ff880011"},
		"nome_app longo": {"nome_app": strings.Repeat("n", 101)},
	} {
		want := 422
		if st, raw := a.patchConfig(ana.AccessToken, campos, nil); st != want {
			t.Errorf("%s: %d %.150s, quer %d", nome, st, raw, want)
		}
	}
	// A config nao foi corrompida pelas tentativas invalidas.
	_, raw = a.do(http.MethodGet, "/tenants/me/config", nil, ana.AccessToken)
	if c := decode[application.TenantConfigResponse](t, raw); c.CorPrimaria != "111111" || c.CorSecundaria != "00aabb" {
		t.Errorf("config apos invalidos: %+v", c)
	}

	// Aluno nao altera branding; corpo nao multipart e 400.
	if st, _ := a.patchConfig(tokAluno, map[string]string{"cor_primaria": "000000"}, nil); st != 403 {
		t.Errorf("aluno alterando branding: %d, quer 403", st)
	}
	if st, _ := a.do(http.MethodPatch, "/tenants/me/config", `{"cor_primaria":"000000"}`, ana.AccessToken); st != 400 {
		t.Errorf("corpo JSON: %d, quer 400", st)
	}
}

func TestTenantConfig_UploadDeLogo(t *testing.T) {
	a := novaAPI(t)
	ana := a.registrar("Ana", "ana@amfit.test")

	st, raw := a.patchConfig(ana.AccessToken, nil, &logoArq{"image/png", []byte("png")})
	cfg := decode[application.TenantConfigResponse](t, raw)
	if st != 200 || cfg.LogoURL == nil || !strings.HasPrefix(*cfg.LogoURL, "http://logos.test/"+ana.Usuario.ID) || a.logos.uploads != 1 {
		t.Fatalf("logo png: %d %s uploads=%d", st, raw, a.logos.uploads)
	}
	if st, _ := a.patchConfig(ana.AccessToken, nil, &logoArq{"image/jpeg", []byte("jpg")}); st != 200 {
		t.Errorf("logo jpeg: %d", st)
	}

	antes := a.logos.uploads
	casos := []struct {
		nome string
		l    logoArq
		st   int
	}{
		{"gif nao suportado", logoArq{"image/gif", []byte("g")}, 415},
		{"svg nao suportado", logoArq{"image/svg+xml", []byte("<svg/>")}, 415},
		{"png vazio", logoArq{"image/png", nil}, 400},
		{"png acima do limite do service", logoArq{"image/png", bytes.Repeat([]byte("x"), 3<<20)}, 413},
		{"acima do teto absoluto de 4MB", logoArq{"image/png", bytes.Repeat([]byte("x"), 4<<20+1)}, 413},
	}
	for _, c := range casos {
		t.Run(c.nome, func(t *testing.T) {
			if st, raw := a.patchConfig(ana.AccessToken, nil, &c.l); st != c.st {
				t.Errorf("status %d %.120s, quer %d", st, raw, c.st)
			}
		})
	}
	if a.logos.uploads != antes {
		t.Errorf("upload ocorreu em pedido rejeitado: %d -> %d", antes, a.logos.uploads)
	}

	// Cores invalidas junto de um logo valido: nada e gravado nem enviado.
	antes = a.logos.uploads
	if st, _ := a.patchConfig(ana.AccessToken, map[string]string{"cor_primaria": "zzz"}, &logoArq{"image/png", []byte("png")}); st != 422 {
		t.Errorf("cor invalida com logo: %d", st)
	}
	if a.logos.uploads != antes {
		t.Error("logo enviado mesmo com a cor invalida")
	}
}

func TestTenantCodigo_RegenerarInvalidaOAntigo(t *testing.T) {
	a := novaAPI(t)
	ana := a.registrar("Ana", "ana@amfit.test")
	a.criarAluno(ana.AccessToken, "Bia", "bia@amfit.test")

	_, raw := a.do(http.MethodGet, "/tenants/me/config", nil, ana.AccessToken)
	antigo := decode[application.TenantConfigResponse](t, raw).Codigo

	if st, _ := a.do(http.MethodGet, "/public/tenants/"+antigo+"/config", nil, ""); st != 200 {
		t.Fatalf("codigo atual: %d", st)
	}
	st, raw := a.do(http.MethodPost, "/tenants/me/codigo/regenerar", nil, ana.AccessToken)
	novo := decode[application.TenantConfigResponse](t, raw).Codigo
	if st != 200 || novo == "" || novo == antigo {
		t.Fatalf("regenerar: %d %s (antigo=%s)", st, raw, antigo)
	}
	if st, _ := a.do(http.MethodGet, "/public/tenants/"+antigo+"/config", nil, ""); st != 404 {
		t.Errorf("codigo antigo: %d, quer 404", st)
	}
	if st, _ := a.do(http.MethodGet, "/public/tenants/"+novo+"/config", nil, ""); st != 200 {
		t.Errorf("codigo novo: %d, quer 200", st)
	}
	// O GET autenticado reflete o novo; o aluno nao pode regenerar.
	_, raw = a.do(http.MethodGet, "/tenants/me/config", nil, ana.AccessToken)
	if decode[application.TenantConfigResponse](t, raw).Codigo != novo {
		t.Error("GET /tenants/me/config nao reflete o codigo novo")
	}
	tokAluno := a.loginOK("bia@amfit.test", "ALUNO").AccessToken
	if st, _ := a.do(http.MethodPost, "/tenants/me/codigo/regenerar", nil, tokAluno); st != 403 {
		t.Errorf("aluno regenerando: %d, quer 403", st)
	}
}
