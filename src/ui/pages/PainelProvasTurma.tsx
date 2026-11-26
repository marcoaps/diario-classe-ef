import React, { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { buscarNotas } from '../../data/supabase';
import { useContextoPendentesProva, usePendentesProva } from '../../domain/usePendentesProva';
import type { Bimestre } from '../../domain/useRelatorioFrequencia';
import { resumirProvas, type LinhaResumo, type NotaGravada } from '../../domain/resumoProvasTurma';
import { formatarNome } from '../../utils/formatarNome';
import { ImagemWhatsApp } from './ImagemWhatsApp';

const fmt = (n: number) => n.toFixed(1).replace('.', ',');
const ORIGEM = { online: 'Online', impressa: 'Impressa' } as const;

function Grupo({ titulo, linhas, aberto = false }: { titulo: string; linhas: LinhaResumo[]; aberto?: boolean }) {
  if (linhas.length === 0) return null;
  return (
    <details open={aberto} className="border-t border-[#DCEBE2]">
      <summary className="cursor-pointer select-none px-3.5 py-3 text-[13px] font-extrabold text-on-surface">
        {titulo} <span className="tabular-nums text-on-surface-variant">({linhas.length})</span>
      </summary>
      <ul className="pb-2">
        {linhas.map(l => (
          <li key={l.id} className="px-3.5 py-1.5 flex items-start gap-1 text-[13px]">
            <span className="w-6 shrink-0 text-xs leading-5 text-on-surface-variant tabular-nums">{l.numero ?? '-'}</span>
            <span className="flex-1 min-w-0 font-semibold text-on-surface leading-5">{formatarNome(l.nome)}</span>
            <span className="shrink-0 flex flex-wrap justify-end gap-1.5 text-xs leading-5 text-on-surface-variant tabular-nums">
              {l.origens.map(o => (
                <span key={o} className="px-2 rounded-full bg-[#E3F2EA] text-[#0B6B3A] font-bold">{ORIGEM[o]}</span>
              ))}
              {l.nota != null
                ? <b className="text-on-surface">{fmt(l.nota)}</b>
                : l.notaFrequencia != null && <span>freq. {fmt(l.notaFrequencia)}</span>}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

// Quem já fez a avaliação do bimestre (online ou impressa vinculada) nesta
// turma. Usa a mesma regra da tela "Alunos para a Prova". Para consultar de
// novo, quem chama troca a `key`: tudo é buscado outra vez.
export function PainelProvasTurma({ turma, bimestre, onFechar }: { turma: string; bimestre: Bimestre; onFechar: () => void }) {
  const ctx = useContextoPendentesProva();
  const { loading, erro, alunos, dispensados, origens } = usePendentesProva(turma, bimestre, ctx);
  const [notas, setNotas] = useState<NotaGravada[] | null>(null);
  const [erroNotas, setErroNotas] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    buscarNotas(turma, bimestre)
      .then(d => { if (ativo) setNotas(d as NotaGravada[]); })
      .catch(e => { if (ativo) setErroNotas(e.message); });
    return () => { ativo = false; };
  }, [turma, bimestre]);

  const falha = erro || erroNotas || ctx.erro;
  const carregando = !falha && (loading || !ctx.pronto || notas === null);
  const r = !carregando && !falha
    ? resumirProvas(alunos, origens, new Set(dispensados.map(a => a.id)), notas!)
    : null;
  const fizeram = r ? r.faltaLancar.length + r.lancados.length : 0;
  const faltam = r ? r.faltaLancar.length + r.naoFizeram.length : 0;

  return (
    <section aria-label={`Avaliação da turma ${turma}`} aria-busy={carregando}
      className="mb-3 bg-white rounded-[20px] border border-[#DCEBE2] overflow-hidden shadow-[0_1px_2px_rgba(5,59,32,0.05)]">
      <div className="px-3.5 py-3 flex items-start gap-2">
        <div className="flex-1 min-w-0" role="status">
          {carregando ? (
            <p className="flex items-center gap-2 text-sm font-semibold text-on-surface-variant">
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> Consultando as provas da {turma}...
            </p>
          ) : falha ? (
            <p className="text-sm font-semibold text-[#B42318]">Não consegui consultar as provas. Toque em atualizar para tentar de novo. ({falha})</p>
          ) : (
            <>
              <h3 className="text-base font-extrabold text-on-surface tabular-nums">
                {faltam === 0 ? 'Nenhuma nota pendente' : faltam === 1 ? 'Falta 1 nota' : `Faltam ${faltam} notas`} na {turma}
              </h3>
              <p className="text-[13px] text-on-surface-variant tabular-nums">
                {bimestre}º bimestre. Fizeram a avaliação: {fizeram}. Ainda não fizeram: {r!.naoFizeram.length}.
              </p>
            </>
          )}
        </div>
        <button type="button" onClick={onFechar} aria-label="Fechar o painel de provas"
          className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-[#F1F6F3]">
          <X className="w-4 h-4" />
        </button>
      </div>
      {r && (
        <>
          {r.naoFizeram.length > 0 && (
            <ImagemWhatsApp turma={turma} bimestre={bimestre} linhas={r.naoFizeram} />
          )}
          <Grupo titulo="Fizeram, falta lançar a nota" linhas={r.faltaLancar} aberto />
          <Grupo titulo="Fizeram, nota lançada" linhas={r.lancados} aberto />
          <Grupo titulo="Ainda não fizeram" linhas={r.naoFizeram} aberto />
          <Grupo titulo="Com nota pela frequência, sem prova" linhas={r.soFrequencia} aberto />
          <Grupo titulo="Com nota, sem prova registrada" linhas={r.comNotaSemProva} />
          <Grupo titulo="Dispensados pela presença" linhas={r.dispensadosSemProva} />
          <p className="border-t border-[#DCEBE2] px-3.5 py-2.5 text-xs text-on-surface-variant">
            Prova impressa só aparece depois de vinculada ao aluno em Correções realizadas.
          </p>
        </>
      )}
    </section>
  );
}
