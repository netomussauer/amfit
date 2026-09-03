package domain

import (
	"testing"

	"github.com/google/uuid"
)

func f(v float64) *float64 { return &v }
func i(v int) *int         { return &v }

func TestCalcularSugestaoProgressao_SemHistorico_SemSugestao(t *testing.T) {
	exercicioID := uuid.New()
	out := CalcularSugestaoProgressao(exercicioID, nil)

	if out.TemSugestao {
		t.Fatalf("esperava TemSugestao=false, veio true: %+v", out)
	}
	if out.ExercicioID != exercicioID {
		t.Fatalf("ExercicioID nao propagado")
	}
}

func TestCalcularSugestaoProgressao_UmaUnicaSessao_SemSugestao(t *testing.T) {
	sessao := uuid.New()
	pontos := []HistoricoCargaPonto{
		{SessaoID: sessao, NumeroSerie: 1, CargaRealizada: f(20), RepeticoesRealizadas: i(10)},
		{SessaoID: sessao, NumeroSerie: 2, CargaRealizada: f(20), RepeticoesRealizadas: i(10)},
	}
	out := CalcularSugestaoProgressao(uuid.New(), pontos)

	if out.TemSugestao {
		t.Fatalf("esperava sem sugestao com apenas 1 sessao, veio: %+v", out)
	}
}

func TestCalcularSugestaoProgressao_RepeticoesIguaisMesmaCarga_SugereAumentar(t *testing.T) {
	sessaoAnterior, sessaoAtual := uuid.New(), uuid.New()
	pontos := []HistoricoCargaPonto{
		{SessaoID: sessaoAnterior, NumeroSerie: 1, CargaRealizada: f(20), RepeticoesRealizadas: i(10)},
		{SessaoID: sessaoAnterior, NumeroSerie: 2, CargaRealizada: f(20), RepeticoesRealizadas: i(10)},
		{SessaoID: sessaoAtual, NumeroSerie: 1, CargaRealizada: f(20), RepeticoesRealizadas: i(10)},
		{SessaoID: sessaoAtual, NumeroSerie: 2, CargaRealizada: f(20), RepeticoesRealizadas: i(10)},
	}
	out := CalcularSugestaoProgressao(uuid.New(), pontos)

	if !out.TemSugestao {
		t.Fatalf("esperava sugestao, veio sem: %+v", out)
	}
	if out.Direcao != DirecaoAumentar {
		t.Fatalf("esperava DirecaoAumentar, veio %s", out.Direcao)
	}
	if out.CargaSugerida == nil || *out.CargaSugerida != 22.5 {
		t.Fatalf("esperava carga sugerida 22.5, veio %v", out.CargaSugerida)
	}
}

func TestCalcularSugestaoProgressao_RepeticoesMelhoraramMesmaCarga_SugereAumentar(t *testing.T) {
	sessaoAnterior, sessaoAtual := uuid.New(), uuid.New()
	pontos := []HistoricoCargaPonto{
		{SessaoID: sessaoAnterior, NumeroSerie: 1, CargaRealizada: f(20), RepeticoesRealizadas: i(8)},
		{SessaoID: sessaoAtual, NumeroSerie: 1, CargaRealizada: f(20), RepeticoesRealizadas: i(12)},
	}
	out := CalcularSugestaoProgressao(uuid.New(), pontos)

	if out.Direcao != DirecaoAumentar {
		t.Fatalf("esperava DirecaoAumentar, veio %s", out.Direcao)
	}
}

func TestCalcularSugestaoProgressao_RepeticoesPiores_SugereManter(t *testing.T) {
	sessaoAnterior, sessaoAtual := uuid.New(), uuid.New()
	pontos := []HistoricoCargaPonto{
		{SessaoID: sessaoAnterior, NumeroSerie: 1, CargaRealizada: f(20), RepeticoesRealizadas: i(12)},
		{SessaoID: sessaoAtual, NumeroSerie: 1, CargaRealizada: f(20), RepeticoesRealizadas: i(8)},
	}
	out := CalcularSugestaoProgressao(uuid.New(), pontos)

	if !out.TemSugestao {
		t.Fatalf("esperava sugestao (manter), veio sem: %+v", out)
	}
	if out.Direcao != DirecaoManter {
		t.Fatalf("esperava DirecaoManter, veio %s", out.Direcao)
	}
	if out.CargaSugerida == nil || *out.CargaSugerida != 20 {
		t.Fatalf("esperava manter carga 20, veio %v", out.CargaSugerida)
	}
}

