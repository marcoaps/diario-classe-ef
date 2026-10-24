import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase, buscarInscricoesInterclasses, type JogoInterclasses, type CampeonatoInterclasses } from '../../../data/supabase';
import type { InscricaoInterclasses } from '../../../domain/interclasses';
import { SumulaVirtual } from './SumulaVirtual';
import { FASES_LIGA } from './Confrontos';
import { pedirLancamento } from './comunicacaoSumula';
import { ErroSumula } from './ErroSumula';

const EDICAO = '2026';

// Súmula numa janela própria: carrega o jogo sozinha e pede o lançamento do placar
// à tela Confrontos (outra janela) quando o jogo é encerrado.
export function SumulaJanela() {
  return <ErroSumula><SumulaJanelaInterna /></ErroSumula>;
}

function SumulaJanelaInterna() {
  const { jogoId = '' } = useParams();
  const [dados, setDados] = useState<{ jogo: JogoInterclasses; camp: CampeonatoInterclasses; insc: InscricaoInterclasses[] } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const { data: jogo, error } = await supabase.from('interclasses_jogos').select('*').eq('id', jogoId).maybeSingle();
        if (error) throw error;
        if (!jogo) throw new Error('Jogo não encontrado.');
        const { data: camp, error: e2 } = await supabase.from('interclasses_campeonatos').select('*').eq('id', (jogo as JogoInterclasses).campeonato_id).maybeSingle();
        if (e2) throw e2;
        const insc = await buscarInscricoesInterclasses(EDICAO);
        if (vivo) setDados({ jogo: jogo as JogoInterclasses, camp: camp as CampeonatoInterclasses, insc });
      } catch (e: any) {
        if (vivo) setErro(e?.message || 'Não consegui carregar o jogo.');
      }
    })();
    return () => { vivo = false; };
  }, [jogoId]);

  useEffect(() => {
    if (dados) document.title = `Súmula ${dados.jogo.equipe_a} × ${dados.jogo.equipe_b}`;
  }, [dados]);

  if (erro) return <div className="fixed inset-0 z-[70] bg-white flex items-center justify-center p-6 text-center text-sm text-red-600">{erro}</div>;
  if (!dados) return <div className="fixed inset-0 z-[70] bg-white flex items-center justify-center text-gray-500 text-sm">Carregando jogo...</div>;
  const { jogo, camp, insc } = dados;
  if (!jogo.equipe_a || !jogo.equipe_b) return <div className="fixed inset-0 z-[70] bg-white flex items-center justify-center p-6 text-center text-sm text-gray-500">Os times deste jogo ainda não foram definidos.</div>;

  return (
    <SumulaVirtual
      jogoId={jogo.id}
      equipeA={jogo.equipe_a}
      equipeB={jogo.equipe_b}
      fase={jogo.fase}
      categoria={camp?.categoria ?? ''}
      eliminatorio={!FASES_LIGA.has(jogo.fase)}
      jogado={jogo.jogado}
      inscricoes={insc}
      onEncerrar={(ga, gb) => pedirLancamento(jogo.id, ga, gb)}
      onFechar={() => { window.close(); }}
    />
  );
}
