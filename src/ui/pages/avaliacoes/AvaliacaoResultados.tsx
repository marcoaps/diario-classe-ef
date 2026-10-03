import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../data/supabase';
import { ArrowLeft, Download, Trophy, AlertCircle, Clock, Eye, X, Brain, ExternalLink } from 'lucide-react';
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
  online?: boolean;
  correcoes?: { questao_id: string; pontos_obtidos: number; pontos_total: number; justificativa: string }[];
}

interface QuestaoOnline {
  id: string;
  enunciado: string;
  tipo: 'multipla_escolha' | 'dissertativa' | 'composta';
  opcoes: string[] | null;
  resposta_correta: string | null;
  pontos: number;
  subitens?: { letra: string; enunciado: string }[] | null;
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
  const [questoesOnline, setQuestoesOnline] = useState<QuestaoOnline[]>([]);
  const [verResposta, setVerResposta] = useState<ResultadoAluno | null>(null);

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

      const respostasMap = new Map<string, Resposta>((respostas || []).map(r => [r.aluno_id, r]));

      // Respostas da Prova Online ficam em `respostas` (aluno digita nome, nº e
      // turma) -- casa com o aluno por turma + nº de chamada. A nota online é
      // de 0 a 10; converte pra escala da avaliação. Papel tem prioridade.
      // Aluno tem até 3 tentativas (ver MAX_TENTATIVAS em ResponderProva.tsx)
      // -- entre elas, vale a de MAIOR nota, não a mais recente.
      if (av.prova_online_id) {
        const [{ data: online }, { data: qs }] = await Promise.all([
          supabase.from('respostas').select('aluno_numero, turma_id, respostas, nota, enviado_em, correcoes_dissertativas')
            .eq('prova_id', av.prova_online_id).order('enviado_em', { ascending: false }),
          supabase.from('questoes').select('id, enunciado, tipo, opcoes, resposta_correta, pontos, subitens, ordem')
            .eq('prova_id', av.prova_online_id).order('ordem'),
        ]);
        setQuestoesOnline((qs || []) as QuestaoOnline[]);
        const valorTotal = (av.valor_total_objetivas || 0) + (av.valor_total_discursivas || 0);
        const melhorPorAluno = new Map<string, { o: NonNullable<typeof online>[number]; aluno: Aluno }>();
        for (const o of online || []) {
          const aluno = (alunos || []).find(a => a.turma_id === o.turma_id && a.numero_chamada === o.aluno_numero);
          if (!aluno || respostasMap.has(aluno.id)) continue; // papel já registrado tem prioridade
          const atual = melhorPorAluno.get(aluno.id);
          if (!atual || (o.nota ?? 0) > (atual.o.nota ?? 0)) melhorPorAluno.set(aluno.id, { o, aluno });
        }
        for (const { o, aluno } of melhorPorAluno.values()) {
          const acertos = (qs || []).filter(q => q.tipo === 'multipla_escolha' && o.respostas?.[q.id] === q.resposta_correta).length;
          const nota = ((o.nota ?? 0) / 10) * valorTotal;
          respostasMap.set(aluno.id, {
            aluno_id: aluno.id, respostas: o.respostas || {}, acertos, nota, nota_final: nota,
            escaneado_em: o.enviado_em, online: true, correcoes: o.correcoes_dissertativas || [],
          });
        }
      }

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
    <div className="py-4 pb-24 space-y-4">
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
                      {resposta.acertos}/{avaliacao.quantidade_objetivas} acertos objetivas{resposta.online ? ' · online' : ''}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {resposta?.online && (
                  <button
                    onClick={() => setVerResposta({ aluno, resposta })}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-secondary-container text-on-secondary-container text-xs font-semibold"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Ver prova
                  </button>
                )}
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

