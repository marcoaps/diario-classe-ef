// Painel "Fichas de Grupo por Estação": aparece na tela de resultado da
// Sequência Didática quando ela tem Estações. Escolhe uma turma real,
// divide os alunos em grupos (um por estação) e baixa um Word com uma
// página por grupo. Compartilhado entre o Gerador de Sequência genérico e
// a aba de Esportes de Invasão.

import { useMemo, useState } from "react";
import { useStore } from "../../../store";
import { supabase } from "../../../data/supabase";
import { normalizarTurma } from "./sequenciaDidaticaHelpers";
import { dividirEmGrupos, baixarFichasGrupo, type AlunoFicha } from "./fichasGrupoWord";
import type { Sequencia } from "./sequenciaDidaticaTypes";

export function FichasGrupoPainel({ sequencia, tema, serie }: { sequencia: Sequencia; tema: string; serie: string }) {
  const { classRooms } = useStore();
  const turmasUnicas = useMemo(
    () => Array.from(new Map(classRooms.map((cr) => [cr.name, cr] as const)).values()).sort(
      (a: any, b: any) => a.name.localeCompare(b.name, "pt-BR", { numeric: true }),
    ),
    [classRooms],
  );
  const [turma, setTurma] = useState(turmasUnicas[0]?.name ?? "");
  const [gerando, setGerando] = useState(false);

  if (!sequencia.estacoes || sequencia.estacoes.length === 0) return null;
  const estacoes = sequencia.estacoes;

  const handleGerar = async () => {
    if (!turma) { alert("Selecione uma turma."); return; }
    setGerando(true);
    try {
      const turmaNorm = normalizarTurma(turma);
      const { data, error } = await supabase
        .from("alunos")
        .select("nome, numero_chamada")
        .eq("turma_id", turmaNorm)
        .order("numero_chamada", { ascending: true, nullsFirst: false });
      if (error) throw error;
      const alunos: AlunoFicha[] = (data || []).map((a: any) => ({ nome: a.nome, numero_chamada: a.numero_chamada ?? null }));
      if (alunos.length === 0) { alert(`Nenhum aluno encontrado na turma ${turma}.`); return; }

      const grupos = dividirEmGrupos(alunos, estacoes.length);
      await baixarFichasGrupo({ tema, turma, serie, estacoes, grupos });
    } catch (e) {
      alert("Erro ao gerar fichas: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setGerando(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-orange-200 p-5 shadow-sm space-y-3 mt-4">
      <h3 className="text-sm font-semibold text-gray-800">🖨️ Fichas de Grupo por Estação</h3>
      <p className="text-xs text-gray-500">
        Divide a turma escolhida em {estacoes.length} grupos (um por estação, seguindo a ordem da lista de chamada) e gera um Word com uma página por grupo — nomes dos alunos e a estação onde o grupo começa, pronta pra imprimir e colar no local.
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <select
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
          value={turma}
          onChange={(e) => setTurma(e.target.value)}
        >
          {turmasUnicas.length === 0 && <option value="">Nenhuma turma</option>}
          {turmasUnicas.map((cr) => <option key={cr.id} value={cr.name}>{cr.name}</option>)}
        </select>
        <button
          onClick={handleGerar}
          disabled={gerando || !turma}
          className="py-2 px-4 rounded-lg bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-medium text-sm transition-colors whitespace-nowrap"
        >
          {gerando ? "Gerando..." : "📄 Gerar Fichas (Word)"}
        </button>
      </div>
    </div>
  );
}
