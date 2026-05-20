import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Copy, CheckCircle, Loader2, RefreshCw, FileDown } from 'lucide-react';
import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, AlignmentType, WidthType, BorderStyle, ShadingType,
  VerticalAlign, PageBreak, ImageRun, ColumnBreak,
} from 'docx';
import { saveAs } from 'file-saver';

const CAMPOS = [
  { id: 'professores', label: 'Professor(es)', tipo: 'text' as const, placeholder: 'Ex: Jessiane / Marco Pedro' },
  { id: 'serie', label: 'Série', tipo: 'select' as const, opcoes: ['6º e 7º Ano', '8º e 9º Ano'] },
  { id: 'bimestre', label: 'Bimestre', tipo: 'select' as const, opcoes: ['1º Bimestre', '2º Bimestre', '3º Bimestre', '4º Bimestre'] },
  { id: 'tema', label: 'Tema / Conteúdo Avaliado', tipo: 'text' as const, placeholder: 'Ex: Futsal — história, regras e fundamentos' },
  { id: 'nivel', label: 'Nível de Dificuldade', tipo: 'select' as const, opcoes: ['Fácil', 'Médio', 'Difícil', 'Misto'] },
  { id: 'contexto', label: 'Observações (opcional)', tipo: 'textarea' as const, placeholder: 'Ex: Foco em inclusão, alunos iniciantes...', required: false },
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
    <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-6 flex flex-col gap-5">
      <div className="flex justify-center">
        <div className="w-20 h-20 rounded-full bg-red-50 border-4 border-red-200 flex items-center justify-center relative">
          <span className="text-3xl animate-bounce">{etapa.icone}</span>
          <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="36" fill="none" stroke="#fee2e2" strokeWidth="4" />
            <circle cx="40" cy="40" r="36" fill="none" stroke="#ef4444" strokeWidth="4"
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
          <div className="h-full bg-gradient-to-r from-red-600 to-red-400 rounded-full transition-all duration-500" style={{ width: `${progresso}%` }} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        {ETAPAS.slice(0, -1).map((e, i) => (
          <div key={i} className={`flex items-center gap-2 text-xs transition-all ${i < etapaIdx ? 'text-red-600' : i === etapaIdx ? 'text-gray-700 font-semibold' : 'text-gray-300'}`}>
            <span className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-[10px] ${i < etapaIdx ? 'bg-red-100 text-red-600' : i === etapaIdx ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 text-gray-300'}`}>
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

SIGA EXATAMENTE este formato. Não adicione texto fora dos blocos.

QUESTOES_OBJETIVAS

Questão 1
[Enunciado contextualizado - situação real do cotidiano escolar ou esportivo]
(A) [alternativa]
(B) [alternativa]
(C) [alternativa]
(D) [alternativa]

Questão 2
[Enunciado]
(A) [alternativa]
(B) [alternativa]
(C) [alternativa]
(D) [alternativa]

Questão 3
[Enunciado]
(A) [alternativa]
(B) [alternativa]
(C) [alternativa]
(D) [alternativa]

Questão 4
[Enunciado]
(A) [alternativa]
(B) [alternativa]
(C) [alternativa]
(D) [alternativa]

Questão 5
[Enunciado]
(A) [alternativa]
(B) [alternativa]
(C) [alternativa]
(D) [alternativa]

Questão 6
[Enunciado]
(A) [alternativa]
(B) [alternativa]
(C) [alternativa]
(D) [alternativa]

Questão 7
[Enunciado]
(A) [alternativa]
(B) [alternativa]
(C) [alternativa]
(D) [alternativa]

Questão 8
[Enunciado]
(A) [alternativa]
(B) [alternativa]
(C) [alternativa]
(D) [alternativa]

QUESTOES_DISSERTATIVAS

Questão 9
[Enunciado dissertativo que exija reflexão. Vale 1,0 ponto]

Questão 10
[Enunciado dissertativo diferente do anterior. Vale 1,0 ponto]

GABARITO_OBJETIVAS
1: [A, B, C ou D]
2: [A, B, C ou D]
3: [A, B, C ou D]
4: [A, B, C ou D]
5: [A, B, C ou D]
6: [A, B, C ou D]
7: [A, B, C ou D]
8: [A, B, C ou D]

GABARITO_DISSERTATIVAS

Questão 9 - Criterios:
[criterio 1 - 0,25 pontos]
[criterio 2 - 0,25 pontos]
[criterio 3 - 0,25 pontos]
[criterio 4 - 0,25 pontos]

Questão 10 - Criterios:
[criterio 1 - 0,25 pontos]
[criterio 2 - 0,25 pontos]
[criterio 3 - 0,25 pontos]
[criterio 4 - 0,25 pontos]`;
}

// ── LIMPEZA ───────────────────────────────────────────────────────────────────
function limpar(t: string): string {
  return t
    .replace(/\r\n/g, '\n').replace(/\r/g, '\n') // normalizar line endings Windows
    .replace(/\*\*/g, '').replace(/\*/g, '')      // remover negrito/itálico markdown
    .replace(/^#{1,6}\s*/gm, '')                  // remover títulos markdown
    .replace(/_+/g, '')                           // remover underscore
    .replace(/\n{3,}/g, '\n\n')                   // max 2 linhas em branco seguidas
    .trim();
}

function extrairBloco(texto: string, inicio: string, fim: string): string {
  const s = texto.indexOf(inicio);
  if (s < 0) return '';
  const depois = texto.slice(s + inicio.length);
  const f = fim ? depois.indexOf(fim) : depois.length;
  return (f >= 0 ? depois.slice(0, f) : depois).trim();
}

interface QuestaoObj { numero: number; enunciado: string; alternativas: { letra: string; texto: string }[] }
interface QuestaoDis { numero: number; enunciado: string }

function parsearProva(textoOriginal: string) {
  const t = limpar(textoOriginal);
  const blocoObj = extrairBloco(t, 'QUESTOES_OBJETIVAS', 'QUESTOES_DISSERTATIVAS');
  const blocoDis = extrairBloco(t, 'QUESTOES_DISSERTATIVAS', 'GABARITO_OBJETIVAS');
  const blocoGabObj = extrairBloco(t, 'GABARITO_OBJETIVAS', 'GABARITO_DISSERTATIVAS');
  const blocoGabDis = extrairBloco(t, 'GABARITO_DISSERTATIVAS', '');

  // Parser questões objetivas
  const questoesObj: QuestaoObj[] = [];
  // Remove linhas em branco duplas dentro do bloco para o regex funcionar
  const blocoObjNorm = blocoObj.replace(/\n{2,}/g, '\n');
  const regex = /Questão\s+(\d+)\s*\n([\s\S]*?)(?=Questão\s+\d+\s*\n|$)/gi;
  for (const m of blocoObjNorm.matchAll(regex)) {
    const num = parseInt(m[1]);
    const corpo = m[2].trim();
    const linhas = corpo.split('\n').map(l => l.trim()).filter(Boolean);
    const isAlt = (l: string) => /^\([A-Da-d]\)/.test(l);
    const enunciado = linhas.filter(l => !isAlt(l)).join(' ');
    const alternativas = linhas.filter(isAlt).map(l => ({
      letra: l[1].toUpperCase(),
      texto: l.slice(3).trim(),
    }));
    if (enunciado) questoesObj.push({ numero: num, enunciado, alternativas });
  }

  // Parser questões dissertativas
  const questoesDis: QuestaoDis[] = [];
  const blocoDisNorm = blocoDis.replace(/\n{2,}/g, '\n');
  const regexDis = /Questão\s+(\d+)\s*\n([\s\S]*?)(?=Questão\s+\d+\s*\n|$)/gi;
  for (const m of blocoDisNorm.matchAll(regexDis)) {
    questoesDis.push({ numero: parseInt(m[1]), enunciado: m[2].trim() });
  }

  // Gabarito objetivas
  const gabObj: { numero: number; resposta: string }[] = [];
  for (const l of blocoGabObj.split('\n')) {
    const m = l.match(/(\d+)\s*:\s*([A-Da-d])/);
    if (m) gabObj.push({ numero: parseInt(m[1]), resposta: m[2].toUpperCase() });
  }

  // Gabarito dissertativas
  const gabDis: { numero: number; criterios: string[] }[] = [];
  const blocoGabDisNorm = blocoGabDis.replace(/\n{2,}/g, '\n');
  const regexGD = /Questão\s+(\d+)[^\n]*\n([\s\S]*?)(?=Questão\s+\d+|$)/gi;
  for (const m of blocoGabDisNorm.matchAll(regexGD)) {
    gabDis.push({
      numero: parseInt(m[1]),
      criterios: m[2].trim().split('\n').map(l => l.trim()).filter(Boolean),
    });
  }

  return { questoesObj, questoesDis, gabObj, gabDis, textoLimpo: t };
}

// ── WORD ──────────────────────────────────────────────────────────────────────
const AZ = '1F3864', VM = 'C0392B', BR = 'FFFFFF', CZ_CLARO = 'F4F6FC';

const run = (t: string, o: any = {}): TextRun =>
  new TextRun({ text: t, font: 'Arial', size: o.sz ?? 20, bold: o.bold, color: o.cor ?? '000000', italics: o.it });

const par = (runs: TextRun[], align = AlignmentType.LEFT, a = 60, d = 60): Paragraph =>
  new Paragraph({ children: runs, alignment: align, spacing: { before: a, after: d } });

const bd = (cor = AZ) => {
  const b = { style: BorderStyle.SINGLE, size: 6, color: cor };
  return { top: b, bottom: b, left: b, right: b, insideH: b, insideV: b };
};

const cel = (children: Paragraph[], cor?: string, cols?: number): TableCell =>
  new TableCell({
    ...(cols ? { columnSpan: cols } : {}),
    ...(cor ? { shading: { type: ShadingType.SOLID, color: cor } } : {}),
    verticalAlign: VerticalAlign.CENTER,
    children,
  });

const hCel = (txt: string, cols?: number, corFundo = AZ) =>
  cel([par([run(txt, { bold: true, cor: BR, sz: 22 })], AlignmentType.CENTER, 80, 80)], corFundo, cols);

const linhasResposta = (n = 8) =>
  Array.from({ length: n }, () =>
    par([run('_'.repeat(95), { sz: 18, cor: 'BBBBBB' })], AlignmentType.LEFT, 25, 8)
  );

async function carregarLogoBase64(): Promise<string | null> {
  try {
    const resp = await fetch('/Logo_IOP.png');
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

async function exportarWord(textoOriginal: string, valores: Record<string, string>) {
  const d = parsearProva(textoOriginal);
  const logoB64 = await carregarLogoBase64();

  const esp = (n = 80) => new Paragraph({ children: [], spacing: { before: n, after: 0 } });
  const quebraSecao = new Paragraph({ children: [new PageBreak()], spacing: { before: 0, after: 0 } });

  // ── CABEÇALHO ────────────────────────────────────────────────────────────
  // Linha 1: Logo + Info escola + Logo
  const celulaInfo = cel([
    par([run(`Avaliação ${valores.bimestre} - Ensino Fundamental - 2026`, { bold: true, sz: 24, cor: AZ })], AlignmentType.LEFT, 40, 10),
    par([run('Disciplina: Educação Física', { bold: true, sz: 21 })], AlignmentType.LEFT, 8, 8),
    par([run(`Professor(a): ${valores.professores}`, { bold: true, sz: 21 })], AlignmentType.LEFT, 8, 8),
    par([run(`Série: ${valores.serie}`, { bold: true, sz: 21 })], AlignmentType.LEFT, 8, 40),
  ]);

  const celulaLogo = logoB64
    ? new TableCell({
        verticalAlign: VerticalAlign.CENTER,
        width: { size: 15, type: WidthType.PERCENTAGE },
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new ImageRun({ data: logoB64, transformation: { width: 70, height: 70 }, type: 'png' })],
          spacing: { before: 40, after: 40 },
        })],
      })
    : cel([par([run('I.O.P.', { bold: true, cor: AZ, sz: 22 })], AlignmentType.CENTER)], CZ_CLARO);

  const cabecalho = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: bd(AZ),
    rows: [
      new TableRow({ children: [celulaLogo, celulaInfo] }),
      new TableRow({ children: [
        cel([
          par([run('Nome: ____________________________________________  Nº: ______', { sz: 20 })], AlignmentType.LEFT, 70, 30),
          par([run('Turma: _________    Data: ____/____/______    Nota: ________', { sz: 20 })], AlignmentType.LEFT, 10, 70),
        ], undefined, 2),
      ]}),
    ],
  });

  // ── INSTRUÇÕES ───────────────────────────────────────────────────────────
  const instrucoes = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: bd(VM),
    rows: [
      new TableRow({ children: [cel([
        par([
          run('Instruções: ', { bold: true, sz: 20, cor: VM }),
          run('Leia atentamente cada questão antes de responder. Use caneta azul ou preta. Não é permitido o uso de corretor. Questões objetivas valem 1,0 ponto cada. Questões dissertativas valem 1,0 ponto cada.', { sz: 20 }),
        ], AlignmentType.LEFT, 60, 60),
      ])] }),
    ],
  });

  // ── PARTE 1: QUESTÕES OBJETIVAS EM 2 COLUNAS ─────────────────────────────
  const parte1Header = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: bd(),
    rows: [new TableRow({ children: [hCel('PARTE 1 — QUESTÕES OBJETIVAS  (8,0 pontos)', 1)] })],
  });

  // Divide as 8 questões em 2 grupos de 4 para colunas lado a lado
  const questoesObj = d.questoesObj;
  const col1 = questoesObj.slice(0, 4);
  const col2 = questoesObj.slice(4, 8);

  const renderQObj = (q: QuestaoObj): Paragraph[] => [
    par([run(`Questão ${q.numero} – `, { bold: true, sz: 20 }), run(q.enunciado, { sz: 20 })], AlignmentType.LEFT, 80, 30),
    ...q.alternativas.map(alt =>
      par([run(`(${alt.letra}) `, { bold: true, sz: 20 }), run(alt.texto, { sz: 20 })], AlignmentType.LEFT, 15, 15)
    ),
    par([run('')], AlignmentType.LEFT, 10, 40),
  ];

  const renderQObjFallback = (): Paragraph[] => {
    const blocoObj = extrairBloco(d.textoLimpo, 'QUESTOES_OBJETIVAS', 'QUESTOES_DISSERTATIVAS');
    return blocoObj.split('\n').filter(l => l.trim()).map(l =>
      par([run(l, { sz: 20 })], AlignmentType.LEFT, 15, 15)
    );
  };

  const col1Pars = col1.length > 0 ? col1.flatMap(renderQObj) : renderQObjFallback();
  const col2Pars = col2.length > 0 ? col2.flatMap(renderQObj) : [par([run('')])];

  const tabelaObj = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: bd(),
    rows: [
      new TableRow({ children: [
        new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: col1Pars }),
        new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: col2Pars }),
      ]}),
    ],
  });

  // ── PARTE 2: DISSERTATIVAS ────────────────────────────────────────────────
  const parte2Header = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: bd(),
    rows: [new TableRow({ children: [hCel('PARTE 2 — QUESTÕES DISSERTATIVAS  (2,0 pontos)', 1)] })],
  });

  const disRows = d.questoesDis.length > 0
    ? d.questoesDis.map((q, idx) =>
      new TableRow({ children: [cel([
        par([run(`Questão ${q.numero} `, { bold: true, sz: 20 }), run('(1,0 ponto)', { sz: 18, cor: '666666', it: true })], AlignmentType.LEFT, 80, 20),
        par([run(q.enunciado, { sz: 20 })], AlignmentType.LEFT, 10, 30),
        par([run('Resposta:', { bold: true, sz: 20 })], AlignmentType.LEFT, 20, 15),
        ...linhasResposta(8),
        par([run('')], AlignmentType.LEFT, 10, 60),
      ], idx % 2 === 0 ? BR : CZ_CLARO)] })
    )
    : [new TableRow({ children: [cel([par([run(extrairBloco(d.textoLimpo, 'QUESTOES_DISSERTATIVAS', 'GABARITO_OBJETIVAS'), { sz: 20 })])])] })];

  const tabelaDis = new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: bd(), rows: disRows });

  // ── GABARITO (nova página) ─────────────────────────────────────────────────
  const gabHeader = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: bd(VM),
    rows: [
      new TableRow({ children: [hCel('GABARITO', 1, VM)] }),
      new TableRow({ children: [cel([
        par([run(`${valores.serie}  |  Educação Física  |  ${valores.bimestre}  |  ${valores.tema || ''}`, { sz: 20, cor: AZ })], AlignmentType.CENTER, 60, 60)
      ])] }),
    ],
  });

  // Grid gabarito objetivas 2x4
  const gabObjHeader = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: bd(),
    rows: [new TableRow({ children: [hCel('QUESTÕES OBJETIVAS')] })],
  });

  const makeGabCell = (n: number) => {
    const gab = d.gabObj.find(g => g.numero === n);
    return cel([par([
      run(`${n}.  `, { bold: true, sz: 22 }),
      run(gab?.resposta ?? '?', { bold: true, sz: 22, cor: VM }),
    ], AlignmentType.CENTER, 80, 80)]);
  };

  const gabObjGrid = new Table({
    width: { size: 80, type: WidthType.PERCENTAGE },
    borders: bd(),
    rows: [
      new TableRow({ children: [1, 2, 3, 4].map(makeGabCell) }),
      new TableRow({ children: [5, 6, 7, 8].map(makeGabCell) }),
    ],
  });

  const gabDisHeader = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: bd(),
    rows: [new TableRow({ children: [hCel('CRITÉRIOS DE CORREÇÃO — QUESTÕES DISSERTATIVAS')] })],
  });

  const gabDisRows = d.gabDis.length > 0
    ? d.gabDis.map((gab, idx) =>
      new TableRow({ children: [cel([
        par([run(`Questão ${gab.numero}`, { bold: true, sz: 20, cor: AZ }), run('  (1,0 ponto)', { sz: 18, cor: '888888', it: true })], AlignmentType.LEFT, 80, 30),
        ...gab.criterios.map(c => par([run('• ' + c, { sz: 20 })], AlignmentType.LEFT, 15, 15)),
        par([run('')], AlignmentType.LEFT, 10, 50),
      ], idx % 2 === 0 ? BR : CZ_CLARO)] })
    )
    : [new TableRow({ children: [cel([par([run(extrairBloco(d.textoLimpo, 'GABARITO_DISSERTATIVAS', ''), { sz: 20 })])])] })];

  const tabelaGabDis = new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: bd(), rows: gabDisRows });

  // ── DOCUMENTO ─────────────────────────────────────────────────────────────
  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: 600, bottom: 600, left: 800, right: 800 } } },
      children: [
        cabecalho, esp(80),
        instrucoes, esp(80),
        parte1Header,
        tabelaObj, esp(80),
        parte2Header,
        tabelaDis,
        quebraSecao,
        gabHeader, esp(80),
        gabObjHeader,
        gabObjGrid, esp(100),
        gabDisHeader,
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
        <button onClick={() => navigate('/ia')} className="flex items-center gap-1.5 text-white/70 text-sm font-semibold mb-3 relative z-10 hover:text-white">
          <ArrowLeft className="w-4 h-4" /> Ferramentas IA
        </button>
        <h1 className="text-lg font-black relative z-10">Gerador de Avaliações</h1>
        <p className="text-sm text-white/70 mt-1 relative z-10">Modelo oficial IOP · 8 objetivas + 2 dissertativas · 2 colunas · Word</p>
      </div>

      <div className="p-4 flex flex-col gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3">
          {CAMPOS.map(campo => (
            <div key={campo.id}>
              <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-1.5">{campo.label}</label>
              {campo.tipo === 'select' ? (
                <select value={valores[campo.id] || ''} onChange={e => atualizar(campo.id, e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-red-200">
                  <option value="">Selecione...</option>
                  {campo.opcoes?.map(op => <option key={op} value={op}>{op}</option>)}
                </select>
              ) : campo.tipo === 'textarea' ? (
                <textarea value={valores[campo.id] || ''} onChange={e => atualizar(campo.id, e.target.value)}
                  placeholder={campo.placeholder} rows={2}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-red-200 resize-none" />
              ) : (
                <input type="text" value={valores[campo.id] || ''} onChange={e => atualizar(campo.id, e.target.value)}
                  placeholder={campo.placeholder}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-red-200" />
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
                  className={`flex items-center gap-1 text-xs font-black px-3 py-1.5 rounded-lg transition-all ${copiado ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700'}`}>
                  {copiado ? <><CheckCircle className="w-3.5 h-3.5" /> Copiado!</> : <><Copy className="w-3.5 h-3.5" /> Copiar</>}
                </button>
                <button onClick={baixarWord} disabled={exportando}
                  className="flex items-center gap-1 text-xs font-black px-3 py-1.5 rounded-lg text-white disabled:opacity-60"
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
