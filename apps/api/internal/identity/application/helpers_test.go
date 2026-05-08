package application

import (
	"crypto/rand"
	"crypto/rsa"
	"testing"

	"golang.org/x/crypto/bcrypt"
)

const fixedPassword = "Password123!"

// testKeys gera um par RSA ad-hoc para uso em testes. Usar bits=2048 é suficiente
// para validar a assinatura sem onerar muito o tempo de teste.
func testKeys(t *testing.T) (*rsa.PrivateKey, *rsa.PublicKey) {
	t.Helper()
	priv, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("rsa.GenerateKey: %v", err)
	}
	return priv, &priv.PublicKey
}

// fixedHash gera um hash bcrypt determinístico de fixedPassword.
func fixedHash(t *testing.T) string {
	t.Helper()
	h, err := bcrypt.GenerateFromPassword([]byte(fixedPassword), bcrypt.MinCost)
	if err != nil {
		t.Fatalf("bcrypt.GenerateFromPassword: %v", err)
	}
	return string(h)
}
