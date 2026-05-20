import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Copy, CheckCircle, Loader2, RefreshCw, FileDown } from 'lucide-react';
import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, AlignmentType, WidthType, BorderStyle, ShadingType,
  VerticalAlign, PageBreak,
} from 'docx';
import { saveAs } from 'file-saver';

const CAMPOS = [
  { id: 'professores', label: 'Professor(es)', tipo: 'text' as const, placeholder: 'Ex: Jessiane / Marco Pedro' },
  { id: 'serie', label: 'Série', tipo: 'select' as const, opcoes: ['6º e 7º Ano', '8º e 9º Ano'] },
  { id: 'bimestre', label: 'Bimestre', tipo: 'select' as const, opcoes: ['1º Bimestre', '2º Bimestre', '3º Bimestre', '4º Bimestre'] },
  { id: 'tema', label: 'Tema / Conteúdo Avaliado', tipo: 'text' as const, placeholder: 'Ex: Futsal — história, regras e fundamentos' },
  { id: 'nivel', label: 'Nível de Dificuldade', tipo: 'select' as const, opcoes: ['Fácil', 'Médio', 'Difícil', 'Misto'] },
  { id: 'contexto', label: 'Observações (opcional)', tipo: 'textarea' as const, placeholder: 'Ex: Turma com foco em inclusão, alunos iniciantes...', required: false },
];

const ETAPAS = [
  { texto: 'Analisando o tema e o nível...', icone: '🔍', duracao: 3000 },
  { texto: 'Elaborando questões objetivas...', icone: '📝', duracao: 6000 },
  { texto: 'Criando alternativas e gabarito...', icone: '✅', duracao: 5000 },
  { texto: 'Redigindo questões dissertativas...', icone: '✏️', duracao: 5000 },
  { texto: 'Elaborando critérios de correção...', icone: '📋', duracao: 4000 },
  { texto: 'Finalizando a avaliação...', icone: '✨', duracao: 99999 },
];

function ProgressoGerando() {
  const [etapaIdx, setEtapaIdx] = useState(0);
  const [progresso, setProgresso] = useState(0);
  const timerRef = useRef<any>(null);
  useEffect(() => {
    let idx = 0;
    const avancar = () => {
      if (idx < ETAPAS.length - 1) {
        idx++;
        setEtapaIdx(idx);
        setProgresso(Math.min(95, Math.round((idx / (ETAPAS.length - 1)) * 95)));
        timerRef.current = setTimeout(avancar, ETAPAS[idx].duracao);
      }
    };
    const inc = setInterval(() => setProgresso(p => {
      const max = Math.round((idx / (ETAPAS.length - 1)) * 95);
      return p < max ? p + 1 : p;
    }), 300);
    timerRef.current = setTimeout(avancar, ETAPAS[0].duracao);
    return () => { clearTimeout(timerRef.current); clearInterval(inc); };
  }, []);
  const etapa = ETAPAS[etapaIdx];
  return (
    <div className="bg-white rounded-2xl border border-blue-100 shadow-sm p-6 flex flex-col gap-5">
      <div className="flex justify-center">
        <div className="w-20 h-20 rounded-full bg-blue-50 border-4 border-blue-200 flex items-center justify-center relative">
          <span className="text-3xl animate-bounce">{etapa.icone}</span>
          <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="36" fill="none" stroke="#dbeafe" strokeWidth="4" />
            <circle cx="40" cy="40" r="36" fill="none" stroke="#3b82f6" strokeWidth="4"
              strokeDasharray={`${2 * Math.PI * 36}`}
              strokeDashoffset={`${2 * Math.PI * 36 * (1 - progresso / 100)}`}
              strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
          </svg>
        </div>
      </div>
      <div className="text-center">
        <p className="font-black text-gray-800 text-base">{etapa.texto}</p>
        <p className="text-xs text-gray-400 mt-1">A IA está elaborando sua avaliação completa</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between text-xs font-semibold text-gray-400"><span>Processando...</span><span>{progresso}%</span></div>
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all duration-500" style={{ width: `${progresso}%` }} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        {ETAPAS.slice(0, -1).map((e, i) => (
          <div key={i} className={`flex items-center gap-2 text-xs transition-all ${i < etapaIdx ? 'text-blue-600' : i === etapaIdx ? 'text-gray-700 font-semibold' : 'text-gray-300'}`}>
            <span className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-[10px] ${i < etapaIdx ? 'bg-blue-100 text-blue-600' : i === etapaIdx ? 'bg-blue-500 text-white animate-pulse' : 'bg-gray-100 text-gray-300'}`}>
              {i < etapaIdx ? '✓' : i + 1}
            </span>
            <span>{e.texto}</span>
          </div>
        ))}
      </div>
      <p className="text-center text-xs text-gray-300 font-medium">Isso pode levar 20 a 40 segundos — aguarde 😊</p>
    </div>
  );
}

function gerarPrompt(v: Record<string, string>) {
  return `Você é professor especialista em Educação Física do Ensino Fundamental.
NÃO use markdown. NÃO use **, ##, *, _. Escreva SOMENTE texto puro.

Crie uma AVALIAÇÃO COMPLETA para:
Professor(es): ${v.professores}
Série: ${v.serie}
Bimestre: ${v.bimestre}
Tema/Conteúdo: ${v.tema}
Nível: ${v.nivel}
${v.contexto ? `Observações: ${v.contexto}` : ''}

Use EXATAMENTE este formato com estes separadores:

TITULO_AVALIACAO
Avaliação ${v.bimestre} - Ensino Fundamental - 2026

INSTRUCOES
Leia atentamente cada questão antes de responder. Use caneta azul ou preta. Não é permitido o uso de corretor.

QUESTOES_OBJETIVAS

Questão 1
[Enunciado contextualizado com situação do cotidiano escolar ou esportivo, nível ${v.nivel}]
a) [alternativa]
b) [alternativa]
c) [alternativa]
d) [alternativa]

