import { useState, useEffect, useCallback } from 'react';
import { buscarInscricoesInterclasses, buscarTurmasDisponiveis } from '../../data/supabase';
import { EDICAO_PADRAO, unirTurmas } from '../../domain/interclasses';
import type { InscricaoInterclasses } from '../../domain/interclasses';
import { InscricaoAlunos } from './interclasses/InscricaoAlunos';

// Página pública (sem login) pra alunos se inscreverem sozinhos no Interclasses
// — compartilhável por link direto. Reaproveita o mesmo formulário/lista do
// painel do professor, só que em modoPublico (sem editar/excluir/limpar tudo).
export function InscricaoAlunosPublico() {
  const [inscricoes, setInscricoes] = useState<InscricaoInterclasses[]>([]);
  const [turmas, setTurmas] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [insc, tms] = await Promise.all([
        buscarInscricoesInterclasses(EDICAO_PADRAO),
        buscarTurmasDisponiveis(),
      ]);
      setInscricoes(insc);
      setTurmas(unirTurmas(tms));
    } catch (e) {
      console.error('Erro ao carregar inscrições do Interclasses:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  return (
    <div className="min-h-screen bg-background font-sans">
      <div className="text-center py-6 px-4 border-b border-gray-100 bg-white">
        <div className="text-4xl mb-2">🏆</div>
        <h1 className="text-on-surface text-xl font-bold">Interclasses IOP {EDICAO_PADRAO}</h1>
        <p className="text-gray-500 text-sm mt-1">Inscrição de alunos — Instituto Odilon Pratagi</p>
      </div>
      <div className="max-w-lg mx-auto p-4">
        <InscricaoAlunos
          edicao={EDICAO_PADRAO}
          inscricoes={inscricoes}
          turmas={turmas}
          loading={loading}
          onRefetch={carregar}
          modoPublico
        />
      </div>
    </div>
  );
}
