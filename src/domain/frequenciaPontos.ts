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

// Pontuação por aula. Escalado para que só "Fez em todas as aulas" alcance
// o teto de 10,0 no bimestre (20 aulas × 0,5) — assim o teto deixa de ser um
// corte arbitrário que empata quem participa parcialmente com quem participa
// integralmente (antes, "Em parte" sozinho já batia o teto, apagando a
// diferença para "Fez"):
//   Ausente                       -> 0
//   Presente + Não fez atividade  -> 0,25
//   Presente + Fez em parte       -> 0,375
//   Presente + Fez a atividade    -> 0,5
// Registros antigos (gravados antes desta funcionalidade existir) não têm
// participação marcada (participacao=null) e continuam valendo os 0,5 de
// frequência pura de antes, para não alterar retroativamente notas já
// fechadas em bimestres passados.
export function pontosPorRegistro(presente: boolean, participacao: Participacao): number {
  if (!presente) return 0;
  switch (participacao) {
    case "fez": return 0.5;
    case "fez_em_parte": return 0.375;
    case "nao_fez": return 0.25;
    default: return 0.5;
  }
}
