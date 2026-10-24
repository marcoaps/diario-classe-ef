// Comunicação entre a janela da súmula e a tela Confrontos (mesma origem).
export const CANAL_SUMULA = 'interclasses-sumula';

export type MsgSumula =
  | { tipo: 'encerrar'; reqId: string; jogoId: string; golsA: number; golsB: number }
  | { tipo: 'ok'; reqId: string }
  | { tipo: 'erro'; reqId: string; mensagem: string };

export const urlSumulaJanela = (jogoId: string) => `/interclasses/sumula/${jogoId}`;

// Pede à tela Confrontos (outra janela) que lance o placar; espera a confirmação.
export function pedirLancamento(jogoId: string, golsA: number, golsB: number, timeoutMs = 6000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof BroadcastChannel === 'undefined') return reject(new Error('Este navegador não suporta a comunicação entre janelas.'));
    const reqId = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
    const canal = new BroadcastChannel(CANAL_SUMULA);
    const fim = (fn: () => void) => { clearTimeout(t); canal.close(); fn(); };
    const t = setTimeout(() => fim(() => reject(new Error(
      'A tela Torneios/Confrontos não respondeu. Deixe-a aberta na janela principal, na mesma categoria do jogo, e tente de novo. ' +
      `(Ou use "Lançar placar" lá com ${golsA} x ${golsB}.)`))), timeoutMs);
    canal.onmessage = (ev: MessageEvent<MsgSumula>) => {
      const m = ev.data;
      if (!m || m.tipo === 'encerrar' || m.reqId !== reqId) return;
      if (m.tipo === 'ok') fim(resolve); else fim(() => reject(new Error(m.mensagem)));
    };
    canal.postMessage({ tipo: 'encerrar', reqId, jogoId, golsA, golsB } satisfies MsgSumula);
  });
}
