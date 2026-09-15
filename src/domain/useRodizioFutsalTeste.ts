import { useCallback, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { RodizioSessaoCompleta } from '../data/supabase';
import {
  calcularFilaAtual, calcularEstatisticas, calcularProximaFila,
  type TimeRodizio, type JogoRodizio,
} from './rodizioFutsalLogica';
import { paraTimeRodizio, paraJogoRodizio, type NovoTimeRodizio } from './useRodizioFutsal';

export const TURMA_ID_TESTE = '__rodizio_teste__';

// Versão 100% local (sem nenhuma chamada ao Supabase) de useRodizioFutsal,
// usada só pela "Chamada de Teste" da aba Rodízio de Futsal — permite testar
// criação de times (incluindo o time extra "Cerca") e a geração dos
// confrontos sem gravar nem ler nada do banco, então não há como isso afetar
// chamada, times ou histórico oficiais. "Apagar chamada de teste" é só
// resetar esse estado local pra null.
export function useRodizioFutsalTeste() {
  const [sessaoCompleta, setSessaoCompleta] = useState<RodizioSessaoCompleta | null>(null);

  const criarSessao = useCallback(async (
    modalidade: string,
    limitePermanencia: number | null,
    novosTimes: NovoTimeRodizio[],
  ) => {
    const agora = new Date().toISOString();
    const times = novosTimes.map((t, i) => ({
      id: uuidv4(),
      sessao_id: 'teste',
      nome: t.nome,
      capitao_aluno_id: t.capitaoAlunoId,
      capitao_nome: t.capitaoNome,
      ordem_inicial: i + 1,
      criado_durante_rodizio: false,
      time_cerca: t.ehTimeCerca ?? false,
      criado_em: agora,
    }));
    const jogadores = novosTimes.flatMap((t, i) => t.jogadores.map(j => ({
      id: uuidv4(), time_id: times[i].id, aluno_id: j.alunoId, aluno_nome: j.alunoNome,
    })));
    setSessaoCompleta({
      sessao: {
        id: 'teste', turma_id: TURMA_ID_TESTE, modalidade, modo: 'rei_da_quadra',
        limite_permanencia: limitePermanencia, data: agora.slice(0, 10), status: 'em_andamento',
        criado_em: agora, atualizado_em: agora,
      },
      times, jogadores, jogos: [],
    });
  }, []);

  const adicionarTime = useCallback(async (
    nome: string,
    capitaoAlunoId: string | null,
    capitaoNome: string,
    jogadores: { alunoId: string; alunoNome: string }[],
  ) => {
    setSessaoCompleta(prev => {
      if (!prev) return prev;
      const agora = new Date().toISOString();
      const proximaOrdem = Math.max(0, ...prev.times.map(t => t.ordem_inicial)) + 1;
      const novoTime = {
        id: uuidv4(), sessao_id: 'teste', nome, capitao_aluno_id: capitaoAlunoId, capitao_nome: capitaoNome,
        ordem_inicial: proximaOrdem, criado_durante_rodizio: true, time_cerca: false, criado_em: agora,
      };
      const novosJogadores = jogadores.map(j => ({ id: uuidv4(), time_id: novoTime.id, aluno_id: j.alunoId, aluno_nome: j.alunoNome }));
      return { ...prev, times: [...prev.times, novoTime], jogadores: [...prev.jogadores, ...novosJogadores] };
    });
  }, []);

  const registrarResultado = useCallback(async (vencedorId: string) => {
    setSessaoCompleta(prev => {
      if (!prev) return prev;
      const times = prev.times.map(paraTimeRodizio);
      const jogos = prev.jogos.map(paraJogoRodizio);
      const filaAtual = calcularFilaAtual(times, jogos);
      const [equipeAId, equipeBId] = filaAtual;
      const estatisticas = calcularEstatisticas(times, jogos);
      const sequenciaAtual = estatisticas.get(vencedorId)?.sequenciaAtual ?? 0;
      const filaApos = calcularProximaFila(filaAtual, vencedorId, sequenciaAtual, prev.sessao.limite_permanencia);
      const novoJogo = {
        id: uuidv4(), sessao_id: 'teste', numero: jogos.length + 1,
        equipe_a_id: equipeAId, equipe_b_id: equipeBId, vencedor_id: vencedorId,
        fila_apos: filaApos, criado_em: new Date().toISOString(),
      };
      return { ...prev, jogos: [...prev.jogos, novoJogo] };
    });
  }, []);

  const finalizarSessao = useCallback(async () => {
    setSessaoCompleta(null);
  }, []);

  const limparChamadaTeste = useCallback(() => {
    setSessaoCompleta(null);
  }, []);

  const times: TimeRodizio[] = (sessaoCompleta?.times ?? []).map(paraTimeRodizio);
  const jogos: JogoRodizio[] = (sessaoCompleta?.jogos ?? []).map(paraJogoRodizio);
  const filaAtual = sessaoCompleta ? calcularFilaAtual(times, jogos) : [];
  const estatisticas = sessaoCompleta ? calcularEstatisticas(times, jogos) : new Map();

  return {
    sessaoCompleta, loading: false, erro: null, recarregar: async () => {},
    criarSessao, adicionarJogador: async () => {}, removerJogador: async () => {},
    adicionarTime, registrarResultado, finalizarSessao, limparChamadaTeste,
    times, jogos, filaAtual, estatisticas,
  };
}
