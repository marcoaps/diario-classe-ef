import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { chamarClaudeProxy } from "../../../utils/claudeProxy";

interface Habilidade {
  codigo: string;
  descricao: string;
}

interface MomentoOficina {
  titulo: string;
  tempo: string;
  passos: string[];
  destaque?: string;
}

interface GrupoOficina {
  numero: number;
  faseTitulo: string;
  descricao: string;
}

interface DiaOficina {
  numeroDia: number;
  tema: string;
  objetivo: string;
  habilidades: Habilidade[];
  acolhidaNome: string;
  acolhidaTempo: string;
  acolhidaPassos: string[];
  desenvolvimentoTempoTotal: string;
  momentos: MomentoOficina[];
  grupos: GrupoOficina[];
}

interface Oficina {
  tituloEvento: string;
  subtitulo: string;
  componente: string;
  ano: string;
  data: string;
  tempoPrevisto: string;
  dias: DiaOficina[];
}

interface DadosSequencia {
  tema: string;
  serie: string;
  habilidades: Habilidade[];
  objetivos: string;
}

const TURMAS_POR_SERIE: Record<string, string> = {
  "6º e 7º": "6ºF, 7ºB, 7ºC, 7ºD, 7ºE, 7ºF",
  "8º e 9º": "8ºA, 8ºB, 8ºC, 8ºD, 8ºE, 8ºF, 9ºA, 9ºB, 9ºC, 9ºD, 9ºE, 9ºF",
  "6º ano": "", "7º ano": "", "8º ano": "", "9º ano": "",
  "1º EM": "", "2º EM": "", "3º EM": "", "1º e 2º EM": "",
};

const BNCC_POR_SERIE: Record<string, string> = {
  "6º ano": "EF67EF01, EF67EF02, EF67EF03, EF67EF04, EF67EF05, EF67EF06, EF67EF07, EF67EF08, EF67EF09, EF67EF10, EF67EF11, EF67EF12, EF67EF13, EF67EF14",
  "7º ano": "EF67EF01, EF67EF02, EF67EF03, EF67EF04, EF67EF05, EF67EF06, EF67EF07, EF67EF08, EF67EF09, EF67EF10, EF67EF11, EF67EF12, EF67EF13, EF67EF14",
  "6º e 7º": "EF67EF01, EF67EF02, EF67EF03, EF67EF04, EF67EF05, EF67EF06, EF67EF07, EF67EF08, EF67EF09, EF67EF10, EF67EF11, EF67EF12, EF67EF13, EF67EF14",
  "8º ano": "EF89EF01, EF89EF02, EF89EF03, EF89EF04, EF89EF05, EF89EF06, EF89EF07, EF89EF08, EF89EF09, EF89EF10, EF89EF11, EF89EF12, EF89EF13, EF89EF14",
  "9º ano": "EF89EF01, EF89EF02, EF89EF03, EF89EF04, EF89EF05, EF89EF06, EF89EF07, EF89EF08, EF89EF09, EF89EF10, EF89EF11, EF89EF12, EF89EF13, EF89EF14",
  "8º e 9º": "EF89EF01, EF89EF02, EF89EF03, EF89EF04, EF89EF05, EF89EF06, EF89EF07, EF89EF08, EF89EF09, EF89EF10, EF89EF11, EF89EF12, EF89EF13, EF89EF14",
  "1º EM": "EM13LGG001, EM13LGG002, EM13LGG003, EM13LGG401, EM13LGG402, EM13LGG403, EM13LGG404",
  "2º EM": "EM13LGG001, EM13LGG002, EM13LGG003, EM13LGG401, EM13LGG402, EM13LGG403, EM13LGG404",
  "3º EM": "EM13LGG001, EM13LGG002, EM13LGG003, EM13LGG401, EM13LGG402, EM13LGG403, EM13LGG404",
  "1º e 2º EM": "EM13LGG001, EM13LGG002, EM13LGG003, EM13LGG401, EM13LGG402, EM13LGG403, EM13LGG404",
};

function ordinalM(n: number): string {
  return n === 1 ? "1º" : n === 2 ? "2º" : n === 3 ? "3º" :
    n === 4 ? "4º" : n === 5 ? "5º" : `${n}º`;
}

