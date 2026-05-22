import { useState } from "react";

// â”€â”€â”€ Tipos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface SituacaoAprendizagem {
  numero: number;
  titulo: string;
  objetivo: string;
  desenvolvimento: string;
  adaptacao: string;
  imageQuery: string;
  imageUrl?: string;
  imageAuthor?: string;
}

interface Habilidade {
  codigo: string;
  descricao: string;
}

interface Sequencia {
  objetivos: string;
  habilidades: Habilidade[];
  objetos_conhecimento: string[];
  aquecimento: string;
  situacoes: SituacaoAprendizagem[];
  valores_atitudinais: string;
  instrumentos_avaliacao: string;
  recursos: string;
  referencias: string[];
}

// â”€â”€â”€ Config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const PEXELS_API_KEY = import.meta.env.VITE_PEXELS_API_KEY ?? "";

async function buscarImagemPexels(query: string): Promise<{ url: string; author: string } | null> {
  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query + " physical education students")}&per_page=1&orientation=landscape`,
      { headers: { Authorization: PEXELS_API_KEY } }
    );
    const data = await res.json();
    if (data.photos?.length > 0) {
      return { url: data.photos[0].src.medium, author: data.photos[0].photographer };
    }
  } catch (_) {}
  return null;
}

async function chamarClaudeProxy(prompt: string): Promise<string> {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Erro HTTP ${res.status}`);
  const data = await res.json();
  return data.content.map((i: { text?: string }) => i.text ?? "").join("");
}

