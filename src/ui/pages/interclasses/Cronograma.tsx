import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw, CalendarClock } from 'lucide-react';
import { cn } from '../../AppLayout';
import { buscarCampeonatosComJogos } from '../../../data/supabase';
import { ADAPTERS, type Resultado } from '../../../domain/interclassesCampeonato';
import type { Modalidade } from '../../../domain/interclasses';
import { corDaEquipe } from './Confrontos';

const EDICAO = '2026';
const SLOT_STORAGE_KEY = 'interclasses_cronograma_slot_min';
const SLOT_PADRAO_MIN = 28; // 2 tempos de 10 + 3 de intervalo + 5 de troca de times

// Janelas em que a quadra está livre (uma quadra só). Os jogos "normais"
// ocupam as janelas em ordem; as finais por faixa ficam na janela do sábado.
interface Periodo { dia: string; rotulo: string; ini: string; fim: string; soFinais?: boolean }
export const PERIODOS: Periodo[] = [
  { dia: 'Terça 20/10', rotulo: 'Tarde', ini: '13:00', fim: '17:00' },
  { dia: 'Quarta 21/10', rotulo: 'Manhã', ini: '07:00', fim: '11:00' },
  { dia: 'Quarta 21/10', rotulo: 'Tarde', ini: '13:00', fim: '17:00' },
  { dia: 'Quinta 22/10', rotulo: 'Manhã', ini: '07:00', fim: '11:00' },
  { dia: 'Quinta 22/10', rotulo: 'Tarde', ini: '13:00', fim: '17:00' },
  { dia: 'Sexta 23/10', rotulo: 'Manhã', ini: '07:00', fim: '11:00' },
  { dia: 'Sexta 23/10', rotulo: 'Tarde', ini: '13:00', fim: '17:00' },
  { dia: 'Sábado 24/10', rotulo: 'Finais', ini: '07:00', fim: '11:00', soFinais: true },
];

const paraMin = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const paraHHMM = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

export interface JogoCronograma {
  id: string;
  categoria: string;   // "6º ano" ou "Final 6º ano × 7º ano"
  genero: 'M' | 'F';
  fase: string;
  rodada: number;
  equipeA: string | null;
  equipeB: string | null;
  jogado: boolean;
  resultado: Resultado | null;
  ehFinal: boolean;
  periodo?: Periodo;
  horario?: string;
}

// Fila única: rodada por rodada, alternando os anos (começando pelos de chave
// mais longa) pra reduzir a chance do mesmo time jogar duas partidas seguidas.
const ORDEM_ANO: Record<string, number> = { '6º ano': 0, '9º ano': 1, '7º ano': 2, '8º ano': 3 };

export function montarCronograma(
  dados: Awaited<ReturnType<typeof buscarCampeonatosComJogos>>, slotMin: number
): { jogos: JogoCronograma[]; semHorario: JogoCronograma[] } {
  const todos: JogoCronograma[] = [];
  dados.forEach(({ campeonato, jogos }) => {
    const [categoria, generoTxt] = campeonato.categoria.split(' · ');
    const genero = generoTxt === 'Feminino' ? 'F' : 'M';
    jogos.filter(j => !j.is_bye).forEach(j => todos.push({
      id: j.id, categoria, genero, fase: j.fase, rodada: j.rodada,
      equipeA: j.equipe_a, equipeB: j.equipe_b, jogado: j.jogado,
      resultado: (j.resultado as Resultado | null) ?? null,
      ehFinal: categoria.startsWith('Final'),
    }));
  });

  const normais = todos.filter(j => !j.ehFinal).sort((a, b) =>
    a.rodada - b.rodada ||
    (ORDEM_ANO[a.categoria] ?? 9) - (ORDEM_ANO[b.categoria] ?? 9) ||
    (a.genero === b.genero ? 0 : a.genero === 'M' ? -1 : 1));
  const finais = todos.filter(j => j.ehFinal).sort((a, b) => a.categoria.localeCompare(b.categoria, 'pt-BR'));

  const slotsDe = (p: Periodo) => {
    const ini = paraMin(p.ini), fim = paraMin(p.fim);
    const qtd = Math.floor((fim - ini) / slotMin);
    return Array.from({ length: qtd }, (_, k) => paraHHMM(ini + k * slotMin));
  };
  const alocar = (jogos: JogoCronograma[], periodos: Periodo[]): JogoCronograma[] => {
    const semHorario: JogoCronograma[] = [];
    const fila = periodos.flatMap(p => slotsDe(p).map(h => ({ p, h })));
    jogos.forEach((j, i) => {
      const slot = fila[i];
      if (slot) { j.periodo = slot.p; j.horario = slot.h; } else semHorario.push(j);
    });
    return semHorario;
  };
  const sem1 = alocar(normais, PERIODOS.filter(p => !p.soFinais));
  const sem2 = alocar(finais, PERIODOS.filter(p => p.soFinais));
  return { jogos: [...normais, ...finais], semHorario: [...sem1, ...sem2] };
}

