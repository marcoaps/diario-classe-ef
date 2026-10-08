import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { LayoutGrid, ClipboardPlus, Users2, Trophy, ShieldAlert, CalendarClock } from 'lucide-react';
import { cn } from '../AppLayout';
import { buscarInscricoesInterclasses, buscarTurmasDisponiveis, buscarElegibilidadeInterclasses } from '../../data/supabase';
import type { ElegibilidadeInterclasses } from '../../data/supabase';
import { EDICAO_PADRAO, unirTurmas, MODALIDADES, normalizarNomeTime } from '../../domain/interclasses';
import type { InscricaoInterclasses, Modalidade } from '../../domain/interclasses';
import { VisaoGeral } from './interclasses/VisaoGeral';
import { InscricaoAlunos } from './interclasses/InscricaoAlunos';
import { Equipes } from './interclasses/Equipes';
import { Confrontos } from './interclasses/Confrontos';
import { AlunosSugeridosCorte } from './interclasses/AlunosSugeridosCorte';
import { Cronograma } from './interclasses/Cronograma';

const EDICAO_ATUAL = EDICAO_PADRAO;
const MODALIDADE_STORAGE_KEY = 'interclasses_modalidade_ativa';

type SubTab = 'visao' | 'inscricao' | 'equipes' | 'confrontos' | 'cronograma' | 'corte';

const SUB_TABS: { id: SubTab; label: string; icon: ReactNode }[] = [
  { id: 'visao', label: 'Visão Geral', icon: <LayoutGrid className="w-4 h-4" /> },
  { id: 'inscricao', label: 'Inscrição de Alunos', icon: <ClipboardPlus className="w-4 h-4" /> },
  { id: 'equipes', label: 'Equipes', icon: <Users2 className="w-4 h-4" /> },
  { id: 'confrontos', label: 'Torneios/Confrontos', icon: <Trophy className="w-4 h-4" /> },
  { id: 'cronograma', label: 'Cronograma', icon: <CalendarClock className="w-4 h-4" /> },
  { id: 'corte', label: 'Sugeridos p/ Corte', icon: <ShieldAlert className="w-4 h-4" /> },
];

