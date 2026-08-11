/**
 * Faz o parsing tolerante de uma resposta de texto da IA, removendo cercas de
 * código markdown e tentando extrair o JSON mesmo se vier com texto extra
 * antes/depois (padrão usado em vários geradores do app, ex: Gerador de
 * Questões, Gerador de Charges).
 */
export function parseJSONTolerante<T>(textoBruto: string): T {
  const limpo = textoBruto.replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(limpo) as T;
  } catch {
    const matchArray = limpo.match(/\[[\s\S]*\]/);
    const matchObjeto = limpo.match(/\{[\s\S]*\}/);
    const match = matchArray ?? matchObjeto;
    if (match) {
      try {
        return JSON.parse(match[0]) as T;
      } catch {
        // Cai no erro genérico abaixo — não propaga o erro cru do JSON.parse
        // (ex: "Expected ',' or '}' after property value..."), que não diz
        // nada de útil para o professor.
      }
    }
    throw new Error('A IA retornou uma resposta com JSON malformado nesta tentativa.');
  }
}
