import { useState } from "react";

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface Etapa {
  tipo: "aquecimento" | "principal" | "volta" | "avaliacao";
  titulo: string;
  tempo: string;
  descricao: string;
  materiais: string;
  imageQuery: string;
  imageUrl?: string;
  imageAuthor?: string;
}

interface Sequencia {
  titulo: string;
  objetivo_geral: string;
  objetivos_especificos: string[];
  etapas: Etapa[];
}

// ─── Configuração ─────────────────────────────────────────────────────────────

const PEXELS_API_KEY = import.meta.env.VITE_PEXELS_API_KEY ?? "";

const BADGE: Record<string, string> = {
  aquecimento: "bg-amber-100 text-amber-800",
  principal:   "bg-blue-100 text-blue-800",
  volta:       "bg-green-100 text-green-800",
  avaliacao:   "bg-purple-100 text-purple-800",
};

const LABEL: Record<string, string> = {
  aquecimento: "Aquecimento",
  principal:   "Parte principal",
  volta:       "Volta à calma",
  avaliacao:   "Avaliação",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function buscarImagemPexels(
  query: string
): Promise<{ url: string; author: string } | null> {
  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(
        query + " sport physical education"
      )}&per_page=1&orientation=landscape`,
      { headers: { Authorization: PEXELS_API_KEY } }
    );
    const data = await res.json();
    if (data.photos?.length > 0) {
      return {
        url: data.photos[0].src.medium,
        author: data.photos[0].photographer,
      };
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
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Erro HTTP ${res.status}`);
  const data = await res.json();
  return data.content.map((i: { text?: string }) => i.text ?? "").join("");
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function IASequencia() {
  const [tema, setTema]       = useState("");
  const [serie, setSerie]     = useState("6º ano");
  const [duracao, setDuracao] = useState("50 minutos");
  const [alunos, setAlunos]   = useState("30");
  const [obs, setObs]         = useState("");

  const [status, setStatus]     = useState<"idle" | "gerando" | "imagens" | "pronto" | "erro">("idle");
  const [erroMsg, setErroMsg]   = useState("");
  const [sequencia, setSequencia] = useState<Sequencia | null>(null);

  const gerar = async () => {
    if (!tema.trim()) { alert("Informe o tema da aula!"); return; }

    setStatus("gerando");
    setErroMsg("");
    setSequencia(null);

    const prompt = `Você é um professor de Educação Física experiente. Crie uma sequência didática para:
Tema: ${tema} | Série: ${serie} | Duração: ${duracao} | Alunos: ${alunos} | Recursos: ${obs || "materiais básicos"}

Responda SOMENTE com JSON puro, sem markdown, sem blocos de código, sem texto antes ou depois.
Formato exato:
{"titulo":"...","objetivo_geral":"...","objetivos_especificos":["...","...","..."],"etapas":[{"tipo":"aquecimento","titulo":"...","tempo":"...","descricao":"...","materiais":"...","imageQuery":"3 palavras em inglês para imagem"},{"tipo":"principal","titulo":"...","tempo":"...","descricao":"...","materiais":"...","imageQuery":"..."},{"tipo":"volta","titulo":"...","tempo":"...","descricao":"...","materiais":"...","imageQuery":"..."},{"tipo":"avaliacao","titulo":"...","tempo":"...","descricao":"...","materiais":"...","imageQuery":"..."}]}`;

    let seq: Sequencia;
    try {
      const texto = await chamarClaudeProxy(prompt);
      const start = texto.indexOf("{");
      const end   = texto.lastIndexOf("}");
      if (start === -1) throw new Error("Resposta inesperada da API");
      seq = JSON.parse(texto.slice(start, end + 1));
    } catch (err: unknown) {
      setErroMsg(err instanceof Error ? err.message : "Erro desconhecido");
      setStatus("erro");
      return;
    }

    setStatus("imagens");
    const etapasComImg = await Promise.all(
      seq.etapas.map(async (e) => {
        const img = await buscarImagemPexels(e.imageQuery);
        return { ...e, imageUrl: img?.url ?? "", imageAuthor: img?.author ?? "" };
      })
    );

    setSequencia({ ...seq, etapas: etapasComImg });
    setStatus("pronto");
  };

  const resetar = () => {
    setStatus("idle");
    setSequencia(null);
    setTema("");
    setObs("");
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">

      {/* Formulário */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">
          🤖 Gerador de Sequência Didática com IA
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2 flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Conteúdo / Tema da aula</label>
            <input
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="Ex: Futsal — Passe e Recepção"
              value={tema}
              onChange={(e) => setTema(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Série / Turma</label>
            <select
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              value={serie}
              onChange={(e) => setSerie(e.target.value)}
            >
              {["6º ano","7º ano","8º ano","9º ano","1º EM","2º EM","3º EM"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Duração</label>
            <select
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              value={duracao}
              onChange={(e) => setDuracao(e.target.value)}
            >
              {["50 minutos","100 minutos (dupla)","60 minutos","90 minutos"].map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Nº de alunos</label>
            <input
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="Ex: 30"
              value={alunos}
              onChange={(e) => setAlunos(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Recursos disponíveis</label>
            <input
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="Ex: quadra, bolas, cones..."
              value={obs}
              onChange={(e) => setObs(e.target.value)}
            />
          </div>
        </div>

        <button
          onClick={gerar}
          disabled={status === "gerando" || status === "imagens"}
          className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium text-sm transition-colors"
        >
          {status === "gerando"
            ? "⏳ Gerando sequência..."
            : status === "imagens"
            ? "🖼️ Buscando imagens..."
            : "✨ Gerar Sequência Didática"}
        </button>

        {status === "erro" && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            ⚠️ {erroMsg}
          </div>
        )}
      </div>

      {/* Resultado */}
      {status === "pronto" && sequencia && (
        <div className="space-y-4">

          <div className="bg-gray-50 rounded-2xl border border-gray-200 p-5">
            <h3 className="text-xl font-semibold text-gray-900">{sequencia.titulo}</h3>
            <p className="text-sm text-gray-500 mt-1">{sequencia.objetivo_geral}</p>
            <div className="flex flex-wrap gap-2 mt-3">
              {[serie, duracao, `${alunos} alunos`].map((m) => (
                <span key={m} className="text-xs bg-white border border-gray-200 rounded-full px-3 py-1 text-gray-600">
                  {m}
                </span>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">🎯 Objetivos específicos</h4>
            <ul className="space-y-1">
              {sequencia.objetivos_especificos.map((o, i) => (
                <li key={i} className="text-sm text-gray-600 flex gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>{o}</span>
                </li>
              ))}
            </ul>
          </div>

          {sequencia.etapas.map((etapa, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100">
                <span className={`text-xs font-semibold px-3 py-1 rounded-full ${BADGE[etapa.tipo] ?? "bg-gray-100 text-gray-700"}`}>
                  {LABEL[etapa.tipo] ?? etapa.tipo}
                </span>
                <span className="text-sm font-medium text-gray-800 flex-1">{etapa.titulo}</span>
                <span className="text-xs text-gray-400">⏱ {etapa.tempo}</span>
              </div>

              <div className="flex">
                <div className="flex-1 p-5 space-y-3">
                  <p className="text-sm text-gray-700 leading-relaxed">{etapa.descricao}</p>
                  <p className="text-xs text-gray-400 flex gap-1">
                    <span>🔧</span><span>{etapa.materiais}</span>
                  </p>
                </div>

                {etapa.imageUrl ? (
                  <div className="w-48 shrink-0 relative">
                    <img
                      src={etapa.imageUrl}
                      alt={etapa.imageQuery}
                      className="w-full h-full object-cover"
                    />
                    {etapa.imageAuthor && (
                      <div className="absolute bottom-0 left-0 right-0 bg-black/40 text-white text-[10px] px-2 py-1 text-right">
                        📷 {etapa.imageAuthor} / Pexels
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-48 shrink-0 bg-gray-50 border-l border-gray-100 flex items-center justify-center text-gray-300 text-xs p-3 text-center">
                    Imagem não encontrada
                  </div>
                )}
              </div>
            </div>
          ))}

          <button
            onClick={resetar}
            className="w-full py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
          >
            ↩ Gerar nova sequência
          </button>
        </div>
      )}
    </div>
  );
}
