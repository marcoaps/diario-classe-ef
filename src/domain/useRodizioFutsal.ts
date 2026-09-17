import { useCallback, useEffect, useState } from 'react';
import {
  buscarSessaoAbertaRodizio, criarSessaoRodizio, adicionarJogadorTime, removerJogadorTime,
  registrarJogoRodizio, finalizarSessaoRodizio, adicionarTimeRodizio,
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
  ehTimeCerca?: boolean;
  jogadores: { alunoId: string; alunoNome: string }[];
}

const TIMEOUT_MS = 15000;

// Some conexões (wifi da escola, por exemplo) deixam a chamada ao Supabase
// pendurada sem nunca resolver nem rejeitar — sem isso, o botão fica girando
// pra sempre porque o await nunca retorna. Com o timeout, a ação sempre
// termina (com erro claro) em no máximo TIMEOUT_MS.
function comTimeout<T>(promessa: Promise<T>): Promise<T> {
  return Promise.race([
    promessa,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error('Tempo esgotado ao falar com o servidor. Verifique sua conexão e tente novamente.')), TIMEOUT_MS);
    }),
  ]);
}

export function paraTimeRodizio(t: RodizioSessaoCompleta['times'][number]): TimeRodizio {
  return {
    id: t.id, nome: t.nome, capitaoNome: t.capitao_nome, ordemInicial: t.ordem_inicial,
    criadoDuranteRodizio: t.criado_durante_rodizio, ehTimeCerca: t.time_cerca,
  };
}