Questão 2
[Enunciado]
a) [alternativa]
b) [alternativa]
c) [alternativa]
d) [alternativa]

Questão 3
[Enunciado]
a) [alternativa]
b) [alternativa]
c) [alternativa]
d) [alternativa]

Questão 4
[Enunciado]
a) [alternativa]
b) [alternativa]
c) [alternativa]
d) [alternativa]

Questão 5
[Enunciado]
a) [alternativa]
b) [alternativa]
c) [alternativa]
d) [alternativa]

Questão 6
[Enunciado]
a) [alternativa]
b) [alternativa]
c) [alternativa]
d) [alternativa]

Questão 7
[Enunciado]
a) [alternativa]
b) [alternativa]
c) [alternativa]
d) [alternativa]

Questão 8
[Enunciado]
a) [alternativa]
b) [alternativa]
c) [alternativa]
d) [alternativa]

QUESTOES_DISSERTATIVAS

Questão 9
[Enunciado dissertativo contextualizado, que exija reflexão e elaboração de resposta. 1,0 ponto]

Questão 10
[Enunciado dissertativo contextualizado, diferente do anterior. 1,0 ponto]

GABARITO_OBJETIVAS
1: [letra correta]
2: [letra correta]
3: [letra correta]
4: [letra correta]
5: [letra correta]
6: [letra correta]
7: [letra correta]
8: [letra correta]

GABARITO_DISSERTATIVAS

Questão 9 - Critérios de correção:
[critério 1 - 0,25 pontos]
[critério 2 - 0,25 pontos]
[critério 3 - 0,25 pontos]
[critério 4 - 0,25 pontos]

Questão 10 - Critérios de correção:
[critério 1 - 0,25 pontos]
[critério 2 - 0,25 pontos]
[critério 3 - 0,25 pontos]
[critério 4 - 0,25 pontos]

