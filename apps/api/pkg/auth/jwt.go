// Package auth fornece utilitários de criação e verificação de tokens JWT RS256.
package auth

import (
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"fmt"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const accessTokenTTL = 15 * time.Minute

// LoadKeys lê o par de chaves RSA de arquivos PEM no disco.
func LoadKeys(privatePath, publicPath string) (*rsa.PrivateKey, *rsa.PublicKey, error) {
	privBytes, err := os.ReadFile(privatePath)
	if err != nil {
		return nil, nil, fmt.Errorf("auth: read private key %q: %w", privatePath, err)
	}

	privBlock, _ := pem.Decode(privBytes)
	if privBlock == nil {
		return nil, nil, fmt.Errorf("auth: private key PEM block not found in %q", privatePath)
	}

	privateKey, err := x509.ParsePKCS1PrivateKey(privBlock.Bytes)
	if err != nil {
		// tenta PKCS8 como fallback
		key, err2 := x509.ParsePKCS8PrivateKey(privBlock.Bytes)
		if err2 != nil {
			return nil, nil, fmt.Errorf("auth: parse private key: %w (PKCS1: %v)", err2, err)
		}
		rsaKey, ok := key.(*rsa.PrivateKey)
		if !ok {
			return nil, nil, fmt.Errorf("auth: private key is not RSA")
		}
		privateKey = rsaKey
	}

	pubBytes, err := os.ReadFile(publicPath)
	if err != nil {
		return nil, nil, fmt.Errorf("auth: read public key %q: %w", publicPath, err)
	}

	pubBlock, _ := pem.Decode(pubBytes)
	if pubBlock == nil {
		return nil, nil, fmt.Errorf("auth: public key PEM block not found in %q", publicPath)
	}

	pubInterface, err := x509.ParsePKIXPublicKey(pubBlock.Bytes)
	if err != nil {
		return nil, nil, fmt.Errorf("auth: parse public key: %w", err)
	}

	publicKey, ok := pubInterface.(*rsa.PublicKey)
	if !ok {
		return nil, nil, fmt.Errorf("auth: public key is not RSA")
	}

	return privateKey, publicKey, nil
}

// SignToken cria um access token JWT assinado com RS256, com expiração de 15 minutos.
// O chamador deve incluir os claims necessários (sub, role, tenant_id, jti).
func SignToken(claims jwt.MapClaims, privateKey *rsa.PrivateKey) (string, error) {
	now := time.Now()
	claims["iat"] = now.Unix()
	claims["exp"] = now.Add(accessTokenTTL).Unix()

	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)

	signed, err := token.SignedString(privateKey)
	if err != nil {
		return "", fmt.Errorf("auth: sign token: %w", err)
	}

	return signed, nil
}

// SignRefreshToken cria um refresh token JWT RS256 com TTL customizável.
// O chamador deve incluir sub, role, tenant_id e jti nos claims.
func SignRefreshToken(claims jwt.MapClaims, privateKey *rsa.PrivateKey, ttl time.Duration) (string, error) {
	now := time.Now()
	claims["iat"] = now.Unix()
	claims["exp"] = now.Add(ttl).Unix()

	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)

	signed, err := token.SignedString(privateKey)
	if err != nil {
		return "", fmt.Errorf("auth: sign refresh token: %w", err)
	}

	return signed, nil
}

// VerifyToken valida a assinatura e a expiração do token, retornando os claims.
func VerifyToken(tokenStr string, publicKey *rsa.PublicKey) (jwt.MapClaims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, jwt.MapClaims{}, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodRSA); !ok {
			return nil, fmt.Errorf("auth: unexpected signing method: %v", t.Header["alg"])
		}
		return publicKey, nil
	})
	if err != nil {
		return nil, fmt.Errorf("auth: verify token: %w", err)
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok || !token.Valid {
		return nil, fmt.Errorf("auth: invalid token claims")
	}

	return claims, nil
}
