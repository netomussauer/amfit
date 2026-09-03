package domain

import "testing"

func TestCalcularScoreAnamnese_OpcaoInvalida_RetornaErro(t *testing.T) {
	casos := []struct {
		nome  string
		input AnamneseRespostasInput
	}{
		{"frequencia invalida", AnamneseRespostasInput{
			FrequenciaSemanal: "chave-invalida", ExperienciaMeses: "nunca_treinei",
			Objetivo: "emagrecimento", Restricoes: "nao", Disponibilidade: "2_dias",
		}},
		{"experiencia invalida", AnamneseRespostasInput{
			FrequenciaSemanal: "sedentario", ExperienciaMeses: "chave-invalida",
			Objetivo: "emagrecimento", Restricoes: "nao", Disponibilidade: "2_dias",
		}},
		{"objetivo invalido", AnamneseRespostasInput{
			FrequenciaSemanal: "sedentario", ExperienciaMeses: "nunca_treinei",
			Objetivo: "chave-invalida", Restricoes: "nao", Disponibilidade: "2_dias",
		}},
		{"restricoes invalida", AnamneseRespostasInput{
			FrequenciaSemanal: "sedentario", ExperienciaMeses: "nunca_treinei",
			Objetivo: "emagrecimento", Restricoes: "chave-invalida", Disponibilidade: "2_dias",
		}},
		{"disponibilidade invalida", AnamneseRespostasInput{
			FrequenciaSemanal: "sedentario", ExperienciaMeses: "nunca_treinei",
			Objetivo: "emagrecimento", Restricoes: "nao", Disponibilidade: "chave-invalida",
		}},
	}

	for _, c := range casos {
		t.Run(c.nome, func(t *testing.T) {
			_, _, _, err := CalcularScoreAnamnese(c.input)
			if err != ErrOpcaoAnamneseInvalida {
				t.Fatalf("esperado ErrOpcaoAnamneseInvalida, got %v", err)
			}
		})
	}
}

func TestCalcularScoreAnamnese_SomaPontosENivel(t *testing.T) {
	casos := []struct {
		nome          string
		input         AnamneseRespostasInput
		scoreEsperado int
		nivelEsperado NivelAnamnese
	}{
		{
			nome: "score minimo possivel -> Iniciante",
			input: AnamneseRespostasInput{
				FrequenciaSemanal: "sedentario", ExperienciaMeses: "nunca_treinei",
				Objetivo: "emagrecimento", Restricoes: "sim", Disponibilidade: "2_dias",
			},
			scoreEsperado: -10,
			nivelEsperado: NivelIniciante,
		},
		{
			nome: "exemplo do SDD: 20+15+10+0+5=50 -> Intermediario",
			input: AnamneseRespostasInput{
				FrequenciaSemanal: "3_4_dias", ExperienciaMeses: "6_meses_2_anos",
				Objetivo: "hipertrofia", Restricoes: "nao", Disponibilidade: "3_dias",
			},
			scoreEsperado: 50,
			nivelEsperado: NivelIntermediario,
		},
		{
			nome: "score maximo possivel -> Avancado",
			input: AnamneseRespostasInput{
				FrequenciaSemanal: "5_mais_dias", ExperienciaMeses: "mais_2_anos",
				Objetivo: "performance_forca", Restricoes: "nao", Disponibilidade: "4_5_dias",
			},
			scoreEsperado: 80,
			nivelEsperado: NivelAvancado,
		},
		{
			nome: "score 30 (todos os pontos sao multiplos de 5 ou -10, 30 e a borda superior de Iniciante)",
			input: AnamneseRespostasInput{
				FrequenciaSemanal: "1_2_dias", ExperienciaMeses: "menos_6_meses",
				Objetivo: "condicionamento_geral", Restricoes: "nao", Disponibilidade: "4_5_dias",
			},
			scoreEsperado: 30,
			nivelEsperado: NivelIniciante,
		},
		{
			nome: "score 65 (primeiro valor avancado alcancavel acima da borda de 61)",
			input: AnamneseRespostasInput{
				FrequenciaSemanal: "5_mais_dias", ExperienciaMeses: "6_meses_2_anos",
				Objetivo: "hipertrofia", Restricoes: "nao", Disponibilidade: "4_5_dias",
			},
			scoreEsperado: 65,
			nivelEsperado: NivelAvancado,
		},
	}

	for _, c := range casos {
		t.Run(c.nome, func(t *testing.T) {
			respostas, score, nivel, err := CalcularScoreAnamnese(c.input)
			if err != nil {
				t.Fatalf("erro inesperado: %v", err)
			}
			if score != c.scoreEsperado {
				t.Errorf("score = %d, esperado %d", score, c.scoreEsperado)
			}
			if nivel != c.nivelEsperado {
				t.Errorf("nivel = %s, esperado %s", nivel, c.nivelEsperado)
			}
			if respostas.Objetivo.Opcao == "" {
				t.Error("respostas.Objetivo.Opcao nao deveria ficar vazio")
			}
		})
	}
}

func TestTemplateObjetivoParaNivel(t *testing.T) {
	casos := map[string]string{
		"emagrecimento":         "emagrecimento",
		"condicionamento_geral": "condicionamento",
		"hipertrofia":           "hipertrofia",
		"performance_forca":     "forca",
		"chave-desconhecida":    "",
	}
	for scoringKey, esperado := range casos {
		if got := TemplateObjetivoParaNivel(scoringKey); got != esperado {
			t.Errorf("TemplateObjetivoParaNivel(%q) = %q, esperado %q", scoringKey, got, esperado)
		}
	}
}
