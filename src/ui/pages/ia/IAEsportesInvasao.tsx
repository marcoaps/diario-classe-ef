import { useState, useEffect } from "react";
import type { Sequencia } from "./sequenciaDidaticaTypes";
import {
  numeroSequenciaAtual, periodoExecucaoAtual, ordinal,
  sugerirRecursos, sugerirFundamentos, TURMAS_POR_SERIE,
} from "./sequenciaDidaticaHelpers";
import { gerarSequenciaComIA } from "./sequenciaDidaticaGerador";
import { baixarWord } from "./sequenciaDidaticaWord";
import { AnimacaoGerando, AnimacaoBaixando } from "./SequenciaDidaticaAnimacoes";
import { SequenciaDidaticaPreview } from "./SequenciaDidaticaPreview";
import { FichasGrupoPainel } from "./FichasGrupoPainel";

// Aba dedicada a esportes de invasão (handebol, futsal, basquete...):
// separada do Gerador de Sequência genérico porque o Plano de Curso oficial
// trata esses esportes de forma agrupada ("Esporte de invasão ou
// territorial", sem nomear a modalidade), então aqui a Modalidade é um
// campo de primeira classe em vez de precisar editar o Tema manualmente.
const MODALIDADES = ["Handebol", "Futsal", "Basquete"];

function temaPadrao(modalidade: string): string {
  return `${modalidade} — Fundamentos técnico-táticos e regras`;
}

