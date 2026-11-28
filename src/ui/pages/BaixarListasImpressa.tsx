import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { supabase } from '../../data/supabase';
import { useContextoPendentesProva, usePendentesProva, TURMAS_PADRAO, type ContextoPendentesProva } from '../../domain/usePendentesProva';
import type { Bimestre } from '../../domain/useRelatorioFrequencia';
import { resumirProvas, listarSituacoes, type LinhaResumo, type LinhaSituacao, type NotaGravada } from '../../domain/resumoProvasTurma';
import { formatarNome } from '../../utils/formatarNome';
import { exportarProvaImpressaWord } from './exportarAlunosProva';

type NotaDaTurma = NotaGravada & { turma: string };

// Calcula uma turma (sem desenhar nada) com a mesma regra do painel da tela Notas.
function ColetorTurma({ turma, bimestre, ctx, notas, onPronto, onErro }: {
  turma: string; bimestre: Bimestre; ctx: ContextoPendentesProva; notas: NotaDaTurma[];
  onPronto: (dados: TurmaPendente) => void; onErro: (msg: string) => void;
}) {
  const { loading, erro, alunos, dispensados, origens } = usePendentesProva(turma, bimestre, ctx);
  const comecou = useRef(false);
  useEffect(() => {
    if (loading) { comecou.current = true; return; }
    if (!comecou.current) return;
    if (erro) { onErro(erro); return; }
    const r = resumirProvas(alunos, origens, new Set(dispensados.map(a => a.id)), notas.filter(n => n.turma === turma));
    onPronto({ turma, linhas: r.naoFizeram, situacoes: listarSituacoes(r) });
  }, [loading, erro]);
  return null;
}

export type TurmaPendente = { turma: string; linhas: LinhaResumo[]; situacoes: LinhaSituacao[] };

// Consulta as 18 turmas e entrega só as que têm alguém para a prova impressa;
// com `todas`, entrega também as turmas sem ninguém pendente.
export function ColetaImpressa({ bimestre, todas = false, usar, onFim }: {
  bimestre: Bimestre;
  todas?: boolean;
  usar: (turmas: TurmaPendente[]) => Promise<void> | void;
  onFim: (erro: string | null) => void;
}) {
  const ctx = useContextoPendentesProva();
  const [notas, setNotas] = useState<NotaDaTurma[] | null>(null);
  const prontas = useRef(new Map<string, TurmaPendente>());
  const encerrado = useRef(false);
  const encerrar = useCallback((erro: string | null) => {
    if (encerrado.current) return;
    encerrado.current = true;
    onFim(erro);
  }, [onFim]);

  useEffect(() => {
    supabase.from('notas').select('turma, nome, nota, nota_ef').eq('bimestre', bimestre).in('turma', TURMAS_PADRAO)
      .then(({ data, error }: any) => error ? encerrar(error.message) : setNotas(data || []));
  }, [bimestre]);
  // Sem a leitura das provas, a lista incluiria quem já fez: não gera o arquivo.
  useEffect(() => { if (ctx.erro) encerrar(ctx.erro); }, [ctx.erro]);

  const receber = async (dados: TurmaPendente) => {
    prontas.current.set(dados.turma, dados);
    if (prontas.current.size < TURMAS_PADRAO.length || encerrado.current) return;
    const turmas = TURMAS_PADRAO
      .map(t => prontas.current.get(t)!)
      .filter(t => (todas ? t.situacoes : t.linhas).length > 0);
    if (turmas.length === 0) { encerrar(todas ? 'Nenhum aluno encontrado nas turmas.' : 'Nenhum aluno pendente de prova nas turmas.'); return; }
    try { await usar(turmas); encerrar(null); }
    catch (e: any) { encerrar(e.message); }
  };

  if (!ctx.pronto || ctx.erro || !notas) return null;
  return <>{TURMAS_PADRAO.map(t => (
    <div key={t}><ColetorTurma turma={t} bimestre={bimestre} ctx={ctx} notas={notas} onPronto={receber} onErro={encerrar} /></div>
  ))}</>;
}

// Word com a lista completa das 18 turmas: quem vai fazer a prova IMPRESSA,
// quem já fez e quem está dispensado. Cada toque consulta o banco de novo.
export function BaixarListasImpressa({ bimestre }: { bimestre: Bimestre }) {
  const [pedido, setPedido] = useState<{ bimestre: Bimestre } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  return (
    <div className="mb-3">
      <button type="button" disabled={!!pedido} aria-busy={!!pedido}
        onClick={() => { setErro(null); setPedido({ bimestre }); }}
        className="w-full min-h-11 px-3 py-2 rounded-xl bg-[#0B6B3A] text-white text-[13px] font-extrabold flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-60">
        {pedido
          ? <><Loader2 className="w-4 h-4 animate-spin" aria-hidden /> Montando o Word das 18 turmas...</>
          : <><FileDown className="w-4 h-4" aria-hidden /> Word com a lista completa (18 turmas)</>}
      </button>
      {erro && <p role="alert" className="mt-1.5 text-xs font-semibold text-[#B42318]">Word não gerado: {erro}</p>}
      {pedido && (
        <ColetaImpressa bimestre={pedido.bimestre} todas
          usar={turmas => exportarProvaImpressaWord(pedido.bimestre, turmas.map(t => ({
            turma: t.turma, alunos: t.situacoes.map(s => ({ numero_chamada: s.numero, nome: formatarNome(s.nome), situacao: s.situacao, tipo: s.tipo })),
          })))}
          onFim={e => { setErro(e); setPedido(null); }} />
      )}
    </div>
  );
}
