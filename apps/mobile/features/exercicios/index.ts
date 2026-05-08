export { exercicioService } from './services/exercicio.service';
export type {
  CriarExercicioInput,
  ListarExerciciosParams,
  MidiaInput,
} from './services/exercicio.service';

export { exercicioKeys, grupoMuscularKeys } from './hooks/query-keys';
export { useExercicios, useExercicio } from './hooks/useExercicios';
export { useGruposMusculares } from './hooks/useGruposMusculares';
export { useCriarExercicio } from './hooks/useCriarExercicio';
export { useDesativarExercicio } from './hooks/useDesativarExercicio';

export { ExercicioCard } from './components/ExercicioCard';
export { GrupoChips } from './components/GrupoChips';
export { GrupoMuscularPicker } from './components/GrupoMuscularPicker';
export { MidiaPicker } from './components/MidiaPicker';
