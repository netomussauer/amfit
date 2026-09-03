package domain

// Tabela de scoring da anamnese inteligente (SDD §20.2, "Tabela de
// Scoring"). Cada pergunta e um mapa de chave de opcao -> {label, pontos}.
// As chaves (ex: "3_4_dias") sao o contrato estavel com o cliente — os
// labels podem mudar sem quebrar nada, os pontos NUNCA sao aceitos do
// cliente, sempre resolvidos aqui.
type opcaoScoring struct {
	Label  string
	Pontos int
}

var opcoesFrequenciaSemanal = map[string]opcaoScoring{
	"sedentario":  {"Nenhuma (sedentário)", 0},
	"1_2_dias":    {"1-2 dias/semana", 10},
	"3_4_dias":    {"3-4 dias/semana", 20},
	"5_mais_dias": {"5+ dias/semana", 30},
}

var opcoesExperienciaMeses = map[string]opcaoScoring{
	"nunca_treinei":  {"Nunca treinei", 0},
	"menos_6_meses":  {"Menos de 6 meses", 5},
	"6_meses_2_anos": {"6 meses a 2 anos", 15},
	"mais_2_anos":    {"Mais de 2 anos", 25},
}

var opcoesObjetivoScoring = map[string]opcaoScoring{
	"emagrecimento":         {"Emagrecimento", 0},
	"condicionamento_geral": {"Condicionamento geral", 5},
	"hipertrofia":           {"Hipertrofia", 10},
	"performance_forca":     {"Performance/força", 15},
}

var opcoesRestricoes = map[string]opcaoScoring{
	"sim": {"Sim (limitam exercícios)", -10},
	"nao": {"Não", 0},
}

var opcoesDisponibilidade = map[string]opcaoScoring{
	"2_dias":   {"2 dias", 0},
	"3_dias":   {"3 dias", 5},
	"4_5_dias": {"4-5 dias", 10},
}

// objetivoScoringParaTemplate traduz a opcao de objetivo do bloco de
// scoring para o vocabulario de `template_treino.objetivo`
// (hipertrofia|emagrecimento|forca|condicionamento — SDD §20.2). E uma
// tradução deliberada: o SDD usa dois vocabularios de objetivo diferentes
// (o da pergunta de scoring, focado em como o aluno descreveria a meta, e
// o do catalogo de templates, mais compacto) sem definir o mapeamento —
// esta e a resolucao adotada aqui.
var objetivoScoringParaTemplate = map[string]string{
	"emagrecimento":         "emagrecimento",
	"condicionamento_geral": "condicionamento",
	"hipertrofia":           "hipertrofia",
	"performance_forca":     "forca",
}

// AnamneseRespostasInput sao as 5 chaves de opcao brutas recebidas do
// cliente (uma por pergunta padronizada).
type AnamneseRespostasInput struct {
	FrequenciaSemanal string
	ExperienciaMeses  string
	Objetivo          string
	Restricoes        string
	Disponibilidade   string
}

// CalcularScoreAnamnese resolve as 5 respostas contra a tabela de scoring,
// soma os pontos e determina o nivel sugerido. Retorna
// ErrOpcaoAnamneseInvalida se qualquer chave nao existir na tabela —
// nunca aceita pontos computados pelo cliente.
func CalcularScoreAnamnese(input AnamneseRespostasInput) (RespostasAnamnese, int, NivelAnamnese, error) {
	freq, ok := opcoesFrequenciaSemanal[input.FrequenciaSemanal]
	if !ok {
		return RespostasAnamnese{}, 0, "", ErrOpcaoAnamneseInvalida
	}
	exp, ok := opcoesExperienciaMeses[input.ExperienciaMeses]
	if !ok {
		return RespostasAnamnese{}, 0, "", ErrOpcaoAnamneseInvalida
	}
	obj, ok := opcoesObjetivoScoring[input.Objetivo]
	if !ok {
		return RespostasAnamnese{}, 0, "", ErrOpcaoAnamneseInvalida
	}
	restr, ok := opcoesRestricoes[input.Restricoes]
	if !ok {
		return RespostasAnamnese{}, 0, "", ErrOpcaoAnamneseInvalida
	}
	disp, ok := opcoesDisponibilidade[input.Disponibilidade]
	if !ok {
		return RespostasAnamnese{}, 0, "", ErrOpcaoAnamneseInvalida
	}

	score := freq.Pontos + exp.Pontos + obj.Pontos + restr.Pontos + disp.Pontos

	respostas := RespostasAnamnese{
		FrequenciaSemanal: RespostaAnamnese{Opcao: freq.Label, Pontos: freq.Pontos},
		ExperienciaMeses:  RespostaAnamnese{Opcao: exp.Label, Pontos: exp.Pontos},
		Objetivo:          RespostaAnamnese{Opcao: obj.Label, Pontos: obj.Pontos},
		Restricoes:        RespostaAnamnese{Opcao: restr.Label, Pontos: restr.Pontos},
		Disponibilidade:   RespostaAnamnese{Opcao: disp.Label, Pontos: disp.Pontos},
	}

	return respostas, score, nivelPorScore(score), nil
}

// nivelPorScore aplica as faixas do SDD §20.2: 0–30 Iniciante,
// 31–60 Intermediário, 61+ Avançado. Score pode ser negativo (restrições
// médicas subtraem 10) — cai na faixa Iniciante.
func nivelPorScore(score int) NivelAnamnese {
	switch {
	case score >= 61:
		return NivelAvancado
	case score >= 31:
		return NivelIntermediario
	default:
		return NivelIniciante
	}
}

// TemplateObjetivoParaNivel resolve o vocabulario de `template_treino.objetivo`
// a partir da chave de opcao de objetivo enviada no scoring. Vazio quando a
// chave e desconhecida (chamador ja validou via CalcularScoreAnamnese antes
// de chegar aqui, entao isso so aconteceria por uso indevido da funcao).
func TemplateObjetivoParaNivel(objetivoScoringKey string) string {
	return objetivoScoringParaTemplate[objetivoScoringKey]
}
