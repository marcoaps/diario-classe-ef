import React, { useMemo, useState } from 'react';
import { Check, Crown, Flag, Loader2, Minus, Plus, RotateCcw, Trash2, Undo2, Users, X } from 'lucide-react';
import { cn } from '../../AppLayout';
import type { AlunoSupabase } from '../../../domain/useAlunosPresentesHoje';
import { useCardsRodizio } from '../../../domain/useCardsRodizio';
import { mediaDoTime, nomeDoCapitao, proximosConfrontos, resumoEquilibrio, resumoJogos, totalDoTime, type Confronto, type JogadorCard, type JogoRealizado, type TimeCard } from '../../../domain/rodizioCardsLogica';

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

const nJogos = (n: number) => `${n} ${n === 1 ? 'jogo' : 'jogos'}`;

function rotuloAluno(a: AlunoSupabase) {
  return `${a.turma_id} ${a.numero_chamada ? `${a.numero_chamada} · ` : '· '}${a.nome}`;
}

// Quatro "checks" para marcar rápido (toque no 3º = 3 vezes; toque de novo no último = tira um)
// e +/- para passar de 4. O número ao lado é sempre o total.
function ContadorVezes({ jogador, onDefinir, onAjustar }: { jogador: JogadorCard; onDefinir: (v: number) => void; onAjustar: (d: number) => void }) {
  const { vezes, nome } = jogador;
  // Dois grupos: os 4 checks e o "− 3× +". Num card largo ficam lado a lado; num card estreito
  // (várias colunas) o segundo grupo desce para a linha de baixo — nada pode passar da borda.
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
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
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onAjustar(-1)}
          disabled={vezes === 0}
          aria-label={`Tirar uma vez de ${nome}`}
          className="h-9 w-9 rounded-xl bg-white border border-gray-200 text-gray-500 flex items-center justify-center active:scale-95 disabled:opacity-30"
        >
          <Minus className="w-4 h-4" />
        </button>
        <span className="min-w-[2rem] text-center text-base font-bold tabular-nums text-on-surface" aria-label={`${vezes} vezes`}>{vezes}×</span>
        <button
          type="button"
          onClick={() => onAjustar(1)}
          aria-label={`Marcar mais uma vez para ${nome}`}
          className="h-9 w-9 rounded-xl bg-primary text-white flex items-center justify-center active:scale-95"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
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

interface PropsPainelConfrontos {
  times: TimeCard[];
  proximos: Confronto[];
  realizados: JogoRealizado[];
  onRegistrar: (aId: string, bId: string) => void;
  onTrocar: (aId: string, bId: string) => void;
  onAutomatico: () => void;
}

