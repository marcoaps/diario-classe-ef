import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Undo2, Play, Pause, Cloud, CloudOff } from 'lucide-react';
import { cn } from '../../AppLayout';
import { corDaEquipe } from './Confrontos';
import {
  PERIODOS, REGRAS_SUMULA, sumulaVazia, segundosDoRelogio, formatarTempo, placar, faltasNoPeriodo, temposNoPeriodo,
  cartoesDoJogador, golsDoJogador, adicionarEvento, desfazerUltimo, removerEvento, iniciarRelogio, pausarRelogio,
  mudarPeriodo, ajustarRelogio, minutosPorTempo, fecharPlacar, nomeDoTipo, anotarCobranca, desfazerCobranca, convertidos, vencedorPenaltis,
  type Sumula, type Lado, type TipoEvento, type Periodo,
} from '../../../domain/sumulaFutsal';
import * as armazenamentoInterclasses from '../../../data/filaSumula';

// Só os campos que a súmula realmente usa — qualquer inscrição (Interclasses,
// ou a escalação montada na hora pelo Rodízio) serve, desde que tenha isso.
export interface JogadorSumula {
  id: string;
  nome_time: string;
  numero_camisa: number;
  nome_completo: string;
}

// Permite trocar onde a súmula é salva/sincronizada (Interclasses usa sua
// tabela de jogos já existentes; o Rodízio usa a própria, ver
// data/filaSumulaRodizio.ts) sem duplicar toda a tela.
export interface ArmazenamentoSumula {
  lerSumulaLocal(jogoId: string): Promise<Sumula | null>;
  lerSumulaRemota(jogoId: string): Promise<Sumula | null>;
  salvarSumulaLocal(s: Sumula): Promise<void>;
  sincronizarSumulas(): Promise<{ enviadas: number; restantes: number; erro?: string }>;
  totalSumulasPendentes(): Promise<number>;
  aoMudarSumulas(cb: () => void): () => void;
}

interface Props {
  jogoId: string;
  equipeA: string;
  equipeB: string;
  fase: string;
  categoria: string; // ex.: "8º ano · Masculino" — define o tempo de cada período
  eliminatorio: boolean;
  jogado: boolean;
  inscricoes: JogadorSumula[];
  // Lança o placar pelo fluxo normal do Confrontos (chave, campeão, etc.).
  onEncerrar: (golsA: number, golsB: number) => Promise<void>;
  onFechar: () => void;
  // Por padrão, o armazenamento do Interclasses — o Rodízio injeta o seu.
  armazenamento?: ArmazenamentoSumula;
}

const ACOES: { tipo: TipoEvento; rotulo: string; emoji: string; cor: string }[] = [
  { tipo: 'gol', rotulo: 'Gol', emoji: '⚽', cor: 'bg-green-600 text-white' },
  { tipo: 'falta', rotulo: 'Falta', emoji: '🛑', cor: 'bg-gray-700 text-white' },
  { tipo: 'amarelo', rotulo: 'Amarelo', emoji: '🟨', cor: 'bg-yellow-400 text-gray-900' },
  { tipo: 'vermelho', rotulo: 'Vermelho', emoji: '🟥', cor: 'bg-red-600 text-white' },
  { tipo: 'gol_contra', rotulo: 'Gol contra', emoji: '↩️', cor: 'bg-gray-200 text-gray-800' },
];

