package domain

import "github.com/google/uuid"

// Direcao indica o sentido da sugestao de progressao de carga.
type Direcao string

const (
	DirecaoAumentar Direcao = "AUMENTAR"
	DirecaoManter   Direcao = "MANTER"
)

// incrementoPadraoKg e o passo fixo sugerido quando o aluno "bate" a
// sessao anterior. Valor pragmatico para o MVP — corresponde ao menor
// anilha comum em academia; nao varia por exercicio/grupo muscular ainda.
const incrementoPadraoKg = 2.5

// SugestaoProgressao e o resultado do calculo de sobrecarga progressiva
// para um exercicio especifico de um aluno, derivado das duas sessoes
// concluidas mais recentes (auto-referencial — nao depende da meta de
// repeticoes da ficha, que hoje e texto livre tipo "8-12" e nao da pra
// comparar numericamente de forma confiavel).
type SugestaoProgressao struct {
	ExercicioID   uuid.UUID
	TemSugestao   bool
	Direcao       Direcao
	CargaSugerida *float64
	// UltimaCargaRegistrada e UltimaMediaRepeticoes vem da sessao mais
	// recente ja concluida (a base de comparacao da sugestao), NAO da
	// sessao anterior a essa — nomear como "anterior"/"sessao_anterior"
	// aqui seria ambiguo e um UI futuro poderia exibir o numero errado
	// como referencia (achado de code-review).
	UltimaCargaRegistrada *float64
	UltimaMediaRepeticoes *float64
}

type sessaoResumo struct {
	sessaoID    uuid.UUID
	cargaMaxima *float64
	mediaReps   *float64
}

// CalcularSugestaoProgressao deriva uma sugestao de carga comparando a
// ultima sessao concluida do exercicio com a sessao concluida anterior a
// ela. `pontos` deve vir ordenado do mais antigo para o mais recente
// (mesmo contrato de HistoricoQueryRepository.HistoricoCarga) e conter
// apenas series concluidas — historicoCore ja garante isso.
//
// Regra (auto-referencial, sem depender de meta de repeticoes):
//   - Menos de 2 sessoes com carga registrada: sem sugestao.
//   - Repeticoes medias na sessao mais recente >= sessao anterior (o
//     aluno "bateu" a sessao anterior, mesma carga ou mais pesada):
//     sugere aumentar +2.5kg sobre a carga mais recente.
//   - Caso contrario (regrediu): sugere manter a carga mais recente.
func CalcularSugestaoProgressao(exercicioID uuid.UUID, pontos []HistoricoCargaPonto) SugestaoProgressao {
	sessoes := agruparPorSessaoComCarga(pontos)
	if len(sessoes) < 2 {
		return SugestaoProgressao{ExercicioID: exercicioID, TemSugestao: false}
	}

	atual := sessoes[len(sessoes)-1]
	anterior := sessoes[len(sessoes)-2]

	if atual.cargaMaxima == nil || anterior.cargaMaxima == nil {
		return SugestaoProgressao{ExercicioID: exercicioID, TemSugestao: false}
	}

	bateuOuSuperou := atual.mediaReps != nil && anterior.mediaReps != nil &&
		*atual.mediaReps >= *anterior.mediaReps &&
		*atual.cargaMaxima >= *anterior.cargaMaxima

	direcao := DirecaoManter
	sugerida := *atual.cargaMaxima
	if bateuOuSuperou {
		direcao = DirecaoAumentar
		sugerida = *atual.cargaMaxima + incrementoPadraoKg
	}

	return SugestaoProgressao{
		ExercicioID:           exercicioID,
		TemSugestao:           true,
		Direcao:               direcao,
		CargaSugerida:         &sugerida,
		UltimaCargaRegistrada: atual.cargaMaxima,
		UltimaMediaRepeticoes: atual.mediaReps,
	}
}

// agruparPorSessaoComCarga agrupa pontos por SessaoID preservando a ordem
// de primeira ocorrencia (cronologica, herdada do input) e calcula a
// carga maxima + media de repeticoes de cada sessao. Series sem carga ou
// sem repeticoes registradas (bodyweight, ou aluno pulou o campo) sao
// ignoradas no calculo da media/maximo daquela sessao, mas nao excluem a
// sessao inteira.
func agruparPorSessaoComCarga(pontos []HistoricoCargaPonto) []sessaoResumo {
	ordem := make([]uuid.UUID, 0, 8)
	acumulado := make(map[uuid.UUID]*struct {
		cargaMax  float64
		temCarga  bool
		somaReps  int
		countReps int
	}, 8)

	for _, p := range pontos {
		acc, ok := acumulado[p.SessaoID]
		if !ok {
			acc = &struct {
				cargaMax  float64
				temCarga  bool
				somaReps  int
				countReps int
			}{}
			acumulado[p.SessaoID] = acc
			ordem = append(ordem, p.SessaoID)
		}
		if p.CargaRealizada != nil && (!acc.temCarga || *p.CargaRealizada > acc.cargaMax) {
			acc.cargaMax = *p.CargaRealizada
			acc.temCarga = true
		}
		if p.RepeticoesRealizadas != nil {
			acc.somaReps += *p.RepeticoesRealizadas
			acc.countReps++
		}
	}

	resumos := make([]sessaoResumo, 0, len(ordem))
	for _, sessaoID := range ordem {
		acc := acumulado[sessaoID]
		r := sessaoResumo{sessaoID: sessaoID}
		if acc.temCarga {
			carga := acc.cargaMax
			r.cargaMaxima = &carga
		}
		if acc.countReps > 0 {
			media := float64(acc.somaReps) / float64(acc.countReps)
			r.mediaReps = &media
		}
		resumos = append(resumos, r)
	}
	return resumos
}
