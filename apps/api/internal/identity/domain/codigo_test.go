package domain

import (
	"strings"
	"testing"
)

func TestGerarCodigoConvite_TamanhoEAlfabeto(t *testing.T) {
	for i := 0; i < 500; i++ {
		codigo, err := GerarCodigoConvite()
		if err != nil {
			t.Fatalf("GerarCodigoConvite: %v", err)
		}
		if len(codigo) != 8 {
			t.Fatalf("tamanho esperado 8, got %d (%q)", len(codigo), codigo)
		}
		if !CodigoConviteValido(codigo) {
			t.Fatalf("codigo gerado nao passa na propria validacao: %q", codigo)
		}
		if strings.ContainsAny(codigo, "ILO01") {
			t.Fatalf("codigo com caractere ambiguo: %q", codigo)
		}
	}
}

func TestGerarCodigoConvite_NaoRepete(t *testing.T) {
	vistos := make(map[string]struct{}, 2000)
	for i := 0; i < 2000; i++ {
		codigo, err := GerarCodigoConvite()
		if err != nil {
			t.Fatalf("GerarCodigoConvite: %v", err)
		}
		if _, ok := vistos[codigo]; ok {
			t.Fatalf("codigo repetido em 2000 sorteios: %q", codigo)
		}
		vistos[codigo] = struct{}{}
	}
}

func TestGerarCodigoConvite_UsaTodosOsSimbolos(t *testing.T) {
	usados := map[rune]struct{}{}
	for i := 0; i < 3000; i++ {
		codigo, _ := GerarCodigoConvite()
		for _, r := range codigo {
			usados[r] = struct{}{}
		}
	}
	if len(usados) != len(codigoConviteAlfabeto) {
		t.Errorf("esperados %d simbolos distintos em 24000 amostras, got %d", len(codigoConviteAlfabeto), len(usados))
	}
}

func TestCodigoConviteValido(t *testing.T) {
	casos := []struct {
		entrada string
		ok      bool
	}{
		{"K7M2QX9P", true},
		{"ABCDEFGH", true},
		{"23456789", true},
		{"K7M2QX9", false},   // curto
		{"K7M2QX9PA", false}, // longo
		{"k7m2qx9p", false},  // minusculas
		{"K7M2QX0P", false},  // zero e ambiguo
		{"K7M2QXIP", false},  // I e ambiguo
		{"K7M2QX9 ", false},  // espaco
		{"", false},
	}
	for _, c := range casos {
		if got := CodigoConviteValido(c.entrada); got != c.ok {
			t.Errorf("CodigoConviteValido(%q) = %v, esperado %v", c.entrada, got, c.ok)
		}
	}
}
