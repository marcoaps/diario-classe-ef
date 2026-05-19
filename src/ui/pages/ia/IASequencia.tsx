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
    let prog = 0;

    const avancar = () => {
      if (idx < ETAPAS.length - 1) {
        idx++;
        setEtapaIdx(idx);
      }
      prog = Math.min(95, Math.round((idx / (ETAPAS.length - 1)) * 95));
      setProgresso(prog);

      if (idx < ETAPAS.length - 1) {
        timerRef.current = setTimeout(avancar, ETAPAS[idx].duracao);
      }
    };

    // Incremento suave de progresso
    const incremento = setInterval(() => {
      setProgresso(prev => {
        const max = Math.round((etapaIdx / (ETAPAS.length - 1)) * 95);
        return prev < max ? prev + 1 : prev;
      });
    }, 300);

    timerRef.current = setTimeout(avancar, ETAPAS[0].duracao);

    return () => {
      clearTimeout(timerRef.current);
      clearInterval(incremento);
    };
  }, []);

  const etapa = ETAPAS[etapaIdx];

  return (
    <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm p-6 flex flex-col gap-5">
      {/* Ícone animado */}
      <div className="flex justify-center">
        <div className="w-20 h-20 rounded-full bg-emerald-50 border-4 border-emerald-200 flex items-center justify-center relative">
          <span className="text-3xl animate-bounce">{etapa.icone}</span>
          <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="36" fill="none" stroke="#d1fae5" strokeWidth="4" />
            <circle
              cx="40" cy="40" r="36" fill="none"
              stroke="#10b981" strokeWidth="4"
              strokeDasharray={`${2 * Math.PI * 36}`}
              strokeDashoffset={`${2 * Math.PI * 36 * (1 - progresso / 100)}`}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 0.5s ease' }}
            />
          </svg>
        </div>
      </div>

      {/* Texto da etapa */}
      <div className="text-center">
        <p className="font-black text-gray-800 text-base">{etapa.texto}</p>
        <p className="text-xs text-gray-400 mt-1">A IA está elaborando sua sequência didática completa</p>
      </div>

      {/* Barra de progresso */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between text-xs font-semibold text-gray-400">
          <span>Processando...</span>
          <span>{progresso}%</span>
        </div>
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
            style={{ width: `${progresso}%` }}
          />
        </div>
      </div>

      {/* Etapas como checklist */}
      <div className="flex flex-col gap-1.5">
        {ETAPAS.slice(0, -1).map((e, i) => (
          <div key={i} className={`flex items-center gap-2 text-xs transition-all ${
            i < etapaIdx ? 'text-emerald-600' : i === etapaIdx ? 'text-gray-700 font-semibold' : 'text-gray-300'
          }`}>
            <span className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-[10px] ${
              i < etapaIdx ? 'bg-emerald-100 text-emerald-600' :
              i === etapaIdx ? 'bg-emerald-500 text-white animate-pulse' :
              'bg-gray-100 text-gray-300'
            }`}>
              {i < etapaIdx ? '✓' : i + 1}
            </span>
            <span>{e.texto}</span>
          </div>
        ))}
      </div>

      <p className="text-center text-xs text-gray-300 font-medium">
        Isso pode levar 20 a 40 segundos — aguarde 😊
      </p>
    </div>
  );
}

function gerarPrompt(v: Record<string, string>) {
  return `Você é um professor especialista em Educação Física do Ensino Fundamental, com domínio da BNCC e do modelo de Sequência Didática da Secretaria de Educação do Acre.

Crie uma SEQUÊNCIA DIDÁTICA COMPLETA no modelo oficial abaixo, para:
- Professor(a): ${v.professor}
- Componente Curricular: Educação Física
- Ano: ${v.turma}
- Aulas Previstas: ${v.aulas}
- Unidade Temática BNCC: ${v.unidade}
- Tema / Objeto de Conhecimento: ${v.tema}
- Número de Situações de Aprendizagem: ${v.situacoes}
${v.contexto ? `- Contexto: ${v.contexto}` : ''}

Use EXATAMENTE esta estrutura:

SEQUÊNCIA DIDÁTICA
PROFESSOR(A): ${v.professor}
COMPONENTE CURRICULAR: Educação Física
ANO: ${v.turma}
AULAS PREVISTAS: ${v.aulas}

OBJETIVOS / CAPACIDADES
[Escreva 2-3 objetivos gerais amplos]

HABILIDADES
[Liste 4-6 habilidades específicas, uma por linha, com códigos EF]

OBJETOS DE CONHECIMENTO
[Liste os objetos de conhecimento BNCC]

DESENVOLVIMENTO DAS ATIVIDADES

[Para cada situação use:]
Situação de Aprendizagem N – [Nome]
Tempo: X min

ANTES DA ATIVIDADE:
[descrição]

DESENVOLVIMENTO:
[passo a passo]

APÓS A ATIVIDADE:
[reflexão e sistematização]

VALORES ATITUDINAIS
[Liste 4-5 valores, um por linha começando com •]

INSTRUMENTOS DE AVALIAÇÃO
[Liste 4-5 instrumentos, um por linha começando com •]

RECURSOS
[Liste recursos necessários, um por linha começando com •]

REFERÊNCIAS
ACRE. Secretaria de Estado de Educação, Cultura e Esporte. Proposta de Plano de Curso do Ensino Fundamental Anos Finais, 2023.
BRASIL. Ministério da Educação. Base Nacional Comum Curricular. Brasília: MEC, 2018.
[mais 2 referências relevantes]

Seja detalhado, prático e use linguagem direta de professor para professor.`;
}

const AZUL_ESCURO = '1F3864';
const AZUL_MEDIO = '2E5FA3';
const CINZA_CLARO = 'D9E2F3';
const BRANCO = 'FFFFFF';

function parsearTexto(resultado: string) {
  const entre = (inicio: string, fim: string): string => {
    const s = resultado.indexOf(inicio);
    const e = fim ? resultado.indexOf(fim) : resultado.length;
    if (s < 0) return '';
    return resultado.slice(s + inicio.length, e > s ? e : resultado.length).trim();
  };
  const listar = (secao: string, proxima: string): string[] => {
    const bloco = entre(secao, proxima);
    return bloco.split('\n').map(l => l.replace(/^[•\-*]\s*/, '').trim()).filter(Boolean);
  };
  const objetivos = entre('OBJETIVOS / CAPACIDADES', 'HABILIDADES').replace(/\[.*?\]/gs, '').trim();
  const habilidades = listar('HABILIDADES\n', 'OBJETOS DE CONHECIMENTO');
  const objetos = listar('OBJETOS DE CONHECIMENTO\n', 'DESENVOLVIMENTO');
  const situacoes: any[] = [];
  const matchSits = resultado.matchAll(/Situação de Aprendizagem (\d+)[–\-—]\s*(.+?)\nTempo:\s*(.+?)\n([\s\S]*?)(?=Situação de Aprendizagem \d+|VALORES ATITUDINAIS|$)/g);
  for (const m of matchSits) {
    const corpo = m[4] || '';
    const antes = (corpo.match(/ANTES DA ATIVIDADE:\n([\s\S]*?)(?=DESENVOLVIMENTO:|$)/) || [])[1]?.trim() || '';
    const dev = (corpo.match(/DESENVOLVIMENTO:\n([\s\S]*?)(?=APÓS A ATIVIDADE:|APOS A ATIVIDADE:|$)/) || [])[1]?.trim() || '';
    const apos = (corpo.match(/(?:APÓS|APOS) A ATIVIDADE:\n([\s\S]*?)$/) || [])[1]?.trim() || '';
    situacoes.push({ titulo: `Situação de Aprendizagem ${m[1]} – ${m[2].trim()}`, tempo: m[3].trim(), antes, desenvolvimento: dev, apos });
  }
  const valores = listar('VALORES ATITUDINAIS\n', 'INSTRUMENTOS DE AVALIAÇÃO');
  const avaliacao = listar('INSTRUMENTOS DE AVALIAÇÃO\n', 'RECURSOS');
  const recursos = listar('RECURSOS\n', 'REFERÊNCIAS');
  const refs = listar('REFERÊNCIAS\n', '---FIM---');
  return { objetivos, habilidades, objetos, situacoes, valores, avaliacao, recursos, referencias: refs };
}

async function exportarWord(resultado: string, valores: Record<string, string>) {
  const d = parsearTexto(resultado);
  const bordaTabela = { style: BorderStyle.SINGLE, size: 8, color: AZUL_MEDIO };
  const bordas = { top: bordaTabela, bottom: bordaTabela, left: bordaTabela, right: bordaTabela, insideH: bordaTabela, insideV: bordaTabela };

  const mk = (texto: string, opts: any = {}): TextRun =>
    new TextRun({ text: texto, font: 'Arial', size: opts.size || 20, bold: opts.bold, color: opts.color || '000000', italics: opts.italics });

  const cell = (children: Paragraph[], cor?: string, cols?: number): TableCell =>
    new TableCell({
      ...(cols ? { columnSpan: cols } : {}),
      ...(cor ? { shading: { type: ShadingType.SOLID, color: cor } } : {}),
      verticalAlign: VerticalAlign.CENTER,
      children,
    });

  const p = (runs: TextRun[], align = AlignmentType.LEFT, spacing = { before: 60, after: 60 }): Paragraph =>
    new Paragraph({ children: runs, alignment: align, spacing });

  const headerCell = (texto: string, cols?: number) => cell([
    p([mk(texto, { bold: true, color: BRANCO, size: 22 })], AlignmentType.CENTER, { before: 80, after: 80 })
  ], AZUL_ESCURO, cols);

  const labelCell = (texto: string) => cell([
    p([mk(texto, { bold: true, color: BRANCO, size: 20 })], AlignmentType.CENTER, { before: 60, after: 60 })
  ], AZUL_MEDIO);

  const textCell = (texto: string) => cell([
    p([mk(texto, { size: 20 })], AlignmentType.LEFT, { before: 60, after: 60 })
  ]);

  const listaCell = (itens: string[]) => cell(
    itens.length > 0
      ? itens.map(i => p([mk('• ' + i, { size: 20 })], AlignmentType.LEFT, { before: 30, after: 30 }))
      : [p([mk('')])]
  );

  const subHeaderCell = (texto: string, cols?: number) => cell([
    p([mk(texto, { bold: true, color: AZUL_ESCURO, size: 20 })], AlignmentType.CENTER, { before: 60, after: 60 })
  ], CINZA_CLARO, cols);

  const secoes: any[] = [
    // Título
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: bordas, rows: [
      new TableRow({ children: [headerCell('SEQUÊNCIA DIDÁTICA', 4)] }),
      new TableRow({ children: [labelCell('PROFESSOR(A):'), textCell(valores.professor || ''), labelCell('COMPONENTE CURRICULAR:'), textCell('Educação Física')] }),
      new TableRow({ children: [labelCell('ANO:'), textCell(valores.turma || ''), labelCell('AULAS PREVISTAS:'), textCell(valores.aulas || '')] }),
    ]}),

    // Objetivos
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: bordas, rows: [
      new TableRow({ children: [cell([
        p([mk('OBJETIVOS / CAPACIDADES', { bold: true, color: BRANCO, size: 22 }), mk(' (Competências amplas do componente)', { color: BRANCO, size: 18 })], AlignmentType.CENTER, { before: 80, after: 80 })
      ], AZUL_ESCURO, 1)] }),
      new TableRow({ children: [cell([p([mk(d.objetivos || '', { size: 20 })], AlignmentType.LEFT, { before: 80, after: 80 })])] }),
    ]}),

    // Conteúdos
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: bordas, rows: [
      new TableRow({ children: [headerCell('CONTEÚDOS', 2)] }),
      new TableRow({ children: [subHeaderCell('HABILIDADES'), subHeaderCell('OBJETOS DE CONHECIMENTO')] }),
      new TableRow({ children: [listaCell(d.habilidades), listaCell(d.objetos.length > 0 ? d.objetos : [valores.unidade || ''])] }),
    ]}),

    // Desenvolvimento
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: bordas, rows: [
      new TableRow({ children: [cell([
        p([mk('DESENVOLVIMENTO DAS ATIVIDADES', { bold: true, color: BRANCO, size: 22 })], AlignmentType.CENTER, { before: 80, after: 0 }),
        p([mk('(Descrição de situações de ensino e aprendizagem para desenvolver as habilidades)', { color: BRANCO, size: 18 })], AlignmentType.CENTER, { before: 0, after: 80 }),
      ], AZUL_ESCURO, 1)] }),
      ...(d.situacoes.length > 0 ? d.situacoes.flatMap(s => [
        new TableRow({ children: [cell([
          p([mk(s.titulo, { bold: true, color: AZUL_ESCURO, size: 20 })], AlignmentType.LEFT, { before: 60, after: 20 }),
          p([mk('Tempo: ' + s.tempo, { italics: true, color: AZUL_ESCURO, size: 18 })], AlignmentType.LEFT, { before: 0, after: 60 }),
        ], CINZA_CLARO)] }),
        new TableRow({ children: [cell([
          ...(s.antes ? [p([mk('ANTES DA ATIVIDADE:', { bold: true, color: AZUL_MEDIO, size: 20 })], AlignmentType.LEFT, { before: 80, after: 40 }),
            ...s.antes.split('\n').filter(Boolean).map((l: string) => p([mk(l, { size: 20 })], AlignmentType.LEFT, { before: 20, after: 20 }))] : []),
          ...(s.desenvolvimento ? [p([mk('DESENVOLVIMENTO:', { bold: true, color: AZUL_MEDIO, size: 20 })], AlignmentType.LEFT, { before: 100, after: 40 }),
            ...s.desenvolvimento.split('\n').filter(Boolean).map((l: string) => p([mk(l, { size: 20 })], AlignmentType.LEFT, { before: 20, after: 20 }))] : []),
          ...(s.apos ? [p([mk('APÓS A ATIVIDADE:', { bold: true, color: AZUL_MEDIO, size: 20 })], AlignmentType.LEFT, { before: 100, after: 40 }),
            ...s.apos.split('\n').filter(Boolean).map((l: string) => p([mk(l, { size: 20 })], AlignmentType.LEFT, { before: 20, after: 20 }))] : []),
          p([mk('')], AlignmentType.LEFT, { before: 60, after: 0 }),
        ])] }),
      ]) : [new TableRow({ children: [cell([p([mk(resultado, { size: 20 })])])] })]),
    ]}),

    // Rodapé 3 colunas
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: bordas, rows: [
      new TableRow({ children: [
        cell([p([mk('VALORES ATITUDINAIS', { bold: true, color: BRANCO, size: 18 })], AlignmentType.CENTER, { before: 60, after: 0 }),
              p([mk('ENVOLVIDOS NAS ATIVIDADES', { bold: true, color: BRANCO, size: 18 })], AlignmentType.CENTER, { before: 0, after: 60 })], AZUL_ESCURO),
        cell([p([mk('INSTRUMENTOS DE AVALIAÇÃO', { bold: true, color: BRANCO, size: 18 })], AlignmentType.CENTER, { before: 60, after: 60 })], AZUL_ESCURO),
        cell([p([mk('RECURSOS', { bold: true, color: BRANCO, size: 18 })], AlignmentType.CENTER, { before: 60, after: 60 })], AZUL_ESCURO),
      ]}),
      new TableRow({ children: [listaCell(d.valores), listaCell(d.avaliacao), listaCell(d.recursos)] }),
    ]}),

    // Referências
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: bordas, rows: [
      new TableRow({ children: [headerCell('REFERÊNCIAS', 1)] }),
      new TableRow({ children: [cell(
        d.referencias.length > 0
          ? d.referencias.map(r => p([mk(r, { size: 18 })], AlignmentType.LEFT, { before: 40, after: 40 }))
          : [p([mk('ACRE. Secretaria de Estado de Educação, Cultura e Esporte. Proposta de Plano de Curso do Ensino Fundamental Anos Finais, 2023.', { size: 18 })])]
      )] }),
    ]}),
  ];

  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } } },
      children: secoes.flatMap((s, i) =>
        i < secoes.length - 1
          ? [s, new Paragraph({ children: [], spacing: { before: 120, after: 0 } })]
          : [s]
      ),
    }],
  });

  const blob = await Packer.toBlob(doc);
  const turma = (valores.turma || 'turma').replace(/[^a-z0-9]/gi, '_');
  saveAs(blob, `sequencia_didatica_ef_${turma}.docx`);
}

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
        {/* Formulário */}
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

        {/* Animação de progresso */}
        {gerando && <ProgressoGerando />}

        {/* Resultado */}
        {resultado && !gerando && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-emerald-50 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-black text-emerald-700">Sequência gerada com sucesso!</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button onClick={gerar}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-emerald-600 font-semibold transition-colors">
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
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">{resultado}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
