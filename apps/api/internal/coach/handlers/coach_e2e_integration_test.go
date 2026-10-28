//go:build integration

package handlers_test

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/json"
	"errors"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/textproto"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/amfit/api/internal/coach/application"
	"github.com/amfit/api/internal/coach/handlers"
	"github.com/amfit/api/internal/coach/infrastructure"
	"github.com/amfit/api/internal/testsupport/pgtest"
	"github.com/amfit/api/pkg/auth"
	"github.com/amfit/api/pkg/middleware"
	"github.com/gofiber/fiber/v3"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// Pilha real do Coach: handlers + service + repositorios no PostgreSQL de
// teste + middleware JWT + role guards. Falsos so o object storage (MinIO) e
// o Notifier (cross-context com Notification).

type fakeStorage struct {
	mu      sync.Mutex
	uploads int
	falha   error
}

func (f *fakeStorage) UploadVideo(_ context.Context, personalID, alunoID, videoID uuid.UUID, v *application.VideoUpload) (string, error) {
	if f.falha != nil {
		return "", f.falha
	}
	if _, err := io.Copy(io.Discard, v.Reader); err != nil {
		return "", err
	}
	f.mu.Lock()
	f.uploads++
	f.mu.Unlock()
	return personalID.String() + "/" + alunoID.String() + "/" + videoID.String() + ".mp4", nil
}

func (f *fakeStorage) PresignedURL(_ context.Context, key string) (string, error) {
	return "http://minio.test/coach-videos/" + key + "?sig=x", nil
}

type fakeNotifier struct {
	mu        sync.Mutex
	videos    []string // "<personalID>|<alunoNome>"
	feedbacks []uuid.UUID
	falha     error
}

func (n *fakeNotifier) NotificarCoachVideoEnviado(_ context.Context, personalID uuid.UUID, nome string) error {
	n.mu.Lock()
	defer n.mu.Unlock()
	n.videos = append(n.videos, personalID.String()+"|"+nome)
	return n.falha
}

func (n *fakeNotifier) NotificarCoachFeedbackEnviado(_ context.Context, alunoID uuid.UUID) error {
	n.mu.Lock()
	defer n.mu.Unlock()
	n.feedbacks = append(n.feedbacks, alunoID)
	return n.falha
}

type api struct {
	t        *testing.T
	app      *fiber.App
	seed     *pgtest.Seed
	priv     *rsa.PrivateKey
	storage  *fakeStorage
	notifier *fakeNotifier
}

func novaAPI(t *testing.T) *api {
	t.Helper()
	pool := pgtest.NewDB(t)
	priv, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	repos := infrastructure.NewPostgresRepositories(pool)
	storage, notifier := &fakeStorage{}, &fakeNotifier{}
	svc := application.NewCoachService(repos.Videos, repos.Feedbacks, repos.AlunoLookup, storage, notifier)
	h := handlers.NewCoachHandler(svc)

	app := fiber.New(fiber.Config{BodyLimit: handlers.MaxRequestBodyBytes})
	authMW := middleware.NewAuthMiddleware(&priv.PublicKey)
	// Mesma ordem do cmd/server/main.go: ALUNO antes de PERSONAL.
	h.RegisterAlunoRoutes(app, authMW, middleware.RequireRole("ALUNO"))
	h.RegisterPersonalRoutes(app, authMW, middleware.RequireRole("PERSONAL"))

	return &api{t: t, app: app, seed: pgtest.NewSeed(t, pool), priv: priv, storage: storage, notifier: notifier}
}

func (a *api) token(sub uuid.UUID, role string, tenant uuid.UUID) string {
	tok, err := auth.SignToken(jwt.MapClaims{"sub": sub.String(), "role": role, "tenant_id": tenant.String()}, a.priv)
	if err != nil {
		a.t.Fatal(err)
	}
	return tok
}

