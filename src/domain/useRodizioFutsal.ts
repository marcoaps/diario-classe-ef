import { useCallback, useEffect, useState } from 'react';
import {
  buscarSessaoAbertaRodizio, criarSessaoRodizio, adicionarJogadorTime, removerJogadorTime,
  registrarJogoRodizio, finalizarSessaoRodizio,
  type RodizioSessaoCompleta,
} from '../data/supabase';
import {
  calcularFilaAtual, calcularEstatisticas, calcularProximaFila,
  type TimeRodizio, type JogoRodizio,
} from './rodizioFutsalLogica';

export interface NovoTimeRodizio {
  nome: string;
  capitaoAlunoId: string | null;
  capitaoNome: string;
  jogadores: { alunoId: string; alunoNome: string }[];
}

function paraTimeRodizio(t: RodizioSessaoCompleta['times'][number]): TimeRodizio {
  return { id: t.id, nome: t.nome, capitaoNome: t.capitao_nome, ordemInicial: t.ordem_inicial };
}

function paraJogoRodizio(j: RodizioSessaoCompleta['jogos'][number]): JogoRodizio {
  return {
    id: j.id, numero: j.numero, equipeAId: j.equipe_a_id, equipeBId: j.equipe_b_id,
    vencedorId: j.vencedor_id, filaApos: j.fila_apos, criadoEm: j.criado_em,
  };
}

// Carrega (ou detecta) a sessão de rodízio em andamento de uma turma e expõe
// tudo que a tela de Controle precisa: fila atual, estatísticas por time, e
// as ações que gravam no Supabase (registrar resultado, finalizar etc).
// Nenhum estado de fila é guardado localmente fora do que veio do banco — a
// fila é sempre recalculada a partir de `sessao.jogos`, então dar refresh no
// meio da aula não perde nada (ver rodizio_futsal_setup.sql).
export function useRodizioFutsal(turmaId: string) {
  const [sessaoCompleta, setSessaoCompleta] = useState<RodizioSessaoCompleta | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    if (!turmaId) { setSessaoCompleta(null); return; }
    setLoading(true);
    setErro(null);
    try {
      const sessao = await buscarSessaoAbertaRodizio(turmaId);
      setSessaoCompleta(sessao);
    } catch (e) {
      console.error(e);
      setErro('Erro ao carregar o rodízio dessa turma.');
    } finally {
      setLoading(false);
    }
  }, [turmaId]);

  useEffect(() => { recarregar(); }, [recarregar]);

  const criarSessao = useCallback(async (
    modalidade: string,
    limitePermanencia: number | null,
    novosTimes: NovoTimeRodizio[],
  ) => {
    setErro(null);
    try {
      const criada = await criarSessaoRodizio({
        turmaId,
        modalidade,
        limitePermanencia,
        times: novosTimes.map((t, i) => ({
          nome: t.nome,
          capitaoAlunoId: t.capitaoAlunoId,
          capitaoNome: t.capitaoNome,
          ordemInicial: i + 1,
          jogadores: t.jogadores,
        })),
      });
      setSessaoCompleta(criada);
    } catch (e) {
      console.error(e);
      setErro('Erro ao criar o rodízio. Tente novamente.');
      throw e;
    }
  }, [turmaId]);

  const adicionarJogador = useCallback(async (timeId: string, alunoId: string, alunoNome: string) => {
    const jogador = await adicionarJogadorTime(timeId, alunoId, alunoNome);
    setSessaoCompleta(prev => prev ? { ...prev, jogadores: [...prev.jogadores, jogador] } : prev);
  }, []);

  const removerJogador = useCallback(async (jogadorRegistroId: string) => {
    await removerJogadorTime(jogadorRegistroId);
    setSessaoCompleta(prev => prev
      ? { ...prev, jogadores: prev.jogadores.filter(j => j.id !== jogadorRegistroId) }
      : prev);
  }, []);

  const registrarResultado = useCallback(async (vencedorId: string) => {
    if (!sessaoCompleta) return;
    const times = sessaoCompleta.times.map(paraTimeRodizio);
    const jogos = sessaoCompleta.jogos.map(paraJogoRodizio);
    const filaAtual = calcularFilaAtual(times, jogos);
    const [equipeAId, equipeBId] = filaAtual;
    const estatisticas = calcularEstatisticas(times, jogos);
    const sequenciaAtual = estatisticas.get(vencedorId)?.sequenciaAtual ?? 0;
    const filaApos = calcularProximaFila(filaAtual, vencedorId, sequenciaAtual, sessaoCompleta.sessao.limite_permanencia);

    const jogo = await registrarJogoRodizio({
      sessaoId: sessaoCompleta.sessao.id,
      numero: jogos.length + 1,
      equipeAId, equipeBId, vencedorId, filaApos,
    });
    setSessaoCompleta(prev => prev ? { ...prev, jogos: [...prev.jogos, jogo] } : prev);
  }, [sessaoCompleta]);

  const finalizarSessao = useCallback(async () => {
    if (!sessaoCompleta) return;
    await finalizarSessaoRodizio(sessaoCompleta.sessao.id);
    setSessaoCompleta(null);
  }, [sessaoCompleta]);

  const times = (sessaoCompleta?.times ?? []).map(paraTimeRodizio);
  const jogos = (sessaoCompleta?.jogos ?? []).map(paraJogoRodizio);
  const filaAtual = sessaoCompleta ? calcularFilaAtual(times, jogos) : [];
  const estatisticas = sessaoCompleta ? calcularEstatisticas(times, jogos) : new Map();

  return {
    sessaoCompleta, loading, erro, recarregar,
    criarSessao, adicionarJogador, removerJogador, registrarResultado, finalizarSessao,
    times, jogos, filaAtual, estatisticas,
  };
}
