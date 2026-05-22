import { useState } from "react";

// ─── Tipos ───────────────────────────────────────────────────────────────────

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

// ─── Config ───────────────────────────────────────────────────────────────────

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
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Erro HTTP ${res.status}`);
  const data = await res.json();
  return data.content.map((i: { text?: string }) => i.text ?? "").join("");
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function IASequencia() {
  // Campos do formulário
  const [professor, setProfessor] = useState("Marco Pedro");
  const [coordenador, setCoordenador] = useState("Jair Fiesca e Amarildo Saady");
  const [serie, setSerie] = useState("6º e 7º");
  const [turmas, setTurmas] = useState("");
  const [aulasPrevistas, setAulasPrevistas] = useState("5");
  const [periodo, setPeriodo] = useState("");
  const [tema, setTema] = useState("");
  const [recursos, setRecursos] = useState("");
  const [numSituacoes, setNumSituacoes] = useState("3");

  const [status, setStatus] = useState<"idle" | "gerando" | "imagens" | "pronto" | "erro">("idle");
  const [erroMsg, setErroMsg] = useState("");
  const [sequencia, setSequencia] = useState<Sequencia | null>(null);

  const gerar = async () => {
    if (!tema.trim()) { alert("Informe o tema/conteúdo da aula!"); return; }

    setStatus("gerando");
    setErroMsg("");
    setSequencia(null);

    const prompt = `Você é um professor de Educação Física experiente do estado do Acre, Brasil. Crie uma sequência didática completa e detalhada no padrão oficial da SEEDUC/AC para:

Tema/Conteúdo: ${tema}
Série: ${serie}
Turmas: ${turmas || "a definir"}
Aulas previstas: ${aulasPrevistas}
Recursos disponíveis: ${recursos || "materiais básicos de Educação Física"}
Número de situações de aprendizagem: ${numSituacoes}

