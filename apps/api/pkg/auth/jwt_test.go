package auth

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func novaChave(t *testing.T) *rsa.PrivateKey {
	t.Helper()
	k, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("gerar chave RSA: %v", err)
	}
	return k
}

func TestSignEVerifyToken_RoundTrip(t *testing.T) {
	priv := novaChave(t)

	tok, err := SignToken(jwt.MapClaims{"sub": "u1", "role": "PERSONAL", "tenant_id": "t1"}, priv)
	if err != nil {
		t.Fatalf("SignToken: %v", err)
	}

	claims, err := VerifyToken(tok, &priv.PublicKey)
	if err != nil {
		t.Fatalf("VerifyToken: %v", err)
	}
	if claims["sub"] != "u1" || claims["role"] != "PERSONAL" || claims["tenant_id"] != "t1" {
		t.Errorf("claims inesperados: %v", claims)
	}
}

func TestSignToken_ExpiraEmQuinzeMinutos(t *testing.T) {
	priv := novaChave(t)

	tok, err := SignToken(jwt.MapClaims{"sub": "u1"}, priv)
	if err != nil {
		t.Fatalf("SignToken: %v", err)
	}
	claims, err := VerifyToken(tok, &priv.PublicKey)
	if err != nil {
		t.Fatalf("VerifyToken: %v", err)
	}

	iat := int64(claims["iat"].(float64))
	exp := int64(claims["exp"].(float64))
	if got := time.Duration(exp-iat) * time.Second; got != accessTokenTTL {
		t.Errorf("TTL = %v, want %v", got, accessTokenTTL)
	}
}

func TestSignRefreshToken_UsaTTLCustomizado(t *testing.T) {
	priv := novaChave(t)

	tok, err := SignRefreshToken(jwt.MapClaims{"sub": "u1", "jti": "j1"}, priv, 7*24*time.Hour)
	if err != nil {
		t.Fatalf("SignRefreshToken: %v", err)
	}
	claims, err := VerifyToken(tok, &priv.PublicKey)
	if err != nil {
		t.Fatalf("VerifyToken: %v", err)
	}

	iat := int64(claims["iat"].(float64))
	exp := int64(claims["exp"].(float64))
	if got := time.Duration(exp-iat) * time.Second; got != 7*24*time.Hour {
		t.Errorf("TTL = %v, want 168h", got)
	}
	if claims["jti"] != "j1" {
		t.Errorf("jti perdido: %v", claims)
	}
}

func TestVerifyToken_Rejeita(t *testing.T) {
	priv := novaChave(t)
	outra := novaChave(t)

	expirado, err := SignRefreshToken(jwt.MapClaims{"sub": "u1"}, priv, -time.Minute)
	if err != nil {
		t.Fatalf("assinar expirado: %v", err)
	}
	valido, err := SignToken(jwt.MapClaims{"sub": "u1"}, priv)
	if err != nil {
		t.Fatalf("assinar valido: %v", err)
	}
	// alg=HS256 assinado com bytes da chave publica: ataque classico de confusao de algoritmo.
	hmacTok, err := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{"sub": "u1"}).
		SignedString([]byte("segredo"))
	if err != nil {
		t.Fatalf("assinar HS256: %v", err)
	}
	semAssinatura, err := jwt.NewWithClaims(jwt.SigningMethodNone, jwt.MapClaims{"sub": "u1"}).
		SignedString(jwt.UnsafeAllowNoneSignatureType)
	if err != nil {
		t.Fatalf("assinar none: %v", err)
	}

	casos := map[string]struct {
		token string
		chave *rsa.PublicKey
	}{
		"expirado":             {expirado, &priv.PublicKey},
		"chave publica errada": {valido, &outra.PublicKey},
		"algoritmo HS256":      {hmacTok, &priv.PublicKey},
		"alg none":             {semAssinatura, &priv.PublicKey},
		"lixo":                 {"nao-e-um-jwt", &priv.PublicKey},
		"vazio":                {"", &priv.PublicKey},
		"payload adulterado":   {valido[:len(valido)-4] + "AAAA", &priv.PublicKey},
	}
	for nome, c := range casos {
		t.Run(nome, func(t *testing.T) {
			if _, err := VerifyToken(c.token, c.chave); err == nil {
				t.Error("deveria rejeitar o token")
			}
		})
	}
}

func escreverPEM(t *testing.T, dir, nome, tipo string, der []byte) string {
	t.Helper()
	p := filepath.Join(dir, nome)
	if err := os.WriteFile(p, pem.EncodeToMemory(&pem.Block{Type: tipo, Bytes: der}), 0o600); err != nil {
		t.Fatalf("escrever %s: %v", nome, err)
	}
	return p
}

func TestLoadKeys_PKCS1EPKCS8(t *testing.T) {
	priv := novaChave(t)
	pubDER, err := x509.MarshalPKIXPublicKey(&priv.PublicKey)
	if err != nil {
		t.Fatalf("marshal publica: %v", err)
	}
	pkcs8, err := x509.MarshalPKCS8PrivateKey(priv)
	if err != nil {
		t.Fatalf("marshal pkcs8: %v", err)
	}

	dir := t.TempDir()
	pub := escreverPEM(t, dir, "pub.pem", "PUBLIC KEY", pubDER)
	casos := map[string]string{
		"PKCS1": escreverPEM(t, dir, "pkcs1.pem", "RSA PRIVATE KEY", x509.MarshalPKCS1PrivateKey(priv)),
		"PKCS8": escreverPEM(t, dir, "pkcs8.pem", "PRIVATE KEY", pkcs8),
	}
	for nome, privPath := range casos {
		t.Run(nome, func(t *testing.T) {
			gotPriv, gotPub, err := LoadKeys(privPath, pub)
			if err != nil {
				t.Fatalf("LoadKeys: %v", err)
			}
			if !gotPriv.Equal(priv) || !gotPub.Equal(&priv.PublicKey) {
				t.Error("chaves carregadas diferem das originais")
			}
		})
	}
}

func TestLoadKeys_Erros(t *testing.T) {
	priv := novaChave(t)
	pubDER, _ := x509.MarshalPKIXPublicKey(&priv.PublicKey)

	dir := t.TempDir()
	privOK := escreverPEM(t, dir, "priv.pem", "RSA PRIVATE KEY", x509.MarshalPKCS1PrivateKey(priv))
	pubOK := escreverPEM(t, dir, "pub.pem", "PUBLIC KEY", pubDER)
	semPEM := filepath.Join(dir, "vazio.pem")
	if err := os.WriteFile(semPEM, []byte("nao e pem"), 0o600); err != nil {
		t.Fatal(err)
	}
	privLixo := escreverPEM(t, dir, "lixo.pem", "RSA PRIVATE KEY", []byte("lixo"))
	pubLixo := escreverPEM(t, dir, "publixo.pem", "PUBLIC KEY", []byte("lixo"))
	inexistente := filepath.Join(dir, "nao-existe.pem")

	casos := map[string][2]string{
		"privada inexistente": {inexistente, pubOK},
		"privada sem PEM":     {semPEM, pubOK},
		"privada corrompida":  {privLixo, pubOK},
		"publica inexistente": {privOK, inexistente},
		"publica sem PEM":     {privOK, semPEM},
		"publica corrompida":  {privOK, pubLixo},
	}
	for nome, c := range casos {
		t.Run(nome, func(t *testing.T) {
			if _, _, err := LoadKeys(c[0], c[1]); err == nil {
				t.Error("deveria retornar erro")
			}
		})
	}
}