export function SumulaVirtual({ jogoId, equipeA, equipeB, fase, categoria, eliminatorio, jogado, inscricoes, onEncerrar, onFechar, armazenamento = armazenamentoInterclasses }: Props) {
  const arm = armazenamento;
  const [s, setS] = useState<Sumula | null>(null);
  const [, forcar] = useState(0);
  const [alvo, setAlvo] = useState<{ lado: Lado; camisa: number; nome: string } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [pend, setPend] = useState(0);
  const carregado = useRef(false);

  const nomes: Record<Lado, string> = { A: equipeA, B: equipeB };
  const jogadores = useMemo(() => {
    const de = (nome: string) => inscricoes
      .filter(i => i.nome_time === nome)
      .sort((a, b) => a.numero_camisa - b.numero_camisa);
    return { A: de(equipeA), B: de(equipeB) };
  }, [inscricoes, equipeA, equipeB]);

  // Carrega do aparelho; se este aparelho nunca viu o jogo, tenta o banco.
  useEffect(() => {
    let vivo = true;
    (async () => {
      const local = await arm.lerSumulaLocal(jogoId);
      if (!vivo) return;
      // Abre na hora (nunca espera a rede); a cópia do banco só é adotada se este
      // aparelho nunca viu o jogo e ninguém anotou nada nesse meio-tempo.
      setS(local ?? sumulaVazia(jogoId));
      carregado.current = true;
      if (!local && navigator.onLine !== false) {
        const remota = await arm.lerSumulaRemota(jogoId).catch(() => null);
        if (vivo && remota) setS(atual => (atual && atual.eventos.length === 0 && !atual.relogio.iniciadoEm ? remota : atual));
      }
    })();
    return () => { vivo = false; };
  }, [jogoId]);

  // Todo estado novo vai pro aparelho e, havendo rede + login, pro banco.
  useEffect(() => {
    if (!s || !carregado.current) return;
    arm.salvarSumulaLocal(s).then(() => { if (navigator.onLine !== false) arm.sincronizarSumulas(); });
  }, [s]);

  useEffect(() => {
    const atualizar = () => { arm.totalSumulasPendentes().then(setPend); };
    atualizar();
    return arm.aoMudarSumulas(atualizar);
  }, []);

  // Relógio: só redesenha a cada 250 ms; o tempo vem da diferença de Date.now().
  useEffect(() => {
    const t = setInterval(() => forcar(n => n + 1), 250);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 3500);
    return () => clearTimeout(t);
  }, [aviso]);

  if (!s) return <div className="fixed inset-0 z-[70] bg-white flex items-center justify-center text-gray-500 text-sm">Carregando súmula...</div>;

  const somenteLeitura = jogado || s.encerrada;
  const p = placar(s.eventos);
  const periodo = s.relogio.periodo;
  const seg = segundosDoRelogio(s.relogio);
  const limiteSeg = minutosPorTempo(categoria) * 60;
  const rodando = !!s.relogio.iniciadoEm;
  const nomePeriodo = PERIODOS.find(x => x.id === periodo)!.rotulo;

  function aplicar(fn: (x: Sumula) => Sumula) { setS(atual => (atual ? fn(atual) : atual)); }

  function anotar(tipo: TipoEvento, lado: Lado, camisa: number | null, nome: string | null) {
    if (!s) return;
    const antes = s;
    const depois = adicionarEvento(s, { tipo, lado, camisa, nome });
    if (depois === antes) return;
    setS(depois);
    let msg = `${nomeDoTipo(tipo)} — ${camisa != null ? `nº ${camisa} (${nomes[lado]})` : nomes[lado]}`;
    if (tipo === 'falta') {
      const n = faltasNoPeriodo(depois.eventos, lado, periodo);
      if (n >= REGRAS_SUMULA.faltasParaTiroLivre) msg += ` · ${n}ª falta: TIRO LIVRE para o adversário!`;
      else msg += ` · ${n}ª falta no tempo`;
    }
    if (depois.eventos.length - antes.eventos.length > 1) msg += ' · 2º amarelo = EXPULSO (time joga com 1 a menos)';
    if (tipo === 'gol') { const pl = placar(depois.eventos); msg += ` · ${pl.A} x ${pl.B}`; }
    setAviso(msg);
  }

  function pedirTempo(lado: Lado) {
    if (!s) return;
    if (temposNoPeriodo(s.eventos, lado, periodo) >= REGRAS_SUMULA.temposPorPeriodo
      && !window.confirm(`${nomes[lado]} já pediu tempo neste período. Anotar mesmo assim?`)) return;
    anotar('tempo', lado, null, null);
  }

  async function encerrar() {
    if (!s) return;
    const corrente = s;
    const f = fecharPlacar(corrente, eliminatorio);
    if (!f.lancar) return;
    setEnviando(true);
    try {
      await onEncerrar(f.lancar.golsA, f.lancar.golsB);
      setS({ ...pausarRelogio(corrente), encerrada: true, atualizadoEm: Date.now() });
      setConfirmando(false);
    } catch (e: any) {
      alert('Não consegui lançar o placar: ' + (e?.message || 'tente novamente.') + '\nA súmula continua guardada.');
    } finally {
      setEnviando(false);
    }
  }

  const fechamento = fecharPlacar(s, eliminatorio);
  const ladoEq = (lado: Lado) => (
    <div className="flex-1 min-w-0 flex flex-col gap-2">
      <div className="flex items-center gap-1.5 justify-center">
        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: corDaEquipe(nomes[lado]) }} />
        <span className="font-bold text-sm truncate">{nomes[lado]}</span>
      </div>
      <div className="grid grid-cols-2 gap-1 text-center text-[11px]">
        <FaltasBadge n={faltasNoPeriodo(s.eventos, lado, periodo)} />
        <div className="rounded-lg bg-gray-50 border border-gray-100 py-1">
          Tempo: <b>{temposNoPeriodo(s.eventos, lado, periodo)}/{REGRAS_SUMULA.temposPorPeriodo}</b>
        </div>
      </div>
      {s.eventos.some(e => e.tipo === 'vermelho' && e.lado === lado) && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-[11px] font-bold text-center py-1 px-1">
          🟥 {s.eventos.filter(e => e.tipo === 'vermelho' && e.lado === lado).length} expulso(s) — joga com a menos
        </div>
      )}
      {!somenteLeitura && (
        <div className="grid grid-cols-2 gap-1">
          <button onClick={() => anotar('falta', lado, null, null)} className="py-2 rounded-lg bg-gray-100 text-xs font-bold active:bg-gray-300">Falta s/ nº</button>
          <button onClick={() => pedirTempo(lado)} className="py-2 rounded-lg bg-blue-50 text-blue-700 text-xs font-bold active:bg-blue-200">⏱ Pedir tempo</button>
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        {jogadores[lado].length === 0 && <p className="text-[11px] text-gray-400 text-center py-2">Sem jogadores inscritos neste time.</p>}
        {jogadores[lado].map(j => {
          const c = cartoesDoJogador(s.eventos, lado, j.numero_camisa);
          const gols = golsDoJogador(s.eventos, lado, j.numero_camisa);
          return (
            <button
              key={j.id}
              disabled={somenteLeitura || c.expulso}
              onClick={() => setAlvo({ lado, camisa: j.numero_camisa, nome: j.nome_completo })}
              className={cn(
                'flex items-center gap-2 rounded-xl border px-2 py-2.5 text-left min-h-[52px] transition-colors',
                c.expulso ? 'bg-red-50 border-red-200 opacity-60' : 'bg-white border-gray-200 active:bg-primary/10',
              )}
            >
              <span className="w-9 h-9 rounded-lg bg-secondary text-white font-black text-lg flex items-center justify-center flex-shrink-0">{j.numero_camisa}</span>
              <span className="flex-1 min-w-0 text-xs font-medium leading-tight line-clamp-2">{j.nome_completo}</span>
              <span className="text-xs flex-shrink-0 flex flex-col items-end leading-tight">
                {gols > 0 && <span>⚽{gols}</span>}
                {c.amarelos > 0 && !c.expulso && <span>🟨</span>}
                {c.expulso && <span>🟥</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[70] bg-background overflow-y-auto" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-3 pt-2 pb-2 shadow-sm">
        <div className="flex items-center justify-between gap-2 mb-1">
          <button onClick={onFechar} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-xs font-bold hover:bg-gray-200 flex-shrink-0">← Voltar</button>
          <div className="text-[11px] text-gray-500 truncate flex-1 min-w-0">📋 Súmula · {fase} · {categoria}</div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={cn('text-[10px] flex items-center gap-1', pend > 0 ? 'text-amber-600' : 'text-green-600')} title={pend > 0 ? 'Há súmulas só neste aparelho' : 'Tudo enviado'}>
              {pend > 0 ? <CloudOff className="w-3.5 h-3.5" /> : <Cloud className="w-3.5 h-3.5" />}
              {pend > 0 ? 'só no aparelho' : 'salvo'}
            </span>
            {!somenteLeitura && (
              <button onClick={() => setConfirmando(true)} className="px-3 py-1.5 rounded-lg bg-secondary text-white text-xs font-bold">🏁 Encerrar</button>
            )}
            <button onClick={onFechar} aria-label="Fechar súmula" className="p-1.5 rounded-full hover:bg-gray-100"><X className="w-5 h-5" /></button>
          </div>
        </div>
        <div className="flex items-center justify-center gap-3">
          <span className="text-sm font-bold truncate max-w-[28%] text-right">{equipeA}</span>
          <span className="text-4xl font-black tabular-nums" data-testid="placar">{p.A} <span className="text-gray-300">x</span> {p.B}</span>
          <span className="text-sm font-bold truncate max-w-[28%]">{equipeB}</span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5 mt-1.5">
          <select
            value={periodo} disabled={somenteLeitura}
            onChange={e => aplicar(x => mudarPeriodo(x, e.target.value as Periodo))}
            className="text-xs font-bold bg-gray-100 rounded-lg px-2 py-2 outline-none"
          >
            {PERIODOS.map(x => <option key={x.id} value={x.id}>{x.rotulo}</option>)}
          </select>
          <span className={cn('text-2xl font-black tabular-nums', seg >= limiteSeg ? 'text-red-600' : 'text-on-surface')} data-testid="relogio">{formatarTempo(seg)}</span>
          {!somenteLeitura && (
            <>
              <button
                onClick={() => aplicar(x => (x.relogio.iniciadoEm ? pausarRelogio(x) : iniciarRelogio(x)))}
                className={cn('flex items-center gap-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white', rodando ? 'bg-amber-500' : 'bg-green-600')}
              >
                {rodando ? <><Pause className="w-4 h-4" /> Pausar</> : <><Play className="w-4 h-4" /> {seg > 0 ? 'Retomar' : 'Iniciar'}</>}
              </button>
              <button onClick={() => aplicar(x => ajustarRelogio(x, -10))} className="px-2 py-2 rounded-lg bg-gray-100 text-[11px] font-bold" title="Voltar 10 s">−10s</button>
              <button onClick={() => aplicar(x => ajustarRelogio(x, 10))} className="px-2 py-2 rounded-lg bg-gray-100 text-[11px] font-bold" title="Avançar 10 s">+10s</button>
            </>
          )}
        </div>
        <div className="text-center text-[10px] text-gray-400 mt-0.5">{nomePeriodo} · previsto {minutosPorTempo(categoria)} min</div>
        {aviso && <div className="mt-1.5 rounded-lg bg-primary text-white text-xs font-bold px-3 py-2 text-center" role="status">{aviso}</div>}
      </div>

      <div className="px-3 py-3 flex gap-2">
        {ladoEq('A')}
        {ladoEq('B')}
      </div>

      <div className="px-3 pb-4">
        <div className="flex items-center justify-between mb-1.5">
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Lance a lance ({s.eventos.length})</h4>
          {!somenteLeitura && (
            <button
              onClick={() => aplicar(x => desfazerUltimo(x))} disabled={s.eventos.length === 0}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-50 text-red-700 text-sm font-bold disabled:opacity-40 active:bg-red-200"
            >
              <Undo2 className="w-4 h-4" /> DESFAZER último
            </button>
          )}
        </div>
        <ul className="flex flex-col gap-1">
          {[...s.eventos].reverse().map(e => (
            <li key={e.id} className="flex items-center gap-2 bg-white border border-gray-100 rounded-lg px-2.5 py-1.5 text-xs">
              <span className="font-mono text-gray-400 w-[4.5rem] flex-shrink-0">{PERIODOS.find(x => x.id === e.periodo)!.curto} {formatarTempo(e.segundo)}</span>
              <span className="flex-1 min-w-0 truncate">
                <b>{ACOES.find(a => a.tipo === e.tipo)?.emoji ?? '⏱'} {nomeDoTipo(e.tipo)}</b>
                {e.camisa != null ? ` · nº ${e.camisa}${e.nome ? ` ${e.nome}` : ''}` : ''} · {nomes[e.lado]}{e.auto ? ' (automático)' : ''}
              </span>
              {!somenteLeitura && (
                <button onClick={() => aplicar(x => removerEvento(x, e.id))} className="text-gray-400 hover:text-red-600 p-1" aria-label="Remover este lance"><X className="w-4 h-4" /></button>
              )}
            </li>
          ))}
          {s.eventos.length === 0 && <li className="text-center text-gray-400 text-xs py-4">Nenhum lance anotado.</li>}
        </ul>

        {!somenteLeitura ? (
          <button onClick={() => setConfirmando(true)} className="w-full mt-4 py-3.5 rounded-xl bg-secondary text-white font-bold text-base">
            🏁 Encerrar jogo e lançar placar
          </button>
        ) : (
          <p className="text-center text-xs text-gray-500 mt-4">Jogo encerrado — súmula só para consulta. Para corrigir o placar, use “Editar placar”.</p>
        )}
      </div>

      {alvo && (
        <div className="fixed inset-0 z-[80] bg-black/40 flex items-end sm:items-center justify-center" onClick={() => setAlvo(null)}>
          <div className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl p-4" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-3">
              <div className="text-3xl font-black">nº {alvo.camisa}</div>
              <div className="text-sm text-gray-600">{alvo.nome} · {nomes[alvo.lado]}</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {ACOES.map(a => (
                <button
                  key={a.tipo}
                  onClick={() => { anotar(a.tipo, alvo.lado, alvo.camisa, alvo.nome); setAlvo(null); }}
                  className={cn('py-5 rounded-2xl text-lg font-black active:scale-95 transition-transform', a.cor, a.tipo === 'gol' && 'col-span-2')}
                >
                  {a.emoji} {a.rotulo}
                </button>
              ))}
            </div>
            <button onClick={() => setAlvo(null)} className="w-full mt-3 py-2.5 rounded-xl bg-gray-100 text-sm font-bold">Cancelar</button>
          </div>
        </div>
      )}

      {confirmando && (
        <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4" onClick={() => !enviando && setConfirmando(false)}>
          <div className="bg-white w-full max-w-sm rounded-2xl p-5" onClick={e => e.stopPropagation()}>
            <h4 className="font-bold text-center mb-1">Encerrar o jogo?</h4>
            <div className="text-center text-2xl font-black mb-3">{equipeA} {fechamento.golsA} x {fechamento.golsB} {equipeB}</div>
            {fechamento.precisaPenaltis ? (
              <>
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-2.5 mb-3">
                  Empatado em jogo eliminatório: registre a disputa de pênaltis (3 cobranças para cada time; depois, alternadas). O placar será lançado com 1 gol a mais para o vencedor, e as cobranças ficam guardadas na súmula.
                </p>
                {(['A', 'B'] as Lado[]).map(l => {
                  const cob = s.penaltis?.[l] ?? [];
                  return (
                    <div key={l} className="mb-2.5">
                      <div className="flex items-center justify-between text-sm font-bold mb-1">
                        <span className="truncate">{nomes[l]}</span><span>{convertidos(cob)} / {cob.length}</span>
                      </div>
                      <div className="flex items-center gap-1 mb-1.5 min-h-[1.5rem] flex-wrap">
                        {cob.map((c, i) => <span key={i} className={cn('w-6 h-6 rounded-full text-xs font-black flex items-center justify-center text-white', c ? 'bg-green-600' : 'bg-red-500')}>{c ? '✓' : '✗'}</span>)}
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        <button onClick={() => aplicar(x => anotarCobranca(x, l, true))} className="py-2.5 rounded-xl bg-green-600 text-white text-sm font-bold">⚽ Gol</button>
                        <button onClick={() => aplicar(x => anotarCobranca(x, l, false))} className="py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold">✗ Perdeu</button>
                        <button onClick={() => aplicar(x => desfazerCobranca(x, l))} disabled={cob.length === 0} className="py-2.5 rounded-xl bg-gray-100 text-sm font-bold disabled:opacity-40">↩ Desfazer</button>
                      </div>
                    </div>
                  );
                })}
                <button disabled={enviando || !vencedorPenaltis(s.penaltis)} onClick={() => encerrar()} className="w-full py-3 rounded-xl bg-primary text-white font-bold disabled:opacity-40">
                  {vencedorPenaltis(s.penaltis) ? `${nomes[vencedorPenaltis(s.penaltis)!]} venceu — lançar placar` : 'Disputa ainda sem vencedor'}
                </button>
              </>
            ) : (
              <button disabled={enviando} onClick={() => encerrar()} className="w-full py-3 rounded-xl bg-primary text-white font-bold disabled:opacity-50">
                {enviando ? 'Lançando...' : 'Confirmar e lançar placar'}
              </button>
            )}
            <button disabled={enviando} onClick={() => setConfirmando(false)} className="w-full mt-2 py-2.5 rounded-xl bg-gray-100 text-sm font-bold">Voltar à súmula</button>
          </div>
        </div>
      )}
    </div>
  );
}

function FaltasBadge({ n }: { n: number }) {
  const limite = REGRAS_SUMULA.faltasParaTiroLivre;
  const alerta = n >= limite;
  const quase = n === limite - 1;
  return (
    <div className={cn('rounded-lg border py-1', alerta ? 'bg-red-600 text-white border-red-600 font-bold' : quase ? 'bg-amber-100 border-amber-300 text-amber-800' : 'bg-gray-50 border-gray-100')}>
      {alerta ? <>Faltas: <b>{n}</b> · TIRO LIVRE</> : <>Faltas: <b>{n}</b>{quase ? ' · próxima = livre' : ''}</>}
    </div>
  );
}
