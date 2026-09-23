import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, RefreshCw, ShieldAlert } from 'lucide-react';
import { cn } from '../../AppLayout';
import { buscarElegibilidadeInterclasses, type ElegibilidadeInterclasses } from '../../../data/supabase';
import { ELEGIBILIDADE_LABEL } from '../../../domain/interclasses';

interface Props {
  edicao: string;
}

// Lista, por turma, os alunos marcados como "Inapto" (2+ notas vermelhas
// mesmo depois da Recuperação 1º Semestre substituir a nota do bimestre) —
// visão só do professor/administrador, pra decidir quem cortar antes que
// alguém tente inscrever. Os dados vêm de sql/interclasses_elegibilidade.sql
// (instantâneo importado dos PDFs do SIMAED, não uma consulta ao vivo).
export function AlunosSugeridosCorte({ edicao }: Props) {
  const [lista, setLista] = useState<ElegibilidadeInterclasses[]>([]);
  const [loading, setLoading] = useState(true);
  const [mostrarAtencao, setMostrarAtencao] = useState(false);
  const [filtroTurma, setFiltroTurma] = useState('TODAS');
  const [busca, setBusca] = useState('');

  async function carregar() {
    setLoading(true);
    try {
      const dados = await buscarElegibilidadeInterclasses(edicao);
      setLista(dados);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregar(); }, [edicao]);

  const turmasComDados = useMemo(
    () => Array.from(new Set(lista.map(l => l.turma_id))).sort((a: string, b: string) => a.localeCompare(b, 'pt-BR', { numeric: true })),
    [lista]
  );

  const filtrados = useMemo(() => {
    const buscaNorm = busca.trim().toLowerCase();
    return lista.filter(l =>
      (mostrarAtencao ? (l.status === 'inapto' || l.status === 'atencao') : l.status === 'inapto') &&
      (filtroTurma === 'TODAS' || l.turma_id === filtroTurma) &&
      (!buscaNorm || l.nome.toLowerCase().includes(buscaNorm))
    );
  }, [lista, mostrarAtencao, filtroTurma, busca]);

  const porTurma = useMemo(() => {
    const mapa = new Map<string, ElegibilidadeInterclasses[]>();
    filtrados.forEach(l => {
      if (!mapa.has(l.turma_id)) mapa.set(l.turma_id, []);
      mapa.get(l.turma_id)!.push(l);
    });
    return Array.from(mapa.entries())
      .sort(([a], [b]) => a.localeCompare(b, 'pt-BR', { numeric: true }))
      .map(([turma, alunos]) => ({ turma, alunos: alunos.sort((a, b) => (a.numero_chamada ?? 0) - (b.numero_chamada ?? 0)) }));
  }, [filtrados]);

  const totalInapto = lista.filter(l => l.status === 'inapto').length;
  const totalAtencao = lista.filter(l => l.status === 'atencao').length;

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-start gap-2">
            <ShieldAlert className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-on-surface text-sm">Alunos sugeridos para corte — Interclasses {edicao}</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Regra: aluno só joga com no máximo 1 nota vermelha (&lt; 7,0) depois da Recuperação 1º Semestre substituir a nota reprovada do 2º bimestre.
                Com 2 ou mais, fica <strong>Inapto</strong> — leve à Gestão ou cancele a inscrição.
              </p>
            </div>
          </div>
          <button
            onClick={carregar}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-primary font-medium disabled:opacity-40 flex-shrink-0"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} /> Atualizar
          </button>
        </div>

        {lista.length === 0 && !loading && (
          <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              Nenhum dado de elegibilidade encontrado. Rode a migração <code className="bg-amber-100 px-1 rounded">sql/interclasses_elegibilidade.sql</code> no
              SQL Editor do Supabase pra importar os dados dos PDFs do SIMAED.
            </p>
          </div>
        )}

        <div className="flex gap-2 mt-3">
          <div className="bg-error-container/50 rounded-xl px-3 py-2 flex-1 text-center">
            <p className="text-lg font-extrabold text-error">{totalInapto}</p>
            <p className="text-[10px] text-error/80 font-semibold">Inapto (cortar)</p>
          </div>
          <div className="bg-amber-50 rounded-xl px-3 py-2 flex-1 text-center">
            <p className="text-lg font-extrabold text-amber-700">{totalAtencao}</p>
            <p className="text-[10px] text-amber-600 font-semibold">Atenção (1 nota)</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-col gap-2 mb-3">
          <input
            type="text"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="🔎 Buscar aluno pelo nome"
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-on-surface outline-none focus:border-primary"
          />
          <div className="flex gap-2 flex-wrap items-center justify-between">
            <select
              value={filtroTurma}
              onChange={e => setFiltroTurma(e.target.value)}
              className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-on-surface outline-none focus:border-primary"
            >
              <option value="TODAS">Todas as turmas</option>
              {turmasComDados.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
              <input type="checkbox" checked={mostrarAtencao} onChange={e => setMostrarAtencao(e.target.checked)} className="accent-amber-500 w-3.5 h-3.5" />
              Incluir "Atenção (1 nota)"
            </label>
          </div>
        </div>

        {loading ? (
          <div className="flex gap-2 items-center justify-center py-8 text-gray-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
          </div>
        ) : porTurma.length === 0 ? (
          <div className="text-center text-gray-500 py-8 text-sm px-2">
            {lista.length === 0 ? 'Nenhum dado importado ainda.' : 'Nenhum aluno inapto encontrado com esses filtros. 🎉'}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {porTurma.map(({ turma, alunos }) => (
              <div key={turma} className="rounded-xl border border-gray-100 overflow-hidden">
                <div className="bg-gray-50 px-3 py-1.5 flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-600 font-mono">{turma}</span>
                  <span className="text-[10px] text-gray-400">{alunos.length} aluno{alunos.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {alunos.map(a => (
                    <div key={a.id} className="flex items-center gap-2 px-3 py-2">
                      <span className="flex-1 text-sm text-on-surface truncate">{a.nome}</span>
                      {a.numero_chamada != null && <span className="text-[11px] text-gray-400 flex-shrink-0">#{a.numero_chamada}</span>}
                      <span
                        className={cn(
                          'text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0',
                          a.status === 'inapto' ? 'bg-error-container text-error' : 'bg-amber-100 text-amber-700'
                        )}
                        title={ELEGIBILIDADE_LABEL[a.status]}
                      >
                        {a.notas_vermelhas_final} vermelha{a.notas_vermelhas_final !== 1 ? 's' : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
