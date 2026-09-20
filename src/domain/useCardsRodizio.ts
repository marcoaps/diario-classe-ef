import { useCallback, useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import * as L from './rodizioCardsLogica';
import type { TimeCard } from './rodizioCardsLogica';

const PREFIXO = 'rodizio-cards:v1:';
const MAX_DESFAZER = 30;

function ler(chave: string): TimeCard[] {
  try { return L.lerTimesSalvos(localStorage.getItem(PREFIXO + chave)); } catch { return []; }
}

function gravar(chave: string, times: TimeCard[]) {
  // Sem localStorage (aba privada, cota cheia): a tela continua funcionando, só não sobrevive a recarregar.
  try { localStorage.setItem(PREFIXO + chave, L.textoParaSalvar(times)); } catch { /* ignora */ }
}

// Cards por capitão + contador de vezes que cada aluno jogou. Fica guardado neste aparelho,
// separado por turma(s), gênero e DIA (a `chave` vem da tela) — então recarregar a página no
// meio da aula não perde nada e um novo dia começa em branco. Não usa o Supabase nem mexe no
// "Rei da Quadra".
export function useCardsRodizio(chave: string) {
  const [times, setTimes] = useState<TimeCard[]>(() => ler(chave));
  const [podeDesfazer, setPodeDesfazer] = useState(false);
  const timesRef = useRef(times);
  const chaveRef = useRef(chave);
  const pilha = useRef<TimeCard[][]>([]);

  useEffect(() => {
    chaveRef.current = chave;
    const lidos = ler(chave);
    timesRef.current = lidos;
    pilha.current = [];
    setTimes(lidos);
    setPodeDesfazer(false);
  }, [chave]);

  const aplicar = useCallback((fn: (atual: TimeCard[]) => TimeCard[], desfazivel = true) => {
    const atual = timesRef.current;
    const novo = fn(atual);
    if (novo === atual) return;
    if (desfazivel) {
      pilha.current = [...pilha.current.slice(-(MAX_DESFAZER - 1)), atual];
      setPodeDesfazer(true);
    }
    timesRef.current = novo;
    setTimes(novo);
    gravar(chaveRef.current, novo);
  }, []);

  const desfazer = useCallback(() => {
    const anterior = pilha.current.pop();
    if (!anterior) return;
    timesRef.current = anterior;
    setTimes(anterior);
    gravar(chaveRef.current, anterior);
    setPodeDesfazer(pilha.current.length > 0);
  }, []);

  return {
    times,
    podeDesfazer,
    desfazer,
    adicionarCapitao: (aluno: { id: string; nome: string }) =>
      aplicar(t => (t.some(x => x.capitaoAlunoId === aluno.id) ? t : [...t, L.novoTime(uuidv4(), aluno)])),
    removerTime: (timeId: string) => aplicar(t => t.filter(x => x.id !== timeId)),
    // Renomear a cada tecla não entra no "desfazer".
    renomearTime: (timeId: string, nome: string) => aplicar(t => t.map(x => (x.id === timeId ? { ...x, nome } : x)), false),
    adicionarJogador: (timeId: string, aluno: { id: string; nome: string }) => aplicar(t => L.adicionarJogador(t, timeId, aluno)),
    removerJogador: (timeId: string, alunoId: string) => aplicar(t => L.removerJogador(t, timeId, alunoId)),
    definirVezes: (timeId: string, alunoId: string, vezes: number) => aplicar(t => L.definirVezes(t, timeId, alunoId, vezes)),
    ajustarVezes: (timeId: string, alunoId: string, delta: number) => aplicar(t => L.ajustarVezes(t, timeId, alunoId, delta)),
    somarUmParaTodos: (timeId: string) => aplicar(t => L.somarUmParaTodos(t, timeId)),
    ajustarJogos: (timeId: string, delta: number) => aplicar(t => L.ajustarJogos(t, timeId, delta)),
    zerarContadores: () => aplicar(t => L.zerarContadores(t)),
    apagarTudo: () => aplicar(() => []),
  };
}
