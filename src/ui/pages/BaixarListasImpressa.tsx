import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { supabase } from '../../data/supabase';
import { useContextoPendentesProva, usePendentesProva, TURMAS_PADRAO, type ContextoPendentesProva } from '../../domain/usePendentesProva';
import type { Bimestre } from '../../domain/useRelatorioFrequencia';
import { resumirProvas, type LinhaResumo, type NotaGravada } from '../../domain/resumoProvasTurma';
import { formatarNome } from '../../utils/formatarNome';
import { exportarProvaImpressaWord } from './exportarAlunosProva';

type NotaDaTurma = NotaGravada & { turma: string };

// Calcula uma turma (sem desenhar nada) com a mesma regra do painel da tela Notas.
function ColetorTurma({ turma, bimestre, ctx, notas, onPronto, onErro }: {
  turma: string; bimestre: Bimestre; ctx: ContextoPendentesProva; notas: NotaDaTurma[];
  onPronto: (turma: string, linhas: LinhaResumo[]) => void; onErro: (msg: string) => void;
}) {
  const { loading, erro, alunos, dispensados, origens } = usePendentesProva(turma, bimestre, ctx);
  const comecou = useRef(false);
  useEffect(() => {
    if (loading) { comecou.current = true; return; }
    if (!comecou.current) return;
    if (erro) { onErro(erro); return; }
    const r = resumirProvas(alunos, origens, new Set(dispensados.map(a => a.id)), notas.filter(n => n.turma === turma));
    onPronto(turma, r.naoFizeram);
  }, [loading, erro]);
  return null;
}

function Coleta({ bimestre, onFim }: { bimestre: Bimestre; onFim: (erro: string | null) => void }) {
  const ctx = useContextoPendentesProva();
  const [notas, setNotas] = useState<NotaDaTurma[] | null>(null);
  const prontas = useRef(new Map<string, LinhaResumo[]>());
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

  const receber = async (turma: string, linhas: LinhaResumo[]) => {
    prontas.current.set(turma, linhas);
    if (prontas.current.size < TURMAS_PADRAO.length || encerrado.current) return;
    const turmas = TURMAS_PADRAO
      .map(t => ({ turma: t, alunos: prontas.current.get(t)!.map(l => ({ numero_chamada: l.numero, nome: formatarNome(l.nome) })) }))
      .filter(t => t.alunos.length > 0);
    if (turmas.length === 0) { encerrar('Nenhum aluno pendente de prova nas turmas.'); return; }
    try { await exportarProvaImpressaWord(bimestre, turmas); encerrar(null); }
    catch (e: any) { encerrar(e.message); }
  };

  if (!ctx.pronto || ctx.erro || !notas) return null;
  return <>{TURMAS_PADRAO.map(t => (
    <div key={t}><ColetorTurma turma={t} bimestre={bimestre} ctx={ctx} notas={notas} onPronto={receber} onErro={encerrar} /></div>
  ))}</>;
}

// Word com quem ainda vai fazer a prova IMPRESSA nas 18 turmas. Cada toque
// consulta o banco de novo, então quem já fez (online ou impressa) sai da lista.
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
          : <><FileDown className="w-4 h-4" aria-hidden /> Word da prova impressa (18 turmas)</>}
      </button>
      {erro && <p role="alert" className="mt-1.5 text-xs font-semibold text-[#B42318]">Word não gerado: {erro}</p>}
      {pedido && (
        <Coleta bimestre={pedido.bimestre} onFim={e => { setErro(e); setPedido(null); }} />
      )}
    </div>
  );
}
