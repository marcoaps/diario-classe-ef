import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../data/supabase';
import { ArrowLeft, Download, ClipboardList } from 'lucide-react';
import * as XLSX from 'xlsx';

import type { Avaliacao } from './tiposCorretorProvas';
import { labelTurmaOuGrupo, ehGrupoDeTurmas } from './tiposCorretorProvas';

// ============================================================================
// "Correções realizadas" — lista TODA correção anônima desta avaliação
// (codigo_anonimo), sem depender de nenhum aluno. A coluna Aluno começa
// sempre em "—"; a associação manual com o aluno é uma etapa futura,
// separada desta tela (ver seção 9/15 do módulo de correção anônima).
// ============================================================================

interface Correcao {
  id: string;
  codigo_anonimo: string;
  acertos: number | null;
  erros: number;
  brancas: number;
  nota_final: number;
  escaneado_em: string | null;
  aluno_id: string | null;
}

export function AvaliacaoCorrecoes() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [avaliacao, setAvaliacao] = useState<Avaliacao | null>(null);
  const [correcoes, setCorrecoes] = useState<Correcao[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      if (!id) return;
      const { data: av } = await supabase.from('avaliacoes').select('*').eq('id', id).single();
      setAvaliacao(av);

      const { data: cor } = await supabase
        .from('avaliacoes_respostas')
        .select('id, codigo_anonimo, acertos, erros, brancas, nota_final, escaneado_em, aluno_id')
        .eq('avaliacao_id', id)
        .not('codigo_anonimo', 'is', null)
        .order('codigo_anonimo');
      setCorrecoes(cor || []);
      setLoading(false);
    }
    init();
  }, [id]);

  function exportarExcel() {
    if (!avaliacao) return;
    const dados = correcoes.map(c => ({
      'Código da correção': c.codigo_anonimo,
      'Código da avaliação': avaliacao.codigo_avaliacao || '',
      'Grupo': ehGrupoDeTurmas(avaliacao.turma_id) ? labelTurmaOuGrupo(avaliacao.turma_id) : avaliacao.turma_id,
      'Acertos': c.acertos ?? '',
      'Erros': c.erros ?? '',
      'Brancas': c.brancas ?? '',
      'Nota': c.nota_final ?? '',
      'Aluno': c.aluno_id ? c.aluno_id : '',
    }));
    const ws = XLSX.utils.json_to_sheet(dados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Correções');
    XLSX.writeFile(wb, `correcoes_${avaliacao.codigo_avaliacao || avaliacao.titulo}.xlsx`);
  }

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );

  if (!avaliacao) return (
    <div className="py-8 text-center text-sm text-on-surface-variant">Avaliação não encontrada.</div>
  );

  const valorTotal = (avaliacao.valor_total_objetivas || 0) + (avaliacao.valor_total_discursivas || 0);
  const media = correcoes.length > 0 ? correcoes.reduce((s, c) => s + (c.nota_final || 0), 0) / correcoes.length : 0;

  return (
    <div className="py-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/avaliacoes')} className="p-1 rounded-lg text-on-surface-variant">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-base font-bold text-on-surface">Correções realizadas</h1>
            <p className="text-xs text-on-surface-variant">
              {avaliacao.titulo} · {avaliacao.codigo_avaliacao || 'sem código ainda'}
            </p>
          </div>
        </div>
        <button
          onClick={exportarExcel}
          disabled={correcoes.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary-container text-on-secondary-container text-xs font-semibold disabled:opacity-50"
        >
          <Download className="w-3.5 h-3.5" />
          Excel
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-surface border border-outline-variant rounded-2xl p-3 text-center">
          <p className="text-xs text-on-surface-variant">Corrigidas</p>
          <p className="text-2xl font-bold text-primary">{correcoes.length}</p>
        </div>
        <div className="bg-surface border border-outline-variant rounded-2xl p-3 text-center">
          <p className="text-xs text-on-surface-variant">Média</p>
          <p className="text-2xl font-bold text-primary">{media.toFixed(1)}</p>
        </div>
      </div>

      {correcoes.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center text-on-surface-variant">
          <ClipboardList className="w-10 h-10 opacity-40" />
          <p className="text-sm">Nenhuma correção ainda. Vá em "Corrigir" e escaneie o QR da avaliação.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-xs text-on-surface-variant border-b border-outline-variant">
                <th className="py-2 pr-2 font-semibold">Código</th>
                <th className="py-2 pr-2 font-semibold">Acertos</th>
                <th className="py-2 pr-2 font-semibold">Nota</th>
                <th className="py-2 pr-2 font-semibold">Aluno</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {correcoes.map(c => (
                <tr key={c.id}>
                  <td className="py-2 pr-2 font-mono text-xs text-on-surface">{c.codigo_anonimo}</td>
                  <td className="py-2 pr-2 text-on-surface">{c.acertos ?? '—'}/{avaliacao.quantidade_objetivas}</td>
                  <td className="py-2 pr-2 font-bold text-primary">{(c.nota_final ?? 0).toFixed(1)} / {valorTotal.toFixed(1)}</td>
                  <td className="py-2 pr-2 text-on-surface-variant">{c.aluno_id ? c.aluno_id : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
