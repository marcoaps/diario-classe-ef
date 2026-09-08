// Painel "Fichas de Grupo por Estação": aparece na tela de resultado da
// Sequência Didática quando ela tem Estações. Escolhe uma ou mais turmas
// reais (algumas escolas juntam várias turmas no mesmo horário) + o gênero
// (quando as aulas são separadas por meninos/meninas), divide os alunos em
// grupos (um por estação) e baixa um Word com uma página por grupo.
// Compartilhado entre o Gerador de Sequência genérico e a aba de Esportes
// de Invasão.

import { useMemo, useState } from "react";
import { useStore } from "../../../store";
import { supabase } from "../../../data/supabase";
import { cn } from "../../AppLayout";
import { normalizarTurma } from "./sequenciaDidaticaHelpers";
import { dividirEmGrupos, baixarFichasGrupo, type AlunoFicha } from "./fichasGrupoWord";
import type { Sequencia } from "./sequenciaDidaticaTypes";

const GENEROS = [
  { valor: "M" as const, label: "Meninos" },
  { valor: "F" as const, label: "Meninas" },
  { valor: null, label: "Todos (misto)" },
];

export function FichasGrupoPainel({ sequencia, tema, serie }: { sequencia: Sequencia; tema: string; serie: string }) {
  const { classRooms } = useStore();
  const turmasUnicas = useMemo(
    () => Array.from(new Map(classRooms.map((cr) => [cr.name, cr] as const)).values()).sort(
      (a: any, b: any) => a.name.localeCompare(b.name, "pt-BR", { numeric: true }),
    ),
    [classRooms],
  );
  const [turmasSelecionadas, setTurmasSelecionadas] = useState<string[]>(turmasUnicas[0] ? [turmasUnicas[0].name] : []);
  const [genero, setGenero] = useState<"M" | "F" | null>(null);
  const [gerando, setGerando] = useState(false);
  const [aviso, setAviso] = useState("");

  if (!sequencia.estacoes || sequencia.estacoes.length === 0) return null;
  const estacoes = sequencia.estacoes;

  const toggleTurma = (nome: string) => {
    setTurmasSelecionadas((prev) => prev.includes(nome) ? prev.filter((t) => t !== nome) : [...prev, nome]);
  };

  const handleGerar = async () => {
    setAviso("");
    if (turmasSelecionadas.length === 0) { setAviso("Selecione ao menos uma turma."); return; }
    setGerando(true);
    try {
      const alunos: AlunoFicha[] = [];
      let totalNaTurma = 0;
      for (const turma of turmasSelecionadas) {
        const turmaNorm = normalizarTurma(turma);
        const { data, error } = await supabase
          .from("alunos")
          .select("nome, numero_chamada, sexo")
          .eq("turma_id", turmaNorm)
          .order("numero_chamada", { ascending: true, nullsFirst: false });
        if (error) throw error;
        totalNaTurma += (data || []).length;
        (data || [])
          .filter((a: any) => !genero || a.sexo === genero)
          .forEach((a: any) => alunos.push({ nome: a.nome, numero_chamada: a.numero_chamada ?? null }));
      }
      if (alunos.length === 0) {
        setAviso(genero
          ? `Nenhum aluno marcado como "${genero === 'M' ? 'Meninos' : 'Meninas'}" nessas turmas (${totalNaTurma} alunos no total, nenhum com gênero marcado) — vá em "Marcar Gênero" na aba Turmas primeiro.`
          : "Nenhum aluno encontrado nessas turmas.");
        return;
      }

      const turmaLabel = turmasSelecionadas.join("+");
      const grupos = dividirEmGrupos(alunos, estacoes.length);
      await baixarFichasGrupo({ tema, turma: turmaLabel, serie, estacoes, grupos });
    } catch (e) {
      setAviso("Erro ao gerar fichas: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setGerando(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-orange-200 p-5 shadow-sm space-y-3 mt-4">
      <h3 className="text-sm font-semibold text-gray-800">🖨️ Fichas de Grupo por Estação</h3>
      <p className="text-xs text-gray-500">
        Divide os alunos das turmas escolhidas em {estacoes.length} grupos (um por estação, seguindo a ordem da lista de chamada) e gera um Word com uma página por grupo — nomes dos alunos e a estação onde o grupo começa, pronta pra imprimir e colar no local.
      </p>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-500">Turmas (marque as que forem juntas no mesmo horário)</label>
        <div className="flex flex-wrap gap-1.5">
          {turmasUnicas.length === 0 && <span className="text-xs text-gray-400">Nenhuma turma</span>}
          {turmasUnicas.map((cr) => {
            const ativo = turmasSelecionadas.includes(cr.name);
            return (
              <button
                key={cr.id}
                onClick={() => toggleTurma(cr.name)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-bold border transition-all",
                  ativo ? "bg-orange-600 text-white border-orange-700" : "bg-orange-50 text-orange-700 border-orange-200",
                )}
              >
                {cr.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-500">Gênero</label>
        <div className="flex gap-1.5">
          {GENEROS.map((g) => {
            const ativo = genero === g.valor;
            return (
              <button
                key={g.label}
                onClick={() => setGenero(g.valor)}
                className={cn(
                  "flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all",
                  ativo ? "bg-orange-600 text-white border-orange-700" : "bg-orange-50 text-orange-700 border-orange-200",
                )}
              >
                {g.label}
              </button>
            );
          })}
        </div>
        {genero && (
          <p className="text-[11px] text-gray-400">Alunos sem gênero marcado ficam de fora — use a tela "Marcar Gênero" na aba Turmas se faltar alguém.</p>
        )}
      </div>

      <button
        onClick={handleGerar}
        disabled={gerando || turmasSelecionadas.length === 0}
        className="w-full py-2 px-4 rounded-lg bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-medium text-sm transition-colors"
      >
        {gerando ? "Gerando..." : "📄 Gerar Fichas (Word)"}
      </button>

      {aviso && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">⚠️ {aviso}</div>
      )}
    </div>
  );
}
