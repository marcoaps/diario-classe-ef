// Pontuação de frequência combinada com participação nas atividades de
// quadra. Compartilhado entre a tela de Chamada (onde é registrado), o
// Relatório de Frequência e o Portal do Aluno (onde é exibido/somado), para
// a fórmula nunca divergir entre as telas.

export type Participacao = "fez" | "fez_em_parte" | "nao_fez" | null;

export const PARTICIPACAO_OPCOES: { valor: Exclude<Participacao, null>; label: string }[] = [
  { valor: "fez", label: "Fez" },
  { valor: "fez_em_parte", label: "Em parte" },
  { valor: "nao_fez", label: "Não fez" },
];

// Pontuação por aula:
//   Ausente                       -> 0
//   Presente + Não fez atividade  -> 0,25
//   Presente + Fez em parte       -> 0,50
//   Presente + Fez a atividade    -> 0,75
// Registros antigos (gravados antes desta funcionalidade existir) não têm
// participação marcada (participacao=null) e continuam valendo os 0,5 de
// frequência pura de antes, para não alterar retroativamente notas já
// fechadas em bimestres passados.
export function pontosPorRegistro(presente: boolean, participacao: Participacao): number {
  if (!presente) return 0;
  switch (participacao) {
    case "fez": return 0.75;
    case "fez_em_parte": return 0.50;
    case "nao_fez": return 0.25;
    default: return 0.5;
  }
}
