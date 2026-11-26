// Interpreta a nota digitada na edição manual. Vazio apaga a nota lançada
// (a tela volta a mostrar a nota de frequência). Aceita "7", "7,5" ou "7.5",
// de 0 a 10, com no máximo uma casa decimal.
export function interpretarNota(texto: string): { valida: true; nota: number | null } | { valida: false } {
  const t = texto.trim().replace(',', '.');
  if (t === '') return { valida: true, nota: null };
  if (!/^\d{1,2}(\.\d)?$/.test(t)) return { valida: false };
  const nota = Number(t);
  return nota <= 10 ? { valida: true, nota } : { valida: false };
}
