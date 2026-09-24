package domain

import (
	"crypto/rand"
	"fmt"
)

// Código de convite do personal (white label nível 2, ADR-007): 8 caracteres
// aleatórios de um alfabeto de 31 símbolos sem ambíguos (sem I, L, O, 0, 1),
// ~8,5e11 combinações. O mesmo alfabeto vale na migration 000012 e na regex
// do @amfit/shared (tenant.schema.ts).
const (
	codigoConviteAlfabeto = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
	codigoConviteTamanho  = 8
)

// GerarCodigoConvite sorteia um código novo com crypto/rand. Usa amostragem
// por rejeição (descarta bytes >= 248) para que os 31 símbolos saiam com a
// mesma probabilidade, sem viés de módulo.
func GerarCodigoConvite() (string, error) {
	const limite = 256 - (256 % len(codigoConviteAlfabeto)) // 248

	codigo := make([]byte, 0, codigoConviteTamanho)
	buf := make([]byte, codigoConviteTamanho*2)
	for len(codigo) < codigoConviteTamanho {
		if _, err := rand.Read(buf); err != nil {
			return "", fmt.Errorf("domain: gerar codigo de convite: %w", err)
		}
		for _, b := range buf {
			if int(b) >= limite {
				continue
			}
			codigo = append(codigo, codigoConviteAlfabeto[int(b)%len(codigoConviteAlfabeto)])
			if len(codigo) == codigoConviteTamanho {
				break
			}
		}
	}
	return string(codigo), nil
}

// CodigoConviteValido informa se s tem o formato de um código de convite
// (tamanho e alfabeto). Não diz se o código existe.
func CodigoConviteValido(s string) bool {
	if len(s) != codigoConviteTamanho {
		return false
	}
	for i := 0; i < len(s); i++ {
		if !containsByte(codigoConviteAlfabeto, s[i]) {
			return false
		}
	}
	return true
}

func containsByte(alfabeto string, b byte) bool {
	for i := 0; i < len(alfabeto); i++ {
		if alfabeto[i] == b {
			return true
		}
	}
	return false
}
