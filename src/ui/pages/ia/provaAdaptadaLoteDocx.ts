// Gerador de provas adaptadas — Word (.docx) do LOTE. Em vez do .doc em HTML (que o Word salva com as
// imagens numa pasta separada quando o professor edita), monta um .docx de verdade, com as imagens
// dentro do arquivo, usando o mesmo motor do Organizador de Provas (A4, Arial 12, duas colunas,
// cada aluno em página nova com o cabeçalho no topo).

import { normalizarImagem } from '../organizador/imagens';
import { paginarProva } from '../organizador/layout';
import { gerarDocx } from '../organizador/exportarDocx';
import { CONFIG_PADRAO, type Bloco, type Prova, type Secao, type Trecho } from '../organizador/tipos';
import { ORIENTACOES_POR_NEE, type DadosLote, type ProvaDoAluno } from './provaAdaptadaLote';
import { opcoesDa } from './provaAdaptadaHtml';

const texto = (...trechos: Trecho[]): Bloco => ({ tipo: 'texto', trechos });
const negrito = (t: string): Trecho => ({ t, b: true });

// "Handebol:História,Fundamentos e Regras" -> "Handebol" (o tema inteiro quebrava o título em 2 linhas).
const temaPrincipal = (tema: string): string => tema.split(/[:;,\n]/)[0].trim() || tema;

async function secaoDoAluno(p: ProvaDoAluno, tema: string): Promise<Secao> {
  const cabecalho: Bloco[] = [
    texto(negrito(`Avaliação Adaptada de Educação Física — ${temaPrincipal(tema)} · 2026`)),
    texto({ t: 'Aluno(a): ' }, negrito(p.nomeAluno), { t: '  Nº: ' }, negrito(String(p.alunoNumero || '___')), { t: '  Série: ' }, negrito(p.serie), { t: '  Turma: ' }, negrito(p.turma || '___'), { t: '  Data: ___/___/_____' }),
  ];
  if (p.diagnostico) cabecalho.push(texto({ t: 'Diagnóstico/NEE: ' }, negrito(p.diagnostico)));

  const questoes = [];
  for (const q of p.questoes) {
    const blocos: Bloco[] = [texto(negrito(`Questão ${q.numero}`))];
    if (q.imagemDataUrl) {
      try { blocos.push(await normalizarImagem(q.imagemDataUrl)); } catch (e) { console.error('[Lote .docx] imagem da questão', q.numero, e); }
    }
    if (q.contexto) blocos.push(texto({ t: q.contexto }));
    blocos.push(texto(negrito(q.pergunta)));
    for (const [letra, t] of opcoesDa(q)) blocos.push({ tipo: 'alt', trechos: [negrito(`${letra}) `), { t }] });
    questoes.push({ blocos });
  }

  // créditos exigidos pela licença das imagens do banco
  const creditos = Array.from(new Set(p.questoes.map(q => q.imagemCredito).filter(Boolean) as string[]));
  const rodape: Bloco[] = creditos.length > 0 ? [texto({ t: 'Créditos das imagens — ' + creditos.join(' · '), i: true })] : [];
  return { cabecalho, questoes, rodape };
}

/** Folha final do professor: gabarito e orientações de cada aluno. */
function secaoDoGabarito(d: DadosLote): Secao {
  const rodape: Bloco[] = [];
  for (const p of d.provas) {
    const respostas = p.questoes.map(q => `${q.numero}) ${q.resposta}`).join('   ');
    rodape.push(texto(negrito(`${p.alunoNumero ? p.alunoNumero + '. ' : ''}${p.nomeAluno}`), { t: ` (${p.nee}): ${respostas}` }));
    const orient = ORIENTACOES_POR_NEE[p.nee];
    if (orient) rodape.push(texto({ t: 'Orientações: ' + orient.join(' '), i: true }));
  }
  return { cabecalho: [texto(negrito('GABARITO — uso do professor (não imprimir para os alunos)'))], questoes: [], rodape };
}

/** Converte o lote para o modelo do Organizador (uma seção por aluno + gabarito). */
export async function provaDoLote(d: DadosLote): Promise<Prova> {
  const secoes: Secao[] = [];
  for (const p of d.provas) secoes.push(await secaoDoAluno(p, d.tema));
  if (!d.semGabarito) secoes.push(secaoDoGabarito(d));
  return { nomeArquivo: `Avaliação Adaptada — ${temaPrincipal(d.tema)}`, secoes, imagensFaltando: 0, avisos: [] };
}

/** Word (.docx) do lote: imagens dentro do arquivo, cada aluno em página nova. */
export async function docxLote(d: DadosLote): Promise<Blob> {
  const prova = await provaDoLote(d);
  return gerarDocx(prova, paginarProva(prova, CONFIG_PADRAO));
}

/** Pedido de ilustração de uma questão (guia do professor, na folha final). */
export interface PedidoImagem { numero: number; titulo?: string; prompt: string }

/**
 * Word (.docx) da prova de UM aluno: página(s) do aluno e, no fim, a folha do professor com o
 * gabarito, as orientações e o guia de prompts de imagem.
 */
export async function docxProvaIndividual(p: ProvaDoAluno, tema: string, guia: PedidoImagem[]): Promise<Blob> {
  const dados: DadosLote = { provas: [p], tema, logoSrc: '' };
  const gabarito = secaoDoGabarito(dados);
  if (guia.length > 0) {
    gabarito.rodape.push(texto(negrito('PROMPTS DE IMAGEM (guia do professor — não imprimir; cole um por vez no gerador de imagem)')));
    for (const g of guia) {
      gabarito.rodape.push(texto(negrito(`Imagem da questão ${g.numero}${g.titulo ? ` (${g.titulo})` : ''}`)));
      gabarito.rodape.push(texto({ t: g.prompt }));
    }
  }
  const prova: Prova = { nomeArquivo: `Avaliação Adaptada — ${p.nomeAluno}`, secoes: [await secaoDoAluno(p, tema), gabarito], imagensFaltando: 0, avisos: [] };
  return gerarDocx(prova, paginarProva(prova, CONFIG_PADRAO));
}
