// Prazo e desconto por atraso da Prova Online. Quem decide a nota é o banco
// (sql/prova_online_prazo_atraso.sql); aqui ficam só a exibição e as regras
// de leitura usadas pelas telas.

export interface FaixaAtraso { dias: number; percentual: number }

// Valores iniciais de uma prova nova (o mesmo default da coluna no banco).
export const FAIXAS_PADRAO: FaixaAtraso[] = [
  { dias: 1, percentual: 80 },
  { dias: 2, percentual: 60 },
  { dias: 3, percentual: 50 },
];

export const MENSAGEM_PRAZO_ENCERRADO = 'Prazo encerrado. Procure o professor.';

const FUSO = 'America/Rio_Branco';
const UM_DIA = 24 * 60 * 60 * 1000;

export interface RegraAtraso {
  prazo_integral?: string | null;
  faixas_atraso?: FaixaAtraso[] | null;
}

export interface NotaComAtraso {
  nota: number | null;
  nota_final?: number | string | null;
  percentual_aplicado?: number | string | null;
  dias_atraso?: number | null;
}

/** Nota que vale: a final (com desconto) quando existe; senão a corrigida. */
export function notaEfetiva(r: NotaComAtraso): number | null {
  if (r.nota_final !== null && r.nota_final !== undefined) return Number(r.nota_final);
  return r.nota === null || r.nota === undefined ? null : Number(r.nota);
}

export function temDesconto(r: NotaComAtraso): boolean {
  return r.percentual_aplicado !== null && r.percentual_aplicado !== undefined && Number(r.percentual_aplicado) < 100;
}

export function entregueComAtraso(r: NotaComAtraso): boolean {
  return (r.dias_atraso ?? 0) > 0;
}

export function faixasOrdenadas(regra: RegraAtraso): FaixaAtraso[] {
  return [...(regra.faixas_atraso ?? FAIXAS_PADRAO)].sort((a, b) => a.dias - b.dias);
}

/** `respostas.enviado_em` é gravado em UTC sem indicar o fuso. */
export function dataDoServidor(valor: string): Date {
  return new Date(/(Z|[+-]\d{2}(:?\d{2})?)$/.test(valor) ? valor : `${valor}Z`);
}

export function formatarDataAcre(data: Date): string {
  return data.toLocaleDateString('pt-BR', { timeZone: FUSO });
}

export function formatarHoraAcre(data: Date): string {
  return data.toLocaleTimeString('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' });
}

function diaDaSemanaEData(data: Date): string {
  const semana = data.toLocaleDateString('pt-BR', { timeZone: FUSO, weekday: 'long' }).replace('-feira', '');
  const dia = data.toLocaleDateString('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit' });
  return `${semana}, ${dia}`;
}

/** Valor de um <input type="datetime-local"> (horário do Acre, UTC-5) -> ISO. */
export function localAcreParaISO(valor: string): string | null {
  if (!valor) return null;
  const d = new Date(`${valor}:00-05:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** ISO do banco -> valor de <input type="datetime-local"> no horário do Acre. */
export function isoParaLocalAcre(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Date(d.getTime() - 5 * 60 * 60 * 1000).toISOString().slice(0, 16);
}

export interface LinhaPrazo { quando: string; vale: string; percentual: number | null }

/** Tabela mostrada ao aluno e ao professor. Vazia se a prova não tem regra. */
export function tabelaDePrazos(regra: RegraAtraso): LinhaPrazo[] {
  if (!regra.prazo_integral) return [];
  const prazo = new Date(regra.prazo_integral);
  const hora = formatarHoraAcre(prazo);
  const as = `às ${hora}`; // não quebra "às" e a hora no celular
  const linhas: LinhaPrazo[] = [{ quando: `Até ${diaDaSemanaEData(prazo)}, ${as}`, vale: '100%', percentual: 100 }];
  let anterior = 0;
  for (const f of faixasOrdenadas(regra)) {
    const inicio = new Date(prazo.getTime() + (anterior + 1) * UM_DIA);
    const fim = new Date(prazo.getTime() + f.dias * UM_DIA);
    const quando = f.dias - anterior > 1
      ? `De ${diaDaSemanaEData(inicio)} até ${diaDaSemanaEData(fim)}, ${as}`
      : `Até ${diaDaSemanaEData(fim)}, ${as}`;
    linhas.push({ quando, vale: `${f.percentual}%`, percentual: f.percentual });
    anterior = f.dias;
  }
  const bloqueio = new Date(prazo.getTime() + anterior * UM_DIA + 60 * 1000);
  linhas.push({ quando: `A partir de ${diaDaSemanaEData(bloqueio)}`, vale: 'Bloqueado', percentual: null });
  return linhas;
}

/** O prazo final (última faixa) já passou? Só para avisar na tela; quem bloqueia é o banco. */
export function prazoFinalPassou(regra: RegraAtraso, agora = new Date()): boolean {
  if (!regra.prazo_integral) return false;
  const faixas = faixasOrdenadas(regra);
  const dias = faixas.length ? faixas[faixas.length - 1].dias : 0;
  const limite = new Date(regra.prazo_integral);
  limite.setUTCSeconds(0, 0);
  return agora.getTime() >= limite.getTime() + 60 * 1000 + dias * UM_DIA;
}

export const formatarNota1 = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : n.toFixed(1).replace('.', ',');