export function IAEsportesInvasao() {
  const [professor, setProfessor] = useState("Marco Pedro");
  const [coordenador, setCoordenador] = useState("Jair Fiesca e Amarildo Saady");
  const [modalidade, setModalidade] = useState("Handebol");
  const [serie, setSerie] = useState("6º e 7º");
  const [turmas, setTurmas] = useState(TURMAS_POR_SERIE["6º e 7º"]);
  const [aulasPrevistas, setAulasPrevistas] = useState("5");
  const [periodo, setPeriodo] = useState(() => periodoExecucaoAtual());
  const [tema, setTema] = useState(() => temaPadrao("Handebol"));
  const [recursos, setRecursos] = useState(() => sugerirRecursos("Handebol"));
  const [numSituacoes, setNumSituacoes] = useState("3");
  const [incluirEstacoes, setIncluirEstacoes] = useState(true);
  const [fundamentos, setFundamentos] = useState(() => sugerirFundamentos("Handebol"));

  // Ao trocar a Modalidade, sincroniza Tema/Recursos/Fundamentos com os
  // padrões daquele esporte — mesmo padrão "pré-preencher, mas deixar
  // editável" do restante do app.
  function selecionarModalidade(valor: string) {
    setModalidade(valor);
    setTema(temaPadrao(valor));
    setRecursos(sugerirRecursos(valor));
    setFundamentos(sugerirFundamentos(valor));
  }

  const handleSerie = (s: string) => {
    setSerie(s);
    if (TURMAS_POR_SERIE[s] !== undefined) setTurmas(TURMAS_POR_SERIE[s]);
  };

  const [status, setStatus] = useState<"idle" | "gerando" | "imagens" | "pronto" | "erro">("idle");
  const [baixando, setBaixando] = useState(false);
  const [erroMsg, setErroMsg] = useState("");
  const [sequencia, setSequencia] = useState<Sequencia | null>(null);
  const [etapaAnim, setEtapaAnim] = useState(0);
  const [contadorSeq, setContadorSeq] = useState(() => {
    return parseInt(localStorage.getItem("seq_contador") || "0");
  });
  const [numeroAtual, setNumeroAtual] = useState(() => numeroSequenciaAtual());

  useEffect(() => {
    if (status !== "gerando" && status !== "imagens") return;
    const iv = setInterval(() => setEtapaAnim(e => e + 1), 3000);
    return () => clearInterval(iv);
  }, [status]);

  const gerar = async () => {
    if (!tema.trim()) { alert("Informe o tema/conteúdo da aula!"); return; }
    setStatus("gerando"); setErroMsg(""); setSequencia(null); setEtapaAnim(0);

    let seq: Sequencia;
    try {
      seq = await gerarSequenciaComIA({ tema, serie, turmas, aulasPrevistas, recursos, numSituacoes, incluirEstacoes, fundamentos });
    } catch (err: unknown) {
      setErroMsg(err instanceof Error ? err.message : "Erro desconhecido");
      setStatus("erro"); return;
    }

    setNumeroAtual(numeroSequenciaAtual());

    const novoContador = contadorSeq + 1;
    setContadorSeq(novoContador);
    localStorage.setItem("seq_contador", String(novoContador));

    setSequencia(seq);
    setStatus("pronto");
  };

  const handleBaixarWord = async () => {
    if (!sequencia) return;
    setBaixando(true);
    try { await baixarWord({ seq: sequencia, professor, coordenador, serie, turmas, aulasPrevistas, periodo, tema, numeroSeq: numeroAtual }); }
    catch (e) { alert("Erro ao gerar Word: " + (e instanceof Error ? e.message : String(e))); }
    setBaixando(false);
  };

  const resetar = () => { setStatus("idle"); setSequencia(null); };

  const carregando = status === "gerando" || status === "imagens";

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {carregando && <AnimacaoGerando etapa={etapaAnim} />}
      {baixando && <AnimacaoBaixando />}

      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">🥅 Esportes de Invasão — Gerador de Sequência (IA)</h2>
          {contadorSeq > 0 && (
            <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-3 py-1 rounded-full">
              {contadorSeq} sequência{contadorSeq > 1 ? "s" : ""} gerada{contadorSeq > 1 ? "s" : ""}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2 flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Modalidade</label>
            <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" value={modalidade} onChange={(e) => selecionarModalidade(e.target.value)}>
              {MODALIDADES.map((m) => <option key={m}>{m}</option>)}
            </select>
            <p className="text-[11px] text-gray-400">O Plano de Curso oficial agrupa esportes de invasão sem nomear a modalidade — aqui você escolhe direto e o resto do formulário já vem ajustado.</p>
          </div>
          <div className="sm:col-span-2 flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Tema / Conteúdo *</label>
            <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" value={tema} onChange={(e) => setTema(e.target.value)} />
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
            <label className="text-xs font-medium text-gray-500">Ano / Série</label>
            <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" value={serie} onChange={(e) => handleSerie(e.target.value)}>
              {Object.keys(TURMAS_POR_SERIE).map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Turmas</label>
            <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" placeholder="Ex: 6ºF, 7ºB, 7ºC..." value={turmas} onChange={(e) => setTurmas(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Aulas previstas</label>
            <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" value={aulasPrevistas} onChange={(e) => setAulasPrevistas(e.target.value)}>
              {["2","3","4","5","6","8","10"].map((n) => <option key={n}>{n}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Período de execução</label>
            <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" placeholder="Ex: Março/Abril 2026" value={periodo} onChange={(e) => setPeriodo(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Nº de Situações de Aprendizagem</label>
            <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" value={numSituacoes} onChange={(e) => setNumSituacoes(e.target.value)}>
              {["2","3","4","5"].map((n) => <option key={n}>{n}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2 flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Recursos disponíveis</label>
            <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" value={recursos} onChange={(e) => setRecursos(e.target.value)} />
            <p className="text-[11px] text-gray-400">Sugestão automática com base na modalidade — pode editar antes de gerar.</p>
          </div>

          <div className="sm:col-span-2 flex flex-col gap-2 border border-orange-100 bg-orange-50/60 rounded-lg p-3">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                className="rounded"
                checked={incluirEstacoes}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setIncluirEstacoes(checked);
                  if (checked && !fundamentos.trim()) setFundamentos(sugerirFundamentos(modalidade));
                }}
              />
              🎯 Organizar por Estações (uma estação por fundamento)
            </label>
            {incluirEstacoes && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">Fundamentos (uma estação por fundamento, separados por vírgula)</label>
                <input
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                  placeholder="Ex: Passe, Drible, Arremesso, Marcação"
                  value={fundamentos}
                  onChange={(e) => setFundamentos(e.target.value)}
                />
                <p className="text-[11px] text-gray-400">
                  {modalidade === "Handebol"
                    ? "Para Passe, Recepção, Empunhadura, Arremesso e Deslocamento, a IA usa a técnica dos seus próprios vídeos como referência."
                    : "A IA vai gerar o passo a passo e uma imagem ilustrativa para cada estação/fundamento, na ordem informada."}
                </p>
              </div>
            )}
          </div>
        </div>

        <button onClick={gerar} disabled={carregando} className="w-full py-3 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-medium text-sm transition-colors">
          ✨ Gerar Sequência Didática Oficial
        </button>
        {status === "erro" && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">⚠️ {erroMsg}</div>}
      </div>

      {status === "pronto" && sequencia && (
        <div>
          <div className="flex gap-3 mb-4">
            <button onClick={handleBaixarWord} disabled={baixando} className="flex-1 py-3 rounded-xl bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white font-medium text-sm transition-colors">
              📄 Baixar Word (.docx) — {ordinal(numeroAtual)} Sequência
            </button>
            <button onClick={resetar} className="py-3 px-5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors">↩ Nova sequência</button>
          </div>

          <SequenciaDidaticaPreview
            sequencia={sequencia} professor={professor} coordenador={coordenador} serie={serie}
            turmas={turmas} aulasPrevistas={aulasPrevistas} periodo={periodo} tema={tema} numeroAtual={numeroAtual}
          />

          <FichasGrupoPainel sequencia={sequencia} tema={tema} serie={serie} />
        </div>
      )}
    </div>
  );
}
