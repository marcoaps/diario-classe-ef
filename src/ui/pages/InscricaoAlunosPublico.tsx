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
    <div className="min-h-screen font-sans" style={{ background: 'linear-gradient(180deg, #0066cc 0%, #0052a3 100%)' }}>
      <div className="text-center pt-10 pb-8 px-4">
        <div className="text-6xl mb-3">🏆</div>
        <h1 className="text-white text-3xl font-extrabold tracking-tight">Interclasses IOP {EDICAO_PADRAO}</h1>
        <p className="text-blue-100 text-sm mt-1.5">Inscrição de alunos — Instituto Odilon Pratagi</p>
      </div>
      <div className="max-w-lg mx-auto px-4 pb-10 flex flex-col gap-4">
        <ModalidadeSeletor modalidade={modalidade} onSelecionar={selecionarModalidade} variant="hero" />
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
