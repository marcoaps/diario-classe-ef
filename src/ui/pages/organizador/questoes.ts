// Organizador de Provas — reconhece cabeçalho, questões, alternativas e rodapé a partir da
// lista de blocos lida do arquivo. Não muda nenhuma palavra: só decide o que pertence a quê.

import { ehTexto, textoPlano, type Bloco, type Questao, type Secao, type Trecho } from './tipos';

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

// Linhas típicas de cabeçalho de prova (para achar onde começa o cabeçalho do aluno seguinte).
const RE_CABECALHO = /\b(alun[oa]|\(a\)|turma|escola|professor[a]?|disciplina|s[ée]rie|nome|data)\b[^\n]{0,40}:|^\s*avalia[çc][ãa]o\b/i;

/**
 * Num arquivo com vários alunos, o cabeçalho do aluno seguinte vem colado no fim da última
 * questão do anterior. Separa o que ainda é da questão, o rodapé (gabarito) e o cabeçalho novo:
 * o cabeçalho começa depois da última alternativa (ou na primeira imagem/linha de cabeçalho).
 */
function separarCabecalhoSeguinte(fatia: Bloco[]): { questao: Bloco[]; rodape: Bloco[]; cabecalho: Bloco[] } {
  let iAlt = -1;
  fatia.forEach((b, i) => { if (ehAlternativa(b)) iAlt = i; });
  const ehCabecalho = (b: Bloco) => b.tipo === 'imagem' || (b.tipo === 'texto' && RE_CABECALHO.test(textoPlano(b.trechos)));
  let corte = iAlt >= 0 ? iAlt + 1 : fatia.findIndex((b, i) => i > 0 && ehCabecalho(b));
  if (corte < 0) corte = fatia.length;
  const resto = fatia.slice(corte);
  const iRod = resto.findIndex(b => b.tipo === 'texto' && RE_RODAPE.test(textoPlano(b.trechos)));
  if (iRod < 0) return { questao: fatia.slice(0, corte), rodape: [], cabecalho: resto };
  const iCab = resto.findIndex((b, i) => i > iRod && ehCabecalho(b));
  return {
    questao: fatia.slice(0, corte),
    rodape: resto.slice(iRod, iCab < 0 ? resto.length : iCab),
    cabecalho: iCab < 0 ? [] : resto.slice(iCab),
  };
}

/** Une as linhas "Créditos das imagens — A · B" de várias folhas numa só e tira linhas repetidas. */
function mesclarRodape(blocos: Bloco[]): Bloco[] {
  const RE_CRED = /^\s*cr[eé]ditos das imagens\s*[—–-]\s*/i;
  const partes: string[] = [];
  const vistos = new Set<string>();
  const saida: Bloco[] = [];
  let posCred = -1;
  for (const b of blocos) {
    const t = b.tipo === 'texto' ? textoPlano(b.trechos) : '';
    if (RE_CRED.test(t)) {
      t.replace(RE_CRED, '').split(/\s*·\s*/).map(x => x.trim()).filter(Boolean).forEach(p => { if (!partes.includes(p)) partes.push(p); });
      if (posCred < 0) { posCred = saida.length; saida.push(b); }
      continue;
    }
    const chave = b.tipo === 'texto' ? t : JSON.stringify(b).slice(0, 80);
    if (b.tipo === 'texto' && vistos.has(chave)) continue;
    vistos.add(chave);
    saida.push(b);
  }
  if (posCred >= 0) saida[posCred] = { tipo: 'texto', trechos: [{ t: 'Créditos das imagens — ' + partes.join(' · ') }] };
  return saida;
}

const prepararQuestao = (fatia: Bloco[]): Questao => ({
  blocos: fatia.flatMap(separarAlternativas).map(b => (b.tipo === 'texto' && ehAlternativa(b) ? { ...b, tipo: 'alt' as const } : b)),
});

/**
 * Divide os blocos em seções (uma por aluno/prova), cada uma com cabeçalho, questões e rodapé.
 * Cada questão leva tudo até a próxima (texto + imagens + alternativas = um bloco só). Uma nova
 * seção começa quando a numeração volta para "Questão 1". Os padrões "N." só valem se seguirem a
 * sequência (1, 2, 3...), para "1.5 m" ou uma data não abrirem questão falsa.
 */
export function identificarQuestoes(blocos: Bloco[]): { secoes: Secao[]; avisosSecoes: string[] } {
  const inicios: { idx: number; novaSecao: boolean }[] = [];
  let ultimo = 0;
  blocos.forEach((b, idx) => {
    const r = numeroDeQuestao(b);
    if (!r) return;
    const reinicio = r.porPalavra && r.n === 1 && inicios.length > 0;
    const valido = r.porPalavra || r.n === ultimo + 1 || (inicios.length === 0 && r.n <= 1);
    if (valido) { inicios.push({ idx, novaSecao: reinicio }); ultimo = r.n; }
  });
  if (inicios.length === 0) return { secoes: [{ cabecalho: blocos, questoes: [], rodape: [] }], avisosSecoes: [] };

  // grupos de inícios por seção
  const grupos: number[][] = [];
  inicios.forEach(i => { if (i.novaSecao || grupos.length === 0) grupos.push([]); grupos[grupos.length - 1].push(i.idx); });

  const secoes: Secao[] = [];
  let repetidos = 0;
  let inicioCabecalho = 0;
  grupos.forEach((idxs, g) => {
    const ultimaSecao = g === grupos.length - 1;
    const primeira = idxs[0];
    const cabecalho = blocos.slice(inicioCabecalho, primeira);
    const limite = ultimaSecao ? blocos.length : grupos[g + 1][0];
    const questoes: Questao[] = [];
    let rodape: Bloco[] = [];
    const creditosSoltos: Bloco[] = [];
    idxs.forEach((ini, k) => {
      const fim = k + 1 < idxs.length ? idxs[k + 1] : limite;
      let fatia = blocos.slice(ini, fim);
      if (k === idxs.length - 1) {
        if (ultimaSecao) {
          // gabarito/créditos depois da última questão não pertencem a ela
          const iAlt = fatia.findIndex(ehAlternativa);
          const iRod = fatia.findIndex((b, idx) => idx > Math.max(iAlt, 0) && b.tipo === 'texto' && RE_RODAPE.test(textoPlano(b.trechos)));
          if (iRod > 0) { rodape = fatia.slice(iRod); fatia = fatia.slice(0, iRod); }
        } else {
          const sep = separarCabecalhoSeguinte(fatia);
          fatia = sep.questao;
          rodape = sep.rodape;
          inicioCabecalho = limite - sep.cabecalho.length;
        }
      }
      // cabeçalho do MESMO aluno repetido no meio (folha de continuação de um arquivo antigo): sai
      // da questão; os créditos de imagem que vinham junto são preservados no rodapé
      if (!(k === idxs.length - 1 && !ultimaSecao)) {
        const sep = separarCabecalhoSeguinte(fatia);
        if (sep.cabecalho.some(b => b.tipo === 'texto' && /alun[oa]/i.test(textoPlano(b.trechos)))) {
          fatia = sep.questao;
          creditosSoltos.push(...sep.rodape);
          repetidos++;
        }
      }
      questoes.push(prepararQuestao(fatia));
    });
    secoes.push({ cabecalho, questoes, rodape: mesclarRodape([...creditosSoltos, ...rodape]) });
  });
  const avisosSecoes = repetidos > 0 ? [`${repetidos} cabeçalho(s) repetido(s) de folhas de continuação foram removidos; o cabeçalho de cada aluno aparece uma vez, no topo.`] : [];
  return { secoes, avisosSecoes };
}