Responda SOMENTE com JSON puro, sem markdown, sem blocos de código, sem texto antes ou depois.
Formato exato (todos os campos são obrigatórios):
{
  "objetivos": "parágrafo descrevendo objetivos/capacidades gerais",
  "habilidades": [
    {"codigo": "EF__EF__", "descricao": "descrição completa da habilidade BNCC"},
    {"codigo": "EF__EF__", "descricao": "descrição completa"},
    {"codigo": "EF__EF__", "descricao": "descrição completa"}
  ],
  "objetos_conhecimento": ["objeto 1", "objeto 2", "objeto 3"],
  "aquecimento": "descrição detalhada da atividade de acolhida e aquecimento inicial (mínimo 3 parágrafos)",
  "situacoes": [
    {
      "numero": 1,
      "titulo": "Título da Situação de Aprendizagem 1",
      "objetivo": "Objetivo específico desta situação",
      "desenvolvimento": "Descrição muito detalhada do desenvolvimento com numeração de etapas (mínimo 4 parágrafos com subatividades)",
      "adaptacao": "Como adaptar para alunos com necessidades especiais",
      "imageQuery": "3 palavras em inglês para buscar imagem no Pexels"
    }
  ],
  "valores_atitudinais": "descrição dos valores atitudinais trabalhados",
  "instrumentos_avaliacao": "descrição dos instrumentos de avaliação utilizados",
  "recursos": "lista completa de recursos materiais necessários",
  "referencias": [
    "ACRE. Referência bibliográfica 1.",
    "Referência 2.",
    "Referência 3."
  ]
}`;

    let seq: Sequencia;
    try {
      const texto = await chamarClaudeProxy(prompt);
      const start = texto.indexOf("{");
      const end = texto.lastIndexOf("}");
      if (start === -1) throw new Error("Resposta inesperada da API");
      seq = JSON.parse(texto.slice(start, end + 1));
    } catch (err: unknown) {
      setErroMsg(err instanceof Error ? err.message : "Erro desconhecido");
      setStatus("erro");
      return;
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

  const resetar = () => {
    setStatus("idle");
    setSequencia(null);
    setTema("");
    setRecursos("");
    setTurmas("");
    setPeriodo("");
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

      {/* ── Formulário ── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">
          🤖 Gerador de Sequência Didática Oficial — IA
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2 flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Tema / Conteúdo *</label>
            <input
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="Ex: Futsal — Fundamentos técnico-táticos e regras"
              value={tema}
              onChange={(e) => setTema(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Professor(a)</label>
            <input
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              value={professor}
              onChange={(e) => setProfessor(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Coordenador(a)</label>
            <input
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              value={coordenador}
              onChange={(e) => setCoordenador(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Ano / Série</label>
            <select
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              value={serie}
              onChange={(e) => setSerie(e.target.value)}
            >
              {["6º ano","7º ano","8º ano","9º ano","6º e 7º","8º e 9º","1º EM","2º EM","3º EM","1º e 2º EM"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Turmas</label>
            <input
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="Ex: 6ºF / 7ºD, E, F"
              value={turmas}
              onChange={(e) => setTurmas(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Aulas previstas</label>
            <select
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              value={aulasPrevistas}
              onChange={(e) => setAulasPrevistas(e.target.value)}
            >
              {["2","3","4","5","6","8","10"].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Período de execução</label>
            <input
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="Ex: Março/Abril 2026"
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Nº de Situações de Aprendizagem</label>
            <select
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              value={numSituacoes}
              onChange={(e) => setNumSituacoes(e.target.value)}
            >
              {["2","3","4","5"].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2 flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Recursos disponíveis</label>
            <input
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="Ex: quadra coberta, bolas de futsal, cones, coletes..."
              value={recursos}
              onChange={(e) => setRecursos(e.target.value)}
            />
          </div>
        </div>

        <button
          onClick={gerar}
          disabled={status === "gerando" || status === "imagens"}
          className="w-full py-3 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-medium text-sm transition-colors"
        >
          {status === "gerando"
            ? "⏳ Gerando sequência didática..."
            : status === "imagens"
            ? "🖼️ Buscando imagens..."
            : "✨ Gerar Sequência Didática Oficial"}
        </button>

        {status === "erro" && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            ⚠️ {erroMsg}
          </div>
        )}
      </div>

      {/* ── Documento Oficial ── */}
      {status === "pronto" && sequencia && (
        <div className="bg-white border border-gray-300 shadow-lg rounded-lg overflow-hidden" style={{ fontFamily: "Arial, sans-serif" }}>

          {/* Cabeçalho Governo do Acre */}
          <div className="flex items-stretch border-b-2 border-gray-800">
            <div className="flex items-center justify-center p-3 border-r border-gray-300" style={{ minWidth: 100 }}>
              {/* Logo placeholder — substitua pela URL do logo hospedado no Imgur */}
              <div className="text-center">
                <div className="text-xs font-bold text-green-800 leading-tight">GOVERNO DO</div>
                <div className="text-xs font-bold text-green-800 leading-tight">ESTADO DO ACRE</div>
                <div className="text-xs text-green-700">www.acre.gov.br</div>
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center p-3 text-center">
              <div>
                <div className="text-xs font-bold text-gray-700">SECRETARIA DE ESTADO DE</div>
                <div className="text-sm font-bold text-blue-900">EDUCAÇÃO, CULTURA E ESPORTES</div>
                <div className="text-sm font-bold text-blue-900">DIRETORIA DE ENSINO</div>
                <div className="text-xs font-bold text-gray-700">DIVISÃO DE ENSINO FUNDAMENTAL I E II</div>
                <div className="text-xs font-bold text-gray-700">DIVISÃO DE ENSINO ANOS FINAIS</div>
              </div>
            </div>
          </div>

          {/* Nome da escola */}
          <div className="px-4 pt-3 pb-1">
            <p className="text-sm font-bold text-gray-900">ESCOLA: INSTITUTO ODILON PRATAGI</p>
          </div>

          {/* Tabela de identificação */}
          <div className="px-4 pb-2">
            <table className="w-full border-collapse text-xs">
              <tbody>
                <tr>
                  <td colSpan={4} className="border border-gray-400 bg-blue-800 text-white font-bold px-2 py-1">
                    SEQUÊNCIA DIDÁTICA
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-400 px-2 py-1 font-semibold bg-gray-50 w-1/4">PROFESSOR(A):<br /><span className="font-normal">{professor}</span></td>
                  <td className="border border-gray-400 px-2 py-1 font-semibold bg-gray-50 w-1/4">COMPONENTE CURRICULAR:<br /><span className="font-normal">Educação Física</span></td>
                  <td className="border border-gray-400 px-2 py-1 font-semibold bg-gray-50 w-1/4">ANO/SÉRIE:<br /><span className="font-normal">{serie}</span></td>
                  <td className="border border-gray-400 px-2 py-1 font-semibold bg-gray-50 w-1/4">TURMAS:<br /><span className="font-normal">{turmas || "—"}</span></td>
                </tr>
                <tr>
                  <td className="border border-gray-400 px-2 py-1 font-semibold bg-gray-50" colSpan={2}>COORDENADOR(A):<br /><span className="font-normal">{coordenador}</span></td>
                  <td className="border border-gray-400 px-2 py-1 font-semibold bg-gray-50">AULAS PREVISTAS:<br /><span className="font-normal">{aulasPrevistas}</span></td>
                  <td className="border border-gray-400 px-2 py-1 font-semibold bg-gray-50">PERÍODO DE EXECUÇÃO:<br /><span className="font-normal">{periodo || "—"}</span></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Objetivos */}
          <div className="px-4 pb-2">
            <table className="w-full border-collapse text-xs">
              <tbody>
                <tr>
                  <td className="border border-gray-400 bg-blue-100 font-bold px-2 py-1 text-center text-sm">
                    OBJETIVOS/CAPACIDADES
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-400 px-3 py-2 text-gray-800 leading-relaxed">
                    {sequencia.objetivos}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Conteúdos — Habilidades e Objetos de Conhecimento */}
          <div className="px-4 pb-2">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <td colSpan={2} className="border border-gray-400 bg-blue-100 font-bold px-2 py-1 text-center text-sm">
                    CONTEÚDOS
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-400 bg-gray-100 font-bold px-2 py-1 text-center w-1/2">HABILIDADES</td>
                  <td className="border border-gray-400 bg-gray-100 font-bold px-2 py-1 text-center w-1/2">OBJETOS DE CONHECIMENTO</td>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-400 px-2 py-2 align-top">
                    {sequencia.habilidades.map((h, i) => (
                      <p key={i} className="mb-1 leading-relaxed">
                        <strong>{h.codigo}:</strong> {h.descricao}
                      </p>
                    ))}
                  </td>
                  <td className="border border-gray-400 px-2 py-2 align-top">
                    <ul className="list-disc list-inside space-y-1">
                      {sequencia.objetos_conhecimento.map((o, i) => (
                        <li key={i} className="leading-relaxed">{o}</li>
                      ))}
                    </ul>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Desenvolvimento das Atividades */}
          <div className="px-4 pb-2">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <td colSpan={2} className="border border-gray-400 bg-blue-100 font-bold px-2 py-1 text-center text-sm">
                    DESENVOLVIMENTO DAS ATIVIDADES
                  </td>
                </tr>
                <tr>
                  <td colSpan={2} className="border border-gray-400 bg-gray-50 px-2 py-1 text-center text-xs text-gray-500 italic">
                    (Descrição de situações de ensino e aprendizagem para desenvolver as habilidades)
                  </td>
                </tr>
              </thead>
              <tbody>
                {/* Aquecimento */}
                <tr>
                  <td colSpan={2} className="border border-gray-400 px-2 py-1 bg-amber-50">
                    <p className="font-bold text-amber-900 mb-1">Atividade de Acolhida e Aquecimento</p>
                    <p className="text-gray-800 leading-relaxed whitespace-pre-line">{sequencia.aquecimento}</p>
                  </td>
                </tr>

                {/* Situações de Aprendizagem */}
                {sequencia.situacoes.map((sit) => (
                  <tr key={sit.numero}>
                    <td colSpan={2} className="border border-gray-400 p-0">
                      {/* Header da situação */}
                      <div className="bg-blue-700 text-white font-bold px-2 py-1 text-xs">
                        Situação de Aprendizagem {sit.numero} — {sit.titulo}
                      </div>

                      {/* Corpo: imagem + texto */}
                      <div className="flex">
                        <div className="flex-1 px-3 py-2">
                          <p className="font-semibold text-gray-700 mb-1">
                            Objetivo Específico: <span className="font-normal">{sit.objetivo}</span>
                          </p>
                          <div className="text-gray-800 leading-relaxed whitespace-pre-line">
                            {sit.desenvolvimento}
                          </div>
                          {sit.adaptacao && (
                            <div className="mt-2 bg-purple-50 border-l-2 border-purple-400 px-2 py-1">
                              <p className="font-semibold text-purple-800 text-xs">Atividades Adaptadas:</p>
                              <p className="text-gray-700 text-xs">{sit.adaptacao}</p>
                            </div>
                          )}
                        </div>

                        {/* Imagem Pexels */}
                        {sit.imageUrl ? (
                          <div className="relative shrink-0" style={{ width: 180 }}>
                            <img
                              src={sit.imageUrl}
                              alt={sit.imageQuery}
                              className="w-full h-full object-cover"
                              style={{ minHeight: 140 }}
                            />
                            {sit.imageAuthor && (
                              <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white px-1 py-0.5 text-center" style={{ fontSize: 9 }}>
                                📷 {sit.imageAuthor} / Pexels
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="shrink-0 bg-gray-100 flex items-center justify-center text-gray-400 text-xs" style={{ width: 180, minHeight: 140 }}>
                            Sem imagem
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Avaliação, Valores e Recursos */}
          <div className="px-4 pb-2">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <td className="border border-gray-400 bg-blue-100 font-bold px-2 py-1 text-center w-1/3">
                    VALORES ATITUDINAIS ENVOLVIDOS NAS ATIVIDADES
                  </td>
                  <td className="border border-gray-400 bg-blue-100 font-bold px-2 py-1 text-center w-1/3">
                    INSTRUMENTOS DE AVALIAÇÃO
                  </td>
                  <td className="border border-gray-400 bg-blue-100 font-bold px-2 py-1 text-center w-1/3">
                    RECURSOS
                  </td>
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

          {/* Referências */}
          <div className="px-4 pb-2">
            <table className="w-full border-collapse text-xs">
              <tbody>
                <tr>
                  <td className="border border-gray-400 bg-blue-100 font-bold px-2 py-1 text-center text-sm">
                    REFERÊNCIAS
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-400 px-3 py-2">
                    <ul className="list-disc list-inside space-y-1 text-gray-800">
                      {sequencia.referencias.map((r, i) => (
                        <li key={i} className="leading-relaxed">{r}</li>
                      ))}
                    </ul>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Assinaturas */}
          <div className="px-4 pb-4">
            <table className="w-full border-collapse text-xs">
              <tbody>
                <tr>
                  <td colSpan={2} className="border border-gray-400 bg-blue-800 text-white font-bold px-2 py-1 text-center">
                    DEVOLUTIVA DO COORDENADOR PEDAGÓGICO
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-400 px-4 py-8 text-center w-1/2">
                    <div className="border-t border-gray-500 mt-6 pt-1">Assinatura do (a) Coordenador (a)</div>
                  </td>
                  <td className="border border-gray-400 px-4 py-8 text-center w-1/2">
                    <div className="border-t border-gray-500 mt-6 pt-1">Assinatura do (a) Professor (a)</div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Botão resetar */}
          <div className="px-4 pb-4">
            <button
              onClick={resetar}
              className="w-full py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
            >
              ↩ Gerar nova sequência
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
