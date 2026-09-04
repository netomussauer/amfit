package domain

import "errors"

// ErrTokenInvalido indica que o token Expo enviado veio vazio/em branco.
var ErrTokenInvalido = errors.New("notification: token invalido")
