// Calendário Escolar 2026 — E.E.F. Instituto Odilon Pratagi.
// Fonte: planilha "CALENDÁRIO ESCOLAR-2026 … corrigido" (28/10/2026) + PDF oficial da SEE (janeiro e legenda).
// As cores são as mesmas do calendário impresso da escola.

export type CatId =
  | 'feriado' | 'inicio' | 'recuperacao' | 'avaliacao' | 'sabado' | 'evento' | 'viver'
  | 'simulado' | 'entrega' | 'letivoEsp' | 'jornada' | 'planejamento' | 'ferias' | 'semana';

export interface CategoriaCal {
  id: CatId;
  nome: string;
  /** Cor de preenchimento, igual à do calendário impresso. */
  cor: string;
  /** Cor do texto sobre o preenchimento (contraste mínimo 4,5:1). */
  texto: string;
}

// Ordem = prioridade na cor do dia quando há mais de um evento (o primeiro vence).
export const CATEGORIAS: CategoriaCal[] = [
  { id: 'feriado',      nome: 'Feriado nacional, estadual ou municipal', cor: '#FF0000', texto: '#120000' },
  { id: 'inicio',       nome: 'Início / término de período letivo',     cor: '#33CC33', texto: '#0A2A0A' },
  { id: 'recuperacao',  nome: 'Recuperação',                             cor: '#00DEB4', texto: '#00302A' },
  { id: 'avaliacao',    nome: 'Avaliações bimestrais',                   cor: '#E791D4', texto: '#3A0A30' },
  { id: 'sabado',       nome: 'Sábado letivo e reunião de pais',         cor: '#FFD966', texto: '#3A2A00' },
  { id: 'evento',       nome: 'Projetos, eventos e sábado letivo',       cor: '#FFC000', texto: '#3A2600' },
  { id: 'viver',        nome: 'Viver Ciências',                          cor: '#F4B183', texto: '#3A1A00' },
  { id: 'simulado',     nome: 'Simulado e culminância de projeto',       cor: '#FFFF00', texto: '#333300' },
  { id: 'entrega',      nome: 'Entrega de avaliações e provas externas', cor: '#C59EE1', texto: '#2A0A40' },
  { id: 'letivoEsp',    nome: 'Feriado letivo (tem aula)',               cor: '#00AFEF', texto: '#002A3A' },
  { id: 'jornada',      nome: 'Jornada pedagógica e boletins',           cor: '#D7BDEB', texto: '#2A0A40' },
  { id: 'planejamento', nome: 'Planejamento escolar',                    cor: '#9BC2E6', texto: '#0A2A40' },
  { id: 'ferias',       nome: 'Férias dos professores e recesso',        cor: '#F8CAAC', texto: '#3A1A00' },
  { id: 'semana',       nome: 'Semana temática (sem cor no calendário)', cor: 'transparent', texto: '#10231A' },
];

export const FIM_DE_SEMANA = '#F8F8E0';

export interface EventoCal {
  ini: string;      // AAAA-MM-DD
  fim?: string;     // AAAA-MM-DD (inclusive)
  titulo: string;
  cat: CatId;
  nota?: string;
}

const e = (ini: string, titulo: string, cat: CatId, fim?: string, nota?: string): EventoCal =>
  ({ ini: `2026-${ini}`, fim: fim ? `2026-${fim}` : undefined, titulo, cat, nota });