function base64ToUint8Array(base64: string): Uint8Array {
  const bin = atob(base64); const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

async function fetchBrasaoBase64(): Promise<{ base64: string; type: "png" } | null> {
  try {
    const res = await fetch("/brasao-acre.png");
    if (res.ok) {
      const buf = await res.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let b64 = "";
      const chunk = 8192;
      for (let i = 0; i < bytes.length; i += chunk) {
        b64 += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      return { base64: btoa(b64), type: "png" };
    }
  } catch (_) {}
  try {
    const url = window.location.origin + "/brasao-acre.png";
    const res2 = await fetch(`/api/pexels?imageUrl=${encodeURIComponent(url)}`);
    const data = await res2.json();
    if (data.base64) return { base64: data.base64, type: "png" };
  } catch (_) {}
  return null;
}

async function baixarWord(oficina: Oficina) {
  const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    ImageRun, AlignmentType, BorderStyle, WidthType, ShadingType, VerticalAlign, LevelFormat,
  } = await import("docx");

  const W = 9360;
  const borda = { style: BorderStyle.SINGLE, size: 4, color: "2E74B5" };
  const bordas = { top: borda, bottom: borda, left: borda, right: borda };
  const bordaFina = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
  const bordasFinas = { top: bordaFina, bottom: bordaFina, left: bordaFina, right: bordaFina };
  const semBorda = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const semBordas = { top: semBorda, bottom: semBorda, left: semBorda, right: semBorda };
  const margCell = { top: 80, bottom: 80, left: 120, right: 120 };

  const headerCell = (text: string, width: number, cor = "1F4E79") =>
    new TableCell({
      borders: bordas, width: { size: width, type: WidthType.DXA },
      shading: { fill: cor, type: ShadingType.CLEAR }, margins: margCell,
      verticalAlign: VerticalAlign.CENTER,
      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text, bold: true, color: "FFFFFF", size: 22, font: "Arial" })] })],
    });

  const paragrafo = (text: string) =>
    new Paragraph({ spacing: { before: 60, after: 60 }, children: [new TextRun({ text, size: 20, font: "Arial" })] });

  const passoNumerado = (text: string) =>
    new Paragraph({ spacing: { before: 40, after: 40 }, numbering: { reference: "passos", level: 0 }, children: [new TextRun({ text, size: 20, font: "Arial" })] });

  const brasao = await fetchBrasaoBase64();

  const colW1 = Math.round(W * 0.18);
  const colW2 = Math.round(W * 0.28);
  const colW3 = W - colW1 - colW2;

  const cellBrasao = new TableCell({
    borders: semBordas, width: { size: colW1, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
    margins: { top: 40, bottom: 40, left: 40, right: 40 },
    children: brasao ? [
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ data: base64ToUint8Array(brasao.base64), transformation: { width: 70, height: 70 }, type: "png" })] }),
    ] : [new Paragraph({ children: [] })],
  });

  const cellGoverno = new TableCell({
    borders: semBordas, width: { size: colW2, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER, margins: margCell,
    children: [
      new Paragraph({ children: [new TextRun({ text: "GOVERNO DO", bold: true, size: 22, color: "1A6B1A", font: "Arial" })] }),
      new Paragraph({ children: [new TextRun({ text: "ESTADO DO ACRE", bold: true, size: 22, color: "1A6B1A", font: "Arial" })] }),
      new Paragraph({ children: [new TextRun({ text: "www.acre.gov.br", size: 18, color: "1A6B1A", font: "Arial" })] }),
    ],
  });

  const cellSecretaria = new TableCell({
    borders: semBordas, width: { size: colW3, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER, margins: margCell,
    children: [
      new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "SECRETARIA DE ESTADO DE", size: 16, color: "1A6B1A", font: "Arial" })] }),
      new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "EDUCAÇÃO, CULTURA E ESPORTES", bold: true, size: 20, color: "1A6B1A", font: "Arial" })] }),
      new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "DIRETORIA DE ENSINO", bold: true, size: 24, color: "1A6B1A", font: "Arial" })] }),
    ],
  });

  const tabelaCabecalho = new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: [colW1, colW2, colW3],
    rows: [new TableRow({ children: [cellBrasao, cellGoverno, cellSecretaria] })],
    borders: { top: semBorda, bottom: { style: BorderStyle.SINGLE, size: 8, color: "D4A017" }, left: semBorda, right: semBorda, insideHorizontal: semBorda, insideVertical: semBorda },
  });

  const linhaDourada = new Paragraph({
    spacing: { before: 0, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: "D4A017", space: 1 } },
    children: [],
  });

  const tituloEventoParagrafos = [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 100, after: 20 }, children: [new TextRun({ text: oficina.tituloEvento, bold: true, size: 26, color: "1F4E79", font: "Arial" })] }),
    ...(oficina.subtitulo ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 160 }, children: [new TextRun({ text: oficina.subtitulo, bold: true, size: 22, font: "Arial" })] })] : []),
  ];

  const tabelaDia = (dia: DiaOficina) => {
    const Q1 = Math.round(W / 4);
    return new Table({
      width: { size: W, type: WidthType.DXA },
      columnWidths: [W],
      rows: [
        new TableRow({ children: [
          new TableCell({
            borders: bordas, width: { size: W, type: WidthType.DXA },
            shading: { fill: "1F4E79", type: ShadingType.CLEAR }, margins: margCell, verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `OFICINA DE ${oficina.componente.toUpperCase()}${oficina.dias.length > 1 ? ` — ${ordinalM(dia.numeroDia)} DIA` : ""}`, bold: true, color: "FFFFFF", size: 24, font: "Arial" })] })],
          }),
        ]}),
        new TableRow({ children: [
          new TableCell({
            borders: bordasFinas, width: { size: W, type: WidthType.DXA },
            shading: { fill: "F2F2F2", type: ShadingType.CLEAR }, margins: margCell,
            children: [new Paragraph({ children: [new TextRun({ text: `TEMA: ${dia.tema}`, bold: true, size: 20, font: "Arial" })] })],
          }),
        ]}),
        new TableRow({ children: [
          new TableCell({ borders: bordasFinas, width: { size: Math.round(W / 2), type: WidthType.DXA }, margins: margCell,
            children: [new Paragraph({ children: [new TextRun({ text: "OBJETIVO", bold: true, size: 18, font: "Arial" })] }), paragrafo(dia.objetivo)] }),
          new TableCell({ borders: bordasFinas, width: { size: W - Math.round(W / 2), type: WidthType.DXA }, margins: margCell,
            children: [
              new Paragraph({ children: [new TextRun({ text: "HABILIDADE DO PLANO DE CURSO", bold: true, size: 18, font: "Arial" })] }),
              ...dia.habilidades.map(h => new Paragraph({ spacing: { before: 40, after: 40 }, children: [new TextRun({ text: `${h.codigo}: `, bold: true, size: 18, font: "Arial" }), new TextRun({ text: h.descricao, size: 18, font: "Arial" })] })),
            ] }),
        ]}),
        new TableRow({ children: [
          new TableCell({ borders: bordasFinas, width: { size: Q1, type: WidthType.DXA }, shading: { fill: "F2F2F2", type: ShadingType.CLEAR }, margins: margCell,
            children: [new Paragraph({ children: [new TextRun({ text: "Ano: ", bold: true, size: 18, font: "Arial" }), new TextRun({ text: oficina.ano, size: 18, font: "Arial" })] })] }),
          new TableCell({ borders: bordasFinas, width: { size: Q1, type: WidthType.DXA }, shading: { fill: "F2F2F2", type: ShadingType.CLEAR }, margins: margCell,
            children: [new Paragraph({ children: [new TextRun({ text: "Data: ", bold: true, size: 18, font: "Arial" }), new TextRun({ text: oficina.data || "—", size: 18, font: "Arial" })] })] }),
          new TableCell({ borders: bordasFinas, width: { size: W - Q1 * 2, type: WidthType.DXA }, shading: { fill: "F2F2F2", type: ShadingType.CLEAR }, margins: margCell,
            children: [new Paragraph({ children: [new TextRun({ text: "Tempo previsto: ", bold: true, size: 18, font: "Arial" }), new TextRun({ text: oficina.tempoPrevisto || "—", size: 18, font: "Arial" })] })] }),
        ]}),
      ],
    });
  };

  const tabelaAcolhida = (dia: DiaOficina) => new Table({
    width: { size: W, type: WidthType.DXA }, columnWidths: [W],
    rows: [
      new TableRow({ children: [headerCell(`ACOLHIDA — ${dia.acolhidaNome} (${dia.acolhidaTempo})`, W, "7B5E00")] }),
      new TableRow({ children: [new TableCell({ borders: bordasFinas, width: { size: W, type: WidthType.DXA }, shading: { fill: "FFF8E1", type: ShadingType.CLEAR }, margins: margCell,
        children: dia.acolhidaPassos.map(passoNumerado) })] }),
    ],
  });

  const blocoMomento = (m: MomentoOficina, idx: number) => [
    new TableRow({ children: [new TableCell({ borders: bordasFinas, width: { size: W, type: WidthType.DXA }, shading: { fill: "E8F0FE", type: ShadingType.CLEAR }, margins: margCell,
      children: [new Paragraph({ children: [new TextRun({ text: `${ordinalM(idx + 1)} Momento — ${m.titulo} (${m.tempo})`, bold: true, size: 20, color: "1A3C8F", font: "Arial" })] })] })] }),
    new TableRow({ children: [new TableCell({ borders: bordasFinas, width: { size: W, type: WidthType.DXA }, margins: margCell,
      children: [
        ...m.passos.map(passoNumerado),
        ...(m.destaque ? [new Paragraph({ spacing: { before: 100, after: 100 }, border: { top: borda, bottom: borda, left: borda, right: borda }, children: [new TextRun({ text: m.destaque, italics: true, size: 20, font: "Arial" })] })] : []),
      ] })] }),
  ];

  const tabelaDesenvolvimento = (dia: DiaOficina) => new Table({
    width: { size: W, type: WidthType.DXA }, columnWidths: [W],
    rows: [
      new TableRow({ children: [headerCell(`DESENVOLVIMENTO DA OFICINA (${dia.desenvolvimentoTempoTotal})`, W)] }),
      ...dia.momentos.flatMap((m, idx) => blocoMomento(m, idx)),
    ],
  });

  const tabelaGrupos = (dia: DiaOficina) => dia.grupos.length === 0 ? null : new Table({
    width: { size: W, type: WidthType.DXA }, columnWidths: [W],
    rows: [
      new TableRow({ children: [headerCell("DISTRIBUIÇÃO DOS GRUPOS", W)] }),
      ...dia.grupos.map(g => new TableRow({ children: [new TableCell({ borders: bordas, width: { size: W, type: WidthType.DXA }, margins: margCell,
        children: [
          new Paragraph({ children: [new TextRun({ text: `Grupo ${g.numero}`, bold: true, size: 20, font: "Arial" })] }),
          new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: `Fase ${g.numero}: ${g.faseTitulo}`, bold: true, size: 18, color: "1F4E79", font: "Arial" })] }),
          paragrafo(g.descricao),
        ] })] })),
    ],
  });

  const espaco = () => new Paragraph({ spacing: { before: 160, after: 0 }, children: [] });

  const diaChildren = oficina.dias.flatMap((dia, i) => {
    const grupos = tabelaGrupos(dia);
    return [
      ...(i > 0 ? [new Paragraph({ pageBreakBefore: true, children: [] })] : []),
      tabelaDia(dia),
      espaco(),
      tabelaAcolhida(dia),
      espaco(),
      tabelaDesenvolvimento(dia),
      ...(grupos ? [espaco(), grupos] : []),
    ];
  });

  const children = [
    tabelaCabecalho,
    linhaDourada,
    ...tituloEventoParagrafos,
    ...diaChildren,
  ];

  const doc = new Document({
    numbering: { config: [{ reference: "passos", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 360 } } } }] }] },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } } }, children }],
  });

  const buffer = await Packer.toBlob(doc);
  const url = URL.createObjectURL(buffer);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Oficina_${oficina.componente.replace(/[^a-zA-Z0-9]/g, "_")}_${oficina.dias[0]?.tema.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 30) || "plano"}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}

