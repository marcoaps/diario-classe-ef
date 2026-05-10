import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../data/supabase';
import { getPeriodoBimestre, type Bimestre } from './useRelatorioFrequencia';

export interface AlunoPortal {
  id: string;
  nome: string;
  turma_id: string;
  numero_chamada: number | null;
  token_acesso: string;
}

export interface FrequenciaBimestre {
  presentes: number;
  ausentes: number;
  total: number;
  pontos: number;
  percentual: number;
}

export interface NotaBimestre {
  bimestre: Bimestre;
  nota: number | null;
}

export interface QuestaoPortal {
  id: string;
  enunciado: string;
  imagem_base64: string | null;
  tipo: 'multipla_escolha' | 'dissertativa';
  opcoes: string[] | null;
  resposta_correta: string | null;
  pontos: number;
  ordem: number;
}

export interface CorrecaoDissertativaPortal {
  questao_id: string;
  pontos_obtidos: number;
  pontos_total: number;
  percentual: number;
  justificativa: string;
}

export interface ProvaPortal {
  resposta_id: string;
  prova_id: string;
  titulo: string;
  enviado_em: string;
  nota: number | null;
  respostas_aluno: Record<string, string>;
  correcoes_dissertativas: CorrecaoDissertativaPortal[];
  questoes: QuestaoPortal[];
}

export interface PortalData {
  aluno: AlunoPortal | null;
  notas: NotaBimestre[];
  frequencia: Record<Bimestre, FrequenciaBimestre>;
  provas: ProvaPortal[];
  loading: boolean;
  error: string | null;
}

const BIMESTRES: Bimestre[] = [1, 2, 3, 4];

function frequenciaVazia(): FrequenciaBimestre {
  return { presentes: 0, ausentes: 0, total: 0, pontos: 0, percentual: 0 };
}

function dataInBimestre(dataISO: string, bimestre: Bimestre, ano: number) {
  const periodo = getPeriodoBimestre(bimestre, ano);
  return dataISO >= periodo.inicio && dataISO <= periodo.fim;
}

