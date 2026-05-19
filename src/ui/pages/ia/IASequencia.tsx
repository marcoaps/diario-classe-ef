import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Copy, CheckCircle, Loader2, RefreshCw, FileDown } from 'lucide-react';
import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, HeadingLevel, AlignmentType, WidthType, BorderStyle,
  ShadingType, TableLayoutType, VerticalAlign,
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

// Cores do modelo oficial
const AZUL_ESCURO = '1F3864';
const AZUL_MEDIO = '2E5FA3';
const CINZA_CLARO = 'D9E2F3';
const BRANCO = 'FFFFFF';

function cellComCor(texto: string, cor: string, fonteCor: string = BRANCO, negrito = true, tamanho = 22): TableCell {
  return new TableCell({
    shading: { type: ShadingType.SOLID, color: cor },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: texto, bold: negrito, color: fonteCor, size: tamanho, font: 'Arial' })],
      spacing: { before: 80, after: 80 },
    })],
  });
}

function cellTexto(texto: string, negrito = false, cor = '000000'): TableCell {
  return new TableCell({
    children: [new Paragraph({
      children: [new TextRun({ text: texto, bold: negrito, color: cor, size: 20, font: 'Arial' })],
      spacing: { before: 60, after: 60 },
    })],
  });
}

function secaoTitulo(texto: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: texto, bold: true, color: BRANCO, size: 22, font: 'Arial' })],
    alignment: AlignmentType.CENTER,
    shading: { type: ShadingType.SOLID, color: AZUL_ESCURO, fill: AZUL_ESCURO },
    spacing: { before: 200, after: 0 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: BRANCO } },
  });
}

function paragrafoNormal(texto: string, negrito = false): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: texto, bold: negrito, size: 20, font: 'Arial' })],
    spacing: { before: 60, after: 60 },
  });
}

