import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { LayoutGrid, ClipboardPlus, Users2, Trophy } from 'lucide-react';
import { cn } from '../AppLayout';
import { buscarInscricoesInterclasses, buscarTurmasDisponiveis } from '../../data/supabase';
import { EDICAO_PADRAO, unirTurmas } from '../../domain/interclasses';
import type { InscricaoInterclasses } from '../../domain/interclasses';
import { VisaoGeral } from './interclasses/VisaoGeral';
import { InscricaoAlunos } from './interclasses/InscricaoAlunos';
import { Equipes } from './interclasses/Equipes';
import Torneio from './Torneio';

const EDICAO_ATUAL = EDICAO_PADRAO;

type SubTab = 'visao' | 'inscricao' | 'equipes' | 'confrontos';

const SUB_TABS: { id: SubTab; label: string; icon: ReactNode }[] = [
  { id: 'visao', label: 'Visão Geral', icon: <LayoutGrid className="w-4 h-4" /> },
  { id: 'inscricao', label: 'Inscrição de Alunos', icon: <ClipboardPlus className="w-4 h-4" /> },
  { id: 'equipes', label: 'Equipes', icon: <Users2 className="w-4 h-4" /> },
  { id: 'confrontos', label: 'Torneios/Confrontos', icon: <Trophy className="w-4 h-4" /> },
];

export default function InterclassesIOP() {
  const [tab, setTab] = useState<SubTab>('inscricao');
  const [inscricoes, setInscricoes] = useState<InscricaoInterclasses[]>([]);
  const [turmas, setTurmas] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [insc, tms] = await Promise.all([
        buscarInscricoesInterclasses(EDICAO_ATUAL),
        buscarTurmasDisponiveis(),
      ]);
      setInscricoes(insc);
      setTurmas(unirTurmas(tms));
    } catch (e) {
      console.error('Erro ao carregar dados do Interclasses:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  // A aba "Torneios/Confrontos" reaproveita a página Torneio original —
  // suas funcionalidades (chaves, grupos, placares) continuam intactas.
  if (tab === 'confrontos') {
    return (
      <div className="flex flex-col">
        <SubTabBar tab={tab} setTab={setTab} />
        <Torneio />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-6 font-sans">
      <SubTabBar tab={tab} setTab={setTab} />
      {tab === 'visao' && <VisaoGeral inscricoes={inscricoes} turmas={turmas} loading={loading} />}
      {tab === 'inscricao' && (
        <InscricaoAlunos
          edicao={EDICAO_ATUAL}
          inscricoes={inscricoes}
          turmas={turmas}
          loading={loading}
          onRefetch={carregar}
        />
      )}
      {tab === 'equipes' && <Equipes inscricoes={inscricoes} loading={loading} onRefetch={carregar} />}
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
