// Helpers de data, numeração e sugestões compartilhados entre as telas de
// geração de Sequência Didática via IA.

// Datas de "Planejamento Escolar" do Calendário Escolar 2026 (Instituto
// Odilon Pratagi), em ordem cronológica — usadas para numerar automaticamente
// a sequência atual: a 1ª data vira a 1ª Sequência, a 2ª data vira a 2ª
// Sequência, etc. Atualizar esta lista todo início de ano letivo.
export const DATAS_PLANEJAMENTO_2026 = [
  "2026-02-19", "2026-03-09", "2026-04-06", "2026-04-27",
  "2026-05-18", "2026-06-08", "2026-06-29", "2026-07-31",
  "2026-08-17", "2026-09-08", "2026-09-28", "2026-10-19",
  "2026-11-09",
];

export function numeroSequenciaAtual(data: Date = new Date()): number {
  const iso = data.toISOString().slice(0, 10);
  let numero = 1;
  for (let i = 0; i < DATAS_PLANEJAMENTO_2026.length; i++) {
    if (iso >= DATAS_PLANEJAMENTO_2026[i]) numero = i + 1;
  }
  return numero;
}

export function formatarDiaMes(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

export function adicionarDias(iso: string, dias: number): string {
  const data = new Date(iso + "T00:00:00");
  data.setDate(data.getDate() + dias);
  return data.toISOString().slice(0, 10);
}

// Cada data de DATAS_PLANEJAMENTO_2026 marca o início da Semana de
// Planejamento Pedagógico daquele ciclo (7 dias, não letiva para os
// alunos). A execução da Sequência Didática em si só começa depois dessa
// semana e dura 3 semanas (21 dias corridos) — confirmado com o aviso da
// coordenação para o IX ciclo: Semana de Planejamento 17 a 23/08, IX SD
// (execução) 24/08 a 13/09/2026.
export function periodoExecucaoAtual(data: Date = new Date()): string {
  const numero = numeroSequenciaAtual(data);
  const inicio = adicionarDias(DATAS_PLANEJAMENTO_2026[numero - 1], 7);
  const fim = adicionarDias(inicio, 20);
  return `${formatarDiaMes(inicio)} a ${formatarDiaMes(fim)}`;
}

export function ordinal(n: number): string {
  return n === 1 ? "1ª" : n === 2 ? "2ª" : n === 3 ? "3ª" :
    n === 4 ? "4ª" : n === 5 ? "5ª" : `${n}ª`;
}

// Formata a série para o nome do arquivo exportado: "6º e 7º" -> "6º-7º",
// "8º e 9º" -> "8º-9º", "6º ano" -> "6º", "1º EM" -> "1º-EM".
export function serieParaArquivo(serie: string): string {
  return serie
    .replace(/\s+e\s+/g, "-")
    .replace(/\s+ano$/i, "")
    .replace(/\s+/g, "-");
}

/**
 * O Plano de Curso não tem uma lista de "recursos/materiais" por objeto de
 * conhecimento, então sugerimos os materiais típicos por palavra-chave
 * detectada no tema/objeto escolhido — mesma lógica de "pré-preencher, mas
 * deixar editável" usada no Gerador de Questões para o campo Conteúdo.
 */
export function sugerirRecursos(texto: string): string {
  const t = texto.toLowerCase();
  if (t.includes("futsal")) return "Quadra coberta, bolas de futsal, cones, coletes, traves";
  if (t.includes("handebol")) return "Quadra, bolas de handebol, coletes, traves/metas";
  if (t.includes("vôlei") || t.includes("volei")) return "Quadra, rede de voleibol, bolas de voleibol";
  if (t.includes("basquete")) return "Quadra, bolas de basquete, coletes, cesta";
  if (t.includes("atletismo")) return "Pista ou quadra, cronômetro, fita métrica, cones, bastões de revezamento";
  if (t.includes("dança")) return "Aparelho de som/caixa de som, espaço livre, fitas ou tecidos (se houver coreografia)";
  if (t.includes("luta") || t.includes("capoeira") || t.includes("judô") || t.includes("judo")) return "Colchonetes/tatame, espaço amplo e seguro, apito";
  if (t.includes("ginástica") || t.includes("ginastica")) return "Colchonetes, arcos, cordas, bolas de ginástica, espaço amplo";
  if (t.includes("jogo") || t.includes("brincadeira")) return "Cones, bambolês, cordas, bolas variadas, giz ou fita para marcação";
  return "Quadra coberta, cones, coletes, apito";
}

/**
 * Esportes de invasão (BNCC/Ed. Física): jogos em que se ataca o alvo/meta
 * adversário disputando o mesmo espaço. Usado para pré-marcar o toggle
 * "Organizar por Estações" e sugerir fundamentos típicos por modalidade.
 */
export const ESPORTES_INVASAO = ["futsal", "futebol", "handebol", "handball", "basquete", "basquetebol", "rugby", "invasão", "invasao"];

export function ehEsporteInvasao(texto: string): boolean {
  const t = texto.toLowerCase();
  return ESPORTES_INVASAO.some((e) => t.includes(e));
}

export const TURMAS_POR_SERIE: Record<string, string> = {
  "6º e 7º": "6ºF, 7ºB, 7ºC, 7ºD, 7ºE, 7ºF",
  "8º e 9º": "8ºA, 8ºB, 8ºC, 8ºD, 8ºE, 8ºF, 9ºA, 9ºB, 9ºC, 9ºD, 9ºE, 9ºF",
  "6º ano": "", "7º ano": "", "8º ano": "", "9º ano": "",
  "1º EM": "", "2º EM": "", "3º EM": "", "1º e 2º EM": "",
};

// Normaliza o identificador de turma para o formato usado nas tabelas do
// Supabase (ex: "6º Ano F" -> "6F"). Mesma lógica usada em Attendance.tsx,
// AttendanceReport.tsx e useRelatorioFrequencia.ts.
export function normalizarTurma(turmaId: string): string {
  if (/^\d+[A-Z]$/i.test(turmaId.trim())) return turmaId.trim().toUpperCase();
  const match = turmaId.match(/(\d+).*?([A-Z])$/i);
  if (match) return `${match[1]}${match[2].toUpperCase()}`;
  return turmaId.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
}

/**
 * Termo em inglês que a foto do Pexels precisa mencionar pra ser aceita
 * como ilustração de uma situação/estação — usado pra filtrar resultados
 * de busca de imagem que erram o esporte (ex: query com "handball" e
 * "dribbling drill" às vezes traz foto de futebol no Pexels).
 */
export function termoObrigatorioImagem(tema: string): string | undefined {
  const t = tema.toLowerCase();
  if (t.includes("handebol") || t.includes("handball")) return "handball";
  if (t.includes("futsal")) return "futsal";
  if (t.includes("basquete")) return "basketball";
  if (t.includes("vôlei") || t.includes("volei")) return "volleyball";
  if (t.includes("futebol")) return "soccer";
  if (t.includes("rugby")) return "rugby";
  return undefined;
}

export function sugerirFundamentos(texto: string): string {
  const t = texto.toLowerCase();
  if (t.includes("futsal") || t.includes("futebol")) return "Passe, Domínio de bola, Drible, Chute a gol, Marcação";
  if (t.includes("handebol") || t.includes("handball")) return "Passe, Drible, Arremesso, Marcação, Deslocamento ofensivo";
  if (t.includes("basquete")) return "Passe, Drible, Arremesso, Bandeja, Marcação";
  if (t.includes("rugby")) return "Passe lateral, Avanço com a bola, Formação/apoio, Marcação (tackle)";
  return "Passe, Drible, Finalização, Marcação";
}
