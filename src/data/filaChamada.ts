import localforage from 'localforage';
import { supabase } from './supabase';

// Fila de escrita offline (fatia 3) — SÓ da chamada. Cada item é a chamada
// completa de uma turma num dia (mesma operação do botão Salvar: apaga o dia
// dos alunos da turma e insere de novo), então reenviar é idempotente e a
// última chamada salva para a mesma turma+data substitui a anterior.
// Notas NÃO passam por aqui (regra "nota nunca rebaixa").
const store = localforage.createInstance({ name: 'DiarioEF_fila', storeName: 'chamada' });
const EVENTO = 'fila-chamada';

export interface RegistroFrequencia {
  aluno_id: string;
  data: string;
  presente: boolean;
  participacao: string | null;
  justificativa_motivo: string | null;
  justificativa_observacao: string | null;
  trabalho_compensatorio_id: string | null;
}

export interface ItemFilaChamada {
  chave: string;
  turma: string;
  data: string;
  alunoIds: string[];
  registros: RegistroFrequencia[];
  criadoEm: number;
  erro?: string;
}

const chaveDe = (turma: string, data: string) => `${turma}|${data}`;
const avisar = () => window.dispatchEvent(new Event(EVENTO));

export function aoMudarFila(cb: () => void): () => void {
  window.addEventListener(EVENTO, cb);
  return () => window.removeEventListener(EVENTO, cb);
}

export async function enfileirarChamada(turma: string, data: string, alunoIds: string[], registros: RegistroFrequencia[]) {
  const item: ItemFilaChamada = { chave: chaveDe(turma, data), turma, data, alunoIds, registros, criadoEm: Date.now() };
  await store.setItem(item.chave, item);
  avisar();
}

export async function listarFila(): Promise<ItemFilaChamada[]> {
  const itens: ItemFilaChamada[] = [];
  try { await store.iterate<ItemFilaChamada, void>(v => { itens.push(v); }); } catch { /* ignore */ }
  return itens.sort((a, b) => a.criadoEm - b.criadoEm);
}

export async function chamadaPendente(turma: string, data: string): Promise<ItemFilaChamada | null> {
  try { return (await store.getItem<ItemFilaChamada>(chaveDe(turma, data))) ?? null; } catch { return null; }
}

export function erroDeRede(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const msg = String((err as any)?.message ?? err ?? '');
  return err instanceof TypeError || /failed to fetch|networkerror|load failed|network request failed/i.test(msg);
}

// Grava a chamada no banco; devolve true só se conferiu a contagem lida de volta
// (a RLS pode "aceitar" e não gravar nada em silêncio).
export async function gravarChamada(item: Pick<ItemFilaChamada, 'alunoIds' | 'data' | 'registros'>): Promise<void> {
  const { error: errDel } = await supabase.from('frequencia').delete().in('aluno_id', item.alunoIds).eq('data', item.data);
  if (errDel) throw errDel;
  if (item.registros.length > 0) {
    const { error: errIns } = await supabase.from('frequencia').insert(item.registros);
    if (errIns) throw errIns;
  }
  const { count, error: errCount } = await supabase
    .from('frequencia').select('id', { count: 'exact', head: true })
    .in('aluno_id', item.alunoIds).eq('data', item.data);
  if (errCount) throw errCount;
  if ((count ?? 0) !== item.registros.length) {
    throw new Error(`Conferência falhou: esperado ${item.registros.length} registros, banco tem ${count ?? 0}.`);
  }
}

let sincronizando = false;

// Envia tudo que está na fila. Item com erro de rede fica para a próxima vez;
// item com outro erro fica marcado com a mensagem (não é descartado).
export async function sincronizarFila(): Promise<{ enviados: number; restantes: number }> {
  if (sincronizando) return { enviados: 0, restantes: (await listarFila()).length };
  sincronizando = true;
  let enviados = 0;
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return { enviados, restantes: (await listarFila()).length };
    for (const item of await listarFila()) {
      try {
        await gravarChamada(item);
        await store.removeItem(item.chave);
        enviados++;
      } catch (err) {
        if (erroDeRede(err)) break;
        await store.setItem(item.chave, { ...item, erro: String((err as any)?.message ?? err) });
      }
    }
  } finally {
    sincronizando = false;
    avisar();
  }
  return { enviados, restantes: (await listarFila()).length };
}

export async function descartarChamadaPendente(turma: string, data: string) {
  try { await store.removeItem(chaveDe(turma, data)); } catch { /* ignore */ }
  avisar();
}
