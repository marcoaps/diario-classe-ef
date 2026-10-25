import localforage from 'localforage';
import { supabase } from './supabase';
import { erroDeRede } from './filaChamada';
import type { Sumula } from '../domain/sumulaFutsal';

// Mesmo molde de filaSumula.ts (súmula do Interclasses), mas para o Rodízio de
// Futsal — precisa de armazenamento próprio porque o jogo do rodízio só vira
// uma linha definitiva (rodizio_jogos) depois de encerrado: não há como usar a
// tabela do Interclasses, que exige um jogo já existente (ver
// sql/rodizio_sumulas.sql). `jogoId` aqui é sempre "<sessaoId>:<número>".
const store = localforage.createInstance({ name: 'DiarioEF_sumula_rodizio', storeName: 'sumulas' });
const pendentes = localforage.createInstance({ name: 'DiarioEF_sumula_rodizio', storeName: 'pendentes' });
const EVENTO = 'fila-sumula-rodizio';
const avisar = () => window.dispatchEvent(new Event(EVENTO));

const sessaoIdDoJogo = (jogoId: string) => jogoId.split(':')[0];

export function aoMudarSumulas(cb: () => void): () => void {
  window.addEventListener(EVENTO, cb);
  return () => window.removeEventListener(EVENTO, cb);
}

export async function lerSumulaLocal(jogoId: string): Promise<Sumula | null> {
  try { return (await store.getItem<Sumula>(jogoId)) ?? null; } catch { return null; }
}

export async function salvarSumulaLocal(s: Sumula): Promise<void> {
  await store.setItem(s.jogoId, s);
  await pendentes.setItem(s.jogoId, s.atualizadoEm);
  avisar();
}

export async function totalSumulasPendentes(): Promise<number> {
  try { return await pendentes.length(); } catch { return 0; }
}

// Devolve a súmula do banco (para abrir em outro aparelho); null se não existe ou
// se a tabela ainda não foi criada (sql/rodizio_sumulas.sql).
export async function lerSumulaRemota(jogoId: string): Promise<Sumula | null> {
  const { data, error } = await supabase.from('rodizio_sumulas').select('dados').eq('jogo_local_id', jogoId).maybeSingle();
  if (error || !data) return null;
  return data.dados as Sumula;
}

async function gravarRemoto(s: Sumula): Promise<void> {
  const { error } = await supabase.from('rodizio_sumulas')
    .upsert({ jogo_local_id: s.jogoId, sessao_id: sessaoIdDoJogo(s.jogoId), dados: s, atualizado_em: new Date(s.atualizadoEm).toISOString() });
  if (error) throw error;
  const { data, error: erroLer } = await supabase.from('rodizio_sumulas').select('dados').eq('jogo_local_id', s.jogoId).maybeSingle();
  if (erroLer) throw erroLer;
  if (!data || (data.dados as Sumula).atualizadoEm !== s.atualizadoEm) {
    throw new Error('Conferência falhou: o banco não guardou a súmula (login de professor?).');
  }
}

let sincronizando = false;

export async function sincronizarSumulas(): Promise<{ enviadas: number; restantes: number; erro?: string }> {
  if (sincronizando) return { enviadas: 0, restantes: await totalSumulasPendentes() };
  sincronizando = true;
  let enviadas = 0;
  let erro: string | undefined;
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return { enviadas, restantes: await totalSumulasPendentes(), erro: 'sem login de professor' };
    const ids: string[] = [];
    await pendentes.iterate<number, void>((_v, k) => { ids.push(k); });
    for (const id of ids) {
      const s = await lerSumulaLocal(id);
      if (!s) { await pendentes.removeItem(id); continue; }
      try {
        await gravarRemoto(s);
        // Só limpa a pendência se ninguém anotou nada novo enquanto enviava.
        const atual = await pendentes.getItem<number>(id);
        if (atual === s.atualizadoEm) await pendentes.removeItem(id);
        enviadas++;
      } catch (e) {
        erro = String((e as any)?.message ?? e);
        if (erroDeRede(e)) break;
      }
    }
  } finally {
    sincronizando = false;
    avisar();
  }
  return { enviadas, restantes: await totalSumulasPendentes(), erro };
}