export const EVENTOS: EventoCal[] = [
  // Janeiro
  e('01-01', 'Confraternização Universal (Feriado Nacional)', 'feriado'),
  e('01-02', 'Férias dos Professores (30 dias)', 'ferias', '01-31'),
  e('01-05', 'Renovação de Matrículas', 'semana', '01-09'),
  e('01-08', 'Solicitação on-line de matrícula e transferência interna', 'semana', '01-20'),
  e('01-12', 'Jornada Pedagógica para os Núcleos', 'jornada', '01-16'),
  e('01-20', 'Feriado Estadual (Lei nº 3.137/2016)', 'feriado', undefined, 'O calendário impresso marca o dia 20; a legenda cita 22 e 23.'),
  e('01-23', 'Feriado Estadual (Lei nº 3.137/2016)', 'feriado'),
  e('01-26', 'Jornada Pedagógica para as Equipes Gestoras', 'jornada', '01-30'),
  // Fevereiro
  e('02-01', 'Férias dos Professores (10 dias)', 'ferias', '02-10'),
  e('02-11', 'Jornada Pedagógica para os Docentes', 'jornada', '02-13'),
  e('02-16', 'Carnaval', 'feriado', '02-18'),
  e('02-19', 'Planejamento Escolar', 'planejamento', '02-20'),
  e('02-23', 'Início do Ano Letivo', 'inicio'),
  e('02-26', 'Reunião de pais — 6º anos', 'sabado'),
  e('02-27', 'Reunião de pais — 7º, 8º e 9º anos', 'sabado'),
  // Março
  e('03-08', 'Dia Internacional da Mulher', 'feriado'),
  e('03-09', 'Semana Escolar de Combate à Violência Contra a Mulher (Lei 14.164)', 'semana', '03-13'),
  e('03-09', 'Planejamento escolar', 'planejamento', '03-13'),
  e('03-16', 'Avaliação Diagnóstica (1ª Fase)', 'semana', '03-20'),
  // Abril
  e('04-01', 'Projeto Páscoa', 'evento'),
  e('04-02', 'Quinta-feira e Sexta-feira Santa', 'feriado', '04-03'),
  e('04-06', 'Planejamento escolar', 'planejamento', '04-10'),
  e('04-08', 'Seminário de Psicologia', 'semana', '04-09'),
  e('04-15', 'Entrega das avaliações bimestrais para impressão', 'entrega'),
  e('04-21', 'Tiradentes — feriado (DIA LETIVO)', 'letivoEsp'),
  e('04-27', 'Planejamento escolar', 'planejamento', '04-30'),
  e('04-27', 'Semana da Convivência escolar', 'semana', '04-30'),
  // Maio
  e('05-01', 'Dia do Trabalho (Feriado Nacional)', 'feriado'),
  e('05-04', 'Avaliações do 1º bimestre', 'avaliacao', '05-08'),
  e('05-09', 'Sábado letivo (2ª feira) — Especial Dia das Mães', 'sabado'),
  e('05-18', 'Planejamento escolar', 'planejamento', '05-22'),
  e('05-26', 'Assinatura de boletins do 1º bimestre', 'jornada'),
  // Junho
  e('06-04', 'Corpus Christi', 'feriado'),
  e('06-06', 'Sábado letivo (3ª feira) — Reconhecimento aos alunos notáveis', 'sabado'),
  e('06-08', 'Planejamento escolar', 'planejamento', '06-12'),
  e('06-09', 'Prova da 1ª fase OBMEP', 'entrega'),
  e('06-15', 'Aniversário do Estado (Feriado Estadual — Lei nº 14/1964)', 'feriado'),
  e('06-17', 'Entrega das avaliações bimestrais para impressão', 'entrega'),
  e('06-22', 'Avaliação Diagnóstica (2ª Fase)', 'semana', '06-26'),
  e('06-25', 'Culminância do Projeto de Leitura e escrita', 'simulado'),
  e('06-26', 'Projeto Aniversário da escola (Feijoada)', 'sabado'),
  e('06-29', 'Planejamento escolar', 'planejamento', '06-30'),
  // Julho
  e('07-03', 'Feriado Municipal', 'feriado'),
  e('07-03', 'Avaliações do 2º bimestre', 'avaliacao', '07-10'),
  e('07-04', 'Sábado letivo (2ª feira / reposição 29/06) — Culminância do Projeto de Leitura “Descobrindo o lugar onde vivo”', 'evento'),
  e('07-13', 'Recuperação do 1º semestre', 'recuperacao', '07-17'),
  e('07-13', 'Jornada Pedagógica para as Equipes Gestoras', 'jornada', '07-17'),
  e('07-17', 'Término do 1º Semestre', 'inicio'),
  e('07-20', 'Recesso Escolar', 'ferias', '07-31'),
  e('07-20', 'Férias dos Professores (5 dias)', 'ferias', '07-24'),
  e('07-27', 'Jornada Pedagógica para os Docentes', 'jornada', '07-30'),
  e('07-31', 'Planejamento Escolar', 'planejamento'),
  // Agosto
  e('08-03', 'Início do 2º Semestre', 'inicio'),
  e('08-06', 'Revolução Acreana — Feriado Estadual (LETIVO)', 'letivoEsp'),
  e('08-10', 'Semana do estudante', 'semana', '08-14'),
  e('08-11', 'Assinatura de boletins do 2º bimestre', 'jornada'),
  e('08-13', 'Avaliação Diagnóstica (2ª Fase)', 'entrega', '08-14'),
  e('08-15', 'Sábado letivo (6ª feira) — Festa dos estudantes', 'sabado'),
  e('08-17', 'Planejamento Escolar', 'planejamento', '08-21'),
  e('08-28', 'Evento Viver Ciências Itinerante 2026', 'viver'),
  e('08-29', 'Sábado letivo (2ª feira) — Trabalhos do Projeto Viver Ciências', 'sabado'),
  // Setembro
  e('09-05', 'Dia da Amazônia (Feriado Estadual)', 'feriado'),
  e('09-07', 'Independência do Brasil (Feriado Nacional)', 'feriado'),
  e('09-08', 'Planejamento Escolar', 'planejamento', '09-11'),
  e('09-12', 'Sábado letivo (3ª feira) — Ganha com o desfile cívico', 'sabado'),
  e('09-15', 'Feriado Municipal — Padroeira Nossa Senhora das Dores', 'feriado'),
  e('09-16', 'Entrega das avaliações bimestrais para impressão', 'entrega'),
  e('09-19', 'Sábado letivo (4ª feira) — Jogos Paralímpicos', 'sabado'),
  e('09-21', 'Simulado 3 (Mat. e Port.) — 6º ao 9º anos', 'simulado', '09-25'),
  e('09-28', 'Planejamento Escolar', 'planejamento', '09-30'),
  // Outubro
  e('10-05', 'Avaliações do 3º bimestre', 'avaliacao', '10-09'),
  e('10-10', 'Sábado letivo (5ª feira) — Ganha Projeto Viver Ciências', 'evento'),
  e('10-12', 'Nossa Senhora Aparecida / Dia da Criança (Feriado Nacional)', 'feriado'),
  e('10-15', 'Dia dos Professores', 'evento'),
  e('10-16', 'Projeto Criativamente / Dia das Crianças', 'evento'),
  e('10-19', 'Planejamento Escolar', 'planejamento', '10-23'),
  e('10-23', 'Sábado letivo (5ª feira) — Interclasse', 'evento'),
  e('10-27', 'Assinatura de boletins do 3º bimestre', 'jornada'),
  e('10-28', 'Dia do Servidor Público (Feriado)', 'feriado'),
  e('10-29', '1ª Fase II Olimpíada de Educação Financeira Acre', 'evento'),
  // Novembro
  e('11-02', 'Finados (Feriado Nacional)', 'feriado'),
  e('11-09', 'Planejamento Escolar', 'planejamento', '11-13'),
  e('11-11', '2ª Fase II Olimpíada de Educação Financeira Acre', 'evento'),
  e('11-14', 'Sábado letivo (6ª feira) — Reconhecimento aos alunos notáveis', 'sabado'),
  e('11-15', 'Proclamação da República (Feriado Nacional)', 'feriado'),
  e('11-16', 'Avaliação Diagnóstica (3ª Fase)', 'semana', '11-19'),
  e('11-16', 'Simulado III — Caderno IDEB', 'semana', '11-19'),
  e('11-17', 'Tratado de Petrópolis (Feriado Estadual — Lei nº 57/1965)', 'feriado'),
  e('11-18', 'Entrega das avaliações bimestrais para impressão', 'entrega'),
  e('11-19', 'Culminância do Projeto Consciência Negra na escola e Culminância de Projetos', 'simulado'),
  e('11-20', 'Dia da Consciência Negra (Feriado Nacional)', 'feriado'),
  e('11-23', 'Simulado 4 (Mat. e Port.) — 6º ao 9º anos', 'simulado', '11-27'),
  e('11-28', 'Sábado letivo (2ª feira) — Ganha com a Feira Ubuntu', 'sabado'),
  e('11-30', 'Planejamento Escolar', 'planejamento'),
  // Dezembro
  e('12-07', 'Avaliações do 4º bimestre', 'avaliacao', '12-11'),
  e('12-14', 'Recuperação do 2º semestre', 'recuperacao', '12-18'),
  e('12-23', 'Término do ano letivo de 2026', 'inicio'),
  e('12-24', 'Véspera de Natal', 'semana'),
  e('12-25', 'Natal (Feriado Nacional)', 'feriado'),
  e('12-28', 'Aniversário do município de Rio Branco (feriado facultativo)', 'feriado'),
];

