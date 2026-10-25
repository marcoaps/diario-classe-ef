import { useMemo } from 'react';
import { SumulaVirtual, type JogadorSumula } from '../interclasses/SumulaVirtual';
import { ErroSumula } from '../interclasses/ErroSumula';
import * as armazenamentoRodizio from '../../../data/filaSumulaRodizio';
import type { TimeRodizio } from '../../../domain/rodizioFutsalLogica';
import type { RodizioJogador } from '../../../data/supabase';

// Mesma súmula virtual do Interclasses (gols, faltas, cartões, relógio por
// período), aplicada ao jogo atual do Rodízio. Como o Rodízio não tem número
// de camisa, cada jogador recebe um número sequencial só pra servir de
// identidade dentro da súmula (não é impresso em lugar nenhum).
interface Props {
  jogoId: string;
  categoria: string;
  equipeA: TimeRodizio;
  equipeB: TimeRodizio;
  jogadores: RodizioJogador[];
  onEncerrar: (golsA: number, golsB: number) => Promise<void>;
  onFechar: () => void;
}

export function RodizioSumula({ jogoId, categoria, equipeA, equipeB, jogadores, onEncerrar, onFechar }: Props) {
  const inscricoes = useMemo<JogadorSumula[]>(() => {
    const doTime = (time: TimeRodizio) => jogadores
      .filter(j => j.time_id === time.id)
      .map((j, i) => ({ id: j.id, nome_time: time.nome, numero_camisa: i + 1, nome_completo: j.aluno_nome }));
    return [...doTime(equipeA), ...doTime(equipeB)];
  }, [jogadores, equipeA, equipeB]);

  return (
    <ErroSumula>
      <SumulaVirtual
        jogoId={jogoId}
        equipeA={equipeA.nome}
        equipeB={equipeB.nome}
        fase="Rodízio"
        categoria={categoria}
        eliminatorio
        jogado={false}
        inscricoes={inscricoes}
        onEncerrar={onEncerrar}
        onFechar={onFechar}
        armazenamento={armazenamentoRodizio}
        duracaoMinutos={4}
      />
    </ErroSumula>
  );
}
