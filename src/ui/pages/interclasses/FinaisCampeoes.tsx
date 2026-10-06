import { useCallback, useEffect, useState } from 'react';
import { Loader2, Trophy } from 'lucide-react';
import { cn } from '../../AppLayout';
import {
  buscarCampeonato, criarCampeonato, atualizarCampeonato, buscarJogos, criarJogos, salvarResultadoJogo,
  type CampeonatoInterclasses,
} from '../../../data/supabase';
import { chaveCampeonato, type GeneroCampeonato, type Modalidade } from '../../../domain/interclasses';
import { ADAPTERS, aplicarResultado, REGRAS_PADRAO, type Jogo, type Resultado } from '../../../domain/interclassesCampeonato';
import { CardJogo, corDaEquipe, linhaParaJogo, jogoParaLinha } from './Confrontos';

const EDICAO = '2026';

// A final de cada faixa é um jogo único entre os campeões dos dois anos da
// faixa (6º x 7º e 8º x 9º), por modalidade e gênero. Cada ano continua com
// o seu torneio isolado; só o campeão de cada um chega aqui.
export const FAIXAS: [string, string][] = [['6º ano', '7º ano'], ['8º ano', '9º ano']];
export const FINAIS = '🏆 Finais';

interface Estado {
  campeaoA: string | null;
  campeaoB: string | null;
  final: CampeonatoInterclasses | null;
  jogos: Jogo[];
}

function CardFaixa({ anoA, anoB, modalidade, genero, somenteLeitura, grande }: {
  anoA: string; anoB: string; modalidade: Modalidade; genero: GeneroCampeonato; somenteLeitura?: boolean; grande?: boolean;
}) {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [criando, setCriando] = useState(false);
  const adapter = ADAPTERS[modalidade];
  const chaveFinal = chaveCampeonato(`Final ${anoA} × ${anoB}`, genero);

  const carregar = useCallback(async () => {
    try {
      const [a, b, final] = await Promise.all([
        buscarCampeonato(EDICAO, modalidade, chaveCampeonato(anoA, genero)),
        buscarCampeonato(EDICAO, modalidade, chaveCampeonato(anoB, genero)),
        buscarCampeonato(EDICAO, modalidade, chaveFinal),
      ]);
      const jogos = final ? (await buscarJogos(final.id)).map(linhaParaJogo) : [];
      setEstado({ campeaoA: a?.campeao ?? null, campeaoB: b?.campeao ?? null, final, jogos });
    } catch (e) {
      console.error('Erro ao carregar a final da faixa:', e);
      setEstado({ campeaoA: null, campeaoB: null, final: null, jogos: [] });
    }
  }, [modalidade, genero, anoA, anoB, chaveFinal]);

  useEffect(() => { setEstado(null); carregar(); }, [carregar]);

  async function criarFinal() {
    if (!estado?.campeaoA || !estado.campeaoB || criando) return;
    setCriando(true);
    try {
      const camp = await criarCampeonato({ edicao: EDICAO, modalidade, categoria: chaveFinal, formato: 'final_unica' });
      const jogo: Jogo = {
        id: 'final_unica', equipeA: estado.campeaoA, equipeB: estado.campeaoB, jogado: false, vencedor: null,
        resultado: null, rodada: 1, fase: `Final ${anoA} × ${anoB}`, grupo: null,
      };
      await criarJogos(camp.id, [jogoParaLinha(jogo)]);
    } catch (e: any) {
      if (e?.code !== '23505') alert('Erro ao criar a final: ' + (e?.message || 'tente novamente.'));
    } finally {
      setCriando(false);
      await carregar();
    }
  }

  async function lancarPlacar(jogoId: string, resultado: Resultado) {
    if (!estado?.final) return;
    const r = aplicarResultado(estado.jogos, jogoId, resultado, adapter, { formato: 'final_unica', equipes: [], regras: REGRAS_PADRAO[modalidade] });
    const j = r.jogos.find(x => x.id === jogoId)!;
    await salvarResultadoJogo(jogoId, { jogado: true, vencedor: j.vencedor, resultado: j.resultado as any });
    if (r.campeao) await atualizarCampeonato(estado.final.id, { fase: 'finalizado', campeao: r.campeao });
    await carregar();
  }

  const titulo = `${anoA} × ${anoB}`;
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3">
      <h3 className={cn('font-bold text-on-surface', grande ? 'text-lg' : 'text-sm')}>Final {titulo}</h3>
      {!estado ? (
        <div className="flex gap-2 items-center text-gray-500 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Carregando...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {([[anoA, estado.campeaoA], [anoB, estado.campeaoB]] as const).map(([ano, camp]) => (
              <div key={ano} className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Campeão do {ano}</div>
                {camp ? (
                  <div className="font-semibold text-on-surface flex items-center gap-1.5 mt-0.5">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: corDaEquipe(camp) }} />{camp}
                  </div>
                ) : <div className="text-gray-400 mt-0.5">ainda não definido</div>}
              </div>
            ))}
          </div>

          {estado.final?.campeao ? (
            <div className="bg-gradient-to-br from-yellow-50 to-white rounded-xl border border-yellow-200 p-4 text-center">
              <Trophy className="w-8 h-8 text-yellow-500 mx-auto mb-1" />
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Campeão da faixa — {titulo}</div>
              <div className="text-lg font-bold text-on-surface mt-1">{estado.final.campeao}</div>
            </div>
          ) : null}

          {estado.jogos.length > 0 ? (
            <div className="flex flex-col gap-2">
              {estado.jogos.map(j => (
                <CardJogo key={j.id} jogo={j} adapter={adapter} onLancar={somenteLeitura ? undefined : lancarPlacar} somenteLeitura={somenteLeitura} grande={grande} mostrarGrupo={false} />
              ))}
            </div>
          ) : estado.campeaoA && estado.campeaoB ? (
            somenteLeitura ? (
              <div className="text-sm text-gray-400">A final ainda será marcada.</div>
            ) : (
              <button
                onClick={criarFinal}
                disabled={criando}
                className="w-full py-2.5 rounded-xl bg-primary hover:bg-primary-dark disabled:opacity-40 text-white text-sm font-bold"
              >
                {criando ? 'Criando...' : `🚀 Criar a final ${titulo}`}
              </button>
            )
          ) : (
            <div className="text-xs text-gray-400">A final aparece quando os dois anos tiverem campeão.</div>
          )}
        </>
      )}
    </div>
  );
}

export function FinaisCampeoes({ modalidade, genero, somenteLeitura, grande }: {
  modalidade: Modalidade; genero: GeneroCampeonato; somenteLeitura?: boolean; grande?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      {FAIXAS.map(([a, b]) => (
        <CardFaixa key={a} anoA={a} anoB={b} modalidade={modalidade} genero={genero} somenteLeitura={somenteLeitura} grande={grande} />
      ))}
    </div>
  );
}
