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
  { id: 'turma', label: 'Turma / Ano', tipo: 'select' as const, opcoes: ['6º Ano', '7º Ano', '8º Ano', '9º Ano'] },
  { id: 'bimestre', label: 'Bimestre', tipo: 'select' as const, opcoes: ['1º Bimestre', '2º Bimestre', '3º Bimestre', '4º Bimestre'] },
  { id: 'tema', label: 'Tema / Conteúdo', tipo: 'text' as const, placeholder: 'Ex: Voleibol — História, Fundamentos e Regras' },
  { id: 'tipo', label: 'Tipo de Atividade', tipo: 'select' as const, opcoes: ['Atividade de Fixação', 'Atividade de Revisão', 'Atividade Avaliativa'] },
  { id: 'contexto', label: 'Observações (opcional)', tipo: 'textarea' as const, placeholder: 'Ex: Foco em imagens, alunos iniciantes...', required: false },
];

const ETAPAS = [
  { texto: 'Analisando o tema e a turma...', icone: '🔍', duracao: 3000 },
  { texto: 'Elaborando questões com imagens...', icone: '🖼️', duracao: 5000 },
  { texto: 'Criando alternativas (A) e (B)...', icone: '✅', duracao: 5000 },
  { texto: 'Organizando a atividade...', icone: '📝', duracao: 4000 },
  { texto: 'Preparando gabarito...', icone: '📋', duracao: 3000 },
  { texto: 'Finalizando...', icone: '✨', duracao: 99999 },
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
    <div className="bg-white rounded-2xl border border-teal-100 shadow-sm p-6 flex flex-col gap-5">
      <div className="flex justify-center">
        <div className="w-20 h-20 rounded-full bg-teal-50 border-4 border-teal-200 flex items-center justify-center relative">
          <span className="text-3xl animate-bounce">{etapa.icone}</span>
          <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="36" fill="none" stroke="#ccfbf1" strokeWidth="4" />
            <circle cx="40" cy="40" r="36" fill="none" stroke="#14b8a6" strokeWidth="4"
              strokeDasharray={`${2 * Math.PI * 36}`}
              strokeDashoffset={`${2 * Math.PI * 36 * (1 - progresso / 100)}`}
              strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
          </svg>
        </div>
      </div>
      <div className="text-center">
        <p className="font-black text-gray-800 text-base">{etapa.texto}</p>
        <p className="text-xs text-gray-400 mt-1">Criando sua atividade com questões e imagens</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between text-xs font-semibold text-gray-400"><span>Processando...</span><span>{progresso}%</span></div>
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-teal-500 to-teal-400 rounded-full transition-all duration-500" style={{ width: `${progresso}%` }} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        {ETAPAS.slice(0, -1).map((e, i) => (
          <div key={i} className={`flex items-center gap-2 text-xs transition-all ${i < etapaIdx ? 'text-teal-600' : i === etapaIdx ? 'text-gray-700 font-semibold' : 'text-gray-300'}`}>
            <span className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-[10px] ${i < etapaIdx ? 'bg-teal-100 text-teal-600' : i === etapaIdx ? 'bg-teal-500 text-white animate-pulse' : 'bg-gray-100 text-gray-300'}`}>
              {i < etapaIdx ? '✓' : i + 1}
            </span>
            <span>{e.texto}</span>
          </div>
        ))}
      </div>
      <p className="text-center text-xs text-gray-300 font-medium">Isso pode levar 20 a 30 segundos — aguarde 😊</p>
    </div>
  );
}

function gerarPrompt(v: Record<string, string>) {
  return `Você é professor especialista em Educação Física do Ensino Fundamental.
NÃO use markdown. NÃO use **, ##, *, _. Escreva SOMENTE texto puro.

Crie uma ATIVIDADE ESCRITA DE FIXAÇÃO com 8 questões para:
Professor(es): ${v.professores}
Turma: ${v.turma}
Bimestre: ${v.bimestre}
Tema/Conteúdo: ${v.tema}
Tipo: ${v.tipo}
${v.contexto ? `Observações: ${v.contexto}` : ''}

REGRAS IMPORTANTES:
- Cada questão tem EXATAMENTE 2 alternativas: (A) e (B)
- Cada questão deve ter uma IMAGEM SUGERIDA entre colchetes ex: [IMAGEM: quadra de voleibol vista de cima]
- As questões devem ser claras, objetivas e adequadas ao ${v.turma}
- As alternativas devem ser simples e diretas — uma correta e uma incorreta
- Varie os tipos: algumas questões sobre história, algumas sobre fundamentos, algumas sobre regras
- A imagem sugerida deve ajudar a entender o conteúdo da questão

SIGA EXATAMENTE este formato:

INSTRUCOES
Leia cada questão com atenção e marque a alternativa correta: (A) ou (B).

QUESTOES

Questão 1
[IMAGEM: descrição clara da imagem sugerida para esta questão]
Enunciado da questão aqui, contextualizado e claro para o ${v.turma}.
(A) alternativa A
(B) alternativa B

Questão 2
[IMAGEM: descrição da imagem]
Enunciado.
(A) alternativa A
(B) alternativa B

Questão 3
[IMAGEM: descrição da imagem]
Enunciado.
(A) alternativa A
(B) alternativa B

Questão 4
[IMAGEM: descrição da imagem]
Enunciado.
(A) alternativa A
(B) alternativa B

Questão 5
[IMAGEM: descrição da imagem]
Enunciado.
(A) alternativa A
(B) alternativa B

Questão 6
[IMAGEM: descrição da imagem]
Enunciado.
(A) alternativa A
(B) alternativa B

Questão 7
[IMAGEM: descrição da imagem]
Enunciado.
(A) alternativa A
(B) alternativa B

Questão 8
[IMAGEM: descrição da imagem]
Enunciado.
(A) alternativa A
(B) alternativa B

GABARITO
1: [A ou B]
2: [A ou B]
3: [A ou B]
4: [A ou B]
5: [A ou B]
6: [A ou B]
7: [A ou B]
8: [A ou B]`;
}

// ── LIMPEZA ───────────────────────────────────────────────────────────────────
function limpar(t: string): string {
  return t
    .replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    .replace(/\*\*/g, '').replace(/\*/g, '')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extrairBloco(texto: string, inicio: string, fim: string): string {
  const s = texto.indexOf(inicio);
  if (s < 0) return '';
  const depois = texto.slice(s + inicio.length);
  const f = fim ? depois.indexOf(fim) : depois.length;
  return (f >= 0 ? depois.slice(0, f) : depois).trim();
}

interface QuestaoAtiv {
  numero: number;
  imagem: string;
  enunciado: string;
  alternativas: { letra: string; texto: string }[];
}

function parsearAtividade(textoOriginal: string) {
  const t = limpar(textoOriginal);
  const instrucoes = extrairBloco(t, 'INSTRUCOES', 'QUESTOES');
  const blocoQ = extrairBloco(t, 'QUESTOES', 'GABARITO');
  const blocoGab = extrairBloco(t, 'GABARITO', '');

  // Normalizar linhas em branco duplas para o regex funcionar
  const blocoNorm = blocoQ.replace(/\n{2,}/g, '\n');

  const questoes: QuestaoAtiv[] = [];
  const regex = /Questão\s+(\d+)\s*\n([\s\S]*?)(?=Questão\s+\d+\s*\n|$)/gi;
  for (const m of blocoNorm.matchAll(regex)) {
    const num = parseInt(m[1]);
    const corpo = m[2].trim();
    const linhas = corpo.split('\n').map(l => l.trim()).filter(Boolean);

    // Extrair imagem [IMAGEM: ...]
    const imgLinha = linhas.find(l => l.startsWith('[IMAGEM:') || l.startsWith('[Imagem:'));
    const imagem = imgLinha ? imgLinha.replace(/^\[IMAGEM:\s*/i, '').replace(/\]$/, '').trim() : '';

    // Alternativas
    const isAlt = (l: string) => /^\([AB]\)/i.test(l);
    const enunciado = linhas
      .filter(l => !isAlt(l) && !l.startsWith('[IMAGEM:') && !l.startsWith('[Imagem:'))
      .join(' ');
    const alternativas = linhas.filter(isAlt).map(l => ({
      letra: l[1].toUpperCase(),
      texto: l.slice(3).trim(),
    }));

    if (enunciado || alternativas.length > 0) {
      questoes.push({ numero: num, imagem, enunciado, alternativas });
    }
  }

  // Gabarito
  const gabarito: { numero: number; resposta: string }[] = [];
  for (const l of blocoGab.split('\n')) {
    const m = l.match(/(\d+)\s*:\s*([AB])/i);
    if (m) gabarito.push({ numero: parseInt(m[1]), resposta: m[2].toUpperCase() });
  }

  return { instrucoes, questoes, gabarito, textoLimpo: t };
}

// ── WORD ──────────────────────────────────────────────────────────────────────
const AZ = '1F3864', TEAL = '0F766E', BR = 'FFFFFF', CZ = 'F0FDFA', CZ2 = 'F4F6FC';

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

async function carregarLogoBase64(): Promise<string | null> {
  try {
    const resp = await fetch('/Logo_IOP.png');
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

async function exportarWord(textoOriginal: string, valores: Record<string, string>) {
  const d = parsearAtividade(textoOriginal);
  const logoB64 = await carregarLogoBase64();
  const esp = (n = 80) => new Paragraph({ children: [], spacing: { before: n, after: 0 } });
  const quebraPage = new Paragraph({ children: [new PageBreak()], spacing: { before: 0, after: 0 } });

  // ── CABEÇALHO ────────────────────────────────────────────────────────────
  const { ImageRun } = await import('docx');
  const celulaInfo = cel([
    par([run(`${valores.tipo || 'Atividade de Fixação'} — ${valores.bimestre} — 2026`, { bold: true, sz: 22, cor: AZ })], AlignmentType.LEFT, 40, 8),
    par([run('Disciplina: Educação Física', { bold: true, sz: 20 })], AlignmentType.LEFT, 6, 6),
    par([run(`Professor(a): ${valores.professores}`, { bold: true, sz: 20 })], AlignmentType.LEFT, 6, 6),
    par([run(`Turma: ${valores.turma}`, { bold: true, sz: 20 })], AlignmentType.LEFT, 6, 40),
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
    : cel([par([run('I.O.P.', { bold: true, cor: AZ, sz: 22 })], AlignmentType.CENTER)], CZ2);

  const cabecalho = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: bd(AZ),
    rows: [
      new TableRow({ children: [celulaLogo, celulaInfo] }),
      new TableRow({ children: [cel([
        par([run(`Tema: ${valores.tema}`, { bold: true, sz: 20, cor: AZ })], AlignmentType.LEFT, 60, 30),
        par([run('Nome: _____________________________________________  Nº: ______', { sz: 20 })], AlignmentType.LEFT, 10, 20),
        par([run('Turma: _________    Data: ____/____/______    Nota: ________', { sz: 20 })], AlignmentType.LEFT, 0, 60),
      ], undefined, 2)] }),
    ],
  });

  // ── INSTRUÇÕES ───────────────────────────────────────────────────────────
  const instrucoes = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: bd(TEAL),
    rows: [new TableRow({ children: [cel([
      par([run('Instruções: ', { bold: true, sz: 20, cor: TEAL }), run(d.instrucoes || 'Leia cada questão com atenção e marque a alternativa correta: (A) ou (B).', { sz: 20 })], AlignmentType.LEFT, 60, 60),
    ])] })],
  });

  // ── QUESTÕES em 2 colunas ─────────────────────────────────────────────────
  const tituloQ = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: bd(),
    rows: [new TableRow({ children: [hCel(`QUESTÕES  (cada questão vale 1,25 ponto — total 10,0)`, 1)] })],
  });

  const renderQ = (q: QuestaoAtiv, idx: number): Paragraph[] => {
    const bg = idx % 2 === 0 ? BR : CZ;
    const pars: Paragraph[] = [];

    // Número + enunciado
    pars.push(par([
      run(`${q.numero}. `, { bold: true, sz: 20, cor: AZ }),
      run(q.enunciado, { sz: 20 }),
    ], AlignmentType.LEFT, 80, 20));

    // Caixa de imagem
    if (q.imagem) {
      pars.push(new Paragraph({
        children: [run(`[ IMAGEM: ${q.imagem} ]`, { sz: 18, cor: '777777', it: true })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 30, after: 30 },
        border: {
          top: { style: BorderStyle.DASHED, size: 4, color: 'AAAAAA' },
          bottom: { style: BorderStyle.DASHED, size: 4, color: 'AAAAAA' },
          left: { style: BorderStyle.DASHED, size: 4, color: 'AAAAAA' },
          right: { style: BorderStyle.DASHED, size: 4, color: 'AAAAAA' },
        },
      }));
      // Espaço vazio para colar a imagem
      pars.push(par([run('', { sz: 20 })], AlignmentType.LEFT, 5, 50));
    }

    // Alternativas
    q.alternativas.forEach(alt => {
      pars.push(par([
        run(`(${alt.letra})  `, { bold: true, sz: 20 }),
        run(alt.texto, { sz: 20 }),
      ], AlignmentType.LEFT, 20, 20));
    });

    // Linha de resposta
    pars.push(par([run('Resposta: (    )', { bold: true, sz: 20, cor: AZ })], AlignmentType.LEFT, 30, 60));

    return pars;
  };

  const col1 = d.questoes.slice(0, 4);
  const col2 = d.questoes.slice(4, 8);

  const col1Pars = col1.length > 0
    ? col1.flatMap((q, i) => renderQ(q, i))
    : [par([run(extrairBloco(d.textoLimpo, 'QUESTOES', 'GABARITO'), { sz: 20 })])];

  const col2Pars = col2.length > 0
    ? col2.flatMap((q, i) => renderQ(q, i))
    : [par([run('')])];

  const tabelaQ = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: bd(),
    rows: [new TableRow({ children: [
      new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: col1Pars }),
      new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: col2Pars }),
    ]})],
  });

  // ── GABARITO (nova página) ────────────────────────────────────────────────
  const gabHeader = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: bd(TEAL),
    rows: [
      new TableRow({ children: [hCel('GABARITO', 1, TEAL)] }),
      new TableRow({ children: [cel([par([run(`${valores.turma}  |  Educação Física  |  ${valores.bimestre}  |  ${valores.tema}`, { sz: 20, cor: AZ })], AlignmentType.CENTER, 60, 60)])] }),
    ],
  });

  const makeGabCell = (n: number) => {
    const gab = d.gabarito.find(g => g.numero === n);
    return cel([par([
      run(`${n}.  `, { bold: true, sz: 22 }),
      run(gab?.resposta ?? '?', { bold: true, sz: 22, cor: TEAL }),
    ], AlignmentType.CENTER, 80, 80)]);
  };

  const gabGrid = new Table({
    width: { size: 80, type: WidthType.PERCENTAGE },
    borders: bd(),
    rows: [
      new TableRow({ children: [1, 2, 3, 4].map(makeGabCell) }),
      new TableRow({ children: [5, 6, 7, 8].map(makeGabCell) }),
    ],
  });

  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: 600, bottom: 600, left: 800, right: 800 } } },
      children: [
        cabecalho, esp(80),
        instrucoes, esp(80),
        tituloQ,
        tabelaQ,
        quebraPage,
        gabHeader, esp(80),
        gabGrid,
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const turma = (valores.turma || 'turma').replace(/[^a-z0-9]/gi, '_');
  const bim = (valores.bimestre || '').replace(/[^a-z0-9]/gi, '_');
  saveAs(blob, `atividade_ef_${turma}_${bim}.docx`);
}

// ── COMPONENTE ────────────────────────────────────────────────────────────────
export function IAAtividadesAdaptadas() {
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
          max_tokens: 3000,
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
      <div className="p-5 text-white relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0f766e, #0d9488)' }}>
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10" />
        <button onClick={() => navigate('/ia')} className="flex items-center gap-1.5 text-white/70 text-sm font-semibold mb-3 relative z-10 hover:text-white">
          <ArrowLeft className="w-4 h-4" /> Ferramentas IA
        </button>
        <h1 className="text-lg font-black relative z-10">Gerador de Atividades</h1>
        <p className="text-sm text-white/70 mt-1 relative z-10">8 questões · 2 alternativas · Espaço para imagens · Word</p>
      </div>

      <div className="p-4 flex flex-col gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3">
          {CAMPOS.map(campo => (
            <div key={campo.id}>
              <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-1.5">{campo.label}</label>
              {campo.tipo === 'select' ? (
                <select value={valores[campo.id] || ''} onChange={e => atualizar(campo.id, e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-teal-200">
                  <option value="">Selecione...</option>
                  {campo.opcoes?.map(op => <option key={op} value={op}>{op}</option>)}
                </select>
              ) : campo.tipo === 'textarea' ? (
                <textarea value={valores[campo.id] || ''} onChange={e => atualizar(campo.id, e.target.value)}
                  placeholder={campo.placeholder} rows={2}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-teal-200 resize-none" />
              ) : (
                <input type="text" value={valores[campo.id] || ''} onChange={e => atualizar(campo.id, e.target.value)}
                  placeholder={campo.placeholder}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-teal-200" />
              )}
            </div>
          ))}

          {erro && <p className="text-xs text-red-500 font-semibold bg-red-50 border border-red-200 rounded-xl px-3 py-2">{erro}</p>}

          <button onClick={gerar} disabled={gerando}
            className="w-full py-4 rounded-2xl font-black text-white flex items-center justify-center gap-2 disabled:opacity-60 transition-all active:scale-95 shadow-lg"
            style={{ background: 'linear-gradient(135deg, #0f766e, #0d9488)' }}>
            {gerando ? <><Loader2 className="w-5 h-5 animate-spin" /> Gerando...</> : <><Sparkles className="w-5 h-5" /> Gerar Atividade</>}
          </button>
        </div>

        {gerando && <ProgressoGerando />}

        {resultado && !gerando && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-teal-50 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-teal-600" />
                <span className="text-sm font-black text-teal-700">Atividade gerada!</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button onClick={gerar} className="flex items-center gap-1 text-xs text-gray-500 hover:text-teal-600 font-semibold">
                  <RefreshCw className="w-3.5 h-3.5" /> Gerar nova
                </button>
                <button onClick={copiar}
                  className={`flex items-center gap-1 text-xs font-black px-3 py-1.5 rounded-lg transition-all ${copiado ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700'}`}>
                  {copiado ? <><CheckCircle className="w-3.5 h-3.5" /> Copiado!</> : <><Copy className="w-3.5 h-3.5" /> Copiar</>}
                </button>
                <button onClick={baixarWord} disabled={exportando}
                  className="flex items-center gap-1 text-xs font-black px-3 py-1.5 rounded-lg text-white disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, #0f766e, #0d9488)' }}>
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
