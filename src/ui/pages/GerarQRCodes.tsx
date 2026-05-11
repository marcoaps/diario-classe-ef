import React, { useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, Loader2, QrCode, GraduationCap } from 'lucide-react';
import { supabase } from '../../data/supabase';
import { useStore } from '../../store';
import { cn } from '../AppLayout';

interface AlunoQR {
  id: string;
  nome: string;
  turma_id: string;
  numero_chamada: number | null;
  token_acesso: string;
}

// CORRIGIDO: extrai formato curto "6F" de "6º Ano F" para bater com o banco
function normalizarTurma(turmaId: string) {
  // Se já está no formato curto (ex: "6F"), retorna direto
  if (/^\d+[A-Z]$/i.test(turmaId.trim())) {
    return turmaId.trim().toUpperCase();
  }
  // Converte "6º Ano F" → "6F"
  const match = turmaId.match(/(\d+).*?([A-Z])$/i);
  if (match) return `${match[1]}${match[2].toUpperCase()}`;
  // Fallback
  return turmaId.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
}

export function GerarQRCodes() {
  const { classRooms } = useStore();
  const turmas = useMemo(
    () =>
      Array.from(new Map(classRooms.map((cr) => [cr.name, cr])).values()).sort((a: any, b: any) =>
        a.name.localeCompare(b.name, 'pt-BR', { numeric: true }),
      ),
    [classRooms],
  );

  const [turma, setTurma] = useState<string>(turmas[0]?.name ?? '');
  const [alunos, setAlunos] = useState<AlunoQR[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [gerado, setGerado] = useState(false);

  useEffect(() => {
    if (!turma && turmas.length > 0) setTurma(turmas[0].name);
  }, [turmas, turma]);

  const gerarQRCodes = async () => {
    if (!turma) return;
    setLoading(true);
    setErro(null);
    setGerado(false);
    try {
      const turmaNorm = normalizarTurma(turma);
      const { data, error } = await supabase
        .from('alunos')
        .select('id, nome, turma_id, numero_chamada, token_acesso')
        .eq('turma_id', turmaNorm)
        .order('numero_chamada', { ascending: true, nullsFirst: false });
      if (error) throw error;

      const lista = (data || []).filter((a: any) => !!a.token_acesso) as AlunoQR[];
      if (lista.length === 0) {
        setErro('Nenhum aluno com token encontrado nessa turma. Rode o SQL sql/portal_aluno.sql no Supabase para gerar os tokens.');
      }
      setAlunos(lista);
      setGerado(true);
    } catch (e: any) {
      console.error('Erro ao buscar alunos:', e);
      setErro(e?.message || 'Erro ao buscar alunos.');
      setAlunos([]);
    } finally {
      setLoading(false);
    }
  };

  const origem = typeof window !== 'undefined' ? window.location.origin : '';
  const urlAluno = (token: string) => `${origem}/aluno/${token}`;

  return (
    <div className="flex flex-col gap-5 font-sans pb-24 bg-[#f5f7fb] min-h-screen p-4 md:p-6">
      <style>{`
        @media print {
          @page { size: A4; margin: 10mm; }
          body { background: white !important; }
          .no-print { display: none !important; }
          .print-grid { grid-template-columns: 1fr 1fr !important; gap: 8mm !important; }
          .print-card { break-inside: avoid; page-break-inside: avoid; border: 1px dashed #6b7280 !important; }
        }
      `}</style>

      <div className="no-print flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
          <QrCode className="w-6 h-6 text-primary" />
          Gerar QR Codes do Portal
        </h2>
        {gerado && alunos.length > 0 && (
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-2 py-2 px-4 rounded-xl font-bold text-sm bg-primary text-white hover:opacity-90 active:scale-95 transition-all shadow-sm"
          >
            <Printer className="w-4 h-4" /> Imprimir Tudo
          </button>
        )}
      </div>

      <div className="no-print bg-white rounded-3xl shadow-sm border border-gray-100 p-5 flex flex-col gap-4">
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">Turma</label>
          <select
            value={turma}
            onChange={(e) => setTurma(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
          >
            {turmas.length === 0 ? <option value="">Nenhuma turma</option> : null}
            {turmas.map((cr: any) => (
              <option key={cr.id} value={cr.name}>{cr.name}</option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={gerarQRCodes}
          disabled={loading || !turma}
          className="flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-base bg-primary text-white hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <QrCode className="w-5 h-5" />}
          {loading ? 'Buscando alunos...' : 'Gerar QR Codes da Turma'}
        </button>

        <p className="text-xs text-gray-500 leading-relaxed">
          Cada aluno recebe um QR Code único que abre o portal pessoal. Imprima, recorte e entregue.
          Os tokens só funcionam após rodar o SQL <code className="bg-gray-100 px-1 rounded">sql/portal_aluno.sql</code>.
        </p>
      </div>

      {erro && (
        <div className="no-print bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-sm font-medium">
          {erro}
        </div>
      )}

      {gerado && alunos.length > 0 && (
        <>
          <div className="no-print flex items-center gap-2 text-sm text-gray-600">
            <GraduationCap className="w-4 h-4" />
            <span><strong className="text-gray-900">{alunos.length}</strong> aluno(s) — Turma {turma}</span>
          </div>

          <div
            className={cn(
              'print-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3',
            )}
          >
            {alunos.map((a) => (
              <div
                key={a.id}
                className="print-card bg-white rounded-2xl border border-gray-200 shadow-sm p-3 flex flex-col items-center gap-2"
              >
                <div className="text-[10px] font-bold tracking-widest text-gray-400 uppercase w-full text-center">
                  Portal do Aluno
                </div>
                <div className="bg-white p-1.5 rounded-lg border border-gray-100">
                  <QRCodeSVG
                    value={urlAluno(a.token_acesso)}
                    size={140}
                    level="M"
                    includeMargin={false}
                  />
                </div>
                <div className="w-full text-center">
                  <p className="text-xs font-mono text-gray-400">
                    {a.numero_chamada !== null ? `Nº ${a.numero_chamada}` : '—'}
                  </p>
                  <p className="text-sm font-bold text-gray-900 leading-tight break-words">
                    {a.nome}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Turma {a.turma_id}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