func (a *api) send(req *http.Request, token string) (int, []byte) {
	a.t.Helper()
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := a.app.Test(req, 60*time.Second)
	if err != nil {
		a.t.Fatalf("app.Test: %v", err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	return resp.StatusCode, raw
}

func (a *api) do(method, path string, body any, token string) (int, []byte) {
	a.t.Helper()
	var rd io.Reader
	switch b := body.(type) {
	case nil:
	case string:
		rd = strings.NewReader(b)
	default:
		raw, err := json.Marshal(b)
		if err != nil {
			a.t.Fatal(err)
		}
		rd = bytes.NewReader(raw)
	}
	req := httptest.NewRequest(method, path, rd)
	req.Header.Set("Content-Type", "application/json")
	return a.send(req, token)
}

type video struct {
	contentType string
	conteudo    []byte
}

func mp4(tamanho int) *video {
	return &video{"video/mp4", bytes.Repeat([]byte("v"), tamanho)}
}

// enviar monta POST /coach/videos multipart.
func (a *api) enviar(campos map[string]string, v *video, token string) (int, []byte) {
	a.t.Helper()
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	for k, val := range campos {
		if err := w.WriteField(k, val); err != nil {
			a.t.Fatal(err)
		}
	}
	if v != nil {
		h := textproto.MIMEHeader{}
		h.Set("Content-Disposition", `form-data; name="video"; filename="clip.mp4"`)
		h.Set("Content-Type", v.contentType)
		part, err := w.CreatePart(h)
		if err != nil {
			a.t.Fatal(err)
		}
		_, _ = part.Write(v.conteudo)
	}
	if err := w.Close(); err != nil {
		a.t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodPost, "/coach/videos", &buf)
	req.Header.Set("Content-Type", w.FormDataContentType())
	return a.send(req, token)
}

type obj = map[string]any

func decode(t *testing.T, raw []byte) obj {
	t.Helper()
	var m obj
	if err := json.Unmarshal(raw, &m); err != nil {
		t.Fatalf("JSON invalido: %s (%v)", raw, err)
	}
	return m
}

// ator: um personal com um aluno e os dois tokens.
type ator struct {
	personal, aluno uuid.UUID
	tokP, tokA      string
}

func (a *api) ator() ator {
	p := a.seed.Personal()
	al := a.seed.Aluno(p)
	return ator{p, al, a.token(p, "PERSONAL", p), a.token(al, "ALUNO", p)}
}

func (a *api) alunoExtra(x ator) (uuid.UUID, string) {
	al := a.seed.Aluno(x.personal)
	return al, a.token(al, "ALUNO", x.personal)
}

func (a *api) enviarOK(x ator, extra map[string]string) obj {
	a.t.Helper()
	campos := map[string]string{"duracao_segundos": "30"}
	for k, v := range extra {
		campos[k] = v
	}
	st, raw := a.enviar(campos, mp4(10), x.tokA)
	if st != 201 {
		a.t.Fatalf("enviar video: %d %s", st, raw)
	}
	return decode(a.t, raw)
}

func TestCoach_RotasExigemAutenticacaoERole(t *testing.T) {
	a := novaAPI(t)
	x := a.ator()
	id := uuid.NewString()

	rotas := [][2]string{
		{"POST", "/coach/videos"}, {"GET", "/alunos/me/coach/videos"}, {"GET", "/alunos/me/coach/videos/" + id},
		{"GET", "/coach/videos"}, {"GET", "/coach/videos/" + id}, {"POST", "/coach/videos/" + id + "/feedback"},
	}
	for _, r := range rotas {
		if st, _ := a.do(r[0], r[1], nil, ""); st != 401 {
			t.Errorf("%s %s sem token: %d, quer 401", r[0], r[1], st)
		}
	}
	// Rotas do aluno com token de PERSONAL e vice-versa: 403.
	for _, r := range rotas[:3] {
		if st, _ := a.do(r[0], r[1], nil, x.tokP); st != 403 {
			t.Errorf("%s %s como PERSONAL: %d, quer 403", r[0], r[1], st)
		}
	}
	for _, r := range rotas[3:] {
		if st, _ := a.do(r[0], r[1], nil, x.tokA); st != 403 {
			t.Errorf("%s %s como ALUNO: %d, quer 403", r[0], r[1], st)
		}
	}
}

func TestCoach_EnviarVideo_FluxoCompleto(t *testing.T) {
	a := novaAPI(t)
	x := a.ator()
	ficha := a.seed.FichaVigente(x.personal, x.aluno)
	treino := a.seed.Treino(ficha, "A", 0)
	item := a.seed.Item(treino, a.seed.Exercicio("Supino Reto", nil), 0, 3)

	m := a.enviarOK(x, map[string]string{"item_treino_id": item.String(), "descricao": "postura ok?"})
	if m["status"] != "AGUARDANDO_FEEDBACK" || m["aluno_id"] != x.aluno.String() || m["descricao"] != "postura ok?" ||
		m["duracao_segundos"] != float64(30) || m["item_treino_id"] != item.String() {
		t.Errorf("resposta: %v", m)
	}
	if !strings.HasPrefix(m["video_url"].(string), "http://minio.test/coach-videos/"+x.personal.String()+"/"+x.aluno.String()+"/") {
		t.Errorf("video_url (presigned): %v", m["video_url"])
	}
	if m["feedback"] != nil {
		t.Errorf("sem feedback ainda: %v", m["feedback"])
	}
	if m["exercicio_nome"] != "Supino Reto" || m["aluno_nome"] != "Aluno" {
		t.Errorf("nomes: ex=%v aluno=%v", m["exercicio_nome"], m["aluno_nome"])
	}

	// O personal e notificado uma vez, com o nome do aluno.
	if len(a.notifier.videos) != 1 || a.notifier.videos[0] != x.personal.String()+"|Aluno" {
		t.Errorf("notificacoes ao personal: %v", a.notifier.videos)
	}
	if a.storage.uploads != 1 {
		t.Errorf("uploads = %d", a.storage.uploads)
	}

	// Persistido com o dono correto (personal derivado do aluno, nao do cliente).
	var personal uuid.UUID
	var status string
	if err := a.seed.Pool.QueryRow(a.seed.Ctx, `SELECT personal_id, status::text FROM coach_video WHERE id=$1`, m["id"]).Scan(&personal, &status); err != nil {
		t.Fatal(err)
	}
	if personal != x.personal || status != "AGUARDANDO_FEEDBACK" {
		t.Errorf("persistido: personal=%v status=%v", personal, status)
	}
}

func TestCoach_EnviarVideo_SemItemEMidiaAcimaDoLimitePadraoDoFiber(t *testing.T) {
	a := novaAPI(t)
	x := a.ator()
	// 6 MB: acima dos 4 MB do BodyLimit padrao do Fiber; um clipe curto de
	// celular tipicamente passa disso.
	st, raw := a.enviar(map[string]string{"duracao_segundos": "20"}, mp4(6<<20), x.tokA)
	if st != 201 {
		t.Fatalf("video de 6MB: %d %.200s", st, raw)
	}
	if m := decode(t, raw); m["item_treino_id"] != nil || m["exercicio_nome"] != nil {
		t.Errorf("sem item: %v", m)
	}
}

func TestCoach_EnviarVideo_Validacao(t *testing.T) {
	a := novaAPI(t)
	x := a.ator()
	casos := []struct {
		nome   string
		campos map[string]string
		v      *video
		status int
	}{
		{"sem duracao", map[string]string{}, mp4(5), 400},
		{"duracao nao numerica", map[string]string{"duracao_segundos": "abc"}, mp4(5), 400},
		{"duracao zero", map[string]string{"duracao_segundos": "0"}, mp4(5), 422},
		{"duracao acima de 60s", map[string]string{"duracao_segundos": "61"}, mp4(5), 422},
		{"duracao 60 ok", map[string]string{"duracao_segundos": "60"}, mp4(5), 201},
		{"descricao longa", map[string]string{"duracao_segundos": "10", "descricao": strings.Repeat("d", 501)}, mp4(5), 422},
		{"item nao uuid", map[string]string{"duracao_segundos": "10", "item_treino_id": "x"}, mp4(5), 422},
		{"item inexistente", map[string]string{"duracao_segundos": "10", "item_treino_id": uuid.NewString()}, mp4(5), 422},
		{"sem arquivo", map[string]string{"duracao_segundos": "10"}, nil, 400},
		{"arquivo vazio", map[string]string{"duracao_segundos": "10"}, &video{"video/mp4", nil}, 400},
		{"tipo nao suportado", map[string]string{"duracao_segundos": "10"}, &video{"video/avi", []byte("x")}, 422},
		{"quicktime (iOS) ok", map[string]string{"duracao_segundos": "10"}, &video{"video/quicktime", []byte("x")}, 201},
	}
	for _, c := range casos {
		t.Run(c.nome, func(t *testing.T) {
			if st, raw := a.enviar(c.campos, c.v, x.tokA); st != c.status {
				t.Errorf("status %d, quer %d: %.200s", st, c.status, raw)
			}
		})
	}

	// So os 2 casos 201 geraram registro.
	var n int
	_ = a.seed.Pool.QueryRow(a.seed.Ctx, `SELECT COUNT(*) FROM coach_video`).Scan(&n)
	if n != 2 {
		t.Errorf("registros = %d, quer 2", n)
	}
}

func TestCoach_EnviarVideo_AcimaDoLimiteDeNegocio(t *testing.T) {
	if testing.Short() {
		t.Skip("aloca ~100MB")
	}
	a := novaAPI(t)
	x := a.ator()
	st, raw := a.enviar(map[string]string{"duracao_segundos": "30"}, mp4(100<<20+1), x.tokA)
	if st != 422 {
		t.Errorf("101MB: %d %.200s, quer 422", st, raw)
	}
	if a.storage.uploads != 0 {
		t.Error("upload nao deveria ocorrer")
	}
}

func TestCoach_EnviarVideo_NaoQuebraPorFalhaDeNotificacao(t *testing.T) {
	a := novaAPI(t)
	x := a.ator()
	a.notifier.falha = errors.New("push fora do ar")
	if st, raw := a.enviar(map[string]string{"duracao_segundos": "10"}, mp4(5), x.tokA); st != 201 {
		t.Fatalf("falha do notifier nao pode derrubar o envio: %d %s", st, raw)
	}
}

func TestCoach_EnviarVideo_FalhaDeStorageNaoGravaRegistro(t *testing.T) {
	a := novaAPI(t)
	x := a.ator()
	a.storage.falha = errors.New("minio fora")
	if st, _ := a.enviar(map[string]string{"duracao_segundos": "10"}, mp4(5), x.tokA); st != 500 {
		t.Errorf("status %d, quer 500", st)
	}
	var n int
	_ = a.seed.Pool.QueryRow(a.seed.Ctx, `SELECT COUNT(*) FROM coach_video`).Scan(&n)
	if n != 0 || len(a.notifier.videos) != 0 {
		t.Errorf("registros=%d notificacoes=%d", n, len(a.notifier.videos))
	}
}

func TestCoach_Listagens_Isolamento(t *testing.T) {
	a := novaAPI(t)
	x := a.ator()
	y := a.ator() // outro personal, outro aluno
	outroAluno, tokOutroAluno := a.alunoExtra(x)

	v1 := a.enviarOK(x, nil)
	v2 := a.enviarOK(x, nil)
	a.enviarOK(y, nil)
	if st, _ := a.enviar(map[string]string{"duracao_segundos": "5"}, mp4(5), tokOutroAluno); st != 201 {
		t.Fatal("video do segundo aluno")
	}
	_ = outroAluno

	ids := func(raw []byte) []string {
		var out []string
		for _, e := range decode(t, raw)["data"].([]any) {
			out = append(out, e.(obj)["id"].(string))
		}
		return out
	}

	// Aluno ve so os proprios, mais recente primeiro.
	st, raw := a.do("GET", "/alunos/me/coach/videos", nil, x.tokA)
	if st != 200 {
		t.Fatalf("%d %s", st, raw)
	}
	if l := ids(raw); len(l) != 2 || l[0] != v2["id"] || l[1] != v1["id"] {
		t.Errorf("videos do aluno: %v (v2=%v v1=%v)", l, v2["id"], v1["id"])
	}

	// Personal ve os de todos os seus alunos (3), nunca os do outro personal.
	_, raw = a.do("GET", "/coach/videos", nil, x.tokP)
	if l := ids(raw); len(l) != 3 {
		t.Errorf("videos do personal x: %v", l)
	}
	pg := decode(t, raw)["pagination"].(obj)
	if pg["total"] != float64(3) || pg["page"] != float64(1) || pg["per_page"] != float64(20) {
		t.Errorf("paginacao: %v", pg)
	}
}

func TestCoach_Listagens_StatusEPaginacao(t *testing.T) {
	a := novaAPI(t)
	x := a.ator()
	var enviados []obj
	for i := 0; i < 5; i++ {
		enviados = append(enviados, a.enviarOK(x, nil))
	}
	// Responde 2 deles.
	for _, v := range enviados[:2] {
		if st, raw := a.do("POST", "/coach/videos/"+v["id"].(string)+"/feedback", obj{"texto": "boa"}, x.tokP); st != 201 {
			t.Fatalf("feedback: %d %s", st, raw)
		}
	}

	total := func(path, tok string) (int, float64, int) {
		st, raw := a.do("GET", path, nil, tok)
		m := decode(t, raw)
		if st != 200 {
			return st, 0, 0
		}
		return st, m["pagination"].(obj)["total"].(float64), len(m["data"].([]any))
	}
	if st, tot, n := total("/coach/videos?status=AGUARDANDO_FEEDBACK", x.tokP); st != 200 || tot != 3 || n != 3 {
		t.Errorf("aguardando: st=%d total=%v n=%d", st, tot, n)
	}
	if st, tot, _ := total("/coach/videos?status=FEEDBACK_ENVIADO", x.tokP); st != 200 || tot != 2 {
		t.Errorf("enviado: st=%d total=%v", st, tot)
	}
	if st, tot, n := total("/coach/videos?status=ARQUIVADO", x.tokP); st != 200 || tot != 0 || n != 0 {
		t.Errorf("arquivado: st=%d total=%v n=%d", st, tot, n)
	}
	if st, _, _ := total("/coach/videos?status=QUALQUER", x.tokP); st != 400 {
		t.Errorf("status invalido: %d, quer 400", st)
	}

	// Paginacao: 5 videos, 2 por pagina => 2,2,1; total sempre 5.
	for page, quer := range map[int]int{1: 2, 2: 2, 3: 1, 4: 0} {
		st, tot, n := total("/coach/videos?per_page=2&page="+string(rune('0'+page)), x.tokP)
		if st != 200 || tot != 5 || n != quer {
			t.Errorf("page %d: st=%d total=%v n=%d, quer n=%d", page, st, tot, n, quer)
		}
	}
	// per_page acima do teto e limitado a 100; valores invalidos caem no default.
	_, raw := a.do("GET", "/coach/videos?per_page=9999&page=abc", nil, x.tokP)
	if pg := decode(t, raw)["pagination"].(obj); pg["per_page"] != float64(100) || pg["page"] != float64(1) {
		t.Errorf("clamp/default: %v", pg)
	}
}

func TestCoach_Obter_Autorizacao(t *testing.T) {
	a := novaAPI(t)
	x := a.ator()
	y := a.ator()
	_, tokIrmao := a.alunoExtra(x) // outro aluno do MESMO personal
	v := a.enviarOK(x, nil)
	id := v["id"].(string)

	if st, raw := a.do("GET", "/alunos/me/coach/videos/"+id, nil, x.tokA); st != 200 || decode(t, raw)["id"] != id {
		t.Errorf("aluno dono: %d", st)
	}
	if st, raw := a.do("GET", "/coach/videos/"+id, nil, x.tokP); st != 200 || decode(t, raw)["id"] != id {
		t.Errorf("personal dono: %d", st)
	}

	// Nao dono => 404 (nao vaza existencia).
	if st, _ := a.do("GET", "/alunos/me/coach/videos/"+id, nil, tokIrmao); st != 404 {
		t.Errorf("aluno irmao: %d, quer 404", st)
	}
	if st, _ := a.do("GET", "/alunos/me/coach/videos/"+id, nil, y.tokA); st != 404 {
		t.Errorf("aluno de outro personal: %d, quer 404", st)
	}
	if st, _ := a.do("GET", "/coach/videos/"+id, nil, y.tokP); st != 404 {
		t.Errorf("outro personal: %d, quer 404", st)
	}
	if st, _ := a.do("GET", "/coach/videos/"+uuid.NewString(), nil, x.tokP); st != 404 {
		t.Errorf("inexistente: %d, quer 404", st)
	}
	if st, _ := a.do("GET", "/coach/videos/xx", nil, x.tokP); st != 400 {
		t.Errorf("id invalido: %d, quer 400", st)
	}
	if st, _ := a.do("GET", "/alunos/me/coach/videos/xx", nil, x.tokA); st != 400 {
		t.Errorf("id invalido (aluno): %d, quer 400", st)
	}
}

func TestCoach_Feedback_Fluxo(t *testing.T) {
	a := novaAPI(t)
	x := a.ator()
	y := a.ator()
	v := a.enviarOK(x, nil)
	id := v["id"].(string)

	// Outro personal nao responde video alheio e nada muda.
	if st, _ := a.do("POST", "/coach/videos/"+id+"/feedback", obj{"texto": "invasor"}, y.tokP); st != 404 {
		t.Errorf("outro personal: %d, quer 404", st)
	}
	var n int
	_ = a.seed.Pool.QueryRow(a.seed.Ctx, `SELECT COUNT(*) FROM coach_video_feedback`).Scan(&n)
	if n != 0 {
		t.Fatalf("feedback de invasor gravado: %d", n)
	}

	st, raw := a.do("POST", "/coach/videos/"+id+"/feedback", obj{"texto": "Joelho alinhado, desca mais."}, x.tokP)
	if st != 201 {
		t.Fatalf("feedback: %d %s", st, raw)
	}
	m := decode(t, raw)
	fb, _ := m["feedback"].(obj)
	if m["status"] != "FEEDBACK_ENVIADO" || fb["texto"] != "Joelho alinhado, desca mais." || fb["enviado_em"] == nil {
		t.Errorf("resposta: %v", m)
	}
	if len(a.notifier.feedbacks) != 1 || a.notifier.feedbacks[0] != x.aluno {
		t.Errorf("notificacoes ao aluno: %v", a.notifier.feedbacks)
	}

	// O aluno enxerga o feedback; a lista do personal tambem reflete o status.
	_, raw = a.do("GET", "/alunos/me/coach/videos/"+id, nil, x.tokA)
	if m := decode(t, raw); m["status"] != "FEEDBACK_ENVIADO" || m["feedback"].(obj)["texto"] != "Joelho alinhado, desca mais." {
		t.Errorf("visao do aluno: %v", m)
	}

	// Segundo feedback: 409, sem sobrescrever nem renotificar.
	if st, _ := a.do("POST", "/coach/videos/"+id+"/feedback", obj{"texto": "outro"}, x.tokP); st != 409 {
		t.Errorf("segundo feedback: %d, quer 409", st)
	}
	var texto string
	_ = a.seed.Pool.QueryRow(a.seed.Ctx, `SELECT texto FROM coach_video_feedback WHERE video_id=$1`, id).Scan(&texto)
	if texto != "Joelho alinhado, desca mais." || len(a.notifier.feedbacks) != 1 {
		t.Errorf("texto=%q notificacoes=%d", texto, len(a.notifier.feedbacks))
	}
}

func TestCoach_Feedback_Validacao(t *testing.T) {
	a := novaAPI(t)
	x := a.ator()
	id := a.enviarOK(x, nil)["id"].(string)

	if st, _ := a.do("POST", "/coach/videos/"+id+"/feedback", obj{"texto": ""}, x.tokP); st != 422 {
		t.Errorf("texto vazio: %d, quer 422", st)
	}
	if st, _ := a.do("POST", "/coach/videos/"+id+"/feedback", obj{}, x.tokP); st != 422 {
		t.Errorf("sem texto: %d, quer 422", st)
	}
	if st, _ := a.do("POST", "/coach/videos/"+id+"/feedback", obj{"texto": strings.Repeat("t", 2001)}, x.tokP); st != 422 {
		t.Errorf("texto longo: %d, quer 422", st)
	}
	if st, _ := a.do("POST", "/coach/videos/"+id+"/feedback", "{quebrado", x.tokP); st != 400 {
		t.Errorf("json quebrado: %d, quer 400", st)
	}
	if st, _ := a.do("POST", "/coach/videos/xx/feedback", obj{"texto": "a"}, x.tokP); st != 400 {
		t.Errorf("id invalido: %d, quer 400", st)
	}
	if st, _ := a.do("POST", "/coach/videos/"+uuid.NewString()+"/feedback", obj{"texto": "a"}, x.tokP); st != 404 {
		t.Errorf("inexistente: %d, quer 404", st)
	}
	// Nada disso pode ter mudado o status do video.
	var status string
	_ = a.seed.Pool.QueryRow(a.seed.Ctx, `SELECT status::text FROM coach_video WHERE id=$1`, id).Scan(&status)
	if status != "AGUARDANDO_FEEDBACK" {
		t.Errorf("status apos pedidos invalidos: %s", status)
	}
	// 2000 caracteres e o maximo aceito.
	if st, _ := a.do("POST", "/coach/videos/"+id+"/feedback", obj{"texto": strings.Repeat("t", 2000)}, x.tokP); st != 201 {
		t.Errorf("texto de 2000: %d, quer 201", st)
	}
}

// Dois cliques/abas do personal ao mesmo tempo: exatamente um feedback vence,
// o outro recebe 409, e o video termina FEEDBACK_ENVIADO.
func TestCoach_Feedback_Concorrente(t *testing.T) {
	a := novaAPI(t)
	x := a.ator()
	for rodada := 0; rodada < 10; rodada++ {
		id := a.enviarOK(x, nil)["id"].(string)

		const n = 8
		codes := make([]int, n)
		var wg sync.WaitGroup
		for i := 0; i < n; i++ {
			wg.Add(1)
			go func(i int) {
				defer wg.Done()
				codes[i], _ = a.do("POST", "/coach/videos/"+id+"/feedback", obj{"texto": "t"}, x.tokP)
			}(i)
		}
		wg.Wait()

		ok, conflito := 0, 0
		for _, c := range codes {
			switch c {
			case 201:
				ok++
			case 409:
				conflito++
			default:
				t.Errorf("rodada %d: status inesperado %d (%v)", rodada, c, codes)
			}
		}
		if ok != 1 || conflito != n-1 {
			t.Errorf("rodada %d: %d x 201, %d x 409 (%v)", rodada, ok, conflito, codes)
		}
		var fbs int
		var status string
		_ = a.seed.Pool.QueryRow(a.seed.Ctx, `SELECT (SELECT COUNT(*) FROM coach_video_feedback WHERE video_id=$1), status::text FROM coach_video WHERE id=$1`, id).Scan(&fbs, &status)
		if fbs != 1 || status != "FEEDBACK_ENVIADO" {
			t.Errorf("rodada %d: feedbacks=%d status=%s", rodada, fbs, status)
		}
	}
}

// O item_treino_id precisa ser de uma ficha do proprio aluno: anexar o video a
// um item de outro aluno (do mesmo personal ou de outro) exporia o nome do
// exercicio dele no GET.
func TestCoach_EnviarVideo_ItemDeOutroAluno_Rejeitado(t *testing.T) {
	a := novaAPI(t)
	x := a.ator()
	y := a.ator()
	irmao, _ := a.alunoExtra(x)
	itemDe := func(personal, aluno uuid.UUID, nome string) uuid.UUID {
		ficha := a.seed.FichaVigente(personal, aluno)
		return a.seed.Item(a.seed.Treino(ficha, "A", 0), a.seed.Exercicio(nome, &personal), 0, 3)
	}

	for nome, item := range map[string]uuid.UUID{
		"de outro personal":          itemDe(y.personal, y.aluno, "Privado do Y"),
		"de aluno do mesmo personal": itemDe(x.personal, irmao, "Privado do irmao"),
	} {
		st, raw := a.enviar(map[string]string{"duracao_segundos": "10", "item_treino_id": item.String()}, mp4(5), x.tokA)
		if st != 422 {
			t.Errorf("item %s: %d %.200s, quer 422", nome, st, raw)
		}
	}
	var n int
	_ = a.seed.Pool.QueryRow(a.seed.Ctx, `SELECT COUNT(*) FROM coach_video`).Scan(&n)
	if n != 0 || len(a.notifier.videos) != 0 {
		t.Errorf("registros=%d notificacoes=%d", n, len(a.notifier.videos))
	}

	// Item do proprio aluno, ainda que de ficha ja encerrada, continua valido.
	fim := a.seed.Dias(-1)
	ficha := a.seed.Ficha(x.personal, x.aluno, a.seed.Dias(-30), &fim, false)
	meu := a.seed.Item(a.seed.Treino(ficha, "A", 0), a.seed.Exercicio("Meu antigo", &x.personal), 0, 3)
	if st, raw := a.enviar(map[string]string{"duracao_segundos": "10", "item_treino_id": meu.String()}, mp4(5), x.tokA); st != 201 {
		t.Errorf("item de ficha antiga do proprio aluno: %d %.200s", st, raw)
	}
}