export default function InterclassesIOP() {
  const [tab, setTab] = useState<SubTab>('inscricao');
  const [modalidade, setModalidade] = useState<Modalidade>(() => {
    try { return (localStorage.getItem(MODALIDADE_STORAGE_KEY) as Modalidade) || 'futsal'; } catch { return 'futsal'; }
  });
  const [inscricoes, setInscricoes] = useState<InscricaoInterclasses[]>([]);
  const [turmas, setTurmas] = useState<string[]>([]);
  const [elegibilidade, setElegibilidade] = useState<ElegibilidadeInterclasses[]>([]);
  const [loading, setLoading] = useState(true);

  function selecionarModalidade(m: Modalidade) {
    setModalidade(m);
    try { localStorage.setItem(MODALIDADE_STORAGE_KEY, m); } catch { /* ignore */ }
  }

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [insc, tms, eleg] = await Promise.all([
        buscarInscricoesInterclasses(EDICAO_ATUAL),
        buscarTurmasDisponiveis(),
        buscarElegibilidadeInterclasses(EDICAO_ATUAL),
      ]);
      setInscricoes(insc);
      setTurmas(unirTurmas(tms));
      setElegibilidade(eleg);
    } catch (e) {
      console.error('Erro ao carregar dados do Interclasses:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  // Cada modalidade só enxerga suas próprias inscrições — isolamento total,
  // mesmo quando o mesmo nome de time/turma existe em mais de uma modalidade.
  // Filtrando aqui uma vez, VisaoGeral/Equipes recebem a lista já isolada e
  // não precisam saber nada sobre modalidade.
  const inscricoesModalidade = useMemo(
    () => inscricoes.filter(i => (i.modalidade ?? 'futsal') === modalidade),
    [inscricoes, modalidade]
  );

  // Nº de times por modalidade (todas as modalidades, não só a ativa) — mostra
  // no seletor onde estão as inscrições.
  const contagemTimes = useMemo(() => {
    const porModalidade = new Map<string, Set<string>>();
    inscricoes.forEach(i => {
      const m = i.modalidade ?? 'futsal';
      if (!porModalidade.has(m)) porModalidade.set(m, new Set());
      porModalidade.get(m)!.add(normalizarNomeTime(i.nome_time.trim()));
    });
    const out: Record<string, number> = {};
    porModalidade.forEach((nomes, m) => { out[m] = nomes.size; });
    return out;
  }, [inscricoes]);

  return (
    <div className="flex flex-col gap-4 pb-28 font-sans">
      <div className="rounded-3xl px-5 pt-6 pb-5 flex flex-col items-center text-center gap-4" style={{ background: 'linear-gradient(180deg, #0066cc 0%, #0052a3 100%)' }}>
        <div>
          <div className="text-5xl mb-2">🏆</div>
          <h1 className="text-white text-xl font-extrabold tracking-tight">Interclasses IOP {EDICAO_ATUAL}</h1>
          <p className="text-blue-100 text-xs mt-1">Painel do professor — Instituto Odilon Pratagi</p>
        </div>
        <ModalidadeSeletor modalidade={modalidade} onSelecionar={selecionarModalidade} variant="hero" contagem={loading ? undefined : contagemTimes} />
      </div>
      <SubTabBar tab={tab} setTab={setTab} />
      {tab === 'visao' && <VisaoGeral inscricoes={inscricoesModalidade} turmas={turmas} loading={loading} modalidade={modalidade} />}
      {tab === 'inscricao' && (
        <InscricaoAlunos
          edicao={EDICAO_ATUAL}
          modalidade={modalidade}
          inscricoes={inscricoesModalidade}
          turmas={turmas}
          loading={loading}
          onRefetch={carregar}
        />
      )}
      {tab === 'equipes' && <Equipes inscricoes={inscricoesModalidade} elegibilidade={elegibilidade} loading={loading} onRefetch={carregar} />}
      {tab === 'confrontos' && <Confrontos modalidade={modalidade} inscricoes={inscricoesModalidade} />}
      {tab === 'cronograma' && <Cronograma modalidade={modalidade} />}
      {tab === 'corte' && <AlunosSugeridosCorte edicao={EDICAO_ATUAL} />}
    </div>
  );
}

export function ModalidadeSeletor({ modalidade, onSelecionar, variant = 'default', contagem }: { modalidade: Modalidade; onSelecionar: (m: Modalidade) => void; variant?: 'default' | 'hero'; contagem?: Record<string, number> }) {
  const hero = variant === 'hero';
  return (
    <div className={cn('flex gap-1.5 overflow-x-auto', hero ? 'justify-center flex-wrap pb-1' : 'pt-2')}>
      {MODALIDADES.map(m => {
        const ativo = modalidade === m.id && m.disponivel;
        return (
          <button
            key={m.id}
            onClick={() => m.disponivel && onSelecionar(m.id)}
            disabled={!m.disponivel}
            className={cn(
              'flex items-center gap-1.5 rounded-xl font-bold whitespace-nowrap transition-all flex-shrink-0',
              hero ? 'px-4 py-2.5 text-sm shadow-sm' : 'px-3 py-2 text-xs',
              !m.disponivel
                ? (hero ? 'bg-white/20 text-white/50 cursor-not-allowed' : 'bg-gray-50 text-gray-300 cursor-not-allowed')
                : ativo
                  ? 'text-white'
                  : (hero ? 'bg-white text-blue-700 hover:bg-blue-50' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')
            )}
            style={ativo ? { background: hero ? '#f59e0b' : m.cor } : undefined}
          >
            <span>{m.icone}</span>
            {m.label}
            {m.disponivel && contagem && (
              <span className={cn('text-[10px] font-bold rounded-full px-1.5 py-0.5', ativo ? 'bg-white/30' : 'bg-black/10')} title="Times inscritos">
                {contagem[m.id] ?? 0}
              </span>
            )}
            {!m.disponivel && <span className="text-[9px] opacity-70">(em breve)</span>}
          </button>
        );
      })}
    </div>
  );
}

function SubTabBar({ tab, setTab }: { tab: SubTab; setTab: (t: SubTab) => void }) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pt-2 pb-1">
      {SUB_TABS.map(t => (
        <button
          key={t.id}
          onClick={() => setTab(t.id)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex-shrink-0",
            tab === t.id ? "bg-primary text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          )}
        >
          {t.icon}
          {t.label}
        </button>
      ))}
    </div>
  );
}