export function Cronograma({ modalidade, publico = false }: { modalidade: Modalidade; publico?: boolean }) {
  const [dados, setDados] = useState<Awaited<ReturnType<typeof buscarCampeonatosComJogos>>>([]);
  const [loading, setLoading] = useState(true);
  const [slotMin, setSlotMin] = useState<number>(() => {
    try { return Number(localStorage.getItem(SLOT_STORAGE_KEY)) || SLOT_PADRAO_MIN; } catch { return SLOT_PADRAO_MIN; }
  });
  const adapter = ADAPTERS[modalidade];

  const carregar = useCallback(async () => {
    setLoading(true);
    try { setDados(await buscarCampeonatosComJogos(EDICAO, modalidade)); }
    catch (e) { console.error('Erro ao carregar o cronograma:', e); setDados([]); }
    finally { setLoading(false); }
  }, [modalidade]);
  useEffect(() => { carregar(); }, [carregar]);

  function mudarSlot(v: string) {
    const n = Math.max(5, Math.min(90, parseInt(v, 10) || SLOT_PADRAO_MIN));
    setSlotMin(n);
    try { localStorage.setItem(SLOT_STORAGE_KEY, String(n)); } catch { /* ignore */ }
  }

  const { jogos, semHorario } = useMemo(() => montarCronograma(dados, slotMin), [dados, slotMin]);
  const porPeriodo = useMemo(() => {
    const m = new Map<Periodo, JogoCronograma[]>();
    PERIODOS.forEach(p => m.set(p, []));
    jogos.forEach(j => { if (j.periodo) m.get(j.periodo)!.push(j); });
    return m;
  }, [jogos]);

  if (modalidade !== 'futsal') {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center text-sm text-gray-500">
        O cronograma é só do <strong>Futsal</strong>. As demais modalidades são amistosos, sem campeonato.
      </div>
    );
  }

  const pendentes = jogos.filter(j => !j.jogado).length;
  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-2">
          <CalendarClock className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-on-surface text-sm">Cronograma do Futsal — uma quadra</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {jogos.length} jogo{jogos.length !== 1 ? 's' : ''} · {pendentes} pendente{pendentes !== 1 ? 's' : ''}. Os jogos entram na fila rodada por rodada, alternando os anos.
              Os horários mudam conforme os campeonatos andam (ex.: uma decisão extra empurra os jogos seguintes).
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!publico && <label className="text-xs text-gray-600 flex items-center gap-1.5">
            Minutos por jogo
            <input
              type="number" min={5} max={90} value={slotMin} onChange={e => mudarSlot(e.target.value)}
              className="w-16 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-xs outline-none focus:border-primary"
              title="2 tempos de 10 + 3 de intervalo + 5 de troca = 28"
            />
          </label>}
          <button onClick={carregar} disabled={loading} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-primary font-medium disabled:opacity-40">
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} /> Atualizar
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex gap-2 items-center justify-center py-10 text-gray-500 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Carregando...</div>
      ) : jogos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center text-sm text-gray-500">
          Nenhum campeonato de Futsal iniciado ainda. {publico ? 'Os jogos aparecem aqui assim que os campeonatos começarem.' : 'Inicie os campeonatos na aba Torneios/Confrontos e os jogos aparecem aqui.'}
        </div>
      ) : (
        <>
          {!publico && semHorario.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-xs text-red-700">
              <strong>{semHorario.length} jogo{semHorario.length !== 1 ? 's' : ''} não cabe{semHorario.length !== 1 ? 'm' : ''} na janela da quadra</strong> (terça à tarde até sexta, e sábado só para as finais).
              Reduza os minutos por jogo ou abra mais horários.
            </div>
          )}
          {PERIODOS.map(p => {
            const lista = porPeriodo.get(p) ?? [];
            if (lista.length === 0) return null;
            return (
              <div key={`${p.dia}-${p.rotulo}`} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-700">{p.dia} · {p.rotulo}</span>
                  <span className="text-[11px] text-gray-400">{p.ini}–{p.fim} · {lista.length} jogo{lista.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {lista.map(j => <LinhaJogo key={j.id} j={j} adapter={adapter} />)}
                </div>
              </div>
            );
          })}
          {semHorario.length > 0 && (
            <div className="bg-white rounded-2xl border border-red-200 shadow-sm overflow-hidden">
              <div className="px-4 py-2 bg-red-50 border-b border-red-100 text-sm font-bold text-red-700">Sem horário</div>
              <div className="divide-y divide-gray-50">{semHorario.map(j => <LinhaJogo key={j.id} j={j} adapter={adapter} />)}</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function LinhaJogo({ j, adapter }: { j: JogoCronograma; adapter: typeof ADAPTERS[Modalidade] }) {
  const time = (n: string | null) => n
    ? <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: corDaEquipe(n) }} />{n}</span>
    : <span className="text-gray-400">a definir</span>;
  return (
    <div className={cn('flex items-center gap-3 px-4 py-2.5 text-sm', j.jogado && 'bg-gray-50/60')}>
      <span className="font-mono text-xs text-primary w-12 flex-shrink-0">{j.horario ?? '—'}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap text-on-surface">
          {time(j.equipeA)} <span className="text-gray-400 text-xs">×</span> {time(j.equipeB)}
        </div>
        <div className="text-[11px] text-gray-400 mt-0.5">
          {j.categoria} · {j.genero === 'F' ? 'Feminino' : 'Masculino'} · {j.fase}
        </div>
      </div>
      {j.jogado && j.resultado
        ? <span className="text-xs font-bold text-secondary flex-shrink-0">{adapter.formatarPlacar(j.resultado)}</span>
        : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 flex-shrink-0">pendente</span>}
    </div>
  );
}
