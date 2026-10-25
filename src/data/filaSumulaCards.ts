import localforage from 'localforage';
import type { Sumula } from '../domain/sumulaFutsal';

// Súmula dos Cards: mesmo espírito 100% local dos Cards (ver useCardsRodizio.ts)
// — nunca toca o Supabase, fica só neste aparelho, igual aos contadores de vezes.
const store = localforage.createInstance({ name: 'DiarioEF_sumula_cards', storeName: 'sumulas' });

export async function lerSumulaLocal(jogoId: string): Promise<Sumula | null> {
  try { return (await store.getItem<Sumula>(jogoId)) ?? null; } catch { return null; }
}

export async function lerSumulaRemota(): Promise<Sumula | null> {
  return null;
}

export async function salvarSumulaLocal(s: Sumula): Promise<void> {
  // Sem localStorage/IndexedDB (aba privada, cota cheia): a súmula continua
  // funcionando, só não sobrevive a recarregar — mesmo tratamento dos Cards.
  try { await store.setItem(s.jogoId, s); } catch { /* ignora */ }
}

export async function sincronizarSumulas(): Promise<{ enviadas: number; restantes: number }> {
  return { enviadas: 0, restantes: 0 };
}

export async function totalSumulasPendentes(): Promise<number> {
  return 0;
}

export function aoMudarSumulas(): () => void {
  return () => {};
}
