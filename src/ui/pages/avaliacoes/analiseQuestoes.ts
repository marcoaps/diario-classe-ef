// Análise por questão das objetivas de uma avaliação (só leitura, não grava nada).
// Usada em "Resultados": ranking de questões com mais erros e folha de correção
// por aluno. Papel: respostas = { "1": "A", ... } comparado com avaliacao.gabarito.
// Online: respostas = { [questaoId]: "índice" } comparado com resposta_correta,
// e a i-ésima múltipla escolha vira a objetiva nº i+1 (só se a contagem bater).

export interface LinhaQuestao {
  numero: number;
  marcada: string;     // '' = em branco
  correta: string;
  acertou: boolean;
}

export interface QuestaoOnlineMin {
  id: string;
  tipo: string;
  resposta_correta: string | null;
}

export interface RespostaMin {
  respostas: Record<string, string>;
  online?: boolean;
}

const letra = (i: string | null | undefined) =>
  i != null && i !== '' && !Number.isNaN(Number(i)) ? String.fromCharCode(65 + Number(i)) : '';

/** Linhas questão a questão desta resposta, ou null se não dá pra comparar com segurança. */
export function linhasObjetivas(
  r: RespostaMin,
  quantidade: number,
  gabarito: Record<string, string>,
  questoesOnline: QuestaoOnlineMin[],
): LinhaQuestao[] | null {
  if (!quantidade) return null;
  if (!r.online) {
    return Array.from({ length: quantidade }, (_, i) => {
      const n = String(i + 1);
      const marcada = (r.respostas?.[n] || '').trim().toUpperCase();
      const correta = (gabarito?.[n] || '').trim().toUpperCase();
      return { numero: i + 1, marcada, correta, acertou: !!marcada && marcada === correta };
    });
  }
  const mc = questoesOnline.filter(q => q.tipo === 'multipla_escolha');
  if (mc.length !== quantidade) return null;
  return mc.map((q, i) => {
    const m = r.respostas?.[q.id];
    return {
      numero: i + 1,
      marcada: letra(m),
      correta: letra(q.resposta_correta),
      acertou: m !== undefined && m === q.resposta_correta,
    };
  });
}

export interface EstatisticaQuestao {
  numero: number;
  correta: string;
  acertos: number;
  total: number;
  pctAcerto: number;
  /** alternativa errada mais marcada (o "distrator") e quantas vezes */
  distrator: { letra: string; vezes: number } | null;
}

/** Ranking das questões, da menor % de acerto pra maior. */
export function estatisticaPorQuestao(todas: LinhaQuestao[][]): EstatisticaQuestao[] {
  const mapa = new Map<number, { correta: string; acertos: number; total: number; erros: Map<string, number> }>();
  for (const linhas of todas) {
    for (const l of linhas) {
      const e = mapa.get(l.numero) || { correta: l.correta, acertos: 0, total: 0, erros: new Map() };
      e.total++;
      if (l.acertou) e.acertos++;
      else if (l.marcada) e.erros.set(l.marcada, (e.erros.get(l.marcada) || 0) + 1);
      mapa.set(l.numero, e);
    }
  }
  return Array.from(mapa.entries())
    .map(([numero, e]) => {
      const top = Array.from(e.erros.entries()).sort((a, b) => b[1] - a[1])[0];
      return {
        numero,
        correta: e.correta,
        acertos: e.acertos,
        total: e.total,
        pctAcerto: e.total ? Math.round((e.acertos / e.total) * 100) : 0,
        distrator: top ? { letra: top[0], vezes: top[1] } : null,
      };
    })
    .sort((a, b) => a.pctAcerto - b.pctAcerto || a.numero - b.numero);
}

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

export interface FolhaAluno {
  nome: string;
  turma: string;
  numero: number | string;
  nota: number;
  linhas: LinhaQuestao[] | null;
}

/** HTML imprimível: uma folha (página) por aluno corrigido. */
export function htmlFolhasCorrecao(titulo: string, valorTotal: number, folhas: FolhaAluno[]): string {
  const paginas = folhas.map(f => {
    const acertos = f.linhas?.filter(l => l.acertou).length ?? 0;
    const corpo = f.linhas
      ? `<p class="res">${acertos} de ${f.linhas.length} objetivas corretas</p>
         <table><thead><tr><th>Questão</th><th>Marcou</th><th>Gabarito</th><th></th></tr></thead><tbody>
         ${f.linhas.map(l => `<tr class="${l.acertou ? 'ok' : 'err'}"><td>${l.numero}</td><td>${esc(l.marcada || '—')}</td><td>${esc(l.correta || '—')}</td><td>${l.acertou ? '✓' : '✗'}</td></tr>`).join('')}
         </tbody></table>`
      : '<p class="res">Detalhe por questão indisponível para esta prova.</p>';
    return `<section>
      <h1>${esc(titulo)}</h1>
      <p class="aluno">${esc(f.turma)} · nº ${esc(String(f.numero))} — <b>${esc(f.nome)}</b></p>
      <p class="nota">Nota: <b>${f.nota.toFixed(1)}</b> / ${valorTotal.toFixed(1)}</p>
      ${corpo}
    </section>`;
  }).join('');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Folhas de correção</title>
  <style>
    body{font-family:Arial,sans-serif;margin:0;color:#111}
    section{page-break-after:always;padding:24px 32px}
    h1{font-size:16px;margin:0 0 8px}
    .aluno{font-size:14px;margin:4px 0}.nota{font-size:18px;margin:4px 0 8px}.res{font-size:13px;color:#444}
    table{border-collapse:collapse;width:100%;max-width:420px;font-size:13px}
    th,td{border:1px solid #bbb;padding:3px 8px;text-align:center}
    tr.err{background:#fde8e8}tr.ok td:last-child{color:#0a7a3d}tr.err td:last-child{color:#c00}
  </style></head><body>${paginas}</body></html>`;
}