export function paraJogoRodizio(j: RodizioSessaoCompleta['jogos'][number]): JogoRodizio {
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
  // Separado de `erro` (que cobre ações com seu próprio alert() no chamador,
  // ex: criar/registrar/finalizar) porque uma falha ao CARREGAR a sessão não
  // tem nenhum botão que a capture — sem isso, o professor cairia direto na
  // tela de "criar novo rodízio" sem saber que só falhou o carregamento
  // (risco de duplicar a sessão de uma turma que já tinha rodízio aberto).
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    if (!turmaId) { setSessaoCompleta(null); setErroCarregamento(null); return; }
    setLoading(true);
    setErroCarregamento(null);
    try {
      const sessao = await comTimeout(buscarSessaoAbertaRodizio(turmaId));
      setSessaoCompleta(sessao);
    } catch (e) {
      console.error(e);
      setErroCarregamento('Erro ao carregar o rodízio dessa turma. Verifique sua conexão.');
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
      const criada = await comTimeout(criarSessaoRodizio({
        turmaId,
        modalidade,
        limitePermanencia,
        times: novosTimes.map((t, i) => ({
          nome: t.nome,
          capitaoAlunoId: t.capitaoAlunoId,
          capitaoNome: t.capitaoNome,
          ordemInicial: i + 1,
          ehTimeCerca: t.ehTimeCerca,
          jogadores: t.jogadores,
        })),
      }));
      setSessaoCompleta(criada);
    } catch (e) {
      console.error(e);
      setErro('Erro ao criar o rodízio. Tente novamente.');
      throw e;
    }
  }, [turmaId]);

  const adicionarJogador = useCallback(async (timeId: string, alunoId: string, alunoNome: string) => {
    setErro(null);
    try {
      const jogador = await comTimeout(adicionarJogadorTime(timeId, alunoId, alunoNome));
      setSessaoCompleta(prev => prev ? { ...prev, jogadores: [...prev.jogadores, jogador] } : prev);
    } catch (e) {
      console.error(e);
      setErro('Erro ao adicionar o jogador ao time. Tente novamente.');
      throw e;
    }
  }, []);

  const removerJogador = useCallback(async (jogadorRegistroId: string) => {
    setErro(null);
    try {
      await comTimeout(removerJogadorTime(jogadorRegistroId));
      setSessaoCompleta(prev => prev
        ? { ...prev, jogadores: prev.jogadores.filter(j => j.id !== jogadorRegistroId) }
        : prev);
    } catch (e) {
      console.error(e);
      setErro('Erro ao remover o jogador do time. Tente novamente.');
      throw e;
    }
  }, []);

  // Time montado no meio da aula (ex: sobrou aluno sem equipe) — entra na
  // fila sozinho, no final, sem tocar nos times originais (ver
  // TimeRodizio.criadoDuranteRodizio e calcularFilaAtual).
  const adicionarTime = useCallback(async (
    nome: string,
    capitaoAlunoId: string | null,
    capitaoNome: string,
    jogadores: { alunoId: string; alunoNome: string }[],
  ) => {
    if (!sessaoCompleta) return;
    setErro(null);
    try {
      const proximaOrdem = Math.max(0, ...sessaoCompleta.times.map(t => t.ordem_inicial)) + 1;
      const { time, jogadores: novosJogadores } = await comTimeout(adicionarTimeRodizio({
        sessaoId: sessaoCompleta.sessao.id,
        nome, capitaoAlunoId, capitaoNome, ordemInicial: proximaOrdem, jogadores,
      }));
      setSessaoCompleta(prev => prev
        ? { ...prev, times: [...prev.times, time], jogadores: [...prev.jogadores, ...novosJogadores] }
        : prev);
    } catch (e) {
      console.error(e);
      setErro('Erro ao adicionar o time. Tente novamente.');
      throw e;
    }
  }, [sessaoCompleta]);

  const registrarResultado = useCallback(async (vencedorId: string) => {
    if (!sessaoCompleta) return;
    setErro(null);
    try {
      const times = sessaoCompleta.times.map(paraTimeRodizio);
      const jogos = sessaoCompleta.jogos.map(paraJogoRodizio);
      const filaAtual = calcularFilaAtual(times, jogos);
      const [equipeAId, equipeBId] = filaAtual;
      const estatisticas = calcularEstatisticas(times, jogos);
      const sequenciaAtual = estatisticas.get(vencedorId)?.sequenciaAtual ?? 0;
      const filaApos = calcularProximaFila(filaAtual, vencedorId, sequenciaAtual, sessaoCompleta.sessao.limite_permanencia);

      const jogo = await comTimeout(registrarJogoRodizio({
        sessaoId: sessaoCompleta.sessao.id,
        numero: jogos.length + 1,
        equipeAId, equipeBId, vencedorId, filaApos,
      }));
      setSessaoCompleta(prev => prev ? { ...prev, jogos: [...prev.jogos, jogo] } : prev);
    } catch (e) {
      console.error(e);
      // Conflito de numeração (duas abas, ou um clique duplo que passou do
      // guard local) — recarrega do banco pra fila voltar a bater com o que
      // foi realmente salvo, em vez de deixar o professor tentando de novo
      // contra um estado que já ficou desatualizado.
      setErro('Erro ao registrar o resultado. Verifique sua conexão e tente novamente.');
      await recarregar();
      throw e;
    }
  }, [sessaoCompleta, recarregar]);

  const finalizarSessao = useCallback(async () => {
    if (!sessaoCompleta) return;
    setErro(null);
    try {
      await comTimeout(finalizarSessaoRodizio(sessaoCompleta.sessao.id));
      setSessaoCompleta(null);
    } catch (e) {
      console.error(e);
      setErro('Erro ao finalizar o rodízio. Tente novamente.');
      throw e;
    }
  }, [sessaoCompleta]);

  const times = (sessaoCompleta?.times ?? []).map(paraTimeRodizio);
  const jogos = (sessaoCompleta?.jogos ?? []).map(paraJogoRodizio);
  const jogadores = sessaoCompleta?.jogadores ?? [];
  const filaAtual = sessaoCompleta ? calcularFilaAtual(times, jogos) : [];
  const estatisticas = sessaoCompleta ? calcularEstatisticas(times, jogos) : new Map();

  return {
    sessaoCompleta, loading, erro, erroCarregamento, recarregar,
    criarSessao, adicionarJogador, removerJogador, adicionarTime, registrarResultado, finalizarSessao,
    times, jogos, jogadores, filaAtual, estatisticas,
  };
}
