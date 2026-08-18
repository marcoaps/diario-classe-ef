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

// Pontuação por aula. Calibrado para, num bimestre de 20 aulas somado à
// nota de trabalho (3,0 no prazo, ou 2,5 atrasado), resultar em:
//   Nunca participa (sempre "Não fez")     -> nota final 7,0 (trab. 3,0)
//   Participação mista (Fez/Em parte/Não)  -> nota final 8,5 (trab. 3,0)
//   Participa de tudo (sempre "Fez")       -> nota final 10,0 (trab. 3,0)
// Pontos por aula:
//   Ausente                       -> 0
//   Presente + Não fez atividade  -> 0,20
//   Presente + Fez em parte       -> 0,275
//   Presente + Fez a atividade    -> 0,35
// Registros antigos (gravados antes desta funcionalidade existir) não têm
// participação marcada (participacao=null) e continuam valendo os 0,5 de
// frequência pura de antes, para não alterar retroativamente notas já
// fechadas em bimestres passados.
export function pontosPorRegistro(presente: boolean, participacao: Participacao): number {
  if (!presente) return 0;
  switch (participacao) {
    case "fez": return 0.35;
    case "fez_em_parte": return 0.275;
    case "nao_fez": return 0.20;
    default: return 0.5;
  }
}
