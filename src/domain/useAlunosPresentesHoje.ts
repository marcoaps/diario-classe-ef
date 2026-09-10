import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../data/supabase';

export interface AlunoSupabase {
  id: string;
  nome: string;
  turma_id: string;
  numero_chamada: number | null;
  sexo: 'M' | 'F' | null;
}

// Busca os alunos das turmas selecionadas e só libera como "disponíveis" quem
// já foi marcado presente na chamada de HOJE — usado por telas que montam
// times em quadra (Times de Futsal, Rodízio de Futsal) para forçar a chamada
// ser feita antes de escalar alguém.
export function useAlunosPresentesHoje(turmasArray: string[], genero: 'M' | 'F' | null) {
  const turmasKey = turmasArray.join(',');
  const [alunosBrutos, setAlunosBrutos] = useState<AlunoSupabase[]>([]);
  const [presentesHojeIds, setPresentesHojeIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [chamadaCarregada, setChamadaCarregada] = useState(false);

  useEffect(() => {
    if (turmasArray.length === 0) {
      setAlunosBrutos([]);
      setPresentesHojeIds(new Set());
      setChamadaCarregada(false);
      return;
    }
    let mounted = true;
    setLoading(true);
    setChamadaCarregada(false);
    supabase
      .from('alunos')
      .select('id, nome, turma_id, numero_chamada, sexo')
      .in('turma_id', turmasArray)
      .order('turma_id', { ascending: true })
      .order('numero_chamada', { ascending: true, nullsFirst: false })
      .then(async ({ data, error }) => {
        if (!mounted) return;
        if (error) console.error('Erro ao buscar alunos:', error);
        const lista = (data || []) as AlunoSupabase[];
        setAlunosBrutos(lista);

        const hoje = new Date().toISOString().slice(0, 10);
        if (lista.length > 0) {
          const { data: freqData, error: freqError } = await supabase
            .from('frequencia')
            .select('aluno_id, presente')
            .eq('data', hoje)
            .in('aluno_id', lista.map(a => a.id));
          if (!mounted) return;
          if (freqError) console.error('Erro ao buscar frequência do dia:', freqError);
          setPresentesHojeIds(new Set((freqData || []).filter(r => r.presente).map(r => r.aluno_id)));
        } else {
          setPresentesHojeIds(new Set());
        }

        setChamadaCarregada(true);
        setLoading(false);
      });
    return () => { mounted = false; };
  }, [turmasKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const alunosComGenero = useMemo(
    () => alunosBrutos.filter(a => !genero || a.sexo === genero),
    [alunosBrutos, genero]
  );

  const alunos = useMemo(
    () => alunosComGenero.filter(a => presentesHojeIds.has(a.id)),
    [alunosComGenero, presentesHojeIds]
  );

  return { alunosBrutos, alunosComGenero, alunos, loading, chamadaCarregada };
}