func TestCalcularSugestaoProgressao_CargaCaiu_SugereManterNaMaisRecente(t *testing.T) {
	// aluno reduziu carga manualmente (ex: trocou de exercicio variante) —
	// nao devemos sugerir voltar pra carga antiga.
	sessaoAnterior, sessaoAtual := uuid.New(), uuid.New()
	pontos := []HistoricoCargaPonto{
		{SessaoID: sessaoAnterior, NumeroSerie: 1, CargaRealizada: f(30), RepeticoesRealizadas: i(10)},
		{SessaoID: sessaoAtual, NumeroSerie: 1, CargaRealizada: f(20), RepeticoesRealizadas: i(10)},
	}
	out := CalcularSugestaoProgressao(uuid.New(), pontos)

	if out.Direcao != DirecaoManter {
		t.Fatalf("esperava DirecaoManter, veio %s", out.Direcao)
	}
	if out.CargaSugerida == nil || *out.CargaSugerida != 20 {
		t.Fatalf("esperava manter a carga mais recente (20), veio %v", out.CargaSugerida)
	}
}

func TestCalcularSugestaoProgressao_CargaAumentouEntreSessoes_SugereManterNaAtual(t *testing.T) {
	// personal/aluno ja aumentou a carga manualmente — nao soma +2.5 de novo
	// por cima, so confirma a carga mais recente.
	sessaoAnterior, sessaoAtual := uuid.New(), uuid.New()
	pontos := []HistoricoCargaPonto{
		{SessaoID: sessaoAnterior, NumeroSerie: 1, CargaRealizada: f(20), RepeticoesRealizadas: i(10)},
		{SessaoID: sessaoAtual, NumeroSerie: 1, CargaRealizada: f(25), RepeticoesRealizadas: i(6)},
	}
	out := CalcularSugestaoProgressao(uuid.New(), pontos)

	if out.Direcao != DirecaoManter {
		t.Fatalf("esperava DirecaoManter (reps caiu, mesmo com carga maior), veio %s", out.Direcao)
	}
	if out.CargaSugerida == nil || *out.CargaSugerida != 25 {
		t.Fatalf("esperava manter a carga mais recente (25), veio %v", out.CargaSugerida)
	}
}

func TestCalcularSugestaoProgressao_UsaMaximaDaSessaoQuandoMultiplasSeries(t *testing.T) {
	sessaoAnterior, sessaoAtual := uuid.New(), uuid.New()
	pontos := []HistoricoCargaPonto{
		{SessaoID: sessaoAnterior, NumeroSerie: 1, CargaRealizada: f(18), RepeticoesRealizadas: i(10)},
		{SessaoID: sessaoAnterior, NumeroSerie: 2, CargaRealizada: f(20), RepeticoesRealizadas: i(10)},
		{SessaoID: sessaoAtual, NumeroSerie: 1, CargaRealizada: f(20), RepeticoesRealizadas: i(10)},
		{SessaoID: sessaoAtual, NumeroSerie: 2, CargaRealizada: f(20), RepeticoesRealizadas: i(10)},
	}
	out := CalcularSugestaoProgressao(uuid.New(), pontos)

	if out.UltimaCargaRegistrada == nil || *out.UltimaCargaRegistrada != 20 {
		t.Fatalf("esperava usar a carga maxima (20) da sessao, veio %v", out.UltimaCargaRegistrada)
	}
}

func TestCalcularSugestaoProgressao_SemCargaRegistrada_SemSugestao(t *testing.T) {
	// exercicio de peso corporal — sem carga registrada nao da pra sugerir carga.
	sessaoAnterior, sessaoAtual := uuid.New(), uuid.New()
	pontos := []HistoricoCargaPonto{
		{SessaoID: sessaoAnterior, NumeroSerie: 1, RepeticoesRealizadas: i(10)},
		{SessaoID: sessaoAtual, NumeroSerie: 1, RepeticoesRealizadas: i(12)},
	}
	out := CalcularSugestaoProgressao(uuid.New(), pontos)

	if out.TemSugestao {
		t.Fatalf("esperava sem sugestao (sem carga), veio: %+v", out)
	}
}

func TestCalcularSugestaoProgressao_UsaAsDuasSessoesMaisRecentes(t *testing.T) {
	// 3 sessoes: deve ignorar a mais antiga e comparar so as 2 ultimas.
	s1, s2, s3 := uuid.New(), uuid.New(), uuid.New()
	pontos := []HistoricoCargaPonto{
		{SessaoID: s1, NumeroSerie: 1, CargaRealizada: f(30), RepeticoesRealizadas: i(1)}, // muito antiga, ignorada
		{SessaoID: s2, NumeroSerie: 1, CargaRealizada: f(20), RepeticoesRealizadas: i(10)},
		{SessaoID: s3, NumeroSerie: 1, CargaRealizada: f(20), RepeticoesRealizadas: i(10)},
	}
	out := CalcularSugestaoProgressao(uuid.New(), pontos)

	if out.Direcao != DirecaoAumentar {
		t.Fatalf("esperava DirecaoAumentar comparando s2 vs s3 (ignorando s1), veio %s", out.Direcao)
	}
	if out.CargaSugerida == nil || *out.CargaSugerida != 22.5 {
		t.Fatalf("esperava 22.5 (20 + incremento), veio %v", out.CargaSugerida)
	}
}
