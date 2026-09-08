import { useState, useEffect, useMemo } from 'react';
import { Trophy, Loader2 } from 'lucide-react';
import { cn } from '../../AppLayout';
import { buscarCampeonato, buscarJogos, type CampeonatoInterclasses } from '../../../data/supabase';
import { CATEGORIA_6_7, CATEGORIA_8_9, MODALIDADES, type Modalidade } from '../../../domain/interclasses';
import { ADAPTERS, REGRAS_PADRAO, calcSt, type Jogo } from '../../../domain/interclassesCampeonato';
import { linhaParaJogo, corDaEquipe, ListaJogos, Classificacao, Chave, FASES_LIGA } from './Confrontos';

const EDICAO = '2026';
const CATEGORIAS = [CATEGORIA_6_7, CATEGORIA_8_9];
const MODALIDADE_STORAGE_KEY = 'interclasses_modalidade_resultados_publico';

// Página pública (sem login) só de leitura — jogos, placar, classificação e
// chave — pra alunos e pais acompanharem o andamento sem precisar de acesso
// ao painel do professor. Nenhuma ação de administrador (lançar placar,
// excluir campeonato) fica disponível aqui.
export function ConfrontosPublico() {
  const [modalidade, setModalidade] = useState<Modalidade>(() => {
    try { return (localStorage.getItem(MODALIDADE_STORAGE_KEY) as Modalidade) || 'futsal'; } catch { return 'futsal'; }
  });
  const [categoriaAtiva, setCategoriaAtiva] = useState<string>(CATEGORIA_6_7);
  const [campeonato, setCampeonato] = useState<CampeonatoInterclasses | null>(null);
  const [jogos, setJogos] = useState<Jogo[]>([]);
  const [loading, setLoading] = useState(true);
  const [aba, setAba] = useState<'jogos' | 'classificacao' | 'chave'>('jogos');

  const adapter = ADAPTERS[modalidade];
  const regras = REGRAS_PADRAO[modalidade];

  function selecionarModalidade(m: Modalidade) {
    setModalidade(m);
    try { localStorage.setItem(MODALIDADE_STORAGE_KEY, m); } catch { /* ignore */ }
  }

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    (async () => {
      try {
        const camp = await buscarCampeonato(EDICAO, modalidade, categoriaAtiva);
        if (!mounted) return;
        setCampeonato(camp);
        if (camp) {
          const rows = await buscarJogos(camp.id);
          if (mounted) setJogos(rows.map(linhaParaJogo));
        } else if (mounted) {
          setJogos([]);
        }
      } catch (e) {
        console.error('Erro ao carregar resultados:', e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [modalidade, categoriaAtiva]);

  useEffect(() => { setAba('jogos'); }, [modalidade, categoriaAtiva]);

  const equipes = useMemo(() => {
    const nomes = new Set<string>();
    jogos.forEach(j => { if (j.equipeA) nomes.add(j.equipeA); if (j.equipeB) nomes.add(j.equipeB); });
    return Array.from(nomes);
  }, [jogos]);

  const standings = useMemo(
    () => campeonato ? calcSt(equipes, jogos, adapter, regras) : [],
    [campeonato, equipes, jogos, adapter, regras]
  );

  const jogosPendentes = jogos.filter(j => !j.jogado && !j.isBye && j.equipeA && j.equipeB);
  const jogosJogados = jogos.filter(j => j.jogado && !j.isBye && j.equipeA && j.equipeB);
  const temChave = jogos.some(j => !FASES_LIGA.has(j.fase));

  const tabs = useMemo(() => {
    const t: { id: typeof aba; label: string }[] = [{ id: 'jogos', label: 'Jogos' }, { id: 'classificacao', label: 'Classificação' }];
    if (temChave) t.push({ id: 'chave', label: 'Chave' });
    return t;
  }, [temChave]);

  return (
    <div className="min-h-screen bg-background font-sans text-base">
      <div className="text-center py-7 px-4 border-b border-gray-100 bg-white">
        <div className="text-5xl mb-2">🏆</div>
        <h1 className="text-on-surface text-2xl font-bold">Interclasses IOP {EDICAO}</h1>
        <p className="text-gray-500 text-base mt-1">Resultados — Instituto Odilon Pratagi</p>
      </div>

      <div className="max-w-lg mx-auto p-4 flex flex-col gap-4">
        <div className="flex gap-2 overflow-x-auto pt-1">
          {MODALIDADES.map(m => (
            <button
              key={m.id}
              onClick={() => m.disponivel && selecionarModalidade(m.id)}
              disabled={!m.disponivel}
              className={cn(
                'flex items-center gap-2 px-4 py-3 rounded-xl text-base font-bold whitespace-nowrap transition-all flex-shrink-0',
                !m.disponivel ? 'bg-gray-50 text-gray-300 cursor-not-allowed' :
                modalidade === m.id ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
              style={modalidade === m.id && m.disponivel ? { background: m.cor } : undefined}
            >
              <span className="text-xl">{m.icone}</span>
              {m.label}
              {!m.disponivel && <span className="text-xs opacity-70">(em breve)</span>}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          {CATEGORIAS.map(c => (
            <button
              key={c}
              onClick={() => setCategoriaAtiva(c)}
              className={cn('flex-1 py-3 rounded-xl text-base font-bold transition-all', categoriaAtiva === c ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}
            >
              {c}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex gap-2 items-center justify-center py-10 text-gray-500 text-base">
            <Loader2 className="w-5 h-5 animate-spin" /> Carregando...
          </div>
        ) : !campeonato ? (
          <div className="text-center text-gray-400 text-base py-10 bg-white rounded-2xl border border-gray-100 px-4">
            Nenhum campeonato criado ainda para esta modalidade/categoria.
          </div>
        ) : campeonato.campeao ? (
          <div className="bg-gradient-to-br from-yellow-50 to-white rounded-2xl border border-yellow-200 shadow-sm p-7 text-center">
            <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-3" />
            <div className="text-sm font-bold text-gray-400 uppercase tracking-widest">Campeão — {categoriaAtiva}</div>
            <div className="text-3xl font-bold text-on-surface mt-2 flex items-center justify-center gap-2.5">
              <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: corDaEquipe(campeonato.campeao) }} />
              {campeonato.campeao}
            </div>
          </div>
        ) : (
          <>
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
              {tabs.map(t => (
                <button
                  key={t.id}
                  onClick={() => setAba(t.id)}
                  className={cn('flex-1 py-2.5 rounded-lg text-sm font-bold transition-all', aba === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500')}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {aba === 'jogos' && (
              <div className="flex flex-col gap-4">
                <ListaJogos titulo={`Pendentes (${jogosPendentes.length})`} jogos={jogosPendentes} adapter={adapter} somenteLeitura grande colunas={1} />
                <ListaJogos titulo={`Realizados (${jogosJogados.length})`} jogos={jogosJogados} adapter={adapter} somenteLeitura grande colunas={1} />
                {jogos.length === 0 && <div className="text-center text-gray-400 text-base py-8">Nenhum jogo gerado.</div>}
              </div>
            )}

            {aba === 'classificacao' && <Classificacao standings={standings} adapter={adapter} jogos={jogos} grande />}

            {aba === 'chave' && <Chave jogos={jogos} adapter={adapter} somenteLeitura grande />}
          </>
        )}
      </div>
    </div>
  );
}
