import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../data/supabase';
import { formatarNome } from '../utils/formatarNome';
import { pontosPorRegistro, type Participacao } from './frequenciaPontos';

export type Bimestre = 1 | 2 | 3 | 4;

export interface AlunoFrequencia {
  id: string;
  nome: string;
  turma_id: string;
  numero_chamada: number | null;
  registros_total: number;
  presentes: number;
  ausentes: number;
  pontos: number;
  percentual: number;
  em_risco: boolean;
  critico: boolean;
}

export interface ResumoFrequencia {
  total_alunos: number;
  media_percentual: number;
  media_pontos: number;
  total_em_risco: number;
  total_criticos: number;
  total_ok: number;
  // Contadores de registros (não de alunos) por nível de participação no
  // período — nunca misturam AUS com NP/NPJ, cada um conta separado.
  total_pi: number;
  total_pp: number;
  total_np: number;
  total_pa: number;
  total_npj: number;
  total_aus: number;
  // Entre os NP, quantos já têm um trabalho compensatório vinculado.
  total_np_com_trabalho: number;
}

export const PONTOS_POR_REGISTRO = 0.5;
export const AULAS_POR_BIMESTRE = 20;
export const PONTOS_MAXIMOS = AULAS_POR_BIMESTRE * PONTOS_POR_REGISTRO * 2;

export function getPeriodoBimestre(bimestre: Bimestre, ano?: number) {
  const y = ano ?? new Date().getFullYear();
  switch (bimestre) {
    case 1: return { inicio: `${y}-02-01`, fim: `${y}-04-30` };
    case 2: return { inicio: `${y}-05-01`, fim: `${y}-07-15` };
    case 3: return { inicio: `${y}-07-16`, fim: `${y}-09-30` };
    case 4: return { inicio: `${y}-10-01`, fim: `${y}-12-20` };
  }
}

// Data-limite de cada bimestre conforme o Calendário Escolar 2026 oficial
// (Instituto Odilon Pratagi): fim das avaliações/fechamento de cada um.
// Atualizar estas datas todo início de ano letivo, conforme o novo calendário.
const LIMITES_BIMESTRE_2026: { bimestre: Bimestre; fim: string }[] = [
  { bimestre: 1, fim: '2026-04-12' }, // avaliações 1º bim (4 a 8/04) + retorno às aulas (13/04)
  { bimestre: 2, fim: '2026-07-19' }, // avaliações 2º bim (3 a 10/07) + término do 1º semestre (17/07)
  { bimestre: 3, fim: '2026-10-31' }, // início do 2º semestre (03/08) + avaliações 3º bim (5 a 9/10)
  { bimestre: 4, fim: '2026-12-23' }, // avaliações 4º bim (7 a 11/12) + término do ano letivo (23/12)
];

// Bimestre vigente na data informada (hoje, por padrão), para pré-selecionar
// o bimestre correto ao abrir uma tela em vez de sempre cair no 1º.
export function bimestreAtual(data: Date = new Date()): Bimestre {
  const iso = data.toISOString().slice(0, 10);
  for (const { bimestre, fim } of LIMITES_BIMESTRE_2026) {
    if (iso <= fim) return bimestre;
  }
  return 4;
}

// CORRIGIDO: extrai formato curto "6F" de "6º Ano F"
function normalizarTurma(turmaId: string) {
  if (/^\d+[A-Z]$/i.test(turmaId.trim())) return turmaId.trim().toUpperCase();
  const match = turmaId.match(/(\d+).*?([A-Z])$/i);
  if (match) return `${match[1]}${match[2].toUpperCase()}`;
  return turmaId.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
}

