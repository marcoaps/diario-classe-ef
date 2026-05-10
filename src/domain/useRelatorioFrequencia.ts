import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../data/supabase';

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
}

export const PONTOS_POR_REGISTRO = 0.5;
export const AULAS_POR_BIMESTRE = 20;
export const PONTOS_MAXIMOS = AULAS_POR_BIMESTRE * PONTOS_POR_REGISTRO * 2;

export function getPeriodoBimestre(bimestre: Bimestre, ano?: number) {
  const y = ano ?? new Date().getFullYear();
  switch (bimestre) {
    case 1:
      return { inicio: `${y}-02-01`, fim: `${y}-04-30` };
    case 2:
      return { inicio: `${y}-05-01`, fim: `${y}-07-15` };
    case 3:
      return { inicio: `${y}-07-16`, fim: `${y}-09-30` };
    case 4:
      return { inicio: `${y}-10-01`, fim: `${y}-12-20` };
  }
}

function normalizarTurma(turmaId: string) {
  return turmaId.replace('º', '').replace(/\s/g, '').toUpperCase();
}

export function useRelatorioFrequencia(turmaId: string | null, bimestre: Bimestre, ano?: number) {
  const [alunos, setAlunos] = useState<AlunoFrequencia[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const periodo = useMemo(() => getPeriodoBimestre(bimestre, ano), [bimestre, ano]);

  const carregar = useCallback(async () => {
    if (!turmaId) {
      setAlunos([]);
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
        return;
      }

      const ids = listaAlunos.map((a: any) => a.id);

      const { data: freqData, error: freqErr } = await supabase
        .from('frequencia')
        .select('aluno_id, data, presente')
        .gte('data', periodo.inicio)
        .lte('data', periodo.fim)
        .in('aluno_id', ids);

      if (freqErr) throw freqErr;

      const mapa = new Map<string, { presentes: number; ausentes: number }>();
      (freqData || []).forEach((r: any) => {
        const acc = mapa.get(r.aluno_id) || { presentes: 0, ausentes: 0 };
        if (r.presente) acc.presentes += 1;
        else acc.ausentes += 1;
        mapa.set(r.aluno_id, acc);
      });

      const resultado: AlunoFrequencia[] = listaAlunos.map((a: any) => {
        const m = mapa.get(a.id) || { presentes: 0, ausentes: 0 };
        const registros_total = m.presentes + m.ausentes;
        const pontos = +(m.presentes * PONTOS_POR_REGISTRO).toFixed(2);
        const percentual = registros_total > 0
          ? +((m.presentes / registros_total) * 100).toFixed(2)
          : 0;
        const critico = registros_total > 0 && percentual < 50;
        const em_risco = registros_total > 0 && percentual < 75 && !critico;
        return {
          id: a.id,
          nome: a.nome,
          turma_id: a.turma_id,
          numero_chamada: a.numero_chamada ?? null,
          registros_total,
          presentes: m.presentes,
          ausentes: m.ausentes,
          pontos,
          percentual,
          em_risco,
          critico,
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
  }, [turmaId, periodo.inicio, periodo.fim]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const resumo: ResumoFrequencia = useMemo(() => {
    if (alunos.length === 0) {
      return { total_alunos: 0, media_percentual: 0, media_pontos: 0, total_em_risco: 0, total_criticos: 0, total_ok: 0 };
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
      total_em_risco,
      total_criticos,
      total_ok,
    };
  }, [alunos]);

  return { alunos, resumo, loading, erro, periodo, recarregar: carregar };
}