function parsearTexto(resultado: string): {
  objetivos: string;
  habilidades: string[];
  objetos: string[];
  situacoes: { titulo: string; tempo: string; antes: string; desenvolvimento: string; apos: string }[];
  valores: string[];
  avaliacao: string[];
  recursos: string[];
  referencias: string[];
} {
  const linhas = resultado.split('\n');

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

  // Parsear situações
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

  const secoes: any[] = [];

  // Título principal
  secoes.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: bordas,
    rows: [
      new TableRow({ children: [new TableCell({
        columnSpan: 4,
        shading: { type: ShadingType.SOLID, color: AZUL_ESCURO },
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: 'SEQUÊNCIA DIDÁTICA', bold: true, color: BRANCO, size: 28, font: 'Arial' })],
          spacing: { before: 100, after: 100 },
        })],
      })] }),
      new TableRow({ children: [
        cellComCor('PROFESSOR(A):', AZUL_MEDIO),
        cellTexto(valores.professor || '', false),
        cellComCor('COMPONENTE CURRICULAR:', AZUL_MEDIO),
        cellTexto('Educação Física', false),
      ]}),
      new TableRow({ children: [
        cellComCor('ANO:', AZUL_MEDIO),
        cellTexto(valores.turma || '', false),
        cellComCor('AULAS PREVISTAS:', AZUL_MEDIO),
        cellTexto(valores.aulas || '', false),
      ]}),
    ],
  }));

  // Objetivos
  secoes.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: bordas,
    rows: [
      new TableRow({ children: [new TableCell({
        columnSpan: 1,
        shading: { type: ShadingType.SOLID, color: AZUL_ESCURO },
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: 'OBJETIVOS / CAPACIDADES', bold: true, color: BRANCO, size: 22, font: 'Arial' }),
            new TextRun({ text: ' (Competências amplas do componente)', color: BRANCO, size: 18, font: 'Arial' }),
          ],
          spacing: { before: 80, after: 80 },
        })],
      })] }),
      new TableRow({ children: [new TableCell({
        children: [new Paragraph({
          children: [new TextRun({ text: d.objetivos || '', size: 20, font: 'Arial' })],
          spacing: { before: 80, after: 80 },
        })],
      })] }),
    ],
  }));

  // Conteúdos — Habilidades x Objetos
  secoes.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: bordas,
    rows: [
      new TableRow({ children: [new TableCell({
        columnSpan: 2,
        shading: { type: ShadingType.SOLID, color: AZUL_ESCURO },
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: 'CONTEÚDOS', bold: true, color: BRANCO, size: 22, font: 'Arial' })],
          spacing: { before: 80, after: 80 },
        })],
      })] }),
      new TableRow({ children: [
        new TableCell({
          width: { size: 60, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.SOLID, color: CINZA_CLARO },
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: 'HABILIDADES', bold: true, color: AZUL_ESCURO, size: 20, font: 'Arial' })],
            spacing: { before: 60, after: 60 },
          })],
        }),
        new TableCell({
          width: { size: 40, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.SOLID, color: CINZA_CLARO },
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: 'OBJETOS DE CONHECIMENTO', bold: true, color: AZUL_ESCURO, size: 20, font: 'Arial' })],
            spacing: { before: 60, after: 60 },
          })],
        }),
      ]}),
      new TableRow({ children: [
        new TableCell({
          children: d.habilidades.length > 0
            ? d.habilidades.map(h => new Paragraph({ children: [new TextRun({ text: '• ' + h, size: 20, font: 'Arial' })], spacing: { before: 40, after: 40 } }))
            : [new Paragraph({ children: [new TextRun({ text: '', size: 20 })] })],
        }),
        new TableCell({
          children: d.objetos.length > 0
            ? d.objetos.map(o => new Paragraph({ children: [new TextRun({ text: '• ' + o, size: 20, font: 'Arial' })], spacing: { before: 40, after: 40 } }))
            : [new Paragraph({ children: [new TextRun({ text: valores.unidade || '', size: 20 })] })],
        }),
      ]}),
    ],
  }));

  // Desenvolvimento
  secoes.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: bordas,
    rows: [
      new TableRow({ children: [new TableCell({
        shading: { type: ShadingType.SOLID, color: AZUL_ESCURO },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: 'DESENVOLVIMENTO DAS ATIVIDADES', bold: true, color: BRANCO, size: 22, font: 'Arial' })],
            spacing: { before: 80, after: 0 },
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: '(Descrição de situações de ensino e aprendizagem para desenvolver as habilidades)', color: BRANCO, size: 18, font: 'Arial' })],
            spacing: { before: 0, after: 80 },
          }),
        ],
      })] }),
      ...d.situacoes.length > 0
        ? d.situacoes.flatMap((s, idx) => [
          new TableRow({ children: [new TableCell({
            shading: { type: ShadingType.SOLID, color: CINZA_CLARO },
            children: [
              new Paragraph({
                children: [new TextRun({ text: s.titulo, bold: true, color: AZUL_ESCURO, size: 20, font: 'Arial' })],
                spacing: { before: 60, after: 20 },
              }),
              new Paragraph({
                children: [new TextRun({ text: 'Tempo: ' + s.tempo, color: AZUL_ESCURO, size: 18, font: 'Arial', italics: true })],
                spacing: { before: 0, after: 60 },
              }),
            ],
          })] }),
          new TableRow({ children: [new TableCell({
            children: [
              ...(s.antes ? [
                new Paragraph({ children: [new TextRun({ text: 'ANTES DA ATIVIDADE:', bold: true, size: 20, font: 'Arial', color: AZUL_MEDIO })], spacing: { before: 80, after: 40 } }),
                ...s.antes.split('\n').filter(Boolean).map(l => new Paragraph({ children: [new TextRun({ text: l, size: 20, font: 'Arial' })], spacing: { before: 20, after: 20 } })),
              ] : []),
              ...(s.desenvolvimento ? [
                new Paragraph({ children: [new TextRun({ text: 'DESENVOLVIMENTO:', bold: true, size: 20, font: 'Arial', color: AZUL_MEDIO })], spacing: { before: 100, after: 40 } }),
                ...s.desenvolvimento.split('\n').filter(Boolean).map(l => new Paragraph({ children: [new TextRun({ text: l, size: 20, font: 'Arial' })], spacing: { before: 20, after: 20 } })),
              ] : []),
              ...(s.apos ? [
                new Paragraph({ children: [new TextRun({ text: 'APÓS A ATIVIDADE:', bold: true, size: 20, font: 'Arial', color: AZUL_MEDIO })], spacing: { before: 100, after: 40 } }),
                ...s.apos.split('\n').filter(Boolean).map(l => new Paragraph({ children: [new TextRun({ text: l, size: 20, font: 'Arial' })], spacing: { before: 20, after: 20 } })),
              ] : []),
              new Paragraph({ children: [new TextRun({ text: '' })], spacing: { before: 60, after: 0 } }),
            ],
          })] }),
        ])
        : [new TableRow({ children: [new TableCell({
          children: resultado.split('\n').filter(l => l.trim()).map(l =>
            new Paragraph({ children: [new TextRun({ text: l, size: 20, font: 'Arial' })], spacing: { before: 40, after: 40 } })
          ),
        })] })],
    ],
  }));

  // Rodapé — Valores, Avaliação, Recursos
  secoes.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: bordas,
    rows: [
      new TableRow({ children: [
        new TableCell({
          shading: { type: ShadingType.SOLID, color: AZUL_ESCURO },
          children: [
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'VALORES ATITUDINAIS', bold: true, color: BRANCO, size: 18, font: 'Arial' })], spacing: { before: 60, after: 0 } }),
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'ENVOLVIDOS NAS ATIVIDADES', bold: true, color: BRANCO, size: 18, font: 'Arial' })], spacing: { before: 0, after: 60 } }),
          ],
        }),
        new TableCell({
          shading: { type: ShadingType.SOLID, color: AZUL_ESCURO },
          children: [
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'INSTRUMENTOS DE AVALIAÇÃO', bold: true, color: BRANCO, size: 18, font: 'Arial' })], spacing: { before: 60, after: 60 } }),
          ],
        }),
        new TableCell({
          shading: { type: ShadingType.SOLID, color: AZUL_ESCURO },
          children: [
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'RECURSOS', bold: true, color: BRANCO, size: 18, font: 'Arial' })], spacing: { before: 60, after: 60 } }),
          ],
        }),
      ]}),
      new TableRow({ children: [
        new TableCell({
          children: d.valores.length > 0
            ? d.valores.map(v => new Paragraph({ children: [new TextRun({ text: '• ' + v, size: 18, font: 'Arial' })], spacing: { before: 30, after: 30 } }))
            : [new Paragraph({ children: [new TextRun({ text: '', size: 18 })] })],
        }),
        new TableCell({
          children: d.avaliacao.length > 0
            ? d.avaliacao.map(a => new Paragraph({ children: [new TextRun({ text: '• ' + a, size: 18, font: 'Arial' })], spacing: { before: 30, after: 30 } }))
            : [new Paragraph({ children: [new TextRun({ text: '', size: 18 })] })],
        }),
        new TableCell({
          children: d.recursos.length > 0
            ? d.recursos.map(r => new Paragraph({ children: [new TextRun({ text: '• ' + r, size: 18, font: 'Arial' })], spacing: { before: 30, after: 30 } }))
            : [new Paragraph({ children: [new TextRun({ text: '', size: 18 })] })],
        }),
      ]}),
    ],
  }));

  // Referências
  secoes.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: bordas,
    rows: [
      new TableRow({ children: [new TableCell({
        shading: { type: ShadingType.SOLID, color: AZUL_ESCURO },
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'REFERÊNCIAS', bold: true, color: BRANCO, size: 22, font: 'Arial' })], spacing: { before: 80, after: 80 } })],
      })] }),
      new TableRow({ children: [new TableCell({
        children: d.referencias.length > 0
          ? d.referencias.map(r => new Paragraph({ children: [new TextRun({ text: r, size: 18, font: 'Arial' })], spacing: { before: 40, after: 40 } }))
          : [new Paragraph({ children: [new TextRun({ text: 'ACRE. Secretaria de Estado de Educação, Cultura e Esporte. Proposta de Plano de Curso do Ensino Fundamental Anos Finais, 2023.', size: 18, font: 'Arial' })] })],
      })] }),
    ],
  }));

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 720, bottom: 720, left: 900, right: 900 },
        },
      },
      children: [
        ...secoes.flatMap((s, i) => i < secoes.length - 1 ? [s, new Paragraph({ children: [], spacing: { before: 120, after: 0 } })] : [s]),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const turma = valores.turma?.replace(/[^a-z0-9]/gi, '_') || 'turma';
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
      <div className="bg-gradient-to-br from-emerald-600 to-emerald-500 p-5 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10" />
        <button onClick={() => navigate('/ia')} className="flex items-center gap-1.5 text-white/70 text-sm font-semibold mb-3 relative z-10 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Ferramentas IA
        </button>
        <h1 className="text-lg font-black relative z-10 leading-tight">Gerador de Sequências Didáticas</h1>
        <p className="text-sm text-white/70 mt-1 relative z-10">Modelo oficial — estrutura completa com exportação Word</p>
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
            {gerando ? <><Loader2 className="w-5 h-5 animate-spin" /> Gerando com IA...</> : <><Sparkles className="w-5 h-5" /> Gerar Sequência Didática</>}
          </button>
        </div>

        {resultado && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-emerald-50">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-black text-emerald-700">Sequência gerada!</span>
              </div>
              <div className="flex gap-2 flex-wrap justify-end">
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
                  {exportando ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Gerando...</> : <><FileDown className="w-3.5 h-3.5" /> Baixar Word</>}
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
