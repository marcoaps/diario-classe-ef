import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Copy, CheckCircle, Loader2, RefreshCw, FileDown } from 'lucide-react';
import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, AlignmentType, WidthType, BorderStyle,
  ShadingType, VerticalAlign,
} from 'docx';
import { saveAs } from 'file-saver';

const CAMPOS = [
  { id: 'professor', label: 'Nome do Professor', tipo: 'text' as const, placeholder: 'Ex: Marco Antonio Pedro da Silva' },
  { id: 'turma', label: 'Ano / Turma', tipo: 'select' as const, opcoes: ['6º Ano', '7º Ano', '8º Ano', '9º Ano'] },
  { id: 'aulas', label: 'Aulas Previstas', tipo: 'select' as const, opcoes: ['2h/aulas', '4h/aulas', '6h/aulas', '8h/aulas'] },
  { id: 'unidade', label: 'Unidade Temática (BNCC)', tipo: 'select' as const, opcoes: ['Brincadeiras e Jogos', 'Esportes', 'Ginásticas', 'Danças', 'Lutas', 'Práticas Corporais de Aventura'] },
  { id: 'tema', label: 'Tema / Objeto de Conhecimento', tipo: 'text' as const, placeholder: 'Ex: Futsal — regras, fundamentos e cooperação' },
  { id: 'situacoes', label: 'Número de Situações de Aprendizagem', tipo: 'select' as const, opcoes: ['2 situações', '3 situações', '4 situações'] },
  { id: 'contexto', label: 'Contexto / Observações (opcional)', tipo: 'textarea' as const, placeholder: 'Ex: Turma inclusiva, sem quadra coberta...', required: false },
];

const ETAPAS = [
  { texto: 'Analisando o tema e a turma...', icone: '🔍', duracao: 4000 },
  { texto: 'Elaborando objetivos e capacidades...', icone: '🎯', duracao: 5000 },
  { texto: 'Selecionando habilidades da BNCC...', icone: '📚', duracao: 5000 },
  { texto: 'Criando as situações de aprendizagem...', icone: '✏️', duracao: 7000 },
  { texto: 'Detalhando atividades práticas...', icone: '⚽', duracao: 6000 },
  { texto: 'Definindo instrumentos de avaliação...', icone: '📋', duracao: 4000 },
  { texto: 'Organizando recursos e referências...', icone: '📖', duracao: 3000 },
  { texto: 'Finalizando a sequência didática...', icone: '✨', duracao: 99999 },
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
    const inc = setInterval(() => setProgresso(p => { const max = Math.round((idx / (ETAPAS.length - 1)) * 95); return p < max ? p + 1 : p; }), 300);
    timerRef.current = setTimeout(avancar, ETAPAS[0].duracao);
    return () => { clearTimeout(timerRef.current); clearInterval(inc); };
  }, []);
  const etapa = ETAPAS[etapaIdx];
  return (
    <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm p-6 flex flex-col gap-5">
      <div className="flex justify-center">
        <div className="w-20 h-20 rounded-full bg-emerald-50 border-4 border-emerald-200 flex items-center justify-center relative">
          <span className="text-3xl animate-bounce">{etapa.icone}</span>
          <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="36" fill="none" stroke="#d1fae5" strokeWidth="4" />
            <circle cx="40" cy="40" r="36" fill="none" stroke="#10b981" strokeWidth="4"
              strokeDasharray={`${2 * Math.PI * 36}`}
              strokeDashoffset={`${2 * Math.PI * 36 * (1 - progresso / 100)}`}
              strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
          </svg>
        </div>
      </div>
      <div className="text-center">
        <p className="font-black text-gray-800 text-base">{etapa.texto}</p>
        <p className="text-xs text-gray-400 mt-1">A IA está elaborando sua sequência didática completa</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between text-xs font-semibold text-gray-400"><span>Processando...</span><span>{progresso}%</span></div>
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500" style={{ width: `${progresso}%` }} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        {ETAPAS.slice(0, -1).map((e, i) => (
          <div key={i} className={`flex items-center gap-2 text-xs transition-all ${i < etapaIdx ? 'text-emerald-600' : i === etapaIdx ? 'text-gray-700 font-semibold' : 'text-gray-300'}`}>
            <span className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-[10px] ${i < etapaIdx ? 'bg-emerald-100 text-emerald-600' : i === etapaIdx ? 'bg-emerald-500 text-white animate-pulse' : 'bg-gray-100 text-gray-300'}`}>
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
NÃO use markdown. NÃO use **, ##, *, _ ou qualquer símbolo de formatação. Escreva SOMENTE texto puro.

Crie uma SEQUÊNCIA DIDÁTICA para:
Professor(a): ${v.professor}
Componente: Educação Física
Ano: ${v.turma}
Aulas: ${v.aulas}
Unidade BNCC: ${v.unidade}
Tema: ${v.tema}
Situações de Aprendizagem: ${v.situacoes}
${v.contexto ? `Contexto: ${v.contexto}` : ''}

Use EXATAMENTE este formato com estas palavras como separadores:

OBJETIVOS / CAPACIDADES
• objetivo 1
• objetivo 2
• objetivo 3

HABILIDADES
• EF89EF01 - descrição
• EF89EF02 - descrição

OBJETOS DE CONHECIMENTO
• objeto 1
• objeto 2

DESENVOLVIMENTO DAS ATIVIDADES

Situação de Aprendizagem 1 – Nome da situação
Tempo: X min

ANTES DA ATIVIDADE:
texto corrido aqui

DESENVOLVIMENTO:
texto corrido aqui

APÓS A ATIVIDADE:
texto corrido aqui

Situação de Aprendizagem 2 – Nome da situação
Tempo: X min

ANTES DA ATIVIDADE:
texto

DESENVOLVIMENTO:
texto

APÓS A ATIVIDADE:
texto

VALORES ATITUDINAIS
• valor 1
• valor 2

INSTRUMENTOS DE AVALIAÇÃO
• instrumento 1
• instrumento 2

RECURSOS
• recurso 1
• recurso 2

REFERÊNCIAS
referência 1
referência 2`;
}

