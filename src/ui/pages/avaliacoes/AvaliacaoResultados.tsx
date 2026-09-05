import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../data/supabase';
import { ArrowLeft, Download, Trophy, AlertCircle, Clock } from 'lucide-react';
import * as XLSX from 'xlsx';

import type { Avaliacao, Aluno } from './tiposCorretorProvas';
import { turmasDoValor, ehGrupoDeTurmas, labelTurmaOuGrupo } from './tiposCorretorProvas';

interface Resposta {
  aluno_id: string;
  respostas: Record<string, string>;
  acertos: number;
  nota: number;
  nota_final: number;
  escaneado_em: string;
}

interface ResultadoAluno {
  aluno: Aluno;
  resposta: Resposta | null;
}

export function AvaliacaoResultados() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [avaliacao, setAvaliacao] = useState<Avaliacao | null>(null);
  const [resultados, setResultados] = useState<ResultadoAluno[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<'todos' | 'corrigidos' | 'pendentes'>('todos');

  useEffect(() => {
    async function init() {
      if (!id) return;
      const { data: av } = await supabase.from('avaliacoes').select('*').eq('id', id).single();
      if (!av) { setLoading(false); return; }
      setAvaliacao(av);

      const { data: alunos } = await supabase
        .from('alunos')
        .select('id, nome, numero_chamada, turma_id')
        .in('turma_id', turmasDoValor(av.turma_id))
        .order('turma_id')
        .order('numero_chamada');

      const { data: respostas } = await supabase
        .from('avaliacoes_respostas')
        .select('aluno_id, respostas, acertos, nota, nota_final, escaneado_em')
        .eq('avaliacao_id', id);

      const respostasMap = new Map((respostas || []).map(r => [r.aluno_id, r]));

      const lista = (alunos || []).map(al => ({
        aluno: al,
        resposta: respostasMap.get(al.id) || null,
      }));

      setResultados(lista);
      setLoading(false);
    }
    init();
  }, [id]);

  function notaDe(r: Resposta | null): number {
    if (!r) return 0;
    return r.nota_final || r.nota || 0;
  }

  function exportarExcel() {
    if (!avaliacao) return;
    const valorTotal = (avaliacao.valor_total_objetivas || 0) + (avaliacao.valor_total_discursivas || 0);
    const dados = resultados.map(r => ({
      'Turma': r.aluno.turma_id || avaliacao.turma_id,
      'Nº': r.aluno.numero_chamada,
      'Nome': r.aluno.nome,
      'Acertos': r.resposta?.acertos ?? '',
      'Nota': r.resposta ? notaDe(r.resposta) : '',
      'Situação': r.resposta ? (notaDe(r.resposta) >= valorTotal / 2 ? 'Aprovado' : 'Recuperação') : 'Pendente',
    }));
    const ws = XLSX.utils.json_to_sheet(dados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Resultados');
    XLSX.writeFile(wb, `resultados_${avaliacao.titulo}_${avaliacao.turma_id}.xlsx`);
  }

  const valorTotalAvaliacao = (avaliacao?.valor_total_objetivas || 0) + (avaliacao?.valor_total_discursivas || 0);
  const corrigidos = resultados.filter(r => r.resposta !== null);
  const pendentes = resultados.filter(r => r.resposta === null);
  const mediaNotas = corrigidos.length > 0
    ? corrigidos.reduce((s, r) => s + notaDe(r.resposta), 0) / corrigidos.length
    : 0;
  const aprovados = corrigidos.filter(r => notaDe(r.resposta) >= valorTotalAvaliacao / 2).length;

  const listaFiltrada = filtro === 'corrigidos' ? corrigidos
    : filtro === 'pendentes' ? pendentes
    : resultados;

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );

  if (!avaliacao) return (
    <div className="py-8 text-center text-sm text-on-surface-variant">Avaliação não encontrada.</div>
  );

  return (
    <div className="py-4 space-y-4">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/avaliacoes')} className="p-1 rounded-lg text-on-surface-variant">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-base font-bold text-on-surface">Resultados</h1>
            <p className="text-xs text-on-surface-variant">
              {avaliacao.titulo} · {ehGrupoDeTurmas(avaliacao.turma_id) ? labelTurmaOuGrupo(avaliacao.turma_id) : `Turma ${avaliacao.turma_id}`}
            </p>
          </div>
        </div>
        <button
          onClick={exportarExcel}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary-container text-on-secondary-container text-xs font-semibold"
        >
          <Download className="w-3.5 h-3.5" />
          Excel
        </button>
      </div>

      {/* Cards de estatísticas */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-surface border border-outline-variant rounded-2xl p-3 text-center">
          <p className="text-xs text-on-surface-variant">Corrigidos</p>
          <p className="text-2xl font-bold text-primary">{corrigidos.length}/{resultados.length}</p>
        </div>
        <div className="bg-surface border border-outline-variant rounded-2xl p-3 text-center">
          <p className="text-xs text-on-surface-variant">Média da turma</p>
          <p className="text-2xl font-bold text-primary">{mediaNotas.toFixed(1)}</p>
        </div>
        <div className="bg-surface border border-outline-variant rounded-2xl p-3 text-center">
          <p className="text-xs text-on-surface-variant">Aprovados</p>
          <p className="text-2xl font-bold text-green-600">{aprovados}</p>
        </div>
        <div className="bg-surface border border-outline-variant rounded-2xl p-3 text-center">
          <p className="text-xs text-on-surface-variant">Recuperação</p>
          <p className="text-2xl font-bold text-red-500">{corrigidos.length - aprovados}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2">
        {(['todos', 'corrigidos', 'pendentes'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={['flex-1 py-1.5 rounded-xl text-xs font-medium border transition-all',
              filtro === f
                ? 'bg-primary text-on-primary border-primary'
                : 'border-outline-variant text-on-surface-variant'
            ].join(' ')}
          >
            {f === 'todos' ? `Todos (${resultados.length})`
              : f === 'corrigidos' ? `Corrigidos (${corrigidos.length})`
              : `Pendentes (${pendentes.length})`}
          </button>
        ))}
      </div>

      {/* Lista de alunos */}
      <div className="space-y-2">
        {listaFiltrada.map(({ aluno, resposta }) => {
          const nota = resposta ? notaDe(resposta) : null;
          const aprovado = nota !== null && nota >= valorTotalAvaliacao / 2;
          return (
            <div
              key={aluno.id}
              className="bg-surface border border-outline-variant rounded-2xl px-4 py-3 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <span className="text-xs text-on-surface-variant w-10 text-right">
                  {ehGrupoDeTurmas(avaliacao.turma_id) ? `${aluno.turma_id} ${aluno.numero_chamada}.` : `${aluno.numero_chamada}.`}
                </span>
                <div>
                  <p className="text-sm text-on-surface font-medium">{aluno.nome}</p>
                  {resposta && (
                    <p className="text-xs text-on-surface-variant">
                      {resposta.acertos}/{avaliacao.quantidade_objetivas} acertos objetivas
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {nota !== null ? (
                  <div className="text-right">
                    <p className={['text-lg font-bold', aprovado ? 'text-green-600' : 'text-red-500'].join(' ')}>
                      {nota.toFixed(1)}
                    </p>
                    <p className={['text-xs font-medium', aprovado ? 'text-green-600' : 'text-red-500'].join(' ')}>
                      {aprovado ? 'Aprovado' : 'Recup.'}
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-on-surface-variant">
                    <Clock className="w-4 h-4" />
                    <span className="text-xs">Pendente</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
