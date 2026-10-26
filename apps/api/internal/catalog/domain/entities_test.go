package domain

import (
	"testing"

	"github.com/google/uuid"
)

func TestExercicio_IsGlobal(t *testing.T) {
	dono := uuid.New()
	if !(&Exercicio{PersonalID: nil}).IsGlobal() {
		t.Error("exercicio sem dono deveria ser global")
	}
	if (&Exercicio{PersonalID: &dono}).IsGlobal() {
		t.Error("exercicio com dono nao e global")
	}
}
