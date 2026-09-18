import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { buscarAlunosEspeciais, type AlunoEspecial } from '../../data/supabase';
import { Loader2, Search, HeartHandshake, X } from 'lucide-react';
import { cn } from '../AppLayout';

/** "6F" -> "6ºF", "7B" -> "7ºB" -- só formatação visual. */
function formatarTurma(turma: string): string {
  return turma.replace(/(\d+)/, '$1º');
}

function normalizar(texto: string): string {
  return texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function AlunosEspeciais() {
  const [searchParams] = useSearchParams();
  const [alunos, setAlunos] = useState<AlunoEspecial[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  // Vem de um atalho "Ver alunos especiais desta turma" nas telas de prova
  // (?turma=6F) — já abre filtrado, sem precisar escolher de novo.
  const [turmaFiltro, setTurmaFiltro] = useState(() => searchParams.get('turma')?.toUpperCase() || 'TODAS');

  useEffect(() => {
    let mounted = true;
    buscarAlunosEspeciais()
      .then(dados => { if (mounted) setAlunos(dados); })
      .catch(err => console.error('Erro ao buscar alunos especiais:', err))
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const turmas = useMemo(() =>
    Array.from(new Set<string>(alunos.map(a => a.turma_id))).sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true })),
  [alunos]);

  const buscaNormalizada = normalizar(busca.trim());

  const alunosFiltrados = useMemo(() => alunos.filter(a => {
    if (turmaFiltro !== 'TODAS' && a.turma_id !== turmaFiltro) return false;
    if (!buscaNormalizada) return true;
    const alvo = normalizar(`${a.nome} ${a.cid_diagnostico || ''}`);
    return alvo.includes(buscaNormalizada);
  }), [alunos, turmaFiltro, buscaNormalizada]);

  return (
    <div className="flex flex-col gap-6 font-sans animate-in fade-in pb-24 bg-gray-50 min-h-screen">
      <div className="bg-white border-b border-gray-100 p-6 md:px-8 space-y-4 shadow-sm">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <HeartHandshake className="w-5 h-5 text-teal-600" />
          Alunos Especiais (AEE)
        </h2>
        <p className="text-xs text-gray-400 -mt-2">
          Busque por CID, diagnóstico ou nome pra preparar a prova bimestral com as adaptações certas.
        </p>

        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por CID (ex: F84, TDAH, F90), diagnóstico ou nome..."
            className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-9 py-2.5 text-sm font-medium focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
          />
          {busca && (
            <button onClick={() => setBusca('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">Turma</label>
          <select
            value={turmaFiltro}
            onChange={(e) => setTurmaFiltro(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
          >
            <option value="TODAS">Todas as Turmas</option>
            {turmas.map(t => <option key={t} value={t}>{formatarTurma(t)}</option>)}
          </select>
        </div>
      </div>

      <div className="px-4 md:px-6 flex flex-col gap-4">
        {loading ? (
          <div className="flex flex-col gap-2 items-center justify-center py-10 text-gray-500">
            <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
            <span className="text-sm font-medium">Carregando...</span>
          </div>
        ) : (
          <>
            <p className="text-xs font-bold text-gray-400">{alunosFiltrados.length} {alunosFiltrados.length === 1 ? 'aluno encontrado' : 'alunos encontrados'}</p>

            {alunosFiltrados.length === 0 ? (
              <div className="text-center text-gray-500 py-10 font-medium bg-white rounded-2xl border border-gray-100 shadow-sm">
                Nenhum aluno encontrado{busca ? ` para "${busca}"` : ''}.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {alunosFiltrados.map(a => (
                  <div key={a.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 text-sm truncate">{a.nome}</p>
                        <span className="inline-block mt-1 px-2 py-0.5 rounded-lg bg-purple-50 text-purple-700 text-xs font-bold border border-purple-200">
                          {formatarTurma(a.turma_id)}
                        </span>
                      </div>
                      {a.transferido && (
                        <span className={cn("shrink-0 px-2 py-1 rounded-lg text-xs font-bold bg-gray-100 text-gray-500 border border-gray-200")}>
                          Transferido
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 leading-snug">
                      {a.cid_diagnostico || <span className="text-gray-300 italic">Sem CID/diagnóstico registrado</span>}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
