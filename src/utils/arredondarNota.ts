// src/utils/arredondarNota.ts
// Regra de arredondamento do Prof. Marco — SEMPRE a favor do aluno.
// A nota sobe para o próximo meio ponto (0,5) ou inteiro, nunca desce.
//
//   9,7 → 10,0     7,1 → 7,5     8,9 → 9,0
//   7,0 → 7,0      7,5 → 7,5     6,6 → 7,0
//
// Limites: mínimo 0,0 e máximo 10,0.

export const NOTA_MINIMA = 0;
export const NOTA_MAXIMA = 10;

/**
 * Arredonda a nota para cima, para o próximo múltiplo de 0,5.
 * Aceita número ou texto com vírgula ("9,7").
 * Retorna null se o valor for vazio ou inválido.
 */
export function arredondarNota(valor: number | string | null | undefined): number | null {
  if (valor === null || valor === undefined || valor === '') return null;

  const numero =
    typeof valor === 'string' ? Number(valor.trim().replace(',', '.')) : valor;

  if (!Number.isFinite(numero)) return null;

  // Corrige imprecisão de ponto flutuante (ex.: 7.000000001 não deve virar 7,5)
  const limpo = Math.round(numero * 100) / 100;

  const arredondado = Math.ceil(limpo * 2) / 2;

  return Math.min(NOTA_MAXIMA, Math.max(NOTA_MINIMA, arredondado));
}

/**
 * Formata a nota no padrão brasileiro com uma casa decimal: 9.5 → "9,5".
 */
export function formatarNota(nota: number | null | undefined): string {
  if (nota === null || nota === undefined) return '-';
  return nota.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

/**
 * Arredonda e formata de uma vez: "9,7" → "10,0".
 */
export function arredondarEFormatar(valor: number | string | null | undefined): string {
  return formatarNota(arredondarNota(valor));
}
