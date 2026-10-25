import { useMemo } from 'react';
import { SumulaVirtual, type JogadorSumula } from '../interclasses/SumulaVirtual';
import { ErroSumula } from '../interclasses/ErroSumula';
import * as armazenamentoCards from '../../../data/filaSumulaCards';
import type { TimeCard } from '../../../domain/rodizioCardsLogica';

// Mesma súmula virtual do Interclasses/Rodízio, aplicada ao confronto atual dos
// Cards. Como aqui o placar é opcional (os Cards registram jogo até sem
// resultado), eliminatorio fica sempre false: um empate na súmula vira um jogo
// registrado empatado, igual a digitar o mesmo número nos dois lados — quem
// precisar decidir nos pênaltis (3 times, modo "Vencedor continua") faz isso
// depois em "corrigir placar", como já funciona hoje.
interface Props {
  jogoId: string;
  categoria: string;
  timeA: TimeCard;
  timeB: TimeCard;
  onEncerrar: (golsA: number, golsB: number) => Promise<void>;
  onFechar: () => void;
}

export function RodizioSumulaCards({ jogoId, categoria, timeA, timeB, onEncerrar, onFechar }: Props) {
  const inscricoes = useMemo<JogadorSumula[]>(() => {
    const doTime = (t: TimeCard) => t.jogadores.map((j, i) => ({ id: j.alunoId, nome_time: t.nome, numero_camisa: i + 1, nome_completo: j.nome }));
    return [...doTime(timeA), ...doTime(timeB)];
  }, [timeA, timeB]);

  return (
    <ErroSumula>
      <SumulaVirtual
        jogoId={jogoId}
        equipeA={timeA.nome}
        equipeB={timeB.nome}
        fase="Cards"
        categoria={categoria}
        eliminatorio={false}
        jogado={false}
        inscricoes={inscricoes}
        onEncerrar={onEncerrar}
        onFechar={onFechar}
        armazenamento={armazenamentoCards}
      />
    </ErroSumula>
  );
}
