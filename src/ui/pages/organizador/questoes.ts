// Organizador de Provas — reconhece cabeçalho, questões, alternativas e rodapé a partir da
// lista de blocos lida do arquivo. Não muda nenhuma palavra: só decide o que pertence a quê.

import { ehTexto, textoPlano, type Bloco, type Prova, type Questao, type Trecho } from './tipos';

const RE_QUESTAO = /^\s*QUEST[ÃA]O\s*(?:N[º°.o]*\s*)?0*(\d+)/i; // "Questão 01", "QUESTÃO 1 -"
const RE_NUMERO = /^\s*0*(\d{1,3})(?:\s*\)\s*|\.\s+|\s+[-–—]\s+)\S/; // "1. ", "01)", "1 - "
const RE_ALTERNATIVA = /^\s*\(?([A-Ea-e])\s*(?:\)|\.\s)\s*\S/; // "A) ", "a) ", "(A) ", "A. "
const RE_RODAPE = /^\s*(gabarito|cr[eé]ditos?|respostas|refer[êe]ncias|fontes?)\b/i;
const RE_SO_ROTULO = /^\s*QUEST[ÃA]O\s*(?:N[º°.o]*\s*)?0*\d+\s*[-–:.)]?\s*$/i;

export const ehRotuloIsolado = (b: Bloco): boolean => b.tipo === 'texto' && RE_SO_ROTULO.test(textoPlano(b.trechos));

/** Número que abre uma questão (pelo padrão "Questão N" ou "N."), ou null. */
function numeroDeQuestao(b: Bloco): { n: number; porPalavra: boolean } | null {
  if (b.tipo !== 'texto') return null;
  const t = textoPlano(b.trechos);
  const q = RE_QUESTAO.exec(t);
  if (q) return { n: parseInt(q[1], 10), porPalavra: true };
  const n = RE_NUMERO.exec(t);
  if (n) return { n: parseInt(n[1], 10), porPalavra: false };
  return null;
}

export const ehAlternativa = (b: Bloco): boolean => ehTexto(b) && !RE_QUESTAO.test(textoPlano(b.trechos)) && RE_ALTERNATIVA.test(textoPlano(b.trechos));

// ── Trechos: recortar por posição de caractere, sem perder negrito/itálico ───

function recortar(trechos: Trecho[], ini: number, fim: number): Trecho[] {
  const saida: Trecho[] = [];
  let pos = 0;
  for (const tr of trechos) {
    const a = Math.max(ini, pos);
    const b = Math.min(fim, pos + tr.t.length);
    if (b > a) saida.push({ ...tr, t: tr.t.slice(a - pos, b - pos) });
    pos += tr.t.length;
  }
  return saida;
}

/** "A) x  B) y  C) z" numa linha só vira uma alternativa por linha (só quando as letras seguem A, B, C...). */
export function separarAlternativas(b: Bloco): Bloco[] {
  if (b.tipo !== 'texto' && b.tipo !== 'alt') return [b];
  const t = textoPlano(b.trechos);
  const primeira = RE_ALTERNATIVA.exec(t);
  if (!primeira) return [b];
  const cortes: number[] = [0];
  let esperada = primeira[1].toUpperCase().charCodeAt(0) + 1;
  const re = /\s+\(?([A-Ea-e])\)\s*(?=\S)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    if (m[1].toUpperCase().charCodeAt(0) !== esperada) continue;
    cortes.push(m.index + (m[0].length - m[0].trimStart().length));
    esperada++;
  }
  if (cortes.length < 2) return [{ tipo: 'alt', trechos: b.trechos }];
  return cortes.map((ini, k) => ({ tipo: 'alt' as const, trechos: recortar(b.trechos, ini, k + 1 < cortes.length ? cortes[k + 1] : t.length) }))
    .map(a => ({ ...a, trechos: aparar(a.trechos) }));
}

function aparar(trechos: Trecho[]): Trecho[] {
  const r = trechos.map(t => ({ ...t }));
  if (r.length) { r[0].t = r[0].t.replace(/^\s+/, ''); r[r.length - 1].t = r[r.length - 1].t.replace(/\s+$/, ''); }
  return r.filter(t => t.t !== '');
}

// ── Agrupamento ──────────────────────────────────────────────────────────────

/**
 * Divide os blocos em cabeçalho, questões e rodapé. Cada questão leva tudo até a próxima
 * (texto + imagens + alternativas = um bloco só). Os padrões "N." só valem se seguirem a
 * sequência (1, 2, 3...), para "1.5 m" ou uma data não abrirem questão falsa.
 */
export function identificarQuestoes(blocos: Bloco[]): Pick<Prova, 'cabecalho' | 'questoes' | 'rodape'> {
  const inicios: number[] = [];
  let ultimo = 0;
  blocos.forEach((b, idx) => {
    const r = numeroDeQuestao(b);
    if (!r) return;
    const valido = r.porPalavra || (r.n === ultimo + 1 || (inicios.length === 0 && r.n <= 1));
    if (valido) { inicios.push(idx); ultimo = r.n; }
  });
  if (inicios.length === 0) return { cabecalho: blocos, questoes: [], rodape: [] };

  const cabecalho = blocos.slice(0, inicios[0]);
  const questoes: Questao[] = [];
  let rodape: Bloco[] = [];
  inicios.forEach((ini, k) => {
    let fatia = blocos.slice(ini, k + 1 < inicios.length ? inicios[k + 1] : blocos.length);
    if (k === inicios.length - 1) {
      // gabarito/créditos depois da última questão não pertencem a ela
      const iAlt = fatia.findIndex(ehAlternativa);
      const iRod = fatia.findIndex((b, idx) => idx > Math.max(iAlt, 0) && b.tipo === 'texto' && RE_RODAPE.test(textoPlano(b.trechos)));
      if (iRod > 0) { rodape = fatia.slice(iRod); fatia = fatia.slice(0, iRod); }
    }
    questoes.push({ blocos: fatia.flatMap(separarAlternativas).map(b => (b.tipo === 'texto' && ehAlternativa(b) ? { ...b, tipo: 'alt' as const } : b)) });
  });
  return { cabecalho, questoes, rodape };
}