REGRAS IMPORTANTES:
- Questões objetivas valem 1,0 ponto cada (total 8,0)
- Questões dissertativas valem 1,0 ponto cada (total 2,0)
- Contextualize as questões com situações reais do cotidiano escolar e esportivo
- As alternativas erradas devem ser plausíveis mas claramente incorretas
- Adeque ao ${v.serie} do Ensino Fundamental`;
}

// ── LIMPEZA ───────────────────────────────────────────────────────────────────
function limpar(texto: string): string {
  return texto
    .replace(/\*\*/g, '').replace(/\*/g, '')
    .replace(/^#{1,6}\s*/gm, '').replace(/_+/g, '')
    .replace(/\n{3,}/g, '\n\n').trim();
}

// ── PARSER ────────────────────────────────────────────────────────────────────
function extrairBloco(texto: string, inicio: string, fim: string): string {
  const s = texto.indexOf(inicio);
  if (s < 0) return '';
  const depois = texto.slice(s + inicio.length);
  const f = fim ? depois.indexOf(fim) : depois.length;
  return (f >= 0 ? depois.slice(0, f) : depois).trim();
}

interface QuestaoObj {
  numero: number;
  enunciado: string;
  alternativas: { letra: string; texto: string }[];
}

interface QuestaoDis {
  numero: number;
  enunciado: string;
}

interface Gabarito {
  objetivas: { numero: number; resposta: string }[];
  dissertativas: { numero: number; criterios: string[] }[];
}

function parsearProva(textoOriginal: string) {
  const t = limpar(textoOriginal);

  const titulo = extrairBloco(t, 'TITULO_AVALIACAO', 'INSTRUCOES').trim();
  const instrucoes = extrairBloco(t, 'INSTRUCOES', 'QUESTOES_OBJETIVAS').trim();
  const blocoObj = extrairBloco(t, 'QUESTOES_OBJETIVAS', 'QUESTOES_DISSERTATIVAS');
  const blocoDis = extrairBloco(t, 'QUESTOES_DISSERTATIVAS', 'GABARITO_OBJETIVAS');
  const blocoGabObj = extrairBloco(t, 'GABARITO_OBJETIVAS', 'GABARITO_DISSERTATIVAS');
  const blocoGabDis = extrairBloco(t, 'GABARITO_DISSERTATIVAS', '');

  // Parser questões objetivas
  const questoesObj: QuestaoObj[] = [];
  const regexQ = /Questão\s+(\d+)\s*\n([\s\S]*?)(?=Questão\s+\d+|$)/gi;
  const matchesObj = [...blocoObj.matchAll(regexQ)];
  matchesObj.forEach(m => {
    const num = parseInt(m[1]);
    const corpo = m[2].trim();
    const linhas = corpo.split('\n').map(l => l.trim()).filter(Boolean);
    const enunciado = linhas.filter(l => !l.match(/^[a-d]\)/i)).join(' ');
    const alternativas = linhas
      .filter(l => l.match(/^[a-d]\)/i))
      .map(l => ({ letra: l[0].toLowerCase(), texto: l.slice(2).trim() }));
    if (enunciado) questoesObj.push({ numero: num, enunciado, alternativas });
  });

  // Parser questões dissertativas
  const questoesDis: QuestaoDis[] = [];
  const regexDis = /Questão\s+(\d+)\s*\n([\s\S]*?)(?=Questão\s+\d+|$)/gi;
  const matchesDis = [...blocoDis.matchAll(regexDis)];
  matchesDis.forEach(m => {
    const num = parseInt(m[1]);
    const enunciado = m[2].trim();
    if (enunciado) questoesDis.push({ numero: num, enunciado });
  });

  // Parser gabarito objetivas
  const gabObj: { numero: number; resposta: string }[] = [];
  blocoGabObj.split('\n').forEach(l => {
    const m = l.match(/(\d+):\s*([a-d])/i);
    if (m) gabObj.push({ numero: parseInt(m[1]), resposta: m[2].toLowerCase() });
  });

  // Parser gabarito dissertativas
  const gabDis: { numero: number; criterios: string[] }[] = [];
  const regexGDis = /Questão\s+(\d+)[^\n]*\n([\s\S]*?)(?=Questão\s+\d+|$)/gi;
  const matchesGDis = [...blocoGabDis.matchAll(regexGDis)];
  matchesGDis.forEach(m => {
    const num = parseInt(m[1]);
    const criterios = m[2].trim().split('\n').map(l => l.trim()).filter(Boolean);
    gabDis.push({ numero: num, criterios });
  });

  return { titulo, instrucoes, questoesObj, questoesDis, gabarito: { objetivas: gabObj, dissertativas: gabDis } };
}

// ── WORD ──────────────────────────────────────────────────────────────────────
const AZ = '1F3864', VM = 'C0392B', BR = 'FFFFFF', CZ = 'F2F2F2';

const mkRun = (t: string, o: any = {}): TextRun =>
  new TextRun({ text: t, font: 'Arial', size: o.sz ?? 20, bold: o.bold, color: o.cor ?? '000000', italics: o.it, underline: o.ul ? {} : undefined });

const mkPar = (runs: TextRun[], align = AlignmentType.LEFT, a = 60, d = 60): Paragraph =>
  new Paragraph({ children: runs, alignment: align, spacing: { before: a, after: d } });

const mkBd = (cor = AZ) => {
  const b = { style: BorderStyle.SINGLE, size: 8, color: cor };
  return { top: b, bottom: b, left: b, right: b, insideH: b, insideV: b };
};

const mkCell = (children: Paragraph[], cor?: string, cols?: number, rows?: number): TableCell =>
  new TableCell({
    ...(cols ? { columnSpan: cols } : {}),
    ...(rows ? { rowSpan: rows } : {}),
    ...(cor ? { shading: { type: ShadingType.SOLID, color: cor } } : {}),
    verticalAlign: VerticalAlign.CENTER,
    children,
  });

async function exportarWord(textoOriginal: string, valores: Record<string, string>) {
  const d = parsearProva(textoOriginal);
  const esp = (n = 80) => new Paragraph({ children: [], spacing: { before: n, after: 0 } });

  // ── CABEÇALHO ────────────────────────────────────────────────────────────
  const cabecalho = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: mkBd(),
    rows: [
      new TableRow({ children: [
        // Célula logo (simulada com texto IOP)
        mkCell([
          mkPar([mkRun('I.O.P.', { bold: true, cor: AZ, sz: 28 })], AlignmentType.CENTER, 40, 10),
          mkPar([mkRun('Instituto Odilon Pratagi', { sz: 14, cor: AZ })], AlignmentType.CENTER, 0, 40),
        ], CZ, undefined, 3),
        // Célula título principal
        mkCell([
          mkPar([mkRun(d.titulo || `Avaliação ${valores.bimestre} - Ensino Fundamental - 2026`, { bold: true, sz: 26, cor: AZ })], AlignmentType.LEFT, 60, 10),
          mkPar([mkRun('Disciplina: Educação Física', { bold: true, sz: 22 })], AlignmentType.LEFT, 10, 10),
          mkPar([mkRun(`Professor(a): ${valores.professores}`, { bold: true, sz: 22 })], AlignmentType.LEFT, 10, 10),
          mkPar([mkRun(`Série: ${valores.serie}`, { bold: true, sz: 22 })], AlignmentType.LEFT, 10, 50),
        ], undefined, 1),
      ]}),
      new TableRow({ children: [
        mkCell([
          mkPar([mkRun('Nome: _____________________________________________  Nº: ______', { sz: 20 })], AlignmentType.LEFT, 80, 40),
          mkPar([mkRun('Turma: _________  Data: ____/____/______  Nota: ________', { sz: 20 })], AlignmentType.LEFT, 0, 80),
        ], undefined, 2),
      ]}),
    ],
  });

  // ── INSTRUÇÕES ───────────────────────────────────────────────────────────
  const instrucoes = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: mkBd(VM),
    rows: [
      new TableRow({ children: [
        mkCell([
          mkPar([mkRun('Instruções: ', { bold: true, sz: 20, cor: VM }), mkRun(d.instrucoes || 'Leia atentamente cada questão antes de responder. Use caneta azul ou preta. Não é permitido o uso de corretor.', { sz: 20 })], AlignmentType.LEFT, 60, 60),
        ]),
      ]}),
    ],
  });

  // ── PARTE 1 TÍTULO ───────────────────────────────────────────────────────
  const parte1Titulo = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: mkBd(),
    rows: [
      new TableRow({ children: [
        mkCell([
          mkPar([mkRun('PARTE 1 — QUESTÕES OBJETIVAS', { bold: true, sz: 22, cor: BR }),
                 mkRun('  (8,0 pontos)', { sz: 20, cor: BR })], AlignmentType.CENTER, 80, 80),
        ], AZ),
      ]}),
    ],
  });

  // ── QUESTÕES OBJETIVAS ───────────────────────────────────────────────────
  const questoesObjRows: TableRow[] = [];
  d.questoesObj.forEach((q, idx) => {
    const bg = idx % 2 === 0 ? BR : 'F8F9FF';
    questoesObjRows.push(new TableRow({ children: [
      mkCell([
        mkPar([mkRun(`Questão ${q.numero} – `, { bold: true, sz: 20 }), mkRun(q.enunciado, { sz: 20 })], AlignmentType.LEFT, 80, 40),
        ...q.alternativas.map(alt =>
          mkPar([mkRun(`(${alt.letra.toUpperCase()}) `, { bold: true, sz: 20 }), mkRun(alt.texto, { sz: 20 })], AlignmentType.LEFT, 20, 20)
        ),
        mkPar([mkRun('')], AlignmentType.LEFT, 20, 40),
      ], bg),
    ]}));
  });

  // Fallback se parser não encontrou questões
  if (questoesObjRows.length === 0) {
    const blocoObj = extrairBloco(limpar(textoOriginal), 'QUESTOES_OBJETIVAS', 'QUESTOES_DISSERTATIVAS');
    questoesObjRows.push(new TableRow({ children: [
      mkCell(blocoObj.split('\n').filter(l => l.trim()).map(l =>
        mkPar([mkRun(l, { sz: 20 })], AlignmentType.LEFT, 20, 20)
      )),
    ]}));
  }

  const tabelaObj = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: mkBd(),
    rows: questoesObjRows,
  });

  // ── PARTE 2 TÍTULO ───────────────────────────────────────────────────────
  const parte2Titulo = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: mkBd(),
    rows: [
      new TableRow({ children: [
        mkCell([
          mkPar([mkRun('PARTE 2 — QUESTÕES DISSERTATIVAS', { bold: true, sz: 22, cor: BR }),
                 mkRun('  (2,0 pontos)', { sz: 20, cor: BR })], AlignmentType.CENTER, 80, 80),
        ], AZ),
      ]}),
    ],
  });

  // ── QUESTÕES DISSERTATIVAS ───────────────────────────────────────────────
  const linhasResposta = () => [1, 2, 3, 4, 5, 6, 7, 8].map(() =>
    mkPar([mkRun('___________________________________________________________________________', { sz: 20, cor: 'AAAAAA' })], AlignmentType.LEFT, 30, 10)
  );

  const questoesDis = d.questoesDis.length > 0
    ? d.questoesDis.flatMap((q, idx) => [
      new TableRow({ children: [
        mkCell([
          mkPar([mkRun(`Questão ${q.numero} – `, { bold: true, sz: 20 }), mkRun(`(1,0 ponto)`, { sz: 18, cor: '666666', it: true })], AlignmentType.LEFT, 80, 20),
          mkPar([mkRun(q.enunciado, { sz: 20 })], AlignmentType.LEFT, 10, 40),
          mkPar([mkRun('Resposta:', { bold: true, sz: 20 })], AlignmentType.LEFT, 20, 20),
          ...linhasResposta(),
          mkPar([mkRun('')], AlignmentType.LEFT, 20, 60),
        ], idx % 2 === 0 ? BR : 'F8F9FF'),
      ]}),
    ])
    : [new TableRow({ children: [
      mkCell([mkPar([mkRun(extrairBloco(limpar(textoOriginal), 'QUESTOES_DISSERTATIVAS', 'GABARITO_OBJETIVAS'), { sz: 20 })])]),
    ]})]
  ;

  const tabelaDis = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: mkBd(),
    rows: questoesDis,
  });

  // ── GABARITO (nova página) ────────────────────────────────────────────────
  const quebra = new Paragraph({ children: [new PageBreak()], spacing: { before: 0, after: 0 } });

  const gabCabecalho = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: mkBd(VM),
    rows: [
      new TableRow({ children: [
        mkCell([mkPar([mkRun('GABARITO', { bold: true, sz: 26, cor: BR })], AlignmentType.CENTER, 80, 80)], VM),
      ]}),
      new TableRow({ children: [
        mkCell([mkPar([mkRun(`${valores.serie}  |  Educação Física  |  ${valores.bimestre}  |  ${valores.tema || ''}`, { sz: 20, cor: AZ })], AlignmentType.CENTER, 60, 60)]),
      ]}),
    ],
  });

  // Gabarito objetivas em grid 2x4
  const gabObjTitulo = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: mkBd(),
    rows: [
      new TableRow({ children: [
        mkCell([mkPar([mkRun('QUESTÕES OBJETIVAS', { bold: true, sz: 20, cor: BR })], AlignmentType.CENTER, 60, 60)], AZ),
      ]}),
    ],
  });

  const gabObjGrid = new Table({
    width: { size: 60, type: WidthType.PERCENTAGE },
    borders: mkBd(),
    rows: [
      new TableRow({ children: [1, 2, 3, 4].map(n => {
        const gab = d.gabarito.objetivas.find(g => g.numero === n);
        return mkCell([
          mkPar([mkRun(`${n}.`, { bold: true, sz: 20 }), mkRun(`  ${(gab?.resposta || '?').toUpperCase()}`, { bold: true, sz: 20, cor: VM })], AlignmentType.CENTER, 60, 60)
        ]);
      })}),
      new TableRow({ children: [5, 6, 7, 8].map(n => {
        const gab = d.gabarito.objetivas.find(g => g.numero === n);
        return mkCell([
          mkPar([mkRun(`${n}.`, { bold: true, sz: 20 }), mkRun(`  ${(gab?.resposta || '?').toUpperCase()}`, { bold: true, sz: 20, cor: VM })], AlignmentType.CENTER, 60, 60)
        ]);
      })}),
    ],
  });

  // Gabarito dissertativas
  const gabDisTitulo = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: mkBd(),
    rows: [
      new TableRow({ children: [
        mkCell([mkPar([mkRun('CRITÉRIOS DE CORREÇÃO — QUESTÕES DISSERTATIVAS', { bold: true, sz: 20, cor: BR })], AlignmentType.CENTER, 60, 60)], AZ),
      ]}),
    ],
  });

  const gabDisRows: TableRow[] = [];
  d.gabarito.dissertativas.forEach((gab, idx) => {
    gabDisRows.push(new TableRow({ children: [
      mkCell([
        mkPar([mkRun(`Questão ${gab.numero}`, { bold: true, sz: 20, cor: AZ }), mkRun(' (1,0 ponto)', { sz: 18, cor: '666666', it: true })], AlignmentType.LEFT, 80, 40),
        ...gab.criterios.map((c, ci) =>
          mkPar([mkRun(`• ${c}`, { sz: 20 })], AlignmentType.LEFT, 20, 20)
        ),
        mkPar([mkRun('')], AlignmentType.LEFT, 20, 60),
      ], idx % 2 === 0 ? BR : CZ),
    ]}));
  });

  if (gabDisRows.length === 0) {
    const blocoGabDis = extrairBloco(limpar(textoOriginal), 'GABARITO_DISSERTATIVAS', '');
    gabDisRows.push(new TableRow({ children: [
      mkCell(blocoGabDis.split('\n').filter(l => l.trim()).map(l =>
        mkPar([mkRun(l, { sz: 20 })], AlignmentType.LEFT, 20, 20)
      )),
    ]}));
  }

  const tabelaGabDis = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: mkBd(),
    rows: gabDisRows,
  });

  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } } },
      children: [
        cabecalho, esp(100),
        instrucoes, esp(100),
        parte1Titulo,
        tabelaObj, esp(100),
        parte2Titulo,
        tabelaDis,
        quebra,
        gabCabecalho, esp(100),
        gabObjTitulo,
        gabObjGrid, esp(100),
        gabDisTitulo,
        tabelaGabDis,
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const serie = (valores.serie || 'turma').replace(/[^a-z0-9]/gi, '_');
  const bim = (valores.bimestre || '').replace(/[^a-z0-9]/gi, '_');
  saveAs(blob, `avaliacao_ef_${serie}_${bim}.docx`);
}

// ── COMPONENTE ────────────────────────────────────────────────────────────────
export function IAProvaOficial() {
  const navigate = useNavigate();
  const [valores, setValores] = useState<Record<string, string>>({});
  const [resultado, setResultado] = useState('');
  const [gerando, setGerando] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState('');

  const atualizar = (id: string, val: string) => setValores(prev => ({ ...prev, [id]: val }));

  const gerar = async () => {
    const faltando = CAMPOS.filter(c => c.required !== false && !valores[c.id]?.trim());
    if (faltando.length > 0) { setErro(`Preencha: ${faltando.map(c => c.label).join(', ')}`); return; }
    setErro(''); setGerando(true); setResultado('');
    try {
      const resp = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4000,
          messages: [{ role: 'user', content: gerarPrompt(valores) }],
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error?.message || 'Erro na API');
      setResultado(data.content?.[0]?.text || '');
    } catch (e: any) { setErro('Erro ao gerar: ' + e.message); }
    finally { setGerando(false); }
  };

  const copiar = () => {
    navigator.clipboard.writeText(resultado);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const baixarWord = async () => {
    setExportando(true);
    try { await exportarWord(resultado, valores); }
    catch (e: any) { alert('Erro ao gerar Word: ' + e.message); }
    finally { setExportando(false); }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 pb-36">
      <div className="p-5 text-white relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #C0392B, #922B21)' }}>
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10" />
        <button onClick={() => navigate('/ia')} className="flex items-center gap-1.5 text-white/70 text-sm font-semibold mb-3 relative z-10 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Ferramentas IA
        </button>
        <h1 className="text-lg font-black relative z-10 leading-tight">Gerador de Avaliações</h1>
        <p className="text-sm text-white/70 mt-1 relative z-10">Modelo oficial IOP · 8 objetivas + 2 dissertativas · Exportação Word</p>
      </div>

      <div className="p-4 flex flex-col gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3">
          {CAMPOS.map(campo => (
            <div key={campo.id}>
              <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-1.5">{campo.label}</label>
              {campo.tipo === 'select' ? (
                <select value={valores[campo.id] || ''} onChange={e => atualizar(campo.id, e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400">
                  <option value="">Selecione...</option>
                  {campo.opcoes?.map(op => <option key={op} value={op}>{op}</option>)}
                </select>
              ) : campo.tipo === 'textarea' ? (
                <textarea value={valores[campo.id] || ''} onChange={e => atualizar(campo.id, e.target.value)}
                  placeholder={campo.placeholder} rows={2}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 resize-none" />
              ) : (
                <input type="text" value={valores[campo.id] || ''} onChange={e => atualizar(campo.id, e.target.value)}
                  placeholder={campo.placeholder}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400" />
              )}
            </div>
          ))}

          {erro && <p className="text-xs text-red-500 font-semibold bg-red-50 border border-red-200 rounded-xl px-3 py-2">{erro}</p>}

          <button onClick={gerar} disabled={gerando}
            className="w-full py-4 rounded-2xl font-black text-white flex items-center justify-center gap-2 disabled:opacity-60 transition-all active:scale-95 shadow-lg"
            style={{ background: 'linear-gradient(135deg, #C0392B, #922B21)' }}>
            {gerando ? <><Loader2 className="w-5 h-5 animate-spin" /> Gerando...</> : <><Sparkles className="w-5 h-5" /> Gerar Avaliação</>}
          </button>
        </div>

        {gerando && <ProgressoGerando />}

        {resultado && !gerando && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-red-50 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-red-600" />
                <span className="text-sm font-black text-red-700">Avaliação gerada!</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button onClick={gerar} className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-600 font-semibold">
                  <RefreshCw className="w-3.5 h-3.5" /> Gerar nova
                </button>
                <button onClick={copiar}
                  className={`flex items-center gap-1 text-xs font-black px-3 py-1.5 rounded-lg transition-all ${copiado ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
                  {copiado ? <><CheckCircle className="w-3.5 h-3.5" /> Copiado!</> : <><Copy className="w-3.5 h-3.5" /> Copiar</>}
                </button>
                <button onClick={baixarWord} disabled={exportando}
                  className="flex items-center gap-1 text-xs font-black px-3 py-1.5 rounded-lg text-white disabled:opacity-60 transition-all"
                  style={{ background: 'linear-gradient(135deg, #C0392B, #922B21)' }}>
                  {exportando ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Gerando...</> : <><FileDown className="w-3.5 h-3.5" /> Baixar Word</>}
                </button>
              </div>
            </div>
            <div className="p-4">
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">{limpar(resultado)}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
