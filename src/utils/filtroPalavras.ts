/**
 * Retorna o primeiro termo de `termos` encontrado dentro de `texto`, ou null
 * se nenhum ocorrer. Termos com espaço são comparados por `includes`; termos
 * de uma palavra só usam um teste simples de fronteira (\b não cobre bem
 * acentos). Compartilhado entre os filtros de termos proibidos de cada
 * gerador (ex: Regra 12 do Gerador de Questões, termos de violência do
 * Gerador de Charges) para que a lógica de comparação nunca divirja entre eles.
 */
export function contemTermoProibido(texto: string, termos: string[]): string | null {
  const normalizado = texto.toLowerCase();
  for (const termo of termos) {
    if (termo.includes(' ')) {
      if (normalizado.includes(termo)) return termo;
    } else {
      const regex = new RegExp(`(^|[^a-zà-ú])${termo}([^a-zà-ú]|$)`, 'i');
      if (regex.test(normalizado)) return termo;
    }
  }
  return null;
}
