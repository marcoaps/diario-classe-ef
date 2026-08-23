// Pontuação de frequência combinada com participação nas atividades de
// quadra. Compartilhado entre a tela de Chamada (onde é registrado), o
// Relatório de Frequência, o Histórico e o Portal do Aluno (onde é
// exibido/somado), para a fórmula e a nomenclatura nunca divergirem entre
// as telas.
//
// Os valores gravados no banco ('fez', 'fez_em_parte', 'nao_fez') NÃO
// mudaram de nome — só a sigla/rótulo exibido mudou (Fez -> PI, Em parte ->
// PP, Não fez -> NP). Isso evita reescrever qualquer registro histórico.

export type Participacao =
  | "fez"                          // PI — Participação Integral
  | "fez_em_parte"                 // PP — Participação Parcial
  | "nao_fez"                      // NP — Não Participou
  | "adaptada"                     // PA — Participação Adaptada
  | "nao_participou_justificado"   // NPJ — Não Participou — Justificado
  | null;

export interface ParticipacaoOpcao {
  valor: Exclude<Participacao, null>;
  sigla: string;
  label: string;
  corAtivo: string;   // classes Tailwind do botão quando selecionado
  corInativo: string; // classes Tailwind do botão quando não selecionado
}

export const PARTICIPACAO_OPCOES: ParticipacaoOpcao[] = [
  { valor: "fez", sigla: "PI", label: "Participação Integral",
    corAtivo: "bg-teal-600 text-white border-teal-700", corInativo: "bg-teal-50 text-teal-700 border-teal-200" },
  { valor: "fez_em_parte", sigla: "PP", label: "Participação Parcial",
    corAtivo: "bg-amber-500 text-white border-amber-600", corInativo: "bg-amber-50 text-amber-700 border-amber-200" },
  { valor: "nao_fez", sigla: "NP", label: "Não Participou",
    corAtivo: "bg-red-600 text-white border-red-700", corInativo: "bg-red-50 text-red-700 border-red-200" },
  { valor: "adaptada", sigla: "PA", label: "Participação Adaptada",
    corAtivo: "bg-blue-600 text-white border-blue-700", corInativo: "bg-blue-50 text-blue-700 border-blue-200" },
  { valor: "nao_participou_justificado", sigla: "NPJ", label: "Não Participou — Justificado",
    corAtivo: "bg-purple-600 text-white border-purple-700", corInativo: "bg-purple-50 text-purple-700 border-purple-200" },
];

export function opcaoParticipacao(valor: Participacao): ParticipacaoOpcao | null {
  return PARTICIPACAO_OPCOES.find(o => o.valor === valor) ?? null;
}

// Motivos da justificativa do NPJ. Só informações pedagógicas — nunca
// diagnóstico médico.
export const MOTIVOS_JUSTIFICATIVA: { valor: string; label: string }[] = [
  { valor: "restricao_medica", label: "Restrição médica" },
  { valor: "lesao_dor", label: "Lesão ou dor durante a aula" },
  { valor: "indisposicao", label: "Indisposição momentânea" },
  { valor: "dispensa_formal", label: "Dispensa formal pela escola ou responsável" },
  { valor: "atendimento_pedagogico", label: "Atendimento pedagógico ou atividade institucional" },
  { valor: "outro", label: "Outro motivo" },
];

export function labelMotivoJustificativa(motivo: string | null): string {
  return MOTIVOS_JUSTIFICATIVA.find(m => m.valor === motivo)?.label ?? motivo ?? "";
}

// Pontuação por aula. Calibrado para, num bimestre de 20 aulas somado à
// nota de trabalho (3,0 no prazo, ou 2,5 atrasado), resultar em:
//   Nunca participa (sempre NP)          -> nota final 7,0 (trab. 3,0)
//   Participação mista (PI/PP/NP)        -> nota final 8,5 (trab. 3,0)
//   Participa de tudo (sempre PI)        -> nota final 10,0 (trab. 3,0)
// Pontos por aula:
//   Ausente (AUS)                  -> 0
//   Presente + NP (Não Participou) -> 0,20
//   Presente + PP (Parcial)        -> 0,275
//   Presente + PI (Integral)       -> 0,35
//   Presente + PA (Adaptada)       -> 0,35 (mesma pontuação de PI — o aluno
//                                     cumpriu a atividade possível pra ele)
//   Presente + NPJ (Justificado)   -> 0 — não pontua, mas também não é
//                                     tratada como uma aula "perdida" (o
//                                     aluno não fica em desvantagem por ter
//                                     um motivo válido; simplesmente não
//                                     soma pontos naquela aula, igual a AUS
//                                     numericamente, sem ser contada junto
//                                     de AUS/NP em nenhum contador da UI)
// Registros antigos (gravados antes desta funcionalidade existir) não têm
// participação marcada (participacao=null) e continuam valendo os 0,5 de
// frequência pura de antes, para não alterar retroativamente notas já
// fechadas em bimestres passados.
export function pontosPorRegistro(presente: boolean, participacao: Participacao): number {
  if (!presente) return 0;
  switch (participacao) {
    case "fez": return 0.35;
    case "adaptada": return 0.35;
    case "fez_em_parte": return 0.275;
    case "nao_fez": return 0.20;
    case "nao_participou_justificado": return 0;
    default: return 0.5;
  }
}