export function useRelatorioFrequencia(
  turmaId: string | null,
  bimestre: Bimestre,
  ano?: number,
  dataFiltro?: string | null, // data específica no formato yyyy-MM-dd
) {
  const [alunos, setAlunos] = useState<AlunoFrequencia[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [contadores, setContadores] = useState({ total_pi: 0, total_pp: 0, total_np: 0, total_pa: 0, total_npj: 0, total_aus: 0, total_np_com_trabalho: 0 });

  const periodo = useMemo(() => getPeriodoBimestre(bimestre, ano), [bimestre, ano]);

  // Período efetivo: se dataFiltro preenchida, usa só aquele dia
  const periodoEfetivo = useMemo(() => {
    if (dataFiltro) return { inicio: dataFiltro, fim: dataFiltro };
    return periodo;
  }, [dataFiltro, periodo]);

  const carregar = useCallback(async () => {
    if (!turmaId) {
      setAlunos([]);
      setContadores({ total_pi: 0, total_pp: 0, total_np: 0, total_pa: 0, total_npj: 0, total_aus: 0, total_np_com_trabalho: 0 });
      return;
    }
    setLoading(true);
    setErro(null);
    try {
      const turmaNormalizada = normalizarTurma(turmaId);

      const { data: alunosData, error: alunosErr } = await supabase
        .from('alunos')
        .select('id, nome, turma_id, numero_chamada')
        .eq('turma_id', turmaNormalizada)
        .order('numero_chamada', { ascending: true, nullsFirst: false });

      if (alunosErr) throw alunosErr;
      const listaAlunos = alunosData || [];

      if (listaAlunos.length === 0) {
        setAlunos([]);
        setContadores({ total_pi: 0, total_pp: 0, total_np: 0, total_pa: 0, total_npj: 0, total_aus: 0, total_np_com_trabalho: 0 });
        return;
      }

      const ids = listaAlunos.map((a: any) => a.id);

      const { data: freqData, error: freqErr } = await supabase
        .from('frequencia')
        .select('aluno_id, data, presente, participacao, trabalho_compensatorio_id')
        .gte('data', periodoEfetivo.inicio)
        .lte('data', periodoEfetivo.fim)
        .in('aluno_id', ids);

      if (freqErr) throw freqErr;

      const mapa = new Map<string, { presentes: number; ausentes: number; pontos: number }>();
      const novosContadores = { total_pi: 0, total_pp: 0, total_np: 0, total_pa: 0, total_npj: 0, total_aus: 0, total_np_com_trabalho: 0 };
      (freqData || []).forEach((r: any) => {
        const acc = mapa.get(r.aluno_id) || { presentes: 0, ausentes: 0, pontos: 0 };
        if (r.presente) acc.presentes += 1;
        else acc.ausentes += 1;
        acc.pontos += pontosPorRegistro(r.presente, (r.participacao ?? null) as Participacao);
        mapa.set(r.aluno_id, acc);

        if (!r.presente) { novosContadores.total_aus += 1; }
        else switch (r.participacao as Participacao) {
          case 'fez': novosContadores.total_pi += 1; break;
          case 'fez_em_parte': novosContadores.total_pp += 1; break;
          case 'nao_fez':
            novosContadores.total_np += 1;
            if (r.trabalho_compensatorio_id) novosContadores.total_np_com_trabalho += 1;
            break;
          case 'adaptada': novosContadores.total_pa += 1; break;
          case 'nao_participou_justificado': novosContadores.total_npj += 1; break;
          default: break; // registro antigo sem participação marcada
        }
      });
      setContadores(novosContadores);

      const resultado: AlunoFrequencia[] = listaAlunos.map((a: any) => {
        const m = mapa.get(a.id) || { presentes: 0, ausentes: 0, pontos: 0 };
        const registros_total = m.presentes + m.ausentes;
        const pontos = +m.pontos.toFixed(2);
        const percentual = registros_total > 0
          ? +((m.presentes / registros_total) * 100).toFixed(2)
          : 0;
        const critico = registros_total > 0 && percentual < 50;
        const em_risco = registros_total > 0 && percentual < 75 && !critico;
        return {
          id: a.id, nome: formatarNome(a.nome), turma_id: a.turma_id,
          numero_chamada: a.numero_chamada ?? null,
          registros_total, presentes: m.presentes, ausentes: m.ausentes,
          pontos, percentual, em_risco, critico,
        };
      });

      resultado.sort((a, b) => {
        const na = a.numero_chamada ?? Infinity;
        const nb = b.numero_chamada ?? Infinity;
        if (na !== nb) return na - nb;
        return a.nome.localeCompare(b.nome, 'pt-BR');
      });

      setAlunos(resultado);
    } catch (e: any) {
      console.error('Erro no relatório de frequência:', e);
      setErro(e?.message || 'Erro ao carregar relatório');
      setAlunos([]);
    } finally {
      setLoading(false);
    }
  }, [turmaId, periodoEfetivo.inicio, periodoEfetivo.fim]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const resumo: ResumoFrequencia = useMemo(() => {
    if (alunos.length === 0) {
      return { total_alunos: 0, media_percentual: 0, media_pontos: 0, total_em_risco: 0, total_criticos: 0, total_ok: 0, ...contadores };
    }
    const total_em_risco = alunos.filter(a => a.em_risco).length;
    const total_criticos = alunos.filter(a => a.critico).length;
    const total_ok = alunos.length - total_em_risco - total_criticos;
    const soma_pct = alunos.reduce((s, a) => s + a.percentual, 0);
    const soma_pts = alunos.reduce((s, a) => s + a.pontos, 0);
    return {
      total_alunos: alunos.length,
      media_percentual: +(soma_pct / alunos.length).toFixed(1),
      media_pontos: +(soma_pts / alunos.length).toFixed(2),
      total_em_risco, total_criticos, total_ok,
      ...contadores,
    };
  }, [alunos, contadores]);

  return { alunos, resumo, loading, erro, periodo, periodoEfetivo, recarregar: carregar };
}
