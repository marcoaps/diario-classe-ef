// Chamada offline: guarda no aparelho (IndexedDB, via localforage) a lista
// de alunos de cada turma e as chamadas feitas sem internet. Quando a
// conexão volta, as chamadas pendentes são enviadas ao Supabase sozinhas.
import localforage from 'localforage';
import { supabase } from './supabase';

const cacheTurmas = localforage.createInstance({ name: 'DiarioIOP_offline', storeName: 'turmas' });
const filaChamadas = localforage.createInstance({ name: 'DiarioIOP_offline', storeName: 'chamadas_pendentes' });

export interface AlunoCache {
  id: string;
  nome: string;
  turma_id: string;
  numero_chamada: number | null;
}

export interface TurmaCache {
  alunos: AlunoCache[];
  transferidos: [string, string][];
  especiais: [string, string | null][];
  atualizadoEm: string;
}

export interface RegistroFrequencia {
  aluno_id: string;
  data: string;
  presente: boolean;
  participacao: string | null;
  justificativa_motivo: string | null;
  justificativa_observacao: string | null;
  trabalho_compensatorio_id: string | null;
}

export interface ChamadaPendente {
  turma: string;
  data: string;
  idsAlunos: string[];
  registros: RegistroFrequencia[];
  salvaEm: string;
}

const EVENTO = 'diario:fila-chamadas';
const chave = (turma: string, data: string) => `${turma}|${data}`;
const avisar = () => window.dispatchEvent(new Event(EVENTO));

// ---------- Cache das turmas ----------

export async function salvarTurmaNoCache(turma: string, dados: Omit<TurmaCache, 'atualizadoEm'>) {
  try {
    await cacheTurmas.setItem(turma, { ...dados, atualizadoEm: new Date().toISOString() });
  } catch (err) {
    console.warn('Não foi possível guardar a turma no aparelho:', err);
  }
}

export async function lerTurmaDoCache(turma: string): Promise<TurmaCache | null> {
  try {
    return await cacheTurmas.getItem<TurmaCache>(turma);
  } catch {
    return null;
  }
}

// ---------- Fila de chamadas pendentes ----------

export async function enfileirarChamada(p: Omit<ChamadaPendente, 'salvaEm'>) {
  // Se a mesma turma/dia for salva de novo offline, a versão mais nova substitui a antiga.
  await filaChamadas.setItem(chave(p.turma, p.data), { ...p, salvaEm: new Date().toISOString() });
  avisar();
}

export async function lerChamadaPendente(turma: string, data: string) {
  try {
    return await filaChamadas.getItem<ChamadaPendente>(chave(turma, data));
  } catch {
    return null;
  }
}

export async function contarPendentes(): Promise<number> {
  try {
    return await filaChamadas.length();
  } catch {
    return 0;
  }
}

/** Grava a chamada no Supabase: apaga a do dia e insere a nova (mesma lógica da tela). */
export async function enviarChamada(idsAlunos: string[], data: string, registros: RegistroFrequencia[]) {
  const { error: errDel } = await supabase
    .from('frequencia')
    .delete()
    .in('aluno_id', idsAlunos)
    .eq('data', data);
  if (errDel) throw errDel;

  if (registros.length > 0) {
    const { error: insError } = await supabase.from('frequencia').insert(registros);
    if (insError) throw insError;
  }
}

/** Remove da fila uma chamada pendente (ex.: foi salva online depois, ou apagada). */
export async function descartarPendente(turma: string, data: string) {
  await filaChamadas.removeItem(chave(turma, data));
  avisar();
}

/** Erro de rede (sem internet / servidor inalcançável), não um erro de dados. */
export function ehErroDeRede(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  const msg = String((err as any)?.message ?? err ?? '').toLowerCase();
  return msg.includes('failed to fetch')
    || msg.includes('networkerror')
    || msg.includes('network request failed')
    || msg.includes('load failed')
    || msg.includes('fetch failed');
}

let sincronizando = false;

/** Envia todas as chamadas pendentes. Retorna quantas foram enviadas. */
export async function sincronizarPendentes(): Promise<number> {
  if (sincronizando || (typeof navigator !== 'undefined' && !navigator.onLine)) return 0;
  sincronizando = true;
  let enviadas = 0;
  try {
    const chaves = await filaChamadas.keys();
    for (const k of chaves) {
      const p = await filaChamadas.getItem<ChamadaPendente>(k);
      if (!p) continue;
      try {
        await enviarChamada(p.idsAlunos, p.data, p.registros);
        await filaChamadas.removeItem(k);
        enviadas++;
      } catch (err) {
        // Continua na fila; tenta de novo na próxima vez que a internet voltar.
        console.warn(`Chamada ${k} ainda não foi enviada:`, err);
        if (ehErroDeRede(err)) break;
      }
    }
  } finally {
    sincronizando = false;
    if (enviadas > 0) avisar();
  }
  return enviadas;
}

/** Tenta sincronizar ao abrir o app, quando a internet volta e a cada 2 minutos. */
export function iniciarSincronizacaoAutomatica() {
  const tentar = () => {
    sincronizarPendentes().then(n => {
      if (n > 0) console.info(`${n} chamada(s) feita(s) sem internet foram enviadas.`);
    });
  };
  window.addEventListener('online', tentar);
  setInterval(tentar, 2 * 60 * 1000);
  tentar();
}

/** Assina mudanças na fila (para mostrar o aviso "X chamadas aguardando internet"). */
export function aoMudarFila(cb: () => void) {
  window.addEventListener(EVENTO, cb);
  return () => window.removeEventListener(EVENTO, cb);
}