export function usePortalAluno(token: string | undefined) {
  const [aluno, setAluno] = useState<AlunoPortal | null>(null);
  const [notas, setNotas] = useState<NotaBimestre[]>([]);
  const [frequencia, setFrequencia] = useState<Record<Bimestre, FrequenciaBimestre>>({
    1: frequenciaVazia(), 2: frequenciaVazia(), 3: frequenciaVazia(), 4: frequenciaVazia(),
  });
  const [provas, setProvas] = useState<ProvaPortal[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setLoading(false);
      setError('Token de acesso ausente.');
      return;
    }

    const carregar = async () => {
      setLoading(true);
      setError(null);
      try {
        console.log('[usePortalAluno] buscando aluno por token=', token);
        // 1) Aluno por token
        const { data: alunoRow, error: alunoErr } = await supabase
          .from('alunos')
          .select('id, nome, turma_id, numero_chamada, token_acesso')
          .eq('token_acesso', token)
          .maybeSingle();

        console.log('[usePortalAluno] resposta supabase:', { data: alunoRow, error: alunoErr });

        if (alunoErr) {
          // Não navega — apenas mostra a mensagem do Supabase para debug.
          if (!cancelled) {
            setAluno(null);
            setError(`Erro do Supabase: ${alunoErr.message || JSON.stringify(alunoErr)}${alunoErr.code ? ` (code ${alunoErr.code})` : ''}`);
          }
          return;
        }
        if (!alunoRow) {
          if (!cancelled) {
            setAluno(null);
            setError('Token não encontrado. A coluna token_acesso pode não existir, RLS pode estar bloqueando, ou o UUID está incorreto.');
          }
          return;
        }

        if (cancelled) return;
        setAluno(alunoRow as AlunoPortal);

        const ano = new Date().getFullYear();

        // 2) Notas — match por turma + nome (esquema atual de notas usa nome+turma)
        const { data: notasData, error: notasErr } = await supabase
          .from('notas')
          .select('bimestre, nota')
          .eq('turma', alunoRow.turma_id)
          .eq('nome', alunoRow.nome);
        if (notasErr) console.warn('Erro ao buscar notas:', notasErr.message);

        const notasMap = new Map<number, number>();
        (notasData || []).forEach((n: any) => notasMap.set(Number(n.bimestre), Number(n.nota)));
        const notasArr: NotaBimestre[] = BIMESTRES.map((b) => ({
          bimestre: b,
          nota: notasMap.has(b) ? (notasMap.get(b) as number) : null,
        }));

        // 3) Frequência do ano todo (filtra em memória por bimestre)
        const inicioAno = `${ano}-01-01`;
        const fimAno = `${ano}-12-31`;
        const { data: freqData, error: freqErr } = await supabase
          .from('frequencia')
          .select('data, presente')
          .eq('aluno_id', alunoRow.id)
          .gte('data', inicioAno)
          .lte('data', fimAno);
        if (freqErr) console.warn('Erro ao buscar frequência:', freqErr.message);

        const freqAcc: Record<Bimestre, FrequenciaBimestre> = {
          1: frequenciaVazia(), 2: frequenciaVazia(), 3: frequenciaVazia(), 4: frequenciaVazia(),
        };
        (freqData || []).forEach((r: any) => {
          for (const b of BIMESTRES) {
            if (dataInBimestre(r.data, b, ano)) {
              if (r.presente) freqAcc[b].presentes += 1;
              else freqAcc[b].ausentes += 1;
              break;
            }
          }
        });
        for (const b of BIMESTRES) {
          const acc = freqAcc[b];
          acc.total = acc.presentes + acc.ausentes;
          acc.pontos = +(acc.presentes * 0.5).toFixed(2);
          acc.percentual = acc.total > 0 ? +((acc.presentes / acc.total) * 100).toFixed(2) : 0;
        }

        // 4) Provas/respostas — match por turma_id + aluno_nome
        const { data: respostasData, error: respErr } = await supabase
          .from('respostas')
          .select('id, prova_id, nota, enviado_em, respostas, correcoes_dissertativas')
          .eq('turma_id', alunoRow.turma_id)
          .eq('aluno_nome', alunoRow.nome)
          .order('enviado_em', { ascending: false });
        if (respErr) console.warn('Erro ao buscar respostas:', respErr.message);

        const provaIds = Array.from(new Set((respostasData || []).map((r: any) => r.prova_id)));

        let provasMap = new Map<string, { id: string; titulo: string }>();
        let questoesMap = new Map<string, QuestaoPortal[]>();
        if (provaIds.length > 0) {
          const [{ data: provasData }, { data: questoesData }] = await Promise.all([
            supabase.from('provas').select('id, titulo').in('id', provaIds),
            supabase
              .from('questoes')
              .select('id, prova_id, enunciado, imagem_base64, tipo, opcoes, resposta_correta, pontos, ordem')
              .in('prova_id', provaIds)
              .order('ordem', { ascending: true }),
          ]);
          (provasData || []).forEach((p: any) => provasMap.set(p.id, p));
          (questoesData || []).forEach((q: any) => {
            const arr = questoesMap.get(q.prova_id) || [];
            arr.push(q as QuestaoPortal);
            questoesMap.set(q.prova_id, arr);
          });
        }

        const provasArr: ProvaPortal[] = (respostasData || []).map((r: any) => ({
          resposta_id: r.id,
          prova_id: r.prova_id,
          titulo: provasMap.get(r.prova_id)?.titulo || 'Prova',
          enviado_em: r.enviado_em,
          nota: r.nota !== null && r.nota !== undefined ? Number(r.nota) : null,
          respostas_aluno: (r.respostas as Record<string, string>) || {},
          correcoes_dissertativas: (r.correcoes_dissertativas as CorrecaoDissertativaPortal[]) || [],
          questoes: questoesMap.get(r.prova_id) || [],
        }));

        if (cancelled) return;
        setNotas(notasArr);
        setFrequencia(freqAcc);
        setProvas(provasArr);
      } catch (e: any) {
        console.error('Erro no portal do aluno:', e);
        if (!cancelled) setError(e?.message || 'Erro ao carregar dados do portal.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    carregar();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const resumo = useMemo(() => {
    const notasValidas = notas.filter((n) => n.nota !== null).map((n) => n.nota as number);
    const mediaNotas = notasValidas.length > 0
      ? +(notasValidas.reduce((s, n) => s + n, 0) / notasValidas.length).toFixed(2)
      : null;

    let totalPres = 0;
    let totalReg = 0;
    BIMESTRES.forEach((b) => {
      totalPres += frequencia[b].presentes;
      totalReg += frequencia[b].total;
    });
    const percGeral = totalReg > 0 ? +((totalPres / totalReg) * 100).toFixed(1) : 0;
    return { mediaNotas, percGeral, totalProvas: provas.length };
  }, [notas, frequencia, provas]);

  return { aluno, notas, frequencia, provas, resumo, loading, error };
}
