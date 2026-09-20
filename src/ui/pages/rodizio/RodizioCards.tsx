import React, { useMemo, useState } from 'react';
import { Check, Crown, Loader2, Minus, Plus, RotateCcw, Trash2, Undo2, Users, X } from 'lucide-react';
import { cn } from '../../AppLayout';
import type { AlunoSupabase } from '../../../domain/useAlunosPresentesHoje';
import { useCardsRodizio } from '../../../domain/useCardsRodizio';
import { mediaDoTime, resumoEquilibrio, totalDoTime, type JogadorCard, type TimeCard } from '../../../domain/rodizioCardsLogica';

interface Props {
  /** Onde guardar (turmas + gênero + dia). Trocou a chave, troca o conjunto de cards. */
  chave: string;
  /** Todos os alunos das turmas escolhidas — não depende da chamada. */
  alunos: AlunoSupabase[];
  /** Quem está presente hoje, se a chamada já foi feita; null = não se aplica (chamada fictícia). */
  presentesIds: Set<string> | null;
  loading: boolean;
}

type Situacao = 'prioridade' | 'adiantado' | 'normal';

function rotuloAluno(a: AlunoSupabase) {
  return `${a.turma_id} ${a.numero_chamada ? `${a.numero_chamada} · ` : '· '}${a.nome}`;
}

// Quatro "checks" para marcar rápido (toque no 3º = 3 vezes; toque de novo no último = tira um)
// e +/- para passar de 4. O número ao lado é sempre o total.
function ContadorVezes({ jogador, onDefinir, onAjustar }: { jogador: JogadorCard; onDefinir: (v: number) => void; onAjustar: (d: number) => void }) {
  const { vezes, nome } = jogador;
  return (
    <div className="flex items-center justify-between gap-2">
      <button
        type="button"
        onClick={() => onAjustar(-1)}
        disabled={vezes === 0}
        aria-label={`Tirar uma vez de ${nome}`}
        className="h-9 w-9 rounded-xl bg-white border border-gray-200 text-gray-500 flex items-center justify-center active:scale-95 disabled:opacity-30"
      >
        <Minus className="w-4 h-4" />
      </button>
      <div className="flex items-center gap-1.5">
        {[1, 2, 3, 4].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => onDefinir(vezes === n ? n - 1 : n)}
            aria-label={`${nome}: marcar ${n} ${n === 1 ? 'vez' : 'vezes'}`}
            aria-pressed={vezes >= n}
            className={cn(
              'h-8 w-8 rounded-full border-2 flex items-center justify-center transition-colors active:scale-95',
              vezes >= n ? 'bg-primary border-primary text-white' : 'bg-white border-gray-300 text-transparent'
            )}
          >
            <Check className="w-4 h-4" />
          </button>
        ))}
      </div>
      <span className="w-9 text-center text-base font-bold tabular-nums text-on-surface" aria-label={`${vezes} vezes`}>{vezes}×</span>
      <button
        type="button"
        onClick={() => onAjustar(1)}
        aria-label={`Marcar mais uma vez para ${nome}`}
        className="h-9 w-9 rounded-xl bg-primary text-white flex items-center justify-center active:scale-95"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}

interface PropsLinhaJogador {
  jogador: JogadorCard;
  ehCapitao: boolean;
  situacao: Situacao;
  onDefinir: (v: number) => void;
  onAjustar: (d: number) => void;
  onRemover: () => void;
}

