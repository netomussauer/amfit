package domain

import (
	"testing"
	"time"
)

func TestFullName_AparaEspacos(t *testing.T) {
	if got := (&PersonalTrainer{Nome: "  Ana Souza \n"}).FullName(); got != "Ana Souza" {
		t.Errorf("PersonalTrainer.FullName = %q", got)
	}
	if got := (&Aluno{Nome: "\tJoão Lima  "}).FullName(); got != "João Lima" {
		t.Errorf("Aluno.FullName = %q", got)
	}
}

func TestRefreshToken_IsExpired(t *testing.T) {
	agora := time.Date(2026, 10, 26, 12, 0, 0, 0, time.UTC)
	rt := &RefreshToken{ExpiraEm: agora}

	casos := []struct {
		nome string
		now  time.Time
		want bool
	}{
		{"antes do vencimento", agora.Add(-time.Second), false},
		{"exatamente no vencimento ainda vale", agora, false},
		{"depois do vencimento", agora.Add(time.Second), true},
	}
	for _, c := range casos {
		t.Run(c.nome, func(t *testing.T) {
			if got := rt.IsExpired(c.now); got != c.want {
				t.Errorf("IsExpired = %v, want %v", got, c.want)
			}
		})
	}
}
