import { useCallback, useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import * as L from './rodizioCardsLogica';
import type { EstadoCards, TimeCard } from './rodizioCardsLogica';

const PREFIXO = 'rodizio-cards:v1:';
const MAX_DESFAZER = 30;

function ler(chave: string): EstadoCards {
  try { return L.lerEstadoSalvo(localStorage.getItem(PREFIXO + chave)); } catch { return L.estadoVazio(); }
}

function gravar(chave: string, estado: EstadoCards) {
  // Sem localStorage (aba privada, cota cheia): a tela continua funcionando, só não sobrevive a recarregar.
  try { localStorage.setItem(PREFIXO + chave, L.textoParaSalvarEstado(estado)); } catch { /* ignora */ }
}

// Cards por capitão + contador de vezes que cada aluno jogou + confrontos (jogo atual, próximos e
// jogos já registrados). Fica guardado neste aparelho, separado por turma(s), gênero e DIA (a
// `chave` vem da tela) — então recarregar a página no meio da aula não perde nada e um novo dia
// começa em branco. Não usa o Supabase nem mexe no "Rei da Quadra".
export function useCardsRodizio(chave: string) {
  const [estado, setEstado] = useState<EstadoCards>(() => ler(chave));
  const [podeDesfazer, setPodeDesfazer] = useState(false);
  const estadoRef = useRef(estado);
  const chaveRef = useRef(chave);
  const pilha = useRef<EstadoCards[]>([]);

  useEffect(() => {
    chaveRef.current = chave;
    const lido = ler(chave);
    estadoRef.current = lido;
    pilha.current = [];
    setEstado(lido);
    setPodeDesfazer(false);
  }, [chave]);

  const aplicarEstado = useCallback((fn: (atual: EstadoCards) => EstadoCards, desfazivel = true) => {
    const atual = estadoRef.current;
    const novo = fn(atual);
    if (novo === atual) return;
    if (desfazivel) {
      pilha.current = [...pilha.current.slice(-(MAX_DESFAZER - 1)), atual];
      setPodeDesfazer(true);
    }
    estadoRef.current = novo;
    setEstado(novo);
    gravar(chaveRef.current, novo);
  }, []);

  // Alterações que só mexem nos cards (a maioria).
  const aplicar = useCallback((fn: (atual: TimeCard[]) => TimeCard[], desfazivel = true) => {
    aplicarEstado(e => {
      const times = fn(e.times);
      return times === e.times ? e : { ...e, times };
    }, desfazivel);
  }, [aplicarEstado]);

  const desfazer = useCallback(() => {
    const anterior = pilha.current.pop();
    if (!anterior) return;
    estadoRef.current = anterior;
    setEstado(anterior);
    gravar(chaveRef.current, anterior);
    setPodeDesfazer(pilha.current.length > 0);
  }, []);

  return {
    estado,
    times: estado.times,
    jogosRealizados: estado.jogosRealizados,
    confrontoManual: estado.confrontoManual,
    podeDesfazer,
    desfazer,
    adicionarCapitao: (aluno: { id: string; nome: string }) =>
      aplicar(t => (t.some(x => x.capitaoAlunoId === aluno.id) ? t : [...t, L.novoTime(uuidv4(), aluno)])),
    removerTime: (timeId: string) => aplicarEstado(e => L.removerTimeDoEstado(e, timeId)),
    // Renomear a cada tecla não entra no "desfazer".
    renomearTime: (timeId: string, nome: string) => aplicar(t => t.map(x => (x.id === timeId ? { ...x, nome } : x)), false),
    adicionarJogador: (timeId: string, aluno: { id: string; nome: string }) => aplicar(t => L.adicionarJogador(t, timeId, aluno)),
    removerJogador: (timeId: string, alunoId: string) => aplicar(t => L.removerJogador(t, timeId, alunoId)),
    definirVezes: (timeId: string, alunoId: string, vezes: number) => aplicar(t => L.definirVezes(t, timeId, alunoId, vezes)),
    ajustarVezes: (timeId: string, alunoId: string, delta: number) => aplicar(t => L.ajustarVezes(t, timeId, alunoId, delta)),
    somarUmParaTodos: (timeId: string) => aplicar(t => L.somarUmParaTodos(t, timeId)),
    ajustarJogos: (timeId: string, delta: number) => aplicar(t => L.ajustarJogos(t, timeId, delta)),
    registrarJogo: (aId: string, bId: string) => aplicarEstado(e => L.registrarJogo(e, aId, bId)),
    definirConfrontoManual: (aId: string, bId: string) => aplicarEstado(e => L.definirConfrontoManual(e, aId, bId)),
    limparConfrontoManual: () => aplicarEstado(e => L.limparConfrontoManual(e)),
    zerarContadores: () => aplicarEstado(e => L.zerarEstado(e)),
    apagarTudo: () => aplicarEstado(() => L.estadoVazio()),
  };
}
