import { useState, useEffect, useCallback } from 'react';
import { buscarInscricoesInterclasses, buscarTurmasDisponiveis } from '../../data/supabase';
import { EDICAO_PADRAO, unirTurmas, type Modalidade } from '../../domain/interclasses';
import type { InscricaoInterclasses } from '../../domain/interclasses';
import { InscricaoAlunos } from './interclasses/InscricaoAlunos';
import { ModalidadeSeletor } from './InterclassesIOP';

const MODALIDADE_STORAGE_KEY = 'interclasses_modalidade_publico';

// Página pública (sem login) pra alunos se inscreverem sozinhos no Interclasses
// — compartilhável por link direto. Reaproveita o mesmo formulário/lista do
// painel do professor, só que em modoPublico (sem editar/excluir/limpar tudo).
export function InscricaoAlunosPublico() {
  const [modalidade, setModalidade] = useState<Modalidade>(() => {
    try { return (localStorage.getItem(MODALIDADE_STORAGE_KEY) as Modalidade) || 'futsal'; } catch { return 'futsal'; }
  });
  const [inscricoes, setInscricoes] = useState<InscricaoInterclasses[]>([]);
  const [turmas, setTurmas] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  function selecionarModalidade(m: Modalidade) {
    setModalidade(m);
    try { localStorage.setItem(MODALIDADE_STORAGE_KEY, m); } catch { /* ignore */ }
  }

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

  const inscricoesModalidade = inscricoes.filter(i => (i.modalidade ?? 'futsal') === modalidade);

  return (
    <div className="min-h-screen bg-background font-sans">
      <div className="text-center py-6 px-4 border-b border-gray-100 bg-white">
        <div className="text-4xl mb-2">🏆</div>
        <h1 className="text-on-surface text-xl font-bold">Interclasses IOP {EDICAO_PADRAO}</h1>
        <p className="text-gray-500 text-sm mt-1">Inscrição de alunos — Instituto Odilon Pratagi</p>
      </div>
      <div className="max-w-lg mx-auto p-4 flex flex-col gap-4">
        <ModalidadeSeletor modalidade={modalidade} onSelecionar={selecionarModalidade} />
        <InscricaoAlunos
          edicao={EDICAO_PADRAO}
          modalidade={modalidade}
          inscricoes={inscricoesModalidade}
          turmas={turmas}
          loading={loading}
          onRefetch={carregar}
          modoPublico
        />
      </div>
    </div>
  );
}