// Jogo atual, próximos jogos e jogos já feitos. O app sugere sempre os dois times que jogaram
// MENOS (sem repetir confronto nem colocar quem acabou de jogar); o professor pode trocar à mão.
const PainelConfrontos: React.FC<PropsPainelConfrontos> = ({ times, proximos, realizados, onRegistrar, onTrocar, onAutomatico }) => {
  const [trocando, setTrocando] = useState(false);
  const atual = proximos[0];
  if (!atual) return null;

  const porId = new Map<string, TimeCard>(times.map((t): [string, TimeCard] => [t.id, t]));
  const nome = (id: string) => porId.get(id)?.nome ?? '—';
  const jogosDe = (id: string) => porId.get(id)?.jogos ?? 0;
  const esperando = times.filter(t => t.id !== atual.aId && t.id !== atual.bId);
  const seguintes = proximos.slice(1);

  // Escolher num seletor o time que está do outro lado troca os dois de lugar.
  const escolher = (lado: 'a' | 'b', id: string) => {
    if (lado === 'a') onTrocar(id, id === atual.bId ? atual.aId : atual.bId);
    else onTrocar(id === atual.aId ? atual.bId : atual.aId, id);
  };
  const classeSeletor = 'w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold text-on-surface outline-none focus:border-primary';

  return (
    <div data-testid="painel-confrontos" className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap text-xs font-bold text-gray-400 tracking-wide">
        <Flag className="w-3.5 h-3.5 shrink-0" /> JOGO ATUAL · JOGO {atual.numero}
        {atual.manual && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-tertiary-container text-on-tertiary-container">escolhido por você</span>
        )}
      </div>

      <div data-testid="jogo-atual" className="flex items-center justify-center gap-3 flex-wrap text-center">
        <span className="text-lg font-bold text-on-surface">{nome(atual.aId)}</span>
        <span className="text-gray-300 font-bold">×</span>
        <span className="text-lg font-bold text-on-surface">{nome(atual.bId)}</span>
      </div>

      <div className="text-[11px] text-gray-500 text-center">
        Jogos até agora: {jogosDe(atual.aId)} × {jogosDe(atual.bId)}
        {esperando.length > 0 && <> · Esperando: {esperando.map(t => t.nome).join(', ')}</>}
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" data-testid="registrar-jogo" onClick={() => onRegistrar(atual.aId, atual.bId)}
          className="flex-1 min-w-[180px] h-11 rounded-xl bg-primary text-white font-bold text-sm active:scale-95 flex items-center justify-center gap-2">
          <Check className="w-4 h-4" /> Registrar jogo
        </button>
        <button type="button" onClick={() => setTrocando(v => !v)}
          className="h-11 px-3 rounded-xl bg-white border border-gray-200 text-xs font-bold text-gray-600 active:scale-95">
          {trocando ? 'Fechar' : 'Trocar confronto'}
        </button>
      </div>
      <p className="text-[11px] text-gray-400 -mt-1">
        "Registrar jogo" soma 1 jogo para os dois times e 1 vez para todos os jogadores deles — não precisa apertar "Time jogou" nos cards.
      </p>

      {trocando && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-gray-50 rounded-xl p-3">
          <label className="text-[11px] font-semibold text-gray-500 flex flex-col gap-1">
            Time A
            <select value={atual.aId} onChange={e => escolher('a', e.target.value)} aria-label="Time A do confronto" className={classeSeletor}>
              {times.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </label>
          <label className="text-[11px] font-semibold text-gray-500 flex flex-col gap-1">
            Time B
            <select value={atual.bId} onChange={e => escolher('b', e.target.value)} aria-label="Time B do confronto" className={classeSeletor}>
              {times.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </label>
          {atual.manual && (
            <button type="button" onClick={onAutomatico}
              className="sm:col-span-2 h-9 rounded-lg bg-white border border-gray-200 text-xs font-bold text-primary active:scale-95">
              Voltar à sugestão automática
            </button>
          )}
        </div>
      )}

      {seguintes.length > 0 && (
        <div data-testid="proximos-jogos">
          <div className="text-xs font-bold text-gray-400 tracking-wide mb-1">PRÓXIMOS JOGOS</div>
          <ol className="flex flex-col gap-1">
            {seguintes.map(c => (
              <li key={c.numero} className="flex items-baseline gap-2 text-sm">
                <span className="text-[11px] font-bold text-gray-400 w-14 shrink-0">Jogo {c.numero}</span>
                <span className="font-semibold text-on-surface">{nome(c.aId)} × {nome(c.bId)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {realizados.length > 0 && (
        <details data-testid="jogos-realizados" className="text-sm">
          <summary className="cursor-pointer text-xs font-bold text-primary">Jogos realizados ({realizados.length})</summary>
          <ul className="flex flex-col gap-1 mt-2">
            {[...realizados].reverse().map(j => (
              <li key={j.numero} className="flex items-baseline gap-2">
                <span className="text-[11px] font-bold text-gray-400 w-14 shrink-0">Jogo {j.numero}</span>
                <span className="text-on-surface">{nome(j.aId)} × {nome(j.bId)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
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
  const jogos = useMemo(() => resumoJogos(cards.times), [cards.times]);
  const proximos = useMemo(() => proximosConfrontos(cards.estado, 5), [cards.estado]);

  const situacaoDe = (alunoId: string): Situacao =>
    resumo.prioridade.has(alunoId) ? 'prioridade' : resumo.adiantados.has(alunoId) ? 'adiantado' : 'normal';

  const nomesPrioridade = cards.times.flatMap(t => t.jogadores).filter(j => resumo.prioridade.has(j.alunoId)).map(j => j.nome.split(/\s+/)[0]);

  const confirmar = (texto: string, acao: () => void) => { if (window.confirm(texto)) acao(); };

  // Aviso do topo: quantos jogos cada capitão já fez e de quem é a vez (quem fez menos).
  const capitaesComMais = jogos.diferenca > 0 ? cards.times.filter(t => t.jogos === jogos.maximo) : [];
  const mensagemJogos = jogos.totalJogos === 0
    ? 'Nenhum jogo registrado ainda. Toque em "Time jogou" no card quando o time entrar em quadra.'
    : jogos.diferenca === 0
      ? `Todos os capitães fizeram ${nJogos(jogos.maximo)} — jogos equilibrados.`
      : `Vez de: ${jogos.comMenos.map(nomeDoCapitao).join(', ')} (${nJogos(jogos.minimo)}). ` +
        `Mais jogos: ${capitaesComMais.map(nomeDoCapitao).join(', ')} (${nJogos(jogos.maximo)}).` +
        (jogos.diferenca >= 2 ? ` Diferença de ${nJogos(jogos.diferenca)} — coloque quem jogou menos em quadra.` : '');

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

      {cards.times.length === 1 && (
        <p className="text-xs text-gray-500 text-center px-2">Crie pelo menos 2 cards para o app sugerir os confrontos e os próximos jogos.</p>
      )}

      {cards.times.length >= 2 && (
        <PainelConfrontos
          times={cards.times}
          proximos={proximos}
          realizados={cards.jogosRealizados}
          onRegistrar={cards.registrarJogo}
          onTrocar={cards.definirConfrontoManual}
          onAutomatico={cards.limparConfrontoManual}
        />
      )}

      {cards.times.length > 0 && (
        <div
          role="status"
          data-testid="aviso-jogos"
          className={cn('rounded-2xl border px-4 py-3', jogos.diferenca >= 2 ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-100 shadow-sm')}
        >
          <div className="flex items-center gap-2 text-sm font-bold text-on-surface">
            <Flag className="w-4 h-4 text-primary shrink-0" /> Jogos de cada capitão
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {cards.times.map(t => (
              <span key={t.id} className={cn(
                'text-xs font-semibold px-2.5 py-1 rounded-full',
                jogos.diferenca > 0 && t.jogos === jogos.minimo ? 'bg-secondary-container text-on-secondary-container' : 'bg-gray-100 text-gray-700'
              )}>
                {nomeDoCapitao(t)}: {nJogos(t.jogos)}
              </span>
            ))}
          </div>
          <p className="text-xs text-gray-600 mt-2">{mensagemJogos}</p>
        </div>
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
            <button type="button" onClick={() => confirmar('Zerar os contadores de todos os alunos e apagar os jogos registrados? Os cards e jogadores continuam.', cards.zerarContadores)}
              className="flex items-center gap-1.5 px-3 h-9 rounded-xl bg-white border border-gray-200 text-xs font-bold text-gray-600 active:scale-95">
              <RotateCcw className="w-3.5 h-3.5" /> Zerar contadores
            </button>
            <button type="button" onClick={() => confirmar('Apagar todos os cards e contadores de hoje?', cards.apagarTudo)}
              className="flex items-center gap-1.5 px-3 h-9 rounded-xl bg-white border border-gray-200 text-xs font-bold text-error active:scale-95 ml-auto">
              <Trash2 className="w-3.5 h-3.5" /> Apagar cards
            </button>
          </div>

          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 330px), 1fr))' }}>
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

                <div className="text-[11px] text-gray-500 px-0.5">
                  {time.jogadores.length} jogador{time.jogadores.length !== 1 ? 'es' : ''} · média {mediaDoTime(time)}× · total {totalDoTime(time)}
                </div>

                <div className="flex items-center justify-between gap-2 flex-wrap px-0.5">
                  <div className="flex items-center gap-1.5" data-testid="jogos-do-time">
                    <span className="text-xs font-bold text-gray-500">Jogos</span>
                    <button type="button" onClick={() => cards.ajustarJogos(time.id, -1)} disabled={time.jogos === 0}
                      aria-label={`Tirar um jogo do ${time.nome}`}
                      className="h-8 w-8 rounded-lg bg-white border border-gray-200 text-gray-500 flex items-center justify-center active:scale-95 disabled:opacity-30">
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="min-w-[1.5rem] text-center text-base font-bold tabular-nums text-on-surface" aria-label={`${nJogos(time.jogos)} do ${time.nome}`}>{time.jogos}</span>
                    <button type="button" onClick={() => cards.ajustarJogos(time.id, 1)}
                      aria-label={`Registrar mais um jogo do ${time.nome}`}
                      className="h-8 w-8 rounded-lg bg-white border border-gray-200 text-primary flex items-center justify-center active:scale-95">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button type="button" onClick={() => cards.somarUmParaTodos(time.id)}
                    title="Soma 1 jogo do time e 1 vez em todos os jogadores do card"
                    className="px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary text-[11px] font-bold active:scale-95">
                    Time jogou (+1 jogo)
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