/** Dias letivos por mês, da tabela do calendário impresso (total 202). */
export const LETIVOS_MES: number[] = [0, 5, 22, 20, 21, 21, 13, 22, 21, 21, 19, 17];
export const TOTAL_LETIVOS = 202;

export const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const DIAS_SEMANA_CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const DIAS_SEMANA_LONGO = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

const PRIORIDADE: Record<CatId, number> = Object.fromEntries(CATEGORIAS.map((c, i) => [c.id, i])) as Record<CatId, number>;
export const categoriaPorId = (id: CatId): CategoriaCal => CATEGORIAS.find(c => c.id === id)!;

export const iso = (ano: number, mes: number, dia: number) =>
  `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;

export function isoDeData(d: Date) {
  return iso(d.getFullYear(), d.getMonth(), d.getDate());
}

export function eventosDoDia(dia: string): EventoCal[] {
  return EVENTOS
    .filter(ev => dia >= ev.ini && dia <= (ev.fim ?? ev.ini))
    .sort((a, b) => PRIORIDADE[a.cat] - PRIORIDADE[b.cat]);
}

/** Categoria que dá a cor ao dia (ou null se for dia comum). */
export function categoriaDoDia(dia: string, foco: CatId | null = null): CategoriaCal | null {
  const evs = eventosDoDia(dia);
  if (foco) return evs.some(ev => ev.cat === foco) ? categoriaPorId(foco) : null;
  const colorido = evs.find(ev => ev.cat !== 'semana');
  return colorido ? categoriaPorId(colorido.cat) : null;
}

export function diaDaSemana(dia: string) {
  const [a, m, d] = dia.split('-').map(Number);
  return new Date(a, m - 1, d).getDay();
}

export function statusDoDia(dia: string): string {
  const evs = eventosDoDia(dia);
  const tem = (c: CatId) => evs.some(ev => ev.cat === c);
  const dow = diaDaSemana(dia);
  const fimDeSemana = dow === 0 || dow === 6;
  if (dia < '2026-02-23' || dia > '2026-12-23') return 'Fora do período letivo';
  if (tem('feriado')) return 'Feriado — sem aula';
  if (tem('ferias')) return 'Recesso / férias — sem aula';
  if (fimDeSemana) {
    return evs.some(ev => ev.cat === 'sabado' || ev.cat === 'evento' || ev.cat === 'viver') && evs.some(ev => /^Sábado letivo/i.test(ev.titulo))
      ? 'Sábado letivo — tem aula'
      : 'Fim de semana';
  }
  if (tem('letivoEsp')) return 'Feriado letivo — tem aula';
  return 'Dia letivo';
}

export const ehSemAula = (status: string) => /sem aula|Fora do período|Fim de semana/.test(status);

/** Texto curto de intervalo: "16 a 20", "16 e 17" ou "5". */
export function rotuloIntervalo(ev: EventoCal): string {
  const di = Number(ev.ini.slice(8)), df = ev.fim ? Number(ev.fim.slice(8)) : di;
  if (ev.fim && ev.fim.slice(5, 7) !== ev.ini.slice(5, 7)) return `${di}/${Number(ev.ini.slice(5, 7))} a ${df}/${Number(ev.fim.slice(5, 7))}`;
  if (df === di) return String(di);
  return df === di + 1 ? `${di} e ${df}` : `${di} a ${df}`;
}

export function eventosDoMes(mes: number): EventoCal[] {
  const ini = iso(2026, mes, 1), fim = iso(2026, mes, new Date(2026, mes + 1, 0).getDate());
  return EVENTOS
    .filter(ev => ev.ini <= fim && (ev.fim ?? ev.ini) >= ini)
    .sort((a, b) => a.ini.localeCompare(b.ini) || PRIORIDADE[a.cat] - PRIORIDADE[b.cat]);
}
