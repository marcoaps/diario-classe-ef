import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../data/supabase';
import { ArrowLeft, Download, ClipboardList, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { lancarNotaImpressaNoDiario, normalizarNotaImpressa, textoLancamento, bimestreDaAvaliacao } from '../../../domain/notaProvaImpressa';

import type { Avaliacao, Aluno } from './tiposCorretorProvas';
import { labelTurmaOuGrupo, ehGrupoDeTurmas, turmasDoValor } from './tiposCorretorProvas';

// ============================================================================
// "Correções realizadas" — lista TODA correção anônima desta avaliação
// (codigo_anonimo). A correção continua nascendo sem aluno; aqui o professor
// VINCULA cada código a um aluno (só preenche avaliacoes_respostas.aluno_id —
// código, respostas e notas ficam intactos). Uma vez vinculada, a correção
// aparece em Resultados da avaliação e tira o aluno dos pendentes em
// "Alunos para a Prova", igual à prova online.
// ============================================================================

interface Correcao {
  id: string;
  codigo_anonimo: string;
  acertos: number | null;
  erros: number;
  brancas: number;
  nota_final: number;
  escaneado_em: string | null;
  aluno_id: string | null;
  respostas: Record<string, string> | null;
}

export function AvaliacaoCorrecoes() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [avaliacao, setAvaliacao] = useState<Avaliacao | null>(null);
  const [correcoes, setCorrecoes] = useState<Correcao[]>([]);
  const [loading, setLoading] = useState(true);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      if (!id) return;
      const { data: av } = await supabase.from('avaliacoes').select('*').eq('id', id).single();
      setAvaliacao(av);

      if (av) {
        const { data: als } = await supabase
          .from('alunos')
          .select('id, nome, numero_chamada, turma_id')
          .in('turma_id', turmasDoValor(av.turma_id))
          .order('turma_id')
          .order('numero_chamada');
        setAlunos(als || []);
      }

      const { data: cor } = await supabase
        .from('avaliacoes_respostas')
        .select('id, codigo_anonimo, acertos, erros, brancas, nota_final, escaneado_em, aluno_id, respostas')
        .eq('avaliacao_id', id)
        .not('codigo_anonimo', 'is', null)
        .order('codigo_anonimo');
      setCorrecoes(cor || []);
      setLoading(false);
    }
    init();
  }, [id]);

  const alunoPorId = new Map<string, Aluno>(alunos.map(a => [a.id, a]));
  const rotuloAluno = (a: Aluno) => `${a.turma_id ? a.turma_id + ' · ' : ''}${a.numero_chamada ?? '?'} — ${a.nome}`;

  // Grava só o aluno_id da correção (ou limpa, pra desfazer um vínculo
  // errado). O índice único (avaliacao_id, aluno_id) do banco impede o mesmo
  // aluno em duas correções da mesma avaliação.
  async function vincularAluno(correcaoId: string, alunoId: string | null) {
    setErro(null);
    setSalvandoId(correcaoId);
    const { error } = await supabase
      .from('avaliacoes_respostas')
      .update({ aluno_id: alunoId })
      .eq('id', correcaoId);
    setSalvandoId(null);
    if (error) {
      setErro(error.code === '23505'
        ? 'Esse aluno já está vinculado a outra correção desta avaliação.'
        : `Não foi possível salvar o vínculo: ${error.message}`);
      return;
    }
    setCorrecoes(cs => cs.map(c => (c.id === correcaoId ? { ...c, aluno_id: alunoId } : c)));
    // Vinculou: a nota vai pro Diário (como na prova online). Desvincular não mexe nas notas.
    const aluno = alunoId ? alunoPorId.get(alunoId) : null;
    const corr = correcoes.find(c => c.id === correcaoId);
    if (aluno && corr && avaliacao) {
      const r = await lancarNotaImpressaNoDiario(avaliacao, aluno, corr.nota_final ?? 0);
      if (r.erro) setErro(r.erro);
      else setMsgLancamento(`${aluno.nome}: ${textoLancamento(avaliacao, corr.nota_final ?? 0, r.nota)}`);
      carregarNotasDiario();
    }
  }

  // Lança no Diário a nota de TODAS as correções já vinculadas (útil pras que
  // foram vinculadas antes de existir o lançamento automático). Idempotente.
  const [lancandoTodas, setLancandoTodas] = useState(false);
  const [msgLancamento, setMsgLancamento] = useState<string | null>(null);
  // Notas que já estão no Diário (tabela notas) deste bimestre: "turma|nº" -> nota.
  // Serve só pro check ✓ da lista (nota do Diário == nota que seria lançada).
  const [notasDiario, setNotasDiario] = useState<Map<string, number | null>>(new Map());
  const [notasCarregadas, setNotasCarregadas] = useState(false);
  const [soNaoLancadas, setSoNaoLancadas] = useState(false);
  async function carregarNotasDiario(av = avaliacao, als = alunos) {
    const bim = av ? bimestreDaAvaliacao(av) : null;
    const turmas = Array.from(new Set(als.map(a => a.turma_id).filter(Boolean))) as string[];
    if (!bim || !turmas.length) return;
    const { data } = await supabase.from('notas').select('turma, numero, nota').eq('bimestre', bim).in('turma', turmas);
    setNotasDiario(new Map((data || []).map((n: any) => [`${n.turma}|${n.numero}`, n.nota == null ? null : Number(n.nota)])));
    setNotasCarregadas(true);
  }
  useEffect(() => { carregarNotasDiario(); }, [avaliacao, alunos]);
  const jaNoDiario = (c: Correcao) => {
    const a = c.aluno_id ? alunoPorId.get(c.aluno_id) : null;
    if (!a) return false;
    const n = notasDiario.get(`${a.turma_id}|${a.numero_chamada}`);
    // Vale a maior nota: Diário com nota MAIOR que a da correção também conta como resolvido.
    return n != null && n >= normalizarNotaImpressa(c.nota_final ?? 0) - 0.001;
  };
  // Aviso fixo no rodapé (a lista é longa: a mensagem do topo some da vista).
  useEffect(() => {
    if (!msgLancamento && !erro) return;
    const t = setTimeout(() => { setMsgLancamento(null); setErro(null); }, 9000);
    return () => clearTimeout(t);
  }, [msgLancamento, erro]);
  async function lancarVinculadasNoDiario() {
    if (!avaliacao) return;
    const vinculadas = correcoes.filter(c => c.aluno_id && alunoPorId.get(c.aluno_id) && !jaNoDiario(c));
    if (!vinculadas.length) { setMsgLancamento('Nenhuma nota pendente: todas as correções vinculadas já estão no Diário.'); return; }
    const lista = vinculadas.map(c => {
      const a = alunoPorId.get(c.aluno_id!)!;
      return `${a.turma_id} ${a.numero_chamada} ${a.nome}: ${(c.nota_final ?? 0).toFixed(1)} → ${normalizarNotaImpressa(c.nota_final ?? 0).toFixed(1)}`;
    }).join('\n');
    if (!window.confirm(`Lançar no Diário (vale a maior nota: nunca rebaixa) estas ${vinculadas.length} notas?\n\n${lista}`)) return;
    setLancandoTodas(true); setMsgLancamento(null);
    let ok = 0; const falhas: string[] = [];
    for (const c of vinculadas) {
      const a = alunoPorId.get(c.aluno_id!)!;
      const r = await lancarNotaImpressaNoDiario(avaliacao, a, c.nota_final ?? 0);
      if (r.erro) falhas.push(`${a.nome}: ${r.erro}`); else ok++;
    }
    setLancandoTodas(false);
    carregarNotasDiario();
    setMsgLancamento(`${ok} nota(s) lançada(s) no Diário.` + (falhas.length ? ` Falhas: ${falhas.join(' | ')}` : ''));
  }

  // Bolhas marcadas na folha (ex: "1-A 2-C 3-·"), pra achar a folha de papel
  // correspondente e descobrir de qual aluno ela é. Minúscula = errou.
  function marcadas(c: Correcao): string {
    const r = c.respostas || {};
    const gab = avaliacao?.gabarito || {};
    return Array.from({ length: avaliacao?.quantidade_objetivas || 0 }, (_, i) => {
      const n = String(i + 1);
      const m = (r[n] || '').trim();
      if (!m) return `${n}-·`;
      return `${n}-${gab[n] && gab[n] !== m ? m.toLowerCase() : m.toUpperCase()}`;
    }).join(' ');
  }
  const horaCorrecao = (c: Correcao) => c.escaneado_em
    ? new Date(c.escaneado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '';

  // Exclui UMA correção (pra corrigir a folha de novo, já escolhendo o aluno).
  // Pede confirmação; o histórico de ajustes de bolha fica preservado.
  async function excluirCorrecao(c: Correcao) {
    const ok = window.confirm(
      `Excluir a correção ${c.codigo_anonimo} (nota ${(c.nota_final ?? 0).toFixed(1)})?\n\n` +
      'Ela some desta lista e dos Resultados. Depois é só corrigir a folha de novo. Esta ação não pode ser desfeita.');
    if (!ok) return;
    setErro(null);
    setSalvandoId(c.id);
    const { error } = await supabase.from('avaliacoes_respostas').delete().eq('id', c.id);
    setSalvandoId(null);
    if (error) { setErro(`Não foi possível excluir: ${error.message}`); return; }
    setCorrecoes(cs => cs.filter(x => x.id !== c.id));
  }

  function exportarExcel() {
    if (!avaliacao) return;
    const dados = correcoes.map(c => ({
      'Código da correção': c.codigo_anonimo,
      'Código da avaliação': avaliacao.codigo_avaliacao || '',
      'Grupo': ehGrupoDeTurmas(avaliacao.turma_id) ? labelTurmaOuGrupo(avaliacao.turma_id) : avaliacao.turma_id,
      'Acertos': c.acertos ?? '',
      'Erros': c.erros ?? '',
      'Brancas': c.brancas ?? '',
      'Nota': c.nota_final ?? '',
      'Marcadas': marcadas(c),
      'Corrigida em': horaCorrecao(c),
      'Aluno': c.aluno_id ? (alunoPorId.get(c.aluno_id) ? rotuloAluno(alunoPorId.get(c.aluno_id)!) : c.aluno_id) : '',
    }));
    const ws = XLSX.utils.json_to_sheet(dados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Correções');
    XLSX.writeFile(wb, `correcoes_${avaliacao.codigo_avaliacao || avaliacao.titulo}.xlsx`);
  }

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );

  if (!avaliacao) return (
    <div className="py-8 text-center text-sm text-on-surface-variant">Avaliação não encontrada.</div>
  );

  const valorTotal = (avaliacao.valor_total_objetivas || 0) + (avaliacao.valor_total_discursivas || 0);
  const media = correcoes.length > 0 ? correcoes.reduce((s, c) => s + (c.nota_final || 0), 0) / correcoes.length : 0;
  const vinculadas = correcoes.filter(c => c.aluno_id).length;
  const naoLancadas = notasCarregadas ? correcoes.filter(c => c.aluno_id && alunoPorId.has(c.aluno_id) && !jaNoDiario(c)) : [];
  const semAluno = correcoes.filter(c => !c.aluno_id).length;
  const visiveis = soNaoLancadas ? correcoes.filter(c => !c.aluno_id || naoLancadas.includes(c)) : correcoes;
  const idsVinculados = new Set(correcoes.map(c => c.aluno_id).filter(Boolean) as string[]);

  return (
    <div className="pt-4 pb-32 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/avaliacoes')} className="p-1 rounded-lg text-on-surface-variant">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-base font-bold text-on-surface">Correções realizadas</h1>
            <p className="text-xs text-on-surface-variant">
              {avaliacao.titulo} · {avaliacao.codigo_avaliacao || 'sem código ainda'}
            </p>
          </div>
        </div>
        <button
          onClick={exportarExcel}
          disabled={correcoes.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary-container text-on-secondary-container text-xs font-semibold disabled:opacity-50"
        >
          <Download className="w-3.5 h-3.5" />
          Excel
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-surface border border-outline-variant rounded-2xl p-3 text-center">
          <p className="text-xs text-on-surface-variant">Corrigidas</p>
          <p className="text-2xl font-bold text-primary">{correcoes.length}</p>
        </div>
        <div className="bg-surface border border-outline-variant rounded-2xl p-3 text-center">
          <p className="text-xs text-on-surface-variant">Média</p>
          <p className="text-2xl font-bold text-primary">{media.toFixed(1)}</p>
        </div>
        <div className="bg-surface border border-outline-variant rounded-2xl p-3 text-center">
          <p className="text-xs text-on-surface-variant">Vinculadas</p>
          <p className="text-2xl font-bold text-primary">{vinculadas}/{correcoes.length}</p>
        </div>
      </div>

      {correcoes.length > 0 && (
        <p className="text-xs text-on-surface-variant">
          Escolha o aluno de cada correção. Depois de vinculada, ela entra em Resultados e o aluno sai da lista de pendentes.
          Não sabe de quem é? Compare as bolhas marcadas (embaixo do código) com as folhas de papel: letra minúscula = errou, · = em branco.
        </p>
      )}
      {erro && <p className="text-xs font-semibold text-red-600">{erro}</p>}
      {vinculadas > 0 && notasCarregadas && (
        <div className="flex flex-wrap items-center gap-2">
          <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${naoLancadas.length ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>
            {naoLancadas.length ? `${naoLancadas.length} ainda não lançada(s) no Diário` : '✓ Todas as vinculadas estão no Diário'}
            {semAluno > 0 ? ` · ${semAluno} sem aluno` : ''}
          </span>
          {(naoLancadas.length > 0 || semAluno > 0) && (
            <button
              onClick={() => setSoNaoLancadas(v => !v)}
              className="px-3 py-1.5 rounded-full border border-outline-variant text-xs font-semibold text-on-surface"
            >
              {soNaoLancadas ? 'Mostrar todas' : 'Mostrar só as pendentes'}
            </button>
          )}
        </div>
      )}
      {vinculadas > 0 && (
        <button
          onClick={lancarVinculadasNoDiario}
          disabled={lancandoTodas || (notasCarregadas && naoLancadas.length === 0)}
          className="self-start px-3 py-1.5 rounded-full bg-primary text-on-primary text-xs font-semibold disabled:opacity-50"
        >
          {lancandoTodas ? 'Lançando…' : `Lançar no Diário as pendentes (${notasCarregadas ? naoLancadas.length : vinculadas})`}
        </button>
      )}
      {msgLancamento && <p className="text-xs font-semibold text-on-surface-variant">{msgLancamento}</p>}
      {(msgLancamento || erro) && (
        <div role="status" onClick={() => { setMsgLancamento(null); setErro(null); }}
          className={`fixed left-3 right-3 bottom-20 z-50 mx-auto max-w-md rounded-2xl px-4 py-3 text-sm font-semibold shadow-lg text-white ${erro ? 'bg-red-600' : 'bg-green-700'}`}>
          {erro ? '✗ ' : '✓ '}{erro || msgLancamento}
        </div>
      )}

      {correcoes.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center text-on-surface-variant">
          <ClipboardList className="w-10 h-10 opacity-40" />
          <p className="text-sm">Nenhuma correção ainda. Vá em "Corrigir" e escaneie o QR da avaliação.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-xs text-on-surface-variant border-b border-outline-variant">
                <th className="py-2 pr-2 font-semibold">Código</th>
                <th className="py-2 pr-2 font-semibold">Acertos</th>
                <th className="py-2 pr-2 font-semibold">Nota</th>
                <th className="py-2 pr-2 font-semibold">Aluno</th>
                <th className="py-2 font-semibold sr-only">Excluir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {visiveis.map(c => (
                <tr key={c.id} className={c.aluno_id && notasCarregadas && !jaNoDiario(c) ? 'bg-amber-50' : undefined}>
                  <td className="py-2 pr-2 font-mono text-xs text-on-surface">
                    {c.codigo_anonimo}
                    <div className="mt-1 text-[10px] leading-snug text-on-surface-variant whitespace-normal break-words max-w-[9rem]">{marcadas(c)}</div>
                    {horaCorrecao(c) && <div className="text-[10px] text-on-surface-variant">{horaCorrecao(c)}</div>}
                  </td>
                  <td className="py-2 pr-2 text-on-surface">{c.acertos ?? '—'}/{avaliacao.quantidade_objetivas}</td>
                  <td className="py-2 pr-2 font-bold text-primary">
                    {(c.nota_final ?? 0).toFixed(1)} / {valorTotal.toFixed(1)}
                    {c.aluno_id && (jaNoDiario(c)
                      ? <div className="text-[10px] font-semibold text-green-700" title="A nota já está no Diário (aba Notas)">✓ no Diário</div>
                      : <div className="text-[10px] font-semibold text-amber-600" title="A nota ainda não está no Diário (aba Notas)">○ não lançada</div>)}
                  </td>
                  <td className="py-2 pr-2 text-on-surface-variant">
                    <select
                      value={c.aluno_id || ''}
                      disabled={salvandoId === c.id}
                      onChange={e => vincularAluno(c.id, e.target.value || null)}
                      className={`w-full max-w-[16rem] px-2 py-1 rounded-lg border text-xs bg-background ${c.aluno_id ? 'border-primary text-on-surface font-semibold' : 'border-outline-variant text-on-surface-variant'} disabled:opacity-50`}
                    >
                      <option value="">— vincular aluno —</option>
                      {c.aluno_id && !alunoPorId.has(c.aluno_id) && (
                        <option value={c.aluno_id}>Aluno não encontrado na turma</option>
                      )}
                      {alunos
                        .filter(a => a.id === c.aluno_id || !idsVinculados.has(a.id))
                        .map(a => <option key={a.id} value={a.id}>{rotuloAluno(a)}</option>)}
                    </select>
                  </td>
                  <td className="py-2">
                    <button
                      onClick={() => excluirCorrecao(c)}
                      disabled={salvandoId === c.id}
                      title="Excluir esta correção"
                      className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-40"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
