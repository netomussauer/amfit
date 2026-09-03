/**
 * Remove campos com string vazia ou `undefined` de um payload antes de
 * validar com Zod — evita que campos opcionais "tocados mas deixados em
 * branco" no form virem strings vazias no body da requisição.
 */
export function stripEmpty<T extends Record<string, unknown>>(
  input: T,
): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === '' || value === undefined) continue;
    out[key] = value;
  }
  return out as Partial<T>;
}
