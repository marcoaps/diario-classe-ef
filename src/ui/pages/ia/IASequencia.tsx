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
        const prog = Math.min(95, Math.round((idx / (ETAPAS.length - 1)) * 95));
        setProgresso(prog);
        timerRef.current = setTimeout(avancar, ETAPAS[idx].duracao);
      }
    };
    const incremento = setInterval(() => {
      setProgresso(prev => {
        const max = Math.round((idx / (ETAPAS.length - 1)) * 95);
        return prev < max ? prev + 1 : prev;
      });
    }, 300);
    timerRef.current = setTimeout(avancar, ETAPAS[0].duracao);
    return () => { clearTimeout(timerRef.current); clearInterval(incremento); };
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
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
          </svg>
        </div>
      </div>
      <div className="text-center">
        <p className="font-black text-gray-800 text-base">{etapa.texto}</p>
        <p className="text-xs text-gray-400 mt-1">A IA está elaborando sua sequência didática completa</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between text-xs font-semibold text-gray-400">
          <span>Processando...</span><span>{progresso}%</span>
        </div>
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
            style={{ width: `${progresso}%` }} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        {ETAPAS.slice(0, -1).map((e, i) => (
          <div key={i} className={`flex items-center gap-2 text-xs transition-all ${
            i < etapaIdx ? 'text-emerald-600' : i === etapaIdx ? 'text-gray-700 font-semibold' : 'text-gray-300'
          }`}>
            <span className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-[10px] ${
              i < etapaIdx ? 'bg-emerald-100 text-emerald-600' :
              i === etapaIdx ? 'bg-emerald-500 text-white animate-pulse' : 'bg-gray-100 text-gray-300'
            }`}>{i < etapaIdx ? '✓' : i + 1}</span>
            <span>{e.texto}</span>
          </div>
        ))}
      </div>
      <p className="text-center text-xs text-gray-300 font-medium">Isso pode levar 20 a 40 segundos — aguarde 😊</p>
    </div>
  );
}

function gerarPrompt(v: Record<string, string>) {
  return `Você é um professor especialista em Educação Física do Ensino Fundamental.

IMPORTANTE: NÃO use markdown. NÃO use **, ##, *, _ ou qualquer formatação especial. Escreva texto puro.

Crie uma SEQUÊNCIA DIDÁTICA para:
Professor(a): ${v.professor}
Componente Curricular: Educação Física
Ano: ${v.turma}
Aulas Previstas: ${v.aulas}
Unidade Temática BNCC: ${v.unidade}
Tema: ${v.tema}
Número de Situações de Aprendizagem: ${v.situacoes}
${v.contexto ? `Contexto: ${v.contexto}` : ''}

Use EXATAMENTE estas marcações (são usadas para estruturar o documento Word):

===OBJETIVOS===
[Escreva os objetivos gerais, um por linha começando com bullet •]

===HABILIDADES===
[Liste as habilidades BNCC com códigos EF, uma por linha começando com •]

===OBJETOS===
[Liste os objetos de conhecimento, um por linha começando com •]

===SITUACAO_1===
Titulo: [Nome da situação]
Tempo: [ex: 50 min ou 2 aulas de 50 min]

ANTES DA ATIVIDADE:
[Texto corrido descrevendo preparação e introdução]

DESENVOLVIMENTO:
[Texto corrido descrevendo as atividades passo a passo]

APOS A ATIVIDADE:
[Texto corrido descrevendo reflexão e sistematização]

===SITUACAO_2===
Titulo: [Nome]
Tempo: [tempo]

ANTES DA ATIVIDADE:
[texto]

DESENVOLVIMENTO:
[texto]

APOS A ATIVIDADE:
[texto]

[Continue para cada situação]

===VALORES===
[Liste os valores atitudinais, um por linha começando com •]

===AVALIACAO===
[Liste os instrumentos de avaliação, um por linha começando com •]

===RECURSOS===
[Liste os recursos, um por linha começando com •]

===REFERENCIAS===
[Liste as referências, uma por linha]

Seja detalhado e prático. Cada situação deve ter atividades concretas e executáveis.`;
}

// ── PARSER ROBUSTO ──────────────────────────────────────────────────────────
function limparMarkdown(texto: string): string {
  return texto
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/##/g, '')
    .replace(/^#+\s*/gm, '')
    .replace(/_+/g, '')
    .trim();
}

function extrairSecao(texto: string, inicio: string, fim: string): string {
  const s = texto.indexOf(inicio);
  if (s < 0) return '';
  const depois = texto.slice(s + inicio.length);
  const f = fim ? depois.indexOf(fim) : depois.length;
  return limparMarkdown(f >= 0 ? depois.slice(0, f) : depois).trim();
}

function extrairLista(texto: string, inicio: string, fim: string): string[] {
  const bloco = extrairSecao(texto, inicio, fim);
  return bloco.split('\n')
    .map(l => limparMarkdown(l).replace(/^[•\-*]\s*/, '').trim())
    .filter(l => l.length > 0 && l !== '##');
}

function extrairSubSecao(bloco: string, rotulo: string): string {
  const padroes = [
    rotulo + ':',
    rotulo.toUpperCase() + ':',
    rotulo.toLowerCase() + ':',
  ];
  let idx = -1;
  for (const p of padroes) {
    idx = bloco.indexOf(p);
    if (idx >= 0) break;
  }
  if (idx < 0) return '';
  const depois = bloco.slice(idx + rotulo.length + 1);
  const proximos = ['ANTES DA ATIVIDADE', 'DESENVOLVIMENTO', 'APOS A ATIVIDADE', 'APÓS A ATIVIDADE'];
  let fim = depois.length;
  for (const p of proximos) {
    const i = depois.indexOf(p);
    if (i > 0 && i < fim) fim = i;
  }
  return limparMarkdown(depois.slice(0, fim)).trim();
}

function parsearTexto(texto: string) {
  const objetivos = extrairLista(texto, '===OBJETIVOS===', '===HABILIDADES===');
  const habilidades = extrairLista(texto, '===HABILIDADES===', '===OBJETOS===');
  const objetos = extrairLista(texto, '===OBJETOS===', '===SITUACAO_1===');

  // Extrai situações dinamicamente
  const situacoes: { titulo: string; tempo: string; antes: string; desenvolvimento: string; apos: string }[] = [];
  let sitIdx = 1;
  while (true) {
    const marcaAtual = `===SITUACAO_${sitIdx}===`;
    const marcaProxima = `===SITUACAO_${sitIdx + 1}===`;
    const marcaFim = '===VALORES===';
    const inicio = texto.indexOf(marcaAtual);
    if (inicio < 0) break;

    const depois = texto.slice(inicio + marcaAtual.length);
    const fimIdx = depois.indexOf(marcaProxima) >= 0
      ? depois.indexOf(marcaProxima)
      : depois.indexOf(marcaFim) >= 0
        ? depois.indexOf(marcaFim)
        : depois.length;

    const bloco = limparMarkdown(depois.slice(0, fimIdx));

    // Extrair título
    const tituloMatch = bloco.match(/Titulo:\s*(.+)/i) || bloco.match(/Título:\s*(.+)/i);
    const titulo = tituloMatch ? tituloMatch[1].trim() : `Situação de Aprendizagem ${sitIdx}`;

    // Extrair tempo
    const tempoMatch = bloco.match(/Tempo:\s*(.+)/i);
    const tempo = tempoMatch ? tempoMatch[1].trim() : '';

    const antes = extrairSubSecao(bloco, 'ANTES DA ATIVIDADE');
    const desenvolvimento = extrairSubSecao(bloco, 'DESENVOLVIMENTO');
    const apos = extrairSubSecao(bloco, 'APOS A ATIVIDADE') || extrairSubSecao(bloco, 'APÓS A ATIVIDADE');

    situacoes.push({ titulo: `Situação de Aprendizagem ${sitIdx} – ${titulo}`, tempo, antes, desenvolvimento, apos });
    sitIdx++;
  }

  const valores = extrairLista(texto, '===VALORES===', '===AVALIACAO===');
  const avaliacao = extrairLista(texto, '===AVALIACAO===', '===RECURSOS===');
  const recursos = extrairLista(texto, '===RECURSOS===', '===REFERENCIAS===');
  const referencias = extrairLista(texto, '===REFERENCIAS===', '');

  return { objetivos, habilidades, objetos, situacoes, valores, avaliacao, recursos, referencias };
}

// ── EXPORTAÇÃO WORD ─────────────────────────────────────────────────────────
const COR_AZUL = '1F3864';
const COR_AZUL_MED = '2E5FA3';
const COR_CINZA = 'D9E2F3';
const COR_BRANCO = 'FFFFFF';

function mkRun(texto: string, opts: { bold?: boolean; color?: string; size?: number; italics?: boolean } = {}): TextRun {
  return new TextRun({ text: texto, font: 'Arial', size: opts.size ?? 20, bold: opts.bold, color: opts.color ?? '000000', italics: opts.italics });
}

function mkPar(runs: TextRun[], align = AlignmentType.LEFT, antes = 60, depois = 60): Paragraph {
  return new Paragraph({ children: runs, alignment: align, spacing: { before: antes, after: depois } });
}

function mkCell(children: Paragraph[], corFundo?: string, cols?: number): TableCell {
  return new TableCell({
    ...(cols ? { columnSpan: cols } : {}),
    ...(corFundo ? { shading: { type: ShadingType.SOLID, color: corFundo } } : {}),
    verticalAlign: VerticalAlign.CENTER,
    children,
  });
}

function mkBordas() {
  const b = { style: BorderStyle.SINGLE, size: 8, color: COR_AZUL_MED };
  return { top: b, bottom: b, left: b, right: b, insideH: b, insideV: b };
}

function cellHeader(texto: string, cols?: number): TableCell {
  return mkCell([mkPar([mkRun(texto, { bold: true, color: COR_BRANCO, size: 22 })], AlignmentType.CENTER, 80, 80)], COR_AZUL, cols);
}

function cellLabel(texto: string): TableCell {
  return mkCell([mkPar([mkRun(texto, { bold: true, color: COR_BRANCO, size: 20 })], AlignmentType.CENTER, 60, 60)], COR_AZUL_MED);
}

function cellTexto(texto: string): TableCell {
  return mkCell([mkPar([mkRun(texto, { size: 20 })], AlignmentType.LEFT, 60, 60)]);
}

function cellSubHeader(texto: string, cols?: number): TableCell {
  return mkCell([mkPar([mkRun(texto, { bold: true, color: COR_AZUL, size: 20 })], AlignmentType.CENTER, 60, 60)], COR_CINZA, cols);
}

function cellLista(itens: string[]): TableCell {
  const pars = itens.length > 0
    ? itens.map(i => mkPar([mkRun('• ' + i, { size: 20 })], AlignmentType.LEFT, 30, 30))
    : [mkPar([mkRun('')])];
  return mkCell(pars);
}

function parsToCell(blocos: { rotulo?: string; texto: string }[]): TableCell {
  const children: Paragraph[] = [];
  for (const b of blocos) {
    if (b.rotulo) {
      children.push(mkPar([mkRun(b.rotulo, { bold: true, color: COR_AZUL_MED, size: 20 })], AlignmentType.LEFT, 100, 40));
    }
    const linhas = b.texto.split('\n').filter(l => l.trim());
    for (const l of linhas) {
      children.push(mkPar([mkRun(l.trim(), { size: 20 })], AlignmentType.LEFT, 20, 20));
    }
  }
  if (children.length === 0) children.push(mkPar([mkRun('')]));
  return mkCell(children);
}

async function exportarWord(resultado: string, valores: Record<string, string>) {
  const d = parsearTexto(resultado);
  const bordas = mkBordas();

  const tabelaTitulo = new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: bordas, rows: [
    new TableRow({ children: [cellHeader('SEQUÊNCIA DIDÁTICA', 4)] }),
    new TableRow({ children: [cellLabel('PROFESSOR(A):'), cellTexto(valores.professor || ''), cellLabel('COMPONENTE CURRICULAR:'), cellTexto('Educação Física')] }),
    new TableRow({ children: [cellLabel('ANO:'), cellTexto(valores.turma || ''), cellLabel('AULAS PREVISTAS:'), cellTexto(valores.aulas || '')] }),
  ]});

  const tabelaObjetivos = new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: bordas, rows: [
    new TableRow({ children: [mkCell([
      mkPar([mkRun('OBJETIVOS / CAPACIDADES', { bold: true, color: COR_BRANCO, size: 22 }),
             mkRun(' (Competências amplas do componente)', { color: COR_BRANCO, size: 18 })], AlignmentType.CENTER, 80, 80)
    ], COR_AZUL, 1)] }),
    new TableRow({ children: [mkCell(
      d.objetivos.length > 0
        ? d.objetivos.map(o => mkPar([mkRun('• ' + o, { size: 20 })], AlignmentType.LEFT, 40, 40))
        : [mkPar([mkRun('')])]
    )] }),
  ]});

  const tabelaConteudos = new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: bordas, rows: [
    new TableRow({ children: [cellHeader('CONTEÚDOS', 2)] }),
    new TableRow({ children: [cellSubHeader('HABILIDADES'), cellSubHeader('OBJETOS DE CONHECIMENTO')] }),
    new TableRow({ children: [cellLista(d.habilidades), cellLista(d.objetos.length > 0 ? d.objetos : [valores.unidade || ''])] }),
  ]});

  const rowsDesenvolvimento: TableRow[] = [
    new TableRow({ children: [mkCell([
      mkPar([mkRun('DESENVOLVIMENTO DAS ATIVIDADES', { bold: true, color: COR_BRANCO, size: 22 })], AlignmentType.CENTER, 80, 0),
      mkPar([mkRun('(Descrição de situações de ensino e aprendizagem para desenvolver as habilidades)', { color: COR_BRANCO, size: 18 })], AlignmentType.CENTER, 0, 80),
    ], COR_AZUL, 1)] }),
  ];

  if (d.situacoes.length > 0) {
    for (const s of d.situacoes) {
      rowsDesenvolvimento.push(new TableRow({ children: [mkCell([
        mkPar([mkRun(s.titulo, { bold: true, color: COR_AZUL, size: 20 })], AlignmentType.LEFT, 60, 20),
        mkPar([mkRun('Tempo: ' + s.tempo, { italics: true, color: COR_AZUL, size: 18 })], AlignmentType.LEFT, 0, 60),
      ], COR_CINZA)] }));

      rowsDesenvolvimento.push(new TableRow({ children: [parsToCell([
        ...(s.antes ? [{ rotulo: 'ANTES DA ATIVIDADE:', texto: s.antes }] : []),
        ...(s.desenvolvimento ? [{ rotulo: 'DESENVOLVIMENTO:', texto: s.desenvolvimento }] : []),
        ...(s.apos ? [{ rotulo: 'APÓS A ATIVIDADE:', texto: s.apos }] : []),
      ])] }));
    }
  } else {
    // Fallback: cai o texto bruto limpo
    const textoLimpo = limparMarkdown(resultado);
    rowsDesenvolvimento.push(new TableRow({ children: [mkCell(
      textoLimpo.split('\n').filter(l => l.trim()).map(l => mkPar([mkRun(l, { size: 20 })], AlignmentType.LEFT, 30, 30))
    )] }));
  }

  const tabelaDesenvolvimento = new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: bordas, rows: rowsDesenvolvimento });

  const tabelaRodape = new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: bordas, rows: [
    new TableRow({ children: [
      mkCell([mkPar([mkRun('VALORES ATITUDINAIS', { bold: true, color: COR_BRANCO, size: 18 })], AlignmentType.CENTER, 40, 0),
              mkPar([mkRun('ENVOLVIDOS NAS ATIVIDADES', { bold: true, color: COR_BRANCO, size: 18 })], AlignmentType.CENTER, 0, 40)], COR_AZUL),
      mkCell([mkPar([mkRun('INSTRUMENTOS DE AVALIAÇÃO', { bold: true, color: COR_BRANCO, size: 18 })], AlignmentType.CENTER, 60, 60)], COR_AZUL),
      mkCell([mkPar([mkRun('RECURSOS', { bold: true, color: COR_BRANCO, size: 18 })], AlignmentType.CENTER, 60, 60)], COR_AZUL),
    ]}),
    new TableRow({ children: [cellLista(d.valores), cellLista(d.avaliacao), cellLista(d.recursos)] }),
  ]});

  const tabelaRefs = new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: bordas, rows: [
    new TableRow({ children: [cellHeader('REFERÊNCIAS', 1)] }),
    new TableRow({ children: [mkCell(
      (d.referencias.length > 0 ? d.referencias : [
        'ACRE. Secretaria de Estado de Educação, Cultura e Esporte. Proposta de Plano de Curso do Ensino Fundamental Anos Finais, 2023.',
        'BRASIL. Ministério da Educação. Base Nacional Comum Curricular. Brasília: MEC, 2018.',
      ]).map(r => mkPar([mkRun(r, { size: 18 })], AlignmentType.LEFT, 40, 40))
    )] }),
  ]});

  const espacamento = new Paragraph({ children: [], spacing: { before: 120, after: 0 } });
  const secoes = [tabelaTitulo, tabelaObjetivos, tabelaConteudos, tabelaDesenvolvimento, tabelaRodape, tabelaRefs];

  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } } },
      children: secoes.flatMap((s, i) => i < secoes.length - 1 ? [s, espacamento] : [s]),
    }],
  });

  const blob = await Packer.toBlob(doc);
  const turma = (valores.turma || 'turma').replace(/[^a-z0-9]/gi, '_');
  saveAs(blob, `sequencia_didatica_ef_${turma}.docx`);
}

// ── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
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
    } catch (e: any) {
      setErro('Erro ao gerar: ' + e.message);
    } finally {
      setGerando(false);
    }
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

  // Preview limpo para exibição
  const resultadoLimpo = limparMarkdown(resultado)
    .replace(/===\w+===/g, '\n');

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 pb-36">
      <div className="bg-gradient-to-br from-emerald-600 to-emerald-500 p-5 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10" />
        <button onClick={() => navigate('/ia')}
          className="flex items-center gap-1.5 text-white/70 text-sm font-semibold mb-3 relative z-10 hover:text-white transition-colors">
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
            {gerando
              ? <><Loader2 className="w-5 h-5 animate-spin" /> Gerando...</>
              : <><Sparkles className="w-5 h-5" /> Gerar Sequência Didática</>}
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
                <button onClick={gerar}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-emerald-600 font-semibold">
                  <RefreshCw className="w-3.5 h-3.5" /> Gerar novo
                </button>
                <button onClick={copiar}
                  className={`flex items-center gap-1 text-xs font-black px-3 py-1.5 rounded-lg transition-all ${copiado ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
                  {copiado ? <><CheckCircle className="w-3.5 h-3.5" /> Copiado!</> : <><Copy className="w-3.5 h-3.5" /> Copiar</>}
                </button>
                <button onClick={baixarWord} disabled={exportando}
                  className="flex items-center gap-1 text-xs font-black px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 transition-all">
                  {exportando
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Gerando...</>
                    : <><FileDown className="w-3.5 h-3.5" /> Baixar Word</>}
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