// ── LIMPEZA DE MARKDOWN ──────────────────────────────────────────────────────
// Aplicada UMA VEZ no texto completo antes de qualquer parse
function limparMarkdown(texto: string): string {
  return texto
    .replace(/\*\*/g, '')      // negrito
    .replace(/\*/g, '')        // itálico/lista markdown
    .replace(/^#{1,6}\s*/gm, '') // títulos ##
    .replace(/_+/g, '')        // underscore
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links [text](url)
    .replace(/^\s*-{3,}\s*$/gm, '') // separadores ---
    .replace(/\n{3,}/g, '\n\n') // excesso de linhas em branco
    .trim();
}

// ── PARSER ───────────────────────────────────────────────────────────────────
function extrairBloco(texto: string, inicio: string, fim: string): string {
  const s = texto.indexOf(inicio);
  if (s < 0) return '';
  const depois = texto.slice(s + inicio.length);
  const f = fim ? depois.indexOf(fim) : depois.length;
  return (f >= 0 ? depois.slice(0, f) : depois).trim();
}

function extrairLista(texto: string, inicio: string, fim: string): string[] {
  const bloco = extrairBloco(texto, inicio, fim);
  return bloco.split('\n')
    .map(l => l.replace(/^[•\-]\s*/, '').trim())
    .filter(l => l.length > 2);
}

interface Situacao {
  titulo: string;
  tempo: string;
  antes: string;
  desenvolvimento: string;
  apos: string;
}

function extrairSituacoes(textoLimpo: string): Situacao[] {
  const situacoes: Situacao[] = [];

  const idxDev = textoLimpo.indexOf('DESENVOLVIMENTO DAS ATIVIDADES');
  const idxVal = textoLimpo.indexOf('VALORES ATITUDINAIS');
  if (idxDev < 0) return situacoes;

  const bloco = textoLimpo.slice(
    idxDev + 'DESENVOLVIMENTO DAS ATIVIDADES'.length,
    idxVal >= 0 ? idxVal : textoLimpo.length
  );

  // Regex robusto: aceita variações de grafia com ou sem acento
  const regex = /Situa[cç][aã]o de Aprendizagem\s+(\d+)\s*[–\-—]\s*([^\n]+)/gi;
  const matches = [...bloco.matchAll(regex)];

  matches.forEach((match, i) => {
    const num = match[1];
    const tituloRaw = match[2].trim();
    const inicio = match.index!;
    const fim = i + 1 < matches.length ? matches[i + 1].index! : bloco.length;
    const trecho = bloco.slice(inicio, fim);

    const tempoMatch = trecho.match(/Tempo:\s*([^\n]+)/i);
    const tempo = tempoMatch ? tempoMatch[1].trim() : '';

    const sub = (rotulos: string[]): string => {
      for (const rot of rotulos) {
        const idx = trecho.indexOf(rot);
        if (idx < 0) continue;
        const depois = trecho.slice(idx + rot.length);
        const proximos = [
          'ANTES DA ATIVIDADE:', 'DESENVOLVIMENTO:', 'APÓS A ATIVIDADE:', 'APOS A ATIVIDADE:',
          'Situação de Aprendizagem', 'Situacao de Aprendizagem', 'VALORES ATITUDINAIS',
        ];
        let f = depois.length;
        for (const p of proximos) {
          if (p.toUpperCase() === rot.toUpperCase()) continue;
          const pi = depois.indexOf(p);
          if (pi > 0 && pi < f) f = pi;
        }
        return depois.slice(0, f).trim();
      }
      return '';
    };

    situacoes.push({
      titulo: `Situação de Aprendizagem ${num} – ${tituloRaw}`,
      tempo,
      antes: sub(['ANTES DA ATIVIDADE:']),
      desenvolvimento: sub(['DESENVOLVIMENTO:']),
      apos: sub(['APÓS A ATIVIDADE:', 'APOS A ATIVIDADE:']),
    });
  });

  return situacoes;
}

function parsear(textoOriginal: string) {
  // Limpa TUDO primeiro
  const t = limparMarkdown(textoOriginal);

  return {
    texto: t,
    objetivos: extrairLista(t, 'OBJETIVOS / CAPACIDADES', 'HABILIDADES'),
    habilidades: extrairLista(t, 'HABILIDADES', 'OBJETOS DE CONHECIMENTO'),
    objetos: extrairLista(t, 'OBJETOS DE CONHECIMENTO', 'DESENVOLVIMENTO DAS ATIVIDADES'),
    situacoes: extrairSituacoes(t),
    valores: extrairLista(t, 'VALORES ATITUDINAIS', 'INSTRUMENTOS DE AVALIAÇÃO'),
    avaliacao: extrairLista(t, 'INSTRUMENTOS DE AVALIAÇÃO', 'RECURSOS'),
    recursos: extrairLista(t, 'RECURSOS', 'REFERÊNCIAS'),
    referencias: extrairLista(t, 'REFERÊNCIAS', ''),
  };
}

// ── WORD ──────────────────────────────────────────────────────────────────────
const AZ = '1F3864', AZM = '2E5FA3', CZ = 'D9E2F3', BR = 'FFFFFF';

const mkRun = (t: string, o: any = {}): TextRun =>
  new TextRun({ text: t, font: 'Arial', size: o.sz ?? 20, bold: o.bold, color: o.cor ?? '000000', italics: o.it });

const mkPar = (runs: TextRun[], align = AlignmentType.LEFT, a = 60, d = 60): Paragraph =>
  new Paragraph({ children: runs, alignment: align, spacing: { before: a, after: d } });

const mkCell = (children: Paragraph[], cor?: string, cols?: number): TableCell =>
  new TableCell({
    ...(cols ? { columnSpan: cols } : {}),
    ...(cor ? { shading: { type: ShadingType.SOLID, color: cor } } : {}),
    verticalAlign: VerticalAlign.CENTER,
    children,
  });

const mkBd = () => {
  const b = { style: BorderStyle.SINGLE, size: 8, color: AZM };
  return { top: b, bottom: b, left: b, right: b, insideH: b, insideV: b };
};

const hCell = (txt: string, cols?: number) =>
  mkCell([mkPar([mkRun(txt, { bold: true, cor: BR, sz: 22 })], AlignmentType.CENTER, 80, 80)], AZ, cols);

const lCell = (txt: string) =>
  mkCell([mkPar([mkRun(txt, { bold: true, cor: BR, sz: 20 })], AlignmentType.CENTER, 60, 60)], AZM);

const tCell = (txt: string) =>
  mkCell([mkPar([mkRun(txt, { sz: 20 })], AlignmentType.LEFT, 60, 60)]);

const sCell = (txt: string, cols?: number) =>
  mkCell([mkPar([mkRun(txt, { bold: true, cor: AZ, sz: 20 })], AlignmentType.CENTER, 60, 60)], CZ, cols);

const listaCell = (itens: string[]) =>
  mkCell(itens.length > 0
    ? itens.map(i => mkPar([mkRun('• ' + i, { sz: 19 })], AlignmentType.LEFT, 30, 30))
    : [mkPar([mkRun('')])]);

function sitCell(s: Situacao): TableCell {
  const children: Paragraph[] = [];
  const sec = (rot: string, txt: string) => {
    if (!txt.trim()) return;
    children.push(mkPar([mkRun(rot, { bold: true, cor: AZM, sz: 20 })], AlignmentType.LEFT, 100, 40));
    txt.split('\n').filter(l => l.trim()).forEach(l =>
      children.push(mkPar([mkRun(l.trim(), { sz: 20 })], AlignmentType.LEFT, 20, 20))
    );
  };
  sec('ANTES DA ATIVIDADE:', s.antes);
  sec('DESENVOLVIMENTO:', s.desenvolvimento);
  sec('APÓS A ATIVIDADE:', s.apos);
  if (children.length === 0) children.push(mkPar([mkRun('')]));
  return mkCell(children);
}

async function exportarWord(textoOriginal: string, valores: Record<string, string>) {
  const d = parsear(textoOriginal);
  const bd = mkBd();
  const esp = new Paragraph({ children: [], spacing: { before: 120, after: 0 } });

  const tTitulo = new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: bd, rows: [
    new TableRow({ children: [hCell('SEQUÊNCIA DIDÁTICA', 4)] }),
    new TableRow({ children: [lCell('PROFESSOR(A):'), tCell(valores.professor || ''), lCell('COMPONENTE CURRICULAR:'), tCell('Educação Física')] }),
    new TableRow({ children: [lCell('ANO:'), tCell(valores.turma || ''), lCell('AULAS PREVISTAS:'), tCell(valores.aulas || '')] }),
  ]});

  const tObj = new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: bd, rows: [
    new TableRow({ children: [mkCell([
      mkPar([mkRun('OBJETIVOS / CAPACIDADES', { bold: true, cor: BR, sz: 22 }), mkRun(' (Competências amplas do componente)', { cor: BR, sz: 18 })], AlignmentType.CENTER, 80, 80)
    ], AZ, 1)] }),
    new TableRow({ children: [mkCell(
      d.objetivos.length > 0
        ? d.objetivos.map(o => mkPar([mkRun('• ' + o, { sz: 20 })], AlignmentType.LEFT, 40, 40))
        : [mkPar([mkRun('')])]
    )] }),
  ]});

  const tCont = new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: bd, rows: [
    new TableRow({ children: [hCell('CONTEÚDOS', 2)] }),
    new TableRow({ children: [sCell('HABILIDADES'), sCell('OBJETOS DE CONHECIMENTO')] }),
    new TableRow({ children: [listaCell(d.habilidades), listaCell(d.objetos.length > 0 ? d.objetos : [valores.unidade || ''])] }),
  ]});

  // Desenvolvimento
  const devRows: TableRow[] = [
    new TableRow({ children: [mkCell([
      mkPar([mkRun('DESENVOLVIMENTO DAS ATIVIDADES', { bold: true, cor: BR, sz: 22 })], AlignmentType.CENTER, 80, 0),
      mkPar([mkRun('(Descrição de situações de ensino e aprendizagem para desenvolver as habilidades)', { cor: BR, sz: 18 })], AlignmentType.CENTER, 0, 80),
    ], AZ, 1)] }),
  ];

  if (d.situacoes.length > 0) {
    for (const s of d.situacoes) {
      devRows.push(new TableRow({ children: [mkCell([
        mkPar([mkRun(s.titulo, { bold: true, cor: AZ, sz: 20 })], AlignmentType.LEFT, 60, 20),
        mkPar([mkRun('Tempo: ' + s.tempo, { it: true, cor: AZM, sz: 18 })], AlignmentType.LEFT, 0, 60),
      ], CZ)] }));
      devRows.push(new TableRow({ children: [sitCell(s)] }));
    }
  } else {
    // Fallback: exibe o bloco de desenvolvimento limpo
    const fb = extrairBloco(d.texto, 'DESENVOLVIMENTO DAS ATIVIDADES', 'VALORES ATITUDINAIS');
    devRows.push(new TableRow({ children: [mkCell(
      fb.split('\n').filter(l => l.trim()).map(l => mkPar([mkRun(l.trim(), { sz: 20 })], AlignmentType.LEFT, 20, 20))
    )] }));
  }

  const tDev = new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: bd, rows: devRows });

  const tRodape = new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: bd, rows: [
    new TableRow({ children: [
      mkCell([mkPar([mkRun('VALORES ATITUDINAIS', { bold: true, cor: BR, sz: 18 })], AlignmentType.CENTER, 40, 0),
              mkPar([mkRun('ENVOLVIDOS NAS ATIVIDADES', { bold: true, cor: BR, sz: 18 })], AlignmentType.CENTER, 0, 40)], AZ),
      mkCell([mkPar([mkRun('INSTRUMENTOS DE AVALIAÇÃO', { bold: true, cor: BR, sz: 18 })], AlignmentType.CENTER, 60, 60)], AZ),
      mkCell([mkPar([mkRun('RECURSOS', { bold: true, cor: BR, sz: 18 })], AlignmentType.CENTER, 60, 60)], AZ),
    ]}),
    new TableRow({ children: [listaCell(d.valores), listaCell(d.avaliacao), listaCell(d.recursos)] }),
  ]});

  const tRefs = new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: bd, rows: [
    new TableRow({ children: [hCell('REFERÊNCIAS', 1)] }),
    new TableRow({ children: [mkCell(
      (d.referencias.length > 0 ? d.referencias : [
        'ACRE. Secretaria de Estado de Educação, Cultura e Esporte. Proposta de Plano de Curso do Ensino Fundamental Anos Finais, 2023.',
        'BRASIL. Ministério da Educação. Base Nacional Comum Curricular. Brasília: MEC, 2018.',
      ]).map(r => mkPar([mkRun(r, { sz: 18 })], AlignmentType.LEFT, 40, 40))
    )] }),
  ]});

  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } } },
      children: [tTitulo, esp, tObj, esp, tCont, esp, tDev, esp, tRodape, esp, tRefs],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const turma = (valores.turma || 'turma').replace(/[^a-z0-9]/gi, '_');
  saveAs(blob, `sequencia_didatica_ef_${turma}.docx`);
}

