/** Escolhe a forma singular ou plural de uma palavra/expressão conforme
 * `count` — usado em mensagens como "1 ação pendente" / "3 ações
 * pendentes" espalhadas pela UI do modo offline. */
export function pluralizar(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}