const LinhaJogador: React.FC<PropsLinhaJogador> = ({ jogador, ehCapitao, situacao, onDefinir, onAjustar, onRemover }) => {
  return (
    <div className={cn(
      'rounded-xl border px-2.5 py-2 flex flex-col gap-1.5',
      situacao === 'prioridade' && 'bg-secondary-container/40 border-secondary/40',
      situacao === 'adiantado' && 'bg-amber-50 border-amber-200',
      situacao === 'normal' && 'bg-gray-50 border-transparent'
    )}>
      <div className="flex items-center gap-1.5 min-w-0">
        {ehCapitao && <Crown className="w-3.5 h-3.5 text-tertiary shrink-0" aria-label="capitão" />}
        <span className="text-sm font-semibold text-on-surface truncate flex-1 min-w-0">{jogador.nome}</span>
        {situacao === 'prioridade' && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container shrink-0">vez dele(a)</span>}
        {situacao === 'adiantado' && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 shrink-0">já jogou mais</span>}
        {!ehCapitao && (
          <button type="button" onClick={onRemover} aria-label={`Tirar ${jogador.nome} do time`} className="p-1 text-gray-300 hover:text-error shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <ContadorVezes jogador={jogador} onDefinir={onDefinir} onAjustar={onAjustar} />
    </div>
  );
};

export function RodizioCards({ chave, alunos, presentesIds, loading }: Props) {
  const cards = useCardsRodizio(chave);
  const [soPresentes, setSoPresentes] = useState(false);
  const temChamada = !!presentesIds && presentesIds.size > 0;

  const lista = useMemo(
    () => (soPresentes && presentesIds ? alunos.filter(a => presentesIds.has(a.id)) : alunos),
    [alunos, presentesIds, soPresentes]
  );
  const idsNosCards = useMemo(() => new Set(cards.times.flatMap(t => t.jogadores.map(j => j.alunoId))), [cards.times]);
  const disponiveis = useMemo(() => lista.filter(a => !idsNosCards.has(a.id)), [lista, idsNosCards]);
  const resumo = useMemo(() => resumoEquilibrio(cards.times), [cards.times]);

  const situacaoDe = (alunoId: string): Situacao =>
    resumo.prioridade.has(alunoId) ? 'prioridade' : resumo.adiantados.has(alunoId) ? 'adiantado' : 'normal';

  const nomesPrioridade = cards.times.flatMap(t => t.jogadores).filter(j => resumo.prioridade.has(j.alunoId)).map(j => j.nome.split(/\s+/)[0]);

  const confirmar = (texto: string, acao: () => void) => { if (window.confirm(texto)) acao(); };

  if (loading) {
    return (
      <div className="flex gap-2 items-center justify-center p-8 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>Carregando alunos...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-2">
        <label className="text-xs font-semibold text-gray-500 block">1. ESCOLHA OS CAPITÃES (um card por capitão)</label>
        <select
          value=""
          onChange={e => {
            const aluno = alunos.find(a => a.id === e.target.value);
            if (aluno) cards.adicionarCapitao({ id: aluno.id, nome: aluno.nome });
          }}
          className="w-full bg-gray-50 border border-dashed border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-600 outline-none focus:border-primary"
        >
          <option value="" disabled>+ Selecionar capitão / capitã</option>
          {disponiveis.map(a => <option key={a.id} value={a.id}>{rotuloAluno(a)}</option>)}
        </select>
        <p className="text-[11px] text-gray-400">
          Mostra todos os alunos da turma, sem precisar da chamada. Os cards ficam guardados neste aparelho até o fim do dia.
        </p>
        {temChamada && (
          <label className="flex items-center gap-2 text-xs text-gray-600 font-medium">
            <input type="checkbox" checked={soPresentes} onChange={e => setSoPresentes(e.target.checked)} className="accent-primary" />
            Mostrar só quem está presente hoje na chamada ({presentesIds?.size})
          </label>
        )}
      </div>

      {alunos.length === 0 && (
        <div className="text-center text-gray-500 py-6 font-medium px-4">Nenhum aluno encontrado nessas turmas.</div>
      )}

      {resumo.jogadores > 0 && (
        <div className={cn(
          'rounded-2xl border px-4 py-3 text-sm',
          resumo.maximo > 0 && resumo.diferenca === 0 ? 'bg-secondary-container/40 border-secondary/30' : 'bg-white border-gray-100 shadow-sm'
        )}>
          <div className="flex items-center gap-2 font-bold text-on-surface">
            <Users className="w-4 h-4 text-primary shrink-0" />
            {resumo.maximo === 0
              ? 'Ninguém jogou ainda'
              : resumo.diferenca === 0
                ? `Todos jogaram ${resumo.maximo}× — participação equilibrada`
                : `Quem menos jogou: ${resumo.minimo}× · quem mais jogou: ${resumo.maximo}×`}
          </div>
          {resumo.diferenca > 0 && (
            <div className="text-xs text-gray-600 mt-1">
              Vez de: <span className="font-semibold text-on-surface">{nomesPrioridade.slice(0, 8).join(', ')}{nomesPrioridade.length > 8 ? ` e mais ${nomesPrioridade.length - 8}` : ''}</span>
            </div>
          )}
        </div>
      )}

      {cards.times.length > 0 && (
        <>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={cards.desfazer} disabled={!cards.podeDesfazer}
              className="flex items-center gap-1.5 px-3 h-9 rounded-xl bg-white border border-gray-200 text-xs font-bold text-gray-600 disabled:opacity-40 active:scale-95">
              <Undo2 className="w-3.5 h-3.5" /> Desfazer
            </button>
            <button type="button" onClick={() => confirmar('Zerar os contadores de todos os alunos? Os cards e jogadores continuam.', cards.zerarContadores)}
              className="flex items-center gap-1.5 px-3 h-9 rounded-xl bg-white border border-gray-200 text-xs font-bold text-gray-600 active:scale-95">
              <RotateCcw className="w-3.5 h-3.5" /> Zerar contadores
            </button>
            <button type="button" onClick={() => confirmar('Apagar todos os cards e contadores de hoje?', cards.apagarTudo)}
              className="flex items-center gap-1.5 px-3 h-9 rounded-xl bg-white border border-gray-200 text-xs font-bold text-error active:scale-95 ml-auto">
              <Trash2 className="w-3.5 h-3.5" /> Apagar cards
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {cards.times.map((time: TimeCard, idx) => (
              <div key={time.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3.5 flex flex-col gap-2.5" data-testid="card-time">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-400 w-5 shrink-0">{idx + 1}º</span>
                  <input
                    value={time.nome}
                    onChange={e => cards.renomearTime(time.id, e.target.value)}
                    aria-label="Nome do time"
                    className="font-bold text-on-surface text-sm bg-transparent outline-none flex-1 min-w-0 border-b border-dashed border-gray-300 focus:border-primary focus:border-solid pb-0.5"
                  />
                  <button type="button" aria-label={`Remover o card ${time.nome}`}
                    onClick={() => confirmar(`Remover o card "${time.nome}"? Os jogadores voltam para a lista de alunos sem time.`, () => cards.removerTime(time.id))}
                    className="p-1 text-gray-300 hover:text-error shrink-0">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2 text-[11px] text-gray-500 px-0.5">
                  <span>{time.jogadores.length} jogador{time.jogadores.length !== 1 ? 'es' : ''} · média {mediaDoTime(time)}× · total {totalDoTime(time)}</span>
                  <button type="button" onClick={() => cards.somarUmParaTodos(time.id)}
                    className="px-2 py-1 rounded-lg bg-primary/10 text-primary font-bold active:scale-95">
                    Time jogou (+1 em todos)
                  </button>
                </div>

                <div className="flex flex-col gap-1.5">
                  {time.jogadores.map(j => (
                    <LinhaJogador
                      key={j.alunoId}
                      jogador={j}
                      ehCapitao={j.alunoId === time.capitaoAlunoId}
                      situacao={situacaoDe(j.alunoId)}
                      onDefinir={v => cards.definirVezes(time.id, j.alunoId, v)}
                      onAjustar={d => cards.ajustarVezes(time.id, j.alunoId, d)}
                      onRemover={() => cards.removerJogador(time.id, j.alunoId)}
                    />
                  ))}
                </div>

                <select
                  value=""
                  onChange={e => {
                    const aluno = alunos.find(a => a.id === e.target.value);
                    if (aluno) cards.adicionarJogador(time.id, { id: aluno.id, nome: aluno.nome });
                  }}
                  aria-label={`Adicionar jogador ao ${time.nome}`}
                  className="w-full bg-gray-50 border border-dashed border-gray-300 rounded-xl px-3 py-1.5 text-xs text-gray-500 outline-none focus:border-primary"
                >
                  <option value="" disabled>+ Adicionar jogador</option>
                  {disponiveis.map(a => <option key={a.id} value={a.id}>{rotuloAluno(a)}</option>)}
                </select>
              </div>
            ))}
          </div>

          {disponiveis.length > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3">
              <div className="text-xs font-bold text-gray-500">{disponiveis.length} aluno{disponiveis.length !== 1 ? 's' : ''} sem time</div>
              <div className="text-xs text-gray-400 mt-0.5">{disponiveis.map(a => a.nome).join(', ')}</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