// ── COMPONENTE ────────────────────────────────────────────────────────────────
export function IASequencia() {
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

  const resultadoLimpo = limparMarkdown(resultado);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 pb-36">
      <div className="bg-gradient-to-br from-emerald-600 to-emerald-500 p-5 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10" />
        <button onClick={() => navigate('/ia')} className="flex items-center gap-1.5 text-white/70 text-sm font-semibold mb-3 relative z-10 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Ferramentas IA
        </button>
        <h1 className="text-lg font-black relative z-10 leading-tight">Gerador de Sequências Didáticas</h1>
        <p className="text-sm text-white/70 mt-1 relative z-10">Modelo oficial · Exportação Word</p>
      </div>

      <div className="p-4 flex flex-col gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3">
          {CAMPOS.map(campo => (
            <div key={campo.id}>
              <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-1.5">{campo.label}</label>
              {campo.tipo === 'select' ? (
                <select value={valores[campo.id] || ''} onChange={e => atualizar(campo.id, e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400">
                  <option value="">Selecione...</option>
                  {campo.opcoes?.map(op => <option key={op} value={op}>{op}</option>)}
                </select>
              ) : campo.tipo === 'textarea' ? (
                <textarea value={valores[campo.id] || ''} onChange={e => atualizar(campo.id, e.target.value)}
                  placeholder={campo.placeholder} rows={3}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400 resize-none" />
              ) : (
                <input type="text" value={valores[campo.id] || ''} onChange={e => atualizar(campo.id, e.target.value)}
                  placeholder={campo.placeholder}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400" />
              )}
            </div>
          ))}

          {erro && <p className="text-xs text-red-500 font-semibold bg-red-50 border border-red-200 rounded-xl px-3 py-2">{erro}</p>}

          <button onClick={gerar} disabled={gerando}
            className="w-full py-4 rounded-2xl font-black text-white flex items-center justify-center gap-2 disabled:opacity-60 transition-all active:scale-95 shadow-lg bg-gradient-to-r from-emerald-600 to-emerald-500">
            {gerando ? <><Loader2 className="w-5 h-5 animate-spin" /> Gerando...</> : <><Sparkles className="w-5 h-5" /> Gerar Sequência Didática</>}
          </button>
        </div>

        {gerando && <ProgressoGerando />}

        {resultado && !gerando && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-emerald-50 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-black text-emerald-700">Sequência gerada!</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button onClick={gerar} className="flex items-center gap-1 text-xs text-gray-500 hover:text-emerald-600 font-semibold">
                  <RefreshCw className="w-3.5 h-3.5" /> Gerar novo
                </button>
                <button onClick={copiar}
                  className={`flex items-center gap-1 text-xs font-black px-3 py-1.5 rounded-lg transition-all ${copiado ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
                  {copiado ? <><CheckCircle className="w-3.5 h-3.5" /> Copiado!</> : <><Copy className="w-3.5 h-3.5" /> Copiar</>}
                </button>
                <button onClick={baixarWord} disabled={exportando}
                  className="flex items-center gap-1 text-xs font-black px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 transition-all">
                  {exportando ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Gerando...</> : <><FileDown className="w-3.5 h-3.5" /> Baixar Word</>}
                </button>
              </div>
            </div>
            <div className="p-4">
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">{resultadoLimpo}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