      {verResposta?.resposta && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center md:p-4">
          <div className="bg-white w-full max-w-lg md:rounded-3xl rounded-t-3xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Prova do aluno</p>
                <p className="font-bold text-gray-900">{verResposta.aluno.nome}</p>
                <p className="text-xs text-gray-400">Turma {verResposta.aluno.turma_id} · Nota {notaDe(verResposta.resposta).toFixed(1)}</p>
              </div>
              <button onClick={() => setVerResposta(null)} className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="overflow-y-auto px-4 py-4 flex flex-col gap-3">
              {questoesOnline.map((q, idx) => {
                const resp = verResposta.resposta!.respostas || {};
                const blocoIA = (chave: string) => {
                  const c = verResposta.resposta!.correcoes?.find(x => x.questao_id === chave);
                  if (!c) return null;
                  return (
                    <div className="bg-purple-50 rounded-xl p-2.5 border border-purple-100">
                      <p className="flex items-center gap-1 text-xs font-bold text-purple-600">
                        <Brain className="w-3 h-3" /> {c.pontos_obtidos}/{c.pontos_total} pts
                      </p>
                      <p className="text-xs text-gray-600 italic">{c.justificativa}</p>
                    </div>
                  );
                };
                const textoResp = (v?: string) => v?.trim()
                  ? <p className="text-sm text-gray-800 whitespace-pre-wrap">{v}</p>
                  : <p className="text-sm italic text-gray-400">(em branco)</p>;

                if (q.tipo === 'multipla_escolha') {
                  const marcada = resp[q.id];
                  const acertou = marcada !== undefined && marcada === q.resposta_correta;
                  const nomeOp = (i: string | null | undefined) => i != null && q.opcoes?.[Number(i)] !== undefined
                    ? `${String.fromCharCode(65 + Number(i))}) ${q.opcoes[Number(i)]}` : null;
                  return (
                    <div key={q.id} className={`rounded-2xl p-3 border-2 ${acertou ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                      <p className="text-xs font-bold text-gray-500 mb-1">Questão {idx + 1} · {acertou ? '✓ Acertou' : '✗ Errou'}</p>
                      <p className="text-sm text-gray-700 mb-2">{q.enunciado}</p>
                      <p className="text-xs text-gray-500">Marcou: <span className="font-semibold text-gray-800">{nomeOp(marcada) || '(em branco)'}</span></p>
                      {!acertou && <p className="text-xs text-gray-500">Correta: <span className="font-semibold text-green-700">{nomeOp(q.resposta_correta) || q.resposta_correta}</span></p>}
                    </div>
                  );
                }
                if (q.tipo === 'composta' && q.subitens) {
                  return (
                    <div key={q.id} className="rounded-2xl p-3 bg-orange-50 border border-orange-200 flex flex-col gap-2">
                      <p className="text-xs font-bold text-orange-700">Questão {idx + 1} (composta)</p>
                      <p className="text-sm text-gray-700">{q.enunciado}</p>
                      {q.subitens.map(s => (
                        <div key={s.letra} className="bg-white rounded-xl p-2.5 border border-orange-100 flex flex-col gap-1.5">
                          <p className="text-sm font-bold text-orange-700">{s.letra}) {s.enunciado}</p>
                          {textoResp(resp[`${q.id}_${s.letra}`])}
                          {blocoIA(`${q.id}_${s.letra}`)}
                        </div>
                      ))}
                    </div>
                  );
                }
                return (
                  <div key={q.id} className="rounded-2xl p-3 bg-gray-50 border border-gray-200 flex flex-col gap-1.5">
                    <p className="text-xs font-bold text-gray-500">Questão {idx + 1} (dissertativa) · {q.pontos} pt{q.pontos !== 1 ? 's' : ''}</p>
                    <p className="text-sm text-gray-700">{q.enunciado}</p>
                    <div className="bg-white rounded-xl p-2.5 border border-gray-200">{textoResp(resp[q.id])}</div>
                    {blocoIA(q.id)}
                  </div>
                );
              })}
            </div>
            <div className="p-4 border-t border-gray-100">
              <button
                onClick={() => navigate(`/provas?prova=${avaliacao.prova_online_id}`)}
                className="w-full py-3 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, #0B7A3D, #149951)' }}
              >
                <ExternalLink className="w-4 h-4" /> Ajustar nota (correção manual)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