const ETAPAS_ANIMACAO = [
  { icone: "🧠", texto: "Analisando o tema da oficina..." },
  { icone: "🤝", texto: "Planejando a acolhida..." },
  { icone: "🧩", texto: "Organizando os momentos..." },
  { icone: "👥", texto: "Distribuindo os grupos..." },
  { icone: "📄", texto: "Finalizando documento..." },
];

function AnimacaoGerando({ etapa }: { etapa: number }) {
  const e = ETAPAS_ANIMACAO[etapa % ETAPAS_ANIMACAO.length];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center">
        <div className="relative w-20 h-20 mx-auto mb-6">
          <svg className="w-20 h-20 animate-spin" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="34" fill="none" stroke="#E5E7EB" strokeWidth="6" />
            <circle cx="40" cy="40" r="34" fill="none" stroke="#A21CAF" strokeWidth="6" strokeDasharray="80 134" strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-3xl">{e.icone}</div>
        </div>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">Gerando Oficina Pedagógica</h3>
        <p className="text-sm text-fuchsia-600 font-medium mb-4">{e.texto}</p>
        <div className="flex justify-center gap-1.5">
          {ETAPAS_ANIMACAO.map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${i <= etapa % ETAPAS_ANIMACAO.length ? "bg-fuchsia-600 w-6" : "bg-gray-200 w-3"}`} />
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-4">Isso pode levar alguns segundos...</p>
      </div>
    </div>
  );
}

function AnimacaoBaixando() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center">
        <div className="relative w-20 h-20 mx-auto mb-6">
          <svg className="w-20 h-20 animate-spin" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="34" fill="none" stroke="#E5E7EB" strokeWidth="6" />
            <circle cx="40" cy="40" r="34" fill="none" stroke="#15803D" strokeWidth="6" strokeDasharray="100 114" strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-3xl">📄</div>
        </div>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">Gerando arquivo Word</h3>
        <p className="text-sm text-green-600 font-medium">Formatando dias, momentos e grupos...</p>
        <p className="text-xs text-gray-400 mt-4">O download iniciará automaticamente</p>
      </div>
    </div>
  );
}

export function IAOficinaPedagogica() {
  const location = useLocation();
  const navigate = useNavigate();
  const fromSequencia = (location.state as { fromSequencia?: DadosSequencia } | null)?.fromSequencia;

  const [tituloEvento, setTituloEvento] = useState("Jornada Pedagógica para Professores");
  const [subtitulo, setSubtitulo] = useState("Anos Finais do Ensino Fundamental");
  const [componente, setComponente] = useState("Educação Física");
  const [serie, setSerie] = useState(fromSequencia?.serie || "6º e 7º");
  const [tema, setTema] = useState(fromSequencia?.tema || "");
  const [ano, setAno] = useState(String(new Date().getFullYear()));
  const [data, setData] = useState("");
  const [tempoPrevisto, setTempoPrevisto] = useState("4h");
  const [numDias, setNumDias] = useState("1");
  const [numMomentos, setNumMomentos] = useState("3");
  const [numGrupos, setNumGrupos] = useState("0");

  const [status, setStatus] = useState<"idle" | "gerando" | "pronto" | "erro">("idle");
  const [baixando, setBaixando] = useState(false);
  const [erroMsg, setErroMsg] = useState("");
  const [oficina, setOficina] = useState<Oficina | null>(null);
  const [etapaAnim, setEtapaAnim] = useState(0);

  useEffect(() => {
    if (status !== "gerando") return;
    const iv = setInterval(() => setEtapaAnim(e => e + 1), 2500);
    return () => clearInterval(iv);
  }, [status]);

  const gerar = async () => {
    if (!tema.trim()) { alert("Informe o tema da oficina!"); return; }
    setStatus("gerando"); setErroMsg(""); setOficina(null); setEtapaAnim(0);

    const habilidadesBncc = BNCC_POR_SERIE[serie] || BNCC_POR_SERIE["6º e 7º"];
    const dias = parseInt(numDias, 10);
    const momentos = parseInt(numMomentos, 10);
    const grupos = parseInt(numGrupos, 10);

    const habilidadesPreDefinidas = fromSequencia?.habilidades?.length
      ? `\nHabilidades já definidas em uma Sequência Didática para este tema, reutilize-as quando fizer sentido: ${fromSequencia.habilidades.map(h => `${h.codigo} (${h.descricao})`).join("; ")}.`
      : "";

    const prompt = `Você é um formador pedagógico experiente que planeja oficinas de formação continuada para professores de ${componente} no estado do Acre, Brasil. Crie o conteúdo de uma oficina de formação no padrão oficial de uma Jornada Pedagógica, com ${dias} dia(s), para:

Tema geral: ${tema}
Componente: ${componente}
Série/Ano dos alunos-alvo das práticas: ${serie}
Momentos de desenvolvimento por dia: ${momentos}
Número de grupos para a distribuição de tarefas por dia: ${grupos} (se 0, retorne "grupos": [])
${habilidadesPreDefinidas}

IMPORTANTE — Use SOMENTE habilidades BNCC para ${serie}: ${habilidadesBncc}
Selecione as que se relacionam com o tema de cada dia. Use os códigos exatos.

Para cada dia, crie:
- Um sub-tema (pode repetir o tema geral ou desdobrá-lo em um aspecto específico daquele dia)
- Um objetivo claro
- 2 a 4 habilidades BNCC relacionadas
- Uma ACOLHIDA: nome de uma dinâmica de abertura curta, tempo estimado, e passos numerados detalhados (4 a 6 passos)
- Exatamente ${momentos} MOMENTOS de desenvolvimento, cada um com título, tempo estimado, e 4 a 8 passos numerados detalhados e práticos (instruções para o formador conduzir a atividade); um dos momentos pode ter um campo "destaque" opcional com uma citação, definição ou frase de efeito relacionada
- ${grupos > 0 ? `Exatamente ${grupos} GRUPOS para distribuição de tarefas, cada um com uma "Fase" (título curto e uma descrição de 2 a 4 frases do que aquele grupo deverá desenvolver, seguindo uma progressão lógica entre os grupos)` : "Nenhum grupo (array vazio)"}

Responda SOMENTE com JSON puro, sem markdown, sem texto antes ou depois, no formato:
{"dias":[{"numeroDia":1,"tema":"...","objetivo":"...","habilidades":[{"codigo":"EF__EF__","descricao":"..."}],"acolhidaNome":"...","acolhidaTempo":"20 min","acolhidaPassos":["...","..."],"desenvolvimentoTempoTotal":"2h 40min","momentos":[{"titulo":"...","tempo":"60min","passos":["...","..."],"destaque":"opcional"}],"grupos":[{"numero":1,"faseTitulo":"...","descricao":"..."}]}]}`;

    let diasGerados: DiaOficina[];
    try {
      const texto = await chamarClaudeProxy(prompt);
      const start = texto.indexOf("{"); const end = texto.lastIndexOf("}");
      if (start === -1) throw new Error("Resposta inesperada da API");
      const parsed = JSON.parse(texto.slice(start, end + 1));
      diasGerados = parsed.dias;
    } catch (err: unknown) {
      setErroMsg(err instanceof Error ? err.message : "Erro desconhecido");
      setStatus("erro"); return;
    }

    setOficina({ tituloEvento, subtitulo, componente, ano, data, tempoPrevisto, dias: diasGerados });
    setStatus("pronto");
  };

  const handleBaixarWord = async () => {
    if (!oficina) return;
    setBaixando(true);
    try { await baixarWord(oficina); }
    catch (e) { alert("Erro ao gerar Word: " + (e instanceof Error ? e.message : String(e))); }
    setBaixando(false);
  };

  const resetar = () => { setStatus("idle"); setOficina(null); setTema(""); setData(""); };

  const carregando = status === "gerando";

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {carregando && <AnimacaoGerando etapa={etapaAnim} />}
      {baixando && <AnimacaoBaixando />}

      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">🏫 Gerador de Oficina Pedagógica — IA</h2>
          <button onClick={() => navigate("/ia")} className="text-xs text-gray-400 hover:text-gray-600">← Voltar ao Hub</button>
        </div>

        {fromSequencia && (
          <div className="text-xs bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200 rounded-lg px-3 py-2">
            ✨ Pré-preenchido a partir da Sequência Didática: <strong>{fromSequencia.tema}</strong>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2 flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Tema geral da oficina *</label>
            <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-300" placeholder="Ex: A Tecnologia e Seus Impactos" value={tema} onChange={(e) => setTema(e.target.value)} />
          </div>
          <div className="sm:col-span-2 flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Nome do evento</label>
            <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-300" value={tituloEvento} onChange={(e) => setTituloEvento(e.target.value)} />
          </div>
          <div className="sm:col-span-2 flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Subtítulo do evento</label>
            <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-300" value={subtitulo} onChange={(e) => setSubtitulo(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Componente curricular</label>
            <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-300" value={componente} onChange={(e) => setComponente(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Ano / Série</label>
            <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-300" value={serie} onChange={(e) => setSerie(e.target.value)}>
              {Object.keys(TURMAS_POR_SERIE).map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Ano letivo</label>
            <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-300" value={ano} onChange={(e) => setAno(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Data(s)</label>
            <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-300" placeholder="Ex: 28 e 29/07" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Tempo previsto (total)</label>
            <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-300" value={tempoPrevisto} onChange={(e) => setTempoPrevisto(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Número de dias</label>
            <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-300" value={numDias} onChange={(e) => setNumDias(e.target.value)}>
              {["1", "2", "3"].map((n) => <option key={n}>{n}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Momentos por dia</label>
            <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-300" value={numMomentos} onChange={(e) => setNumMomentos(e.target.value)}>
              {["2", "3", "4"].map((n) => <option key={n}>{n}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Grupos por dia (0 = sem distribuição)</label>
            <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-300" value={numGrupos} onChange={(e) => setNumGrupos(e.target.value)}>
              {["0", "2", "3", "4", "5", "6"].map((n) => <option key={n}>{n}</option>)}
            </select>
          </div>
        </div>

        <button onClick={gerar} disabled={carregando} className="w-full py-3 rounded-xl bg-fuchsia-700 hover:bg-fuchsia-800 disabled:opacity-50 text-white font-medium text-sm transition-colors">
          ✨ Gerar Oficina Pedagógica
        </button>
        {status === "erro" && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">⚠️ {erroMsg}</div>}
      </div>

      {status === "pronto" && oficina && (
        <div>
          <div className="flex gap-3 mb-4">
            <button onClick={handleBaixarWord} disabled={baixando} className="flex-1 py-3 rounded-xl bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white font-medium text-sm transition-colors">
              📄 Baixar Word (.docx)
            </button>
            <button onClick={resetar} className="py-3 px-5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors">↩ Nova oficina</button>
          </div>

          <div className="bg-white border border-gray-300 shadow-lg rounded-lg overflow-hidden" style={{ fontFamily: "Arial, sans-serif" }}>
            <div className="flex items-center border-b-4 border-yellow-500 pb-2 px-4 pt-3 gap-3">
              <img src="/brasao-acre.png" alt="Brasão do Acre" className="h-16 w-16 object-contain shrink-0" />
              <div>
                <div className="text-xs font-bold text-green-800">GOVERNO DO ESTADO DO ACRE</div>
                <div className="text-xs text-green-700">www.acre.gov.br</div>
              </div>
              <div className="flex-1 text-right">
                <div className="text-xs text-green-800">SECRETARIA DE ESTADO DE</div>
                <div className="text-sm font-bold text-green-800">EDUCAÇÃO, CULTURA E ESPORTES</div>
              </div>
            </div>

            <div className="px-4 py-2 text-center border-b border-gray-200">
              <p className="text-base font-bold text-blue-900">{oficina.tituloEvento}</p>
              {oficina.subtitulo && <p className="text-sm font-semibold text-gray-600">{oficina.subtitulo}</p>}
            </div>

            {oficina.dias.map((dia, i) => (
              <div key={dia.numeroDia} className={i > 0 ? "border-t-4 border-dashed border-gray-300" : ""}>
                <div className="px-4 pt-3">
                  <table className="w-full border-collapse text-xs">
                    <tbody>
                      <tr><td className="border border-gray-400 bg-blue-800 text-white font-bold px-2 py-1 text-center">
                        OFICINA DE {oficina.componente.toUpperCase()}{oficina.dias.length > 1 ? ` — ${ordinalM(dia.numeroDia)} DIA` : ""}
                      </td></tr>
                      <tr><td className="border border-gray-400 bg-gray-50 font-semibold px-2 py-1">TEMA: <span className="font-normal">{dia.tema}</span></td></tr>
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-2">
                  <table className="w-full border-collapse text-xs">
                    <tbody>
                      <tr>
                        <td className="border border-gray-400 px-2 py-2 align-top w-1/2"><strong>OBJETIVO</strong><p className="mt-1 leading-relaxed">{dia.objetivo}</p></td>
                        <td className="border border-gray-400 px-2 py-2 align-top w-1/2">
                          <strong>HABILIDADE DO PLANO DE CURSO</strong>
                          {dia.habilidades.map((h, hi) => <p key={hi} className="mt-1 leading-relaxed"><strong>{h.codigo}:</strong> {h.descricao}</p>)}
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-gray-400 bg-gray-50 px-2 py-1"><strong>Ano:</strong> {oficina.ano}</td>
                        <td className="border border-gray-400 bg-gray-50 px-2 py-1"><strong>Data:</strong> {oficina.data || "—"} &nbsp;|&nbsp; <strong>Tempo previsto:</strong> {oficina.tempoPrevisto || "—"}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="px-4 pb-2">
                  <table className="w-full border-collapse text-xs">
                    <tbody>
                      <tr><td className="border border-gray-400 bg-amber-100 font-bold px-2 py-1">ACOLHIDA — {dia.acolhidaNome} ({dia.acolhidaTempo})</td></tr>
                      <tr><td className="border border-gray-400 bg-amber-50 px-3 py-2">
                        <ol className="list-decimal list-inside space-y-1">{dia.acolhidaPassos.map((p, pi) => <li key={pi} className="leading-relaxed">{p}</li>)}</ol>
                      </td></tr>
                    </tbody>
                  </table>
                </div>
                <div className="px-4 pb-2">
                  <table className="w-full border-collapse text-xs">
                    <thead><tr><td className="border border-gray-400 bg-blue-100 font-bold px-2 py-1 text-center">DESENVOLVIMENTO DA OFICINA ({dia.desenvolvimentoTempoTotal})</td></tr></thead>
                    <tbody>
                      {dia.momentos.map((m, mi) => (
                        <tr key={mi}><td className="border border-gray-400 p-0">
                          <div className="bg-blue-700 text-white font-bold px-2 py-1 text-xs">{ordinalM(mi + 1)} Momento — {m.titulo} ({m.tempo})</div>
                          <div className="px-3 py-2">
                            <ol className="list-decimal list-inside space-y-1 text-gray-800">{m.passos.map((p, pi) => <li key={pi} className="leading-relaxed">{p}</li>)}</ol>
                            {m.destaque && <div className="mt-2 border-l-2 border-blue-400 bg-blue-50 px-2 py-1 italic text-gray-700">{m.destaque}</div>}
                          </div>
                        </td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {dia.grupos.length > 0 && (
                  <div className="px-4 pb-4">
                    <table className="w-full border-collapse text-xs">
                      <thead><tr><td className="border border-gray-400 bg-blue-100 font-bold px-2 py-1 text-center">DISTRIBUIÇÃO DOS GRUPOS</td></tr></thead>
                      <tbody>
                        {dia.grupos.map((g) => (
                          <tr key={g.numero}><td className="border border-gray-400 px-3 py-2">
                            <p className="font-bold text-gray-800">Grupo {g.numero}</p>
                            <p className="font-semibold text-blue-900">Fase {g.numero}: {g.faseTitulo}</p>
                            <p className="text-gray-700 leading-relaxed mt-1">{g.descricao}</p>
                          </td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