// â”€â”€â”€ GeraÃ§Ã£o Word (docx) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function baixarWord(
  seq: Sequencia,
  professor: string,
  coordenador: string,
  serie: string,
  turmas: string,
  aulasPrevistas: string,
  periodo: string,
  tema: string
) {
  const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    AlignmentType, BorderStyle, WidthType, ShadingType, VerticalAlign,
    HeadingLevel, LevelFormat,
  } = await import("docx");

  const W = 9360; // largura Ãºtil em DXA (A4 com margens de 1440)
  const borda = { style: BorderStyle.SINGLE, size: 4, color: "2E74B5" };
  const bordas = { top: borda, bottom: borda, left: borda, right: borda };
  const bordaFina = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
  const bordasFinas = { top: bordaFina, bottom: bordaFina, left: bordaFina, right: bordaFina };
  const margCell = { top: 80, bottom: 80, left: 120, right: 120 };

  const headerCell = (text: string, width: number, cor = "1F4E79") =>
    new TableCell({
      borders: bordas,
      width: { size: width, type: WidthType.DXA },
      shading: { fill: cor, type: ShadingType.CLEAR },
      margins: margCell,
      verticalAlign: VerticalAlign.CENTER,
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text, bold: true, color: "FFFFFF", size: 22, font: "Arial" })],
        }),
      ],
    });

  const dataCell = (text: string, width: number, bold = false, cor = "FFFFFF") =>
    new TableCell({
      borders: bordasFinas,
      width: { size: width, type: WidthType.DXA },
      shading: { fill: cor, type: ShadingType.CLEAR },
      margins: margCell,
      children: [
        new Paragraph({
          children: [new TextRun({ text, bold, size: 20, font: "Arial" })],
        }),
      ],
    });

  const labelDataCell = (label: string, value: string, width: number) =>
    new TableCell({
      borders: bordasFinas,
      width: { size: width, type: WidthType.DXA },
      shading: { fill: "F2F2F2", type: ShadingType.CLEAR },
      margins: margCell,
      children: [
        new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 18, font: "Arial" })] }),
        new Paragraph({ children: [new TextRun({ text: value || "â€”", size: 20, font: "Arial" })] }),
      ],
    });

  const titulo = (text: string, cor = "1F4E79") =>
    new Paragraph({
      spacing: { before: 120, after: 60 },
      children: [new TextRun({ text, bold: true, size: 24, color: cor, font: "Arial" })],
    });

  const paragrafo = (text: string, espacoAntes = 60) =>
    new Paragraph({
      spacing: { before: espacoAntes, after: 60 },
      children: [new TextRun({ text, size: 20, font: "Arial" })],
    });

  // quebra linhas em parÃ¡grafos
  const textoParagrafos = (text: string) =>
    text.split("\n").filter(l => l.trim()).map(l => paragrafo(l));

  const children: (Paragraph | Table)[] = [

    // â”€â”€ TÃ­tulo principal â”€â”€
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 200 },
      children: [new TextRun({ text: "ESCOLA: INSTITUTO ODILON PRATAGI", bold: true, size: 24, font: "Arial" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 200 },
      children: [new TextRun({ text: "SEQUÃŠNCIA DIDÃTICA â€” EDUCAÃ‡ÃƒO FÃSICA", bold: true, size: 28, color: "1F4E79", font: "Arial" })],
    }),

    // â”€â”€ Tabela de identificaÃ§Ã£o â”€â”€
    new Table({
      width: { size: W, type: WidthType.DXA },
      columnWidths: [Math.round(W / 4), Math.round(W / 4), Math.round(W / 4), W - Math.round(W / 4) * 3],
      rows: [
        new TableRow({ children: [headerCell("IDENTIFICAÃ‡ÃƒO", W, "1F4E79")] }),
        new TableRow({
          children: [
            labelDataCell("PROFESSOR(A)", professor, Math.round(W / 4)),
            labelDataCell("COMPONENTE", "EducaÃ§Ã£o FÃ­sica", Math.round(W / 4)),
            labelDataCell("ANO/SÃ‰RIE", serie, Math.round(W / 4)),
            labelDataCell("TURMAS", turmas || "â€”", W - Math.round(W / 4) * 3),
          ],
        }),
        new TableRow({
          children: [
            labelDataCell("COORDENADOR(A)", coordenador, Math.round(W / 2)),
            labelDataCell("AULAS PREVISTAS", aulasPrevistas, Math.round(W / 4)),
            labelDataCell("PERÃODO", periodo || "â€”", W - Math.round(W / 2) - Math.round(W / 4)),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              columnSpan: 4,
              borders: bordasFinas,
              width: { size: W, type: WidthType.DXA },
              shading: { fill: "F2F2F2", type: ShadingType.CLEAR },
              margins: margCell,
              children: [
                new Paragraph({ children: [new TextRun({ text: `TEMA: ${tema}`, bold: true, size: 20, font: "Arial" })] }),
              ],
            }),
          ],
        }),
      ],
    }),

    new Paragraph({ spacing: { before: 200, after: 0 }, children: [] }),

    // â”€â”€ Objetivos â”€â”€
    new Table({
      width: { size: W, type: WidthType.DXA },
      columnWidths: [W],
      rows: [
        new TableRow({ children: [headerCell("OBJETIVOS / CAPACIDADES", W)] }),
        new TableRow({
          children: [
            new TableCell({
              borders: bordasFinas, width: { size: W, type: WidthType.DXA },
              margins: margCell,
              children: [paragrafo(seq.objetivos)],
            }),
          ],
        }),
      ],
    }),

    new Paragraph({ spacing: { before: 160, after: 0 }, children: [] }),

    // â”€â”€ ConteÃºdos: Habilidades + Objetos â”€â”€
    new Table({
      width: { size: W, type: WidthType.DXA },
      columnWidths: [Math.round(W * 0.55), W - Math.round(W * 0.55)],
      rows: [
        new TableRow({
          children: [
            headerCell("HABILIDADES (BNCC)", Math.round(W * 0.55)),
            headerCell("OBJETOS DE CONHECIMENTO", W - Math.round(W * 0.55)),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              borders: bordasFinas,
              width: { size: Math.round(W * 0.55), type: WidthType.DXA },
              margins: margCell,
              children: seq.habilidades.map(h =>
                new Paragraph({
                  spacing: { before: 40, after: 60 },
                  children: [
                    new TextRun({ text: `${h.codigo}: `, bold: true, size: 18, font: "Arial" }),
                    new TextRun({ text: h.descricao, size: 18, font: "Arial" }),
                  ],
                })
              ),
            }),
            new TableCell({
              borders: bordasFinas,
              width: { size: W - Math.round(W * 0.55), type: WidthType.DXA },
              margins: margCell,
              children: seq.objetos_conhecimento.map(o =>
                new Paragraph({
                  spacing: { before: 40, after: 40 },
                  numbering: { reference: "bullets", level: 0 },
                  children: [new TextRun({ text: o, size: 18, font: "Arial" })],
                })
              ),
            }),
          ],
        }),
      ],
    }),

    new Paragraph({ spacing: { before: 160, after: 0 }, children: [] }),

    // â”€â”€ Desenvolvimento das Atividades â”€â”€
    new Table({
      width: { size: W, type: WidthType.DXA },
      columnWidths: [W],
      rows: [
        new TableRow({ children: [headerCell("DESENVOLVIMENTO DAS ATIVIDADES", W)] }),
        new TableRow({
          children: [
            new TableCell({
              borders: bordasFinas, width: { size: W, type: WidthType.DXA },
              shading: { fill: "FFF8E1", type: ShadingType.CLEAR },
              margins: margCell,
              children: [
                new Paragraph({
                  children: [new TextRun({ text: "Atividade de Acolhida e Aquecimento", bold: true, size: 20, color: "7B5E00", font: "Arial" })],
                }),
                ...textoParagrafos(seq.aquecimento),
              ],
            }),
          ],
        }),

        // SituaÃ§Ãµes de Aprendizagem
        ...seq.situacoes.flatMap(sit => [
          new TableRow({
            children: [
              new TableCell({
                borders: bordasFinas,
                width: { size: W, type: WidthType.DXA },
                shading: { fill: "E8F0FE", type: ShadingType.CLEAR },
                margins: margCell,
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: `SituaÃ§Ã£o de Aprendizagem ${sit.numero} â€” `, bold: true, size: 20, color: "1A3C8F", font: "Arial" }),
                      new TextRun({ text: sit.titulo, bold: true, size: 20, color: "1A3C8F", font: "Arial" }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          new TableRow({
            children: [
              new TableCell({
                borders: bordasFinas, width: { size: W, type: WidthType.DXA },
                margins: margCell,
                children: [
                  new Paragraph({
                    spacing: { before: 0, after: 60 },
                    children: [
                      new TextRun({ text: "Objetivo EspecÃ­fico: ", bold: true, size: 20, font: "Arial" }),
                      new TextRun({ text: sit.objetivo, size: 20, font: "Arial" }),
                    ],
                  }),
                  new Paragraph({
                    children: [new TextRun({ text: "Desenvolvimento:", bold: true, size: 20, font: "Arial" })],
                  }),
                  ...textoParagrafos(sit.desenvolvimento),
                  ...(sit.adaptacao ? [
                    new Paragraph({
                      spacing: { before: 100, after: 40 },
                      children: [new TextRun({ text: "Atividades Adaptadas:", bold: true, size: 18, color: "5B2D8E", font: "Arial" })],
                    }),
                    paragrafo(sit.adaptacao),
                  ] : []),
                  ...(sit.imageUrl ? [
                    new Paragraph({
                      spacing: { before: 40, after: 0 },
                      children: [new TextRun({ text: `[Imagem ilustrativa: ${sit.imageQuery} â€” Foto: ${sit.imageAuthor || ""} / Pexels]`, size: 16, italics: true, color: "888888", font: "Arial" })],
                    }),
                  ] : []),
                ],
              }),
            ],
          }),
        ]),
      ],
    }),

    new Paragraph({ spacing: { before: 160, after: 0 }, children: [] }),

    // â”€â”€ AvaliaÃ§Ã£o, Valores, Recursos â”€â”€
    new Table({
      width: { size: W, type: WidthType.DXA },
      columnWidths: [Math.round(W / 3), Math.round(W / 3), W - Math.round(W / 3) * 2],
      rows: [
        new TableRow({
          children: [
            headerCell("VALORES ATITUDINAIS", Math.round(W / 3)),
            headerCell("INSTRUMENTOS DE AVALIAÃ‡ÃƒO", Math.round(W / 3)),
            headerCell("RECURSOS", W - Math.round(W / 3) * 2),
          ],
        }),
        new TableRow({
          children: [
            dataCell(seq.valores_atitudinais, Math.round(W / 3)),
            dataCell(seq.instrumentos_avaliacao, Math.round(W / 3)),
            dataCell(seq.recursos, W - Math.round(W / 3) * 2),
          ],
        }),
      ],
    }),

    new Paragraph({ spacing: { before: 160, after: 0 }, children: [] }),

    // â”€â”€ ReferÃªncias â”€â”€
    new Table({
      width: { size: W, type: WidthType.DXA },
      columnWidths: [W],
      rows: [
        new TableRow({ children: [headerCell("REFERÃŠNCIAS", W)] }),
        new TableRow({
          children: [
            new TableCell({
              borders: bordasFinas, width: { size: W, type: WidthType.DXA },
              margins: margCell,
              children: seq.referencias.map(r =>
                new Paragraph({
                  spacing: { before: 40, after: 40 },
                  numbering: { reference: "bullets", level: 0 },
                  children: [new TextRun({ text: r, size: 18, font: "Arial" })],
                })
              ),
            }),
          ],
        }),
      ],
    }),

    new Paragraph({ spacing: { before: 240, after: 0 }, children: [] }),

    // â”€â”€ Assinaturas â”€â”€
    new Table({
      width: { size: W, type: WidthType.DXA },
      columnWidths: [Math.round(W / 2), W - Math.round(W / 2)],
      rows: [
        new TableRow({ children: [headerCell("DEVOLUTIVA DO COORDENADOR PEDAGÃ“GICO", W, "1F4E79")] }),
        new TableRow({
          children: [
            new TableCell({
              borders: bordasFinas, width: { size: Math.round(W / 2), type: WidthType.DXA },
              margins: { top: 800, bottom: 80, left: 120, right: 120 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  border: { top: { style: BorderStyle.SINGLE, size: 4, color: "555555", space: 1 } },
                  children: [new TextRun({ text: "Assinatura do (a) Coordenador (a)", size: 18, font: "Arial" })],
                }),
              ],
            }),
            new TableCell({
              borders: bordasFinas, width: { size: W - Math.round(W / 2), type: WidthType.DXA },
              margins: { top: 800, bottom: 80, left: 120, right: 120 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  border: { top: { style: BorderStyle.SINGLE, size: 4, color: "555555", space: 1 } },
                  children: [new TextRun({ text: "Assinatura do (a) Professor (a)", size: 18, font: "Arial" })],
                }),
              ],
            }),
          ],
        }),
      ],
    }),
  ];

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: "bullets",
          levels: [{
            level: 0, format: LevelFormat.BULLET, text: "\u2022",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 540, hanging: 360 } } },
          }],
        },
      ],
    },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 },
        },
      },
      children,
    }],
  });

  const buffer = await Packer.toBlob(doc);
  const url = URL.createObjectURL(buffer);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Sequencia_Didatica_${tema.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40)}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}

// â”€â”€â”€ Componente â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function IASequencia() {
  const [professor, setProfessor] = useState("Marco Pedro");
  const [coordenador, setCoordenador] = useState("Jair Fiesca e Amarildo Saady");
  const [serie, setSerie] = useState("6Âº e 7Âº");
  const [turmas, setTurmas] = useState("");
  const [aulasPrevistas, setAulasPrevistas] = useState("5");
  const [periodo, setPeriodo] = useState("");
  const [tema, setTema] = useState("");
  const [recursos, setRecursos] = useState("");
  const [numSituacoes, setNumSituacoes] = useState("3");

  const [status, setStatus] = useState<"idle" | "gerando" | "imagens" | "pronto" | "erro">("idle");
  const [baixando, setBaixando] = useState(false);
  const [erroMsg, setErroMsg] = useState("");
  const [sequencia, setSequencia] = useState<Sequencia | null>(null);

  const gerar = async () => {
    if (!tema.trim()) { alert("Informe o tema/conteÃºdo da aula!"); return; }
    setStatus("gerando"); setErroMsg(""); setSequencia(null);

    const prompt = `VocÃª Ã© um professor de EducaÃ§Ã£o FÃ­sica experiente do estado do Acre, Brasil. Crie uma sequÃªncia didÃ¡tica completa e detalhada no padrÃ£o oficial da SEEDUC/AC para:

Tema/ConteÃºdo: ${tema}
SÃ©rie: ${serie}
Turmas: ${turmas || "a definir"}
Aulas previstas: ${aulasPrevistas}
Recursos disponÃ­veis: ${recursos || "materiais bÃ¡sicos de EducaÃ§Ã£o FÃ­sica"}
NÃºmero de situaÃ§Ãµes de aprendizagem: ${numSituacoes}

Responda SOMENTE com JSON puro, sem markdown, sem blocos de cÃ³digo, sem texto antes ou depois.
Formato exato:
{
  "objetivos": "parÃ¡grafo descrevendo objetivos/capacidades gerais",
  "habilidades": [
    {"codigo": "EF__EF__", "descricao": "descriÃ§Ã£o completa da habilidade BNCC"},
    {"codigo": "EF__EF__", "descricao": "descriÃ§Ã£o completa"},
    {"codigo": "EF__EF__", "descricao": "descriÃ§Ã£o completa"}
  ],
  "objetos_conhecimento": ["objeto 1", "objeto 2", "objeto 3"],
  "aquecimento": "descriÃ§Ã£o detalhada da atividade de acolhida e aquecimento inicial (mÃ­nimo 3 parÃ¡grafos)",
  "situacoes": [
    {
      "numero": 1,
      "titulo": "TÃ­tulo da SituaÃ§Ã£o de Aprendizagem 1",
      "objetivo": "Objetivo especÃ­fico desta situaÃ§Ã£o",
      "desenvolvimento": "DescriÃ§Ã£o muito detalhada do desenvolvimento com numeraÃ§Ã£o de etapas (mÃ­nimo 4 parÃ¡grafos)",
      "adaptacao": "Como adaptar para alunos com necessidades especiais",
      "imageQuery": "3 palavras em inglÃªs para buscar imagem no Pexels"
    }
  ],
  "valores_atitudinais": "descriÃ§Ã£o dos valores atitudinais trabalhados",
  "instrumentos_avaliacao": "descriÃ§Ã£o dos instrumentos de avaliaÃ§Ã£o utilizados",
  "recursos": "lista completa de recursos materiais necessÃ¡rios",
  "referencias": ["ACRE. ReferÃªncia 1.", "ReferÃªncia 2.", "ReferÃªncia 3."]
}`;

    let seq: Sequencia;
    try {
      const texto = await chamarClaudeProxy(prompt);
      const start = texto.indexOf("{"); const end = texto.lastIndexOf("}");
      if (start === -1) throw new Error("Resposta inesperada da API");
      seq = JSON.parse(texto.slice(start, end + 1));
    } catch (err: unknown) {
      setErroMsg(err instanceof Error ? err.message : "Erro desconhecido");
      setStatus("erro"); return;
    }

    setStatus("imagens");
    const situacoesComImg = await Promise.all(
      seq.situacoes.map(async (s) => {
        const img = await buscarImagemPexels(s.imageQuery);
        return { ...s, imageUrl: img?.url ?? "", imageAuthor: img?.author ?? "" };
      })
    );
    setSequencia({ ...seq, situacoes: situacoesComImg });
    setStatus("pronto");
  };

  const handleBaixarWord = async () => {
    if (!sequencia) return;
    setBaixando(true);
    try {
      await baixarWord(sequencia, professor, coordenador, serie, turmas, aulasPrevistas, periodo, tema);
    } catch (e) {
      alert("Erro ao gerar Word: " + (e instanceof Error ? e.message : String(e)));
    }
    setBaixando(false);
  };

  const resetar = () => { setStatus("idle"); setSequencia(null); setTema(""); setRecursos(""); setTurmas(""); setPeriodo(""); };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

      {/* FormulÃ¡rio */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">ðŸ¤– Gerador de SequÃªncia DidÃ¡tica Oficial â€” IA</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2 flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Tema / ConteÃºdo *</label>
            <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" placeholder="Ex: Futsal â€” Fundamentos tÃ©cnico-tÃ¡ticos e regras" value={tema} onChange={(e) => setTema(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Professor(a)</label>
            <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" value={professor} onChange={(e) => setProfessor(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Coordenador(a)</label>
            <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" value={coordenador} onChange={(e) => setCoordenador(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Ano / SÃ©rie</label>
            <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" value={serie} onChange={(e) => setSerie(e.target.value)}>
              {["6Âº ano","7Âº ano","8Âº ano","9Âº ano","6Âº e 7Âº","8Âº e 9Âº","1Âº EM","2Âº EM","3Âº EM","1Âº e 2Âº EM"].map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Turmas</label>
            <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" placeholder="Ex: 6ÂºF / 7ÂºD, E, F" value={turmas} onChange={(e) => setTurmas(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Aulas previstas</label>
            <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" value={aulasPrevistas} onChange={(e) => setAulasPrevistas(e.target.value)}>
              {["2","3","4","5","6","8","10"].map((n) => <option key={n}>{n}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">PerÃ­odo de execuÃ§Ã£o</label>
            <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" placeholder="Ex: MarÃ§o/Abril 2026" value={periodo} onChange={(e) => setPeriodo(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">NÂº de SituaÃ§Ãµes de Aprendizagem</label>
            <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" value={numSituacoes} onChange={(e) => setNumSituacoes(e.target.value)}>
              {["2","3","4","5"].map((n) => <option key={n}>{n}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2 flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Recursos disponÃ­veis</label>
            <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" placeholder="Ex: quadra coberta, bolas de futsal, cones, coletes..." value={recursos} onChange={(e) => setRecursos(e.target.value)} />
          </div>
        </div>
        <button onClick={gerar} disabled={status === "gerando" || status === "imagens"} className="w-full py-3 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-medium text-sm transition-colors">
          {status === "gerando" ? "â³ Gerando sequÃªncia didÃ¡tica..." : status === "imagens" ? "ðŸ–¼ï¸ Buscando imagens..." : "âœ¨ Gerar SequÃªncia DidÃ¡tica Oficial"}
        </button>
        {status === "erro" && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">âš ï¸ {erroMsg}</div>
        )}
      </div>

      {/* Documento Oficial */}
      {status === "pronto" && sequencia && (
        <div>
          {/* BotÃµes de aÃ§Ã£o */}
          <div className="flex gap-3 mb-4">
            <button onClick={handleBaixarWord} disabled={baixando} className="flex-1 py-3 rounded-xl bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white font-medium text-sm transition-colors">
              {baixando ? "â³ Gerando Word..." : "ðŸ“„ Baixar Word (.docx)"}
            </button>
            <button onClick={resetar} className="py-3 px-5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors">
              â†© Nova sequÃªncia
            </button>
          </div>

          {/* VisualizaÃ§Ã£o */}
          <div className="bg-white border border-gray-300 shadow-lg rounded-lg overflow-hidden" style={{ fontFamily: "Arial, sans-serif" }}>
            <div className="flex items-stretch border-b-2 border-gray-800">
              <div className="flex items-center justify-center p-3 border-r border-gray-300" style={{ minWidth: 100 }}>
                <div className="text-center">
                  <div className="text-xs font-bold text-green-800 leading-tight">GOVERNO DO</div>
                  <div className="text-xs font-bold text-green-800 leading-tight">ESTADO DO ACRE</div>
                  <div className="text-xs text-green-700">www.acre.gov.br</div>
                </div>
              </div>
              <div className="flex-1 flex items-center justify-center p-3 text-center">
                <div>
                  <div className="text-xs font-bold text-gray-700">SECRETARIA DE ESTADO DE</div>
                  <div className="text-sm font-bold text-blue-900">EDUCAÃ‡ÃƒO, CULTURA E ESPORTES</div>
                  <div className="text-sm font-bold text-blue-900">DIRETORIA DE ENSINO</div>
                  <div className="text-xs font-bold text-gray-700">DIVISÃƒO DE ENSINO FUNDAMENTAL I E II</div>
                </div>
              </div>
            </div>
            <div className="px-4 pt-3 pb-1">
              <p className="text-sm font-bold text-gray-900">ESCOLA: INSTITUTO ODILON PRATAGI</p>
            </div>
            <div className="px-4 pb-2">
              <table className="w-full border-collapse text-xs">
                <tbody>
                  <tr><td colSpan={4} className="border border-gray-400 bg-blue-800 text-white font-bold px-2 py-1">SEQUÃŠNCIA DIDÃTICA</td></tr>
                  <tr>
                    <td className="border border-gray-400 px-2 py-1 font-semibold bg-gray-50 w-1/4">PROFESSOR(A):<br /><span className="font-normal">{professor}</span></td>
                    <td className="border border-gray-400 px-2 py-1 font-semibold bg-gray-50 w-1/4">COMPONENTE CURRICULAR:<br /><span className="font-normal">EducaÃ§Ã£o FÃ­sica</span></td>
                    <td className="border border-gray-400 px-2 py-1 font-semibold bg-gray-50 w-1/4">ANO/SÃ‰RIE:<br /><span className="font-normal">{serie}</span></td>
                    <td className="border border-gray-400 px-2 py-1 font-semibold bg-gray-50 w-1/4">TURMAS:<br /><span className="font-normal">{turmas || "â€”"}</span></td>
                  </tr>
                  <tr>
                    <td className="border border-gray-400 px-2 py-1 font-semibold bg-gray-50" colSpan={2}>COORDENADOR(A):<br /><span className="font-normal">{coordenador}</span></td>
                    <td className="border border-gray-400 px-2 py-1 font-semibold bg-gray-50">AULAS PREVISTAS:<br /><span className="font-normal">{aulasPrevistas}</span></td>
                    <td className="border border-gray-400 px-2 py-1 font-semibold bg-gray-50">PERÃODO:<br /><span className="font-normal">{periodo || "â€”"}</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="px-4 pb-2">
              <table className="w-full border-collapse text-xs">
                <tbody>
                  <tr><td className="border border-gray-400 bg-blue-100 font-bold px-2 py-1 text-center text-sm">OBJETIVOS/CAPACIDADES</td></tr>
                  <tr><td className="border border-gray-400 px-3 py-2 text-gray-800 leading-relaxed">{sequencia.objetivos}</td></tr>
                </tbody>
              </table>
            </div>
            <div className="px-4 pb-2">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr><td colSpan={2} className="border border-gray-400 bg-blue-100 font-bold px-2 py-1 text-center text-sm">CONTEÃšDOS</td></tr>
                  <tr>
                    <td className="border border-gray-400 bg-gray-100 font-bold px-2 py-1 text-center w-1/2">HABILIDADES</td>
                    <td className="border border-gray-400 bg-gray-100 font-bold px-2 py-1 text-center w-1/2">OBJETOS DE CONHECIMENTO</td>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-400 px-2 py-2 align-top">
                      {sequencia.habilidades.map((h, i) => <p key={i} className="mb-1 leading-relaxed"><strong>{h.codigo}:</strong> {h.descricao}</p>)}
                    </td>
                    <td className="border border-gray-400 px-2 py-2 align-top">
                      <ul className="list-disc list-inside space-y-1">
                        {sequencia.objetos_conhecimento.map((o, i) => <li key={i} className="leading-relaxed">{o}</li>)}
                      </ul>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="px-4 pb-2">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr><td colSpan={2} className="border border-gray-400 bg-blue-100 font-bold px-2 py-1 text-center text-sm">DESENVOLVIMENTO DAS ATIVIDADES</td></tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={2} className="border border-gray-400 px-2 py-1 bg-amber-50">
                      <p className="font-bold text-amber-900 mb-1">Atividade de Acolhida e Aquecimento</p>
                      <p className="text-gray-800 leading-relaxed whitespace-pre-line">{sequencia.aquecimento}</p>
                    </td>
                  </tr>
                  {sequencia.situacoes.map((sit) => (
                    <tr key={sit.numero}>
                      <td colSpan={2} className="border border-gray-400 p-0">
                        <div className="bg-blue-700 text-white font-bold px-2 py-1 text-xs">
                          SituaÃ§Ã£o de Aprendizagem {sit.numero} â€” {sit.titulo}
                        </div>
                        <div className="flex">
                          <div className="flex-1 px-3 py-2">
                            <p className="font-semibold text-gray-700 mb-1 text-xs">Objetivo EspecÃ­fico: <span className="font-normal">{sit.objetivo}</span></p>
                            <div className="text-gray-800 leading-relaxed whitespace-pre-line text-xs">{sit.desenvolvimento}</div>
                            {sit.adaptacao && (
                              <div className="mt-2 bg-purple-50 border-l-2 border-purple-400 px-2 py-1">
                                <p className="font-semibold text-purple-800 text-xs">Atividades Adaptadas:</p>
                                <p className="text-gray-700 text-xs">{sit.adaptacao}</p>
                              </div>
                            )}
                          </div>
                          {sit.imageUrl ? (
                            <div className="relative shrink-0" style={{ width: 180 }}>
                              <img src={sit.imageUrl} alt={sit.imageQuery} className="w-full h-full object-cover" style={{ minHeight: 140 }} />
                              {sit.imageAuthor && (
                                <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white px-1 py-0.5 text-center" style={{ fontSize: 9 }}>
                                  ðŸ“· {sit.imageAuthor} / Pexels
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="shrink-0 bg-gray-100 flex items-center justify-center text-gray-400 text-xs" style={{ width: 180, minHeight: 140 }}>Sem imagem</div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 pb-2">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr>
                    <td className="border border-gray-400 bg-blue-100 font-bold px-2 py-1 text-center w-1/3">VALORES ATITUDINAIS</td>
                    <td className="border border-gray-400 bg-blue-100 font-bold px-2 py-1 text-center w-1/3">INSTRUMENTOS DE AVALIAÃ‡ÃƒO</td>
                    <td className="border border-gray-400 bg-blue-100 font-bold px-2 py-1 text-center w-1/3">RECURSOS</td>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-400 px-2 py-2 align-top leading-relaxed">{sequencia.valores_atitudinais}</td>
                    <td className="border border-gray-400 px-2 py-2 align-top leading-relaxed">{sequencia.instrumentos_avaliacao}</td>
                    <td className="border border-gray-400 px-2 py-2 align-top leading-relaxed">{sequencia.recursos}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="px-4 pb-2">
              <table className="w-full border-collapse text-xs">
                <tbody>
                  <tr><td className="border border-gray-400 bg-blue-100 font-bold px-2 py-1 text-center text-sm">REFERÃŠNCIAS</td></tr>
                  <tr><td className="border border-gray-400 px-3 py-2"><ul className="list-disc list-inside space-y-1 text-gray-800">{sequencia.referencias.map((r, i) => <li key={i} className="leading-relaxed">{r}</li>)}</ul></td></tr>
                </tbody>
              </table>
            </div>
            <div className="px-4 pb-4">
              <table className="w-full border-collapse text-xs">
                <tbody>
                  <tr><td colSpan={2} className="border border-gray-400 bg-blue-800 text-white font-bold px-2 py-1 text-center">DEVOLUTIVA DO COORDENADOR PEDAGÃ“GICO</td></tr>
                  <tr>
                    <td className="border border-gray-400 px-4 py-8 text-center w-1/2"><div className="border-t border-gray-500 mt-6 pt-1">Assinatura do (a) Coordenador (a)</div></td>
                    <td className="border border-gray-400 px-4 py-8 text-center w-1/2"><div className="border-t border-gray-500 mt-6 pt-1">Assinatura do (a) Professor (a)</div></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

