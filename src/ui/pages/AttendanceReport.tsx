import React, { useMemo, useState } from 'react';
import { useStore } from '../../store';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../data/supabase';
import { Loader2, BarChart3, AlertTriangle, FileSpreadsheet, FileText, ShieldCheck, Users, Percent, Award, Trash2, Calendar, X, BookOpen, ClipboardList } from 'lucide-react';
import { cn } from '../AppLayout';
import { useRelatorioFrequencia, type Bimestre, PONTOS_MAXIMOS, getPeriodoBimestre } from '../../domain/useRelatorioFrequencia';
import { exportarExcel, exportarPDF } from '../../domain/exportarFrequencia';
import { exportarDiario } from '../../domain/exportarDiario';
import { exportarDiarioOficial } from '../../domain/exportarDiarioOficial';

const BIMESTRES: Bimestre[] = [1, 2, 3, 4];

function normalizarTurma(turmaId: string) {
  if (/^\d+[A-Z]$/i.test(turmaId.trim())) return turmaId.trim().toUpperCase();
  const match = turmaId.match(/(\d+).*?([A-Z])$/i);
  if (match) return `${match[1]}${match[2].toUpperCase()}`;
  return turmaId.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
}

export function AttendanceReport() {
  const { classRooms } = useStore();
  const [deleting, setDeleting] = useState(false);
  const [dataFiltro, setDataFiltro] = useState<string>('');
  const [exportandoDiario, setExportandoDiario] = useState(false);
  const [exportandoDiarioOficial, setExportandoDiarioOficial] = useState(false);
  const [criandoAvaliacao, setCriandoAvaliacao] = useState(false);
  const [nomesExcluidos, setNomesExcluidos] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  // Carregar nomes excluídos (especiais + transferidos) ao montar
  React.useEffect(() => {
    async function carregarExcluidos() {
      // Especiais
      const { data: aee } = await supabase.from('alunos_especiais').select('nome');
      // Transferidos
      const { data: transf } = await supabase
        .from('notas')
        .select('nome')
        .ilike('situacao', '%transferi%');
      const nomes = new Set<string>([
        ...(aee || []).map((e: any) => e.nome.toLowerCase().trim()),
        ...(transf || []).map((e: any) => e.nome.toLowerCase().trim()),
      ]);
      setNomesExcluidos(nomes);
    }
    carregarExcluidos();
  }, []);

  const uniqueClassRooms = useMemo(
    () =>
      Array.from(new Map(classRooms.map((cr) => [cr.name, cr])).values()).sort(
        (a: any, b: any) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true }),
      ),
    [classRooms],
  );

  const [turmaId, setTurmaId] = useState<string>(uniqueClassRooms[0]?.name ?? '');
  const [bimestre, setBimestre] = useState<Bimestre>(1);

  React.useEffect(() => {
    if (!turmaId && uniqueClassRooms.length > 0) setTurmaId(uniqueClassRooms[0].name);
  }, [uniqueClassRooms, turmaId]);

  const { alunos, resumo, loading, erro, periodo, periodoEfetivo, recarregar } = useRelatorioFrequencia(
    turmaId || null,
    bimestre,
    undefined,
    dataFiltro || null,
  );

  const emRisco = alunos.filter((a) => a.em_risco || a.critico);
  const alunosCriticos = alunos.filter((a) =>
    a.critico && !nomesExcluidos.has(a.nome.toLowerCase().trim())
  );

  const handleExcel = () => exportarExcel({
    turma: turmaId, bimestre, periodo,
    periodoEfetivo, dataFiltro: dataFiltro || null,
    alunos, resumo,
  });

  const handlePDF = () => exportarPDF({
    turma: turmaId, bimestre, periodo,
    periodoEfetivo, dataFiltro: dataFiltro || null,
    alunos, resumo,
  });

  const handleDiario = async () => {
    if (alunos.length === 0) return;
    setExportandoDiario(true);
    try {
      const turmaNorm = normalizarTurma(turmaId);
      const ano = new Date().getFullYear();
      const p = getPeriodoBimestre(bimestre, ano);

      const alunoIds = alunos.map(a => a.id);

      const { data: freqData, error: freqErr } = await supabase
        .from('frequencia')
        .select('aluno_id, data, presente')
        .in('aluno_id', alunoIds)
        .gte('data', p.inicio)
        .lte('data', p.fim);

      if (freqErr) throw freqErr;

      // Agrupa por data -> alunoId -> presente
      const frequenciaPorDia: Record<string, Record<string, boolean>> = {};
      (freqData || []).forEach((r: any) => {
        if (!frequenciaPorDia[r.data]) frequenciaPorDia[r.data] = {};
        frequenciaPorDia[r.data][r.aluno_id] = r.presente;
      });

      await exportarDiario({
        turma: turmaNorm,
        bimestre,
        alunos,
        frequenciaPorDia,
      });
    } catch (e: any) {
      alert('Erro ao gerar diário: ' + e.message);
    } finally {
      setExportandoDiario(false);
    }
  };

  const handleDiarioOficial = async () => {
    if (alunos.length === 0) return;
    setExportandoDiarioOficial(true);
    try {
      const turmaNorm = normalizarTurma(turmaId);
      const ano = new Date().getFullYear();
      const p = getPeriodoBimestre(bimestre, ano);
      const alunoIds = alunos.map(a => a.id);

      const { data: freqData, error: freqErr } = await supabase
        .from('frequencia')
        .select('aluno_id, data, presente')
        .in('aluno_id', alunoIds)
        .gte('data', p.inicio)
        .lte('data', p.fim);

      if (freqErr) throw freqErr;

      const frequenciaPorDia: Record<string, Record<string, boolean>> = {};
      (freqData || []).forEach((r: any) => {
        if (!frequenciaPorDia[r.data]) frequenciaPorDia[r.data] = {};
        frequenciaPorDia[r.data][r.aluno_id] = r.presente;
      });

      await exportarDiarioOficial({
        turma: turmaNorm,
        bimestre,
        alunos,
        frequenciaPorDia,
      });
    } catch (e: any) {
      alert('Erro ao gerar diário oficial: ' + e.message);
    } finally {
      setExportandoDiarioOficial(false);
    }
  };

  const handleExcluir = async () => {
    const label = dataFiltro
      ? `do dia ${formatarBR(dataFiltro)}`
      : `do ${bimestre}º Bimestre`;
    const confirmado = window.confirm(
      `Excluir TODOS os registros de frequência da turma ${turmaId} ${label}?\n\nEsta ação não pode ser desfeita.`
    );
    if (!confirmado) return;

    setDeleting(true);
    try {
      const turmaNorm = normalizarTurma(turmaId);
      const ano = new Date().getFullYear();
      const p = dataFiltro
        ? { inicio: dataFiltro, fim: dataFiltro }
        : getPeriodoBimestre(bimestre, ano);

      const { data: alunosData, error: errAlunos } = await supabase
        .from('alunos').select('id').eq('turma_id', turmaNorm);
      if (errAlunos) throw errAlunos;

      const alunoIds = (alunosData || []).map((a: any) => a.id);
      if (alunoIds.length === 0) { alert('Nenhum aluno encontrado.'); return; }

      const { error } = await supabase
        .from('frequencia').delete()
        .in('aluno_id', alunoIds)
        .gte('data', p.inicio)
        .lte('data', p.fim);
      if (error) throw error;

      alert(`Frequência ${label} da turma ${turmaId} excluída!`);
      if (recarregar) recarregar();
    } catch (err: any) {
      alert('Erro ao excluir. Tente novamente.');
    } finally {
      setDeleting(false);
    }
  };

  async function criarAvaliacaoRecuperacao() {
    if (alunosCriticos.length === 0) return;
    setCriandoAvaliacao(true);
    try {
      const gabarito: Record<string, string> = {};
      for (let i = 1; i <= 8; i++) gabarito[String(i)] = 'A';
      const turmaNormalizada = normalizarTurma(turmaId);
      const { data: avaliacao, error } = await supabase
        .from('avaliacoes')
        .insert({
          titulo: `Recuperação ${turmaNormalizada} — ${new Date().toLocaleDateString('pt-BR')}`,
          descricao: `Alunos críticos (frequência baixa) — ${alunosCriticos.length} alunos`,
          turma_id: turmaNormalizada,
          num_questoes: 10,
          gabarito,
          valor_questao: 1.0,
        })
        .select()
        .single();
      if (error) throw error;
      const ids = alunosCriticos.map((a: any) => a.id).join(',');
      navigate(`/avaliacoes/folha/${avaliacao.id}?criticos=${ids}`);
    } catch (e: any) {
      alert('Erro ao criar avaliação: ' + e.message);
    } finally {
      setCriandoAvaliacao(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 font-sans animate-in fade-in pb-32 bg-[#f5f7fb] min-h-screen p-4 md:p-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-primary" />
          Relatório de Frequência
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" onClick={handleExcel} disabled={loading || alunos.length === 0}
            className="flex items-center gap-2 py-2 px-3 rounded-lg font-semibold text-xs bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-50 shadow-sm">
            <FileSpreadsheet className="w-4 h-4" /> Excel
          </button>
          <button type="button" onClick={handlePDF} disabled={loading || alunos.length === 0}
            className="flex items-center gap-2 py-2 px-3 rounded-lg font-semibold text-xs bg-rose-600 text-white hover:bg-rose-700 active:scale-95 transition-all disabled:opacity-50 shadow-sm">
            <FileText className="w-4 h-4" /> PDF
          </button>
          <button type="button" onClick={handleDiario} disabled={loading || exportandoDiario || alunos.length === 0}
            className="flex items-center gap-2 py-2 px-3 rounded-lg font-semibold text-xs bg-blue-700 text-white hover:bg-blue-800 active:scale-95 transition-all disabled:opacity-50 shadow-sm">
            {exportandoDiario ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
            {exportandoDiario ? 'Gerando...' : 'Di\u00e1rio'}
          </button>
          <button type="button" onClick={handleDiarioOficial} disabled={loading || exportandoDiarioOficial || alunos.length === 0}
            className="flex items-center gap-2 py-2 px-3 rounded-lg font-semibold text-xs bg-indigo-700 text-white hover:bg-indigo-800 active:scale-95 transition-all disabled:opacity-50 shadow-sm">
            {exportandoDiarioOficial ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
            {exportandoDiarioOficial ? 'Gerando...' : 'Oficial'}
          </button>
          <button type="button" onClick={handleExcluir} disabled={loading || deleting || alunos.length === 0}
            className="flex items-center gap-2 py-2 px-3 rounded-lg font-semibold text-xs bg-gray-800 text-white hover:bg-gray-900 active:scale-95 transition-all disabled:opacity-50 shadow-sm">
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            {deleting ? 'Excluindo...' : 'Limpar'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5">
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Turma</label>
            <select value={turmaId} onChange={(e) => setTurmaId(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none">
              {uniqueClassRooms.length === 0 ? <option value="">Nenhuma turma</option> : null}
              {uniqueClassRooms.map((cr: any) => <option key={cr.id} value={cr.name}>{cr.name}</option>)}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Bimestre</label>
            <div className="grid grid-cols-4 gap-2">
              {BIMESTRES.map((b) => (
                <button key={b} type="button" onClick={() => setBimestre(b)}
                  className={cn('py-2 rounded-xl text-sm font-bold border transition-all active:scale-95',
                    bimestre === b ? 'bg-primary text-white border-primary shadow-sm' : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100')}>
                  {b}º Bim
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Filtro de data específica */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center gap-3">
            <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
            <div className="flex-1">
              <label className="text-xs font-semibold text-gray-500 block mb-1">
                Filtrar por data específica <span className="text-gray-400 font-normal">(opcional — não afeta o Diário)</span>
              </label>
              <div className="flex items-center gap-2">
                <input type="date" value={dataFiltro} onChange={(e) => setDataFiltro(e.target.value)}
                  className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none" />
                {dataFiltro && (
                  <button onClick={() => setDataFiltro('')}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100 border border-red-200">
                    <X className="w-3.5 h-3.5" /> Limpar filtro
                  </button>
                )}
              </div>
            </div>
          </div>
          {dataFiltro && (
            <div className="mt-2 flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2">
              <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <p className="text-xs text-blue-700 font-medium">
                Mostrando apenas a chamada do dia <strong>{formatarBR(dataFiltro)}</strong>
              </p>
            </div>
          )}
        </div>

        <p className="text-[11px] text-gray-400 mt-3">
          {dataFiltro
            ? `Data: ${formatarBR(dataFiltro)}`
            : `Período: ${formatarBR(periodo.inicio)} a ${formatarBR(periodo.fim)} • ${PONTOS_MAXIMOS} aulas • ${PONTOS_MAXIMOS * 0.5} pts máx`}
        </p>
      </div>

      {erro ? <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-sm">{erro}</div> : null}

      {loading ? (
        <div className="flex flex-col gap-2 items-center justify-center py-20 text-gray-500">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="text-sm font-medium">Analisando dados...</span>
        </div>
      ) : alunos.length === 0 ? (
        <div className="text-center text-gray-500 py-10 font-medium bg-white rounded-2xl border border-gray-100 shadow-sm">
          Nenhum aluno encontrado para essa turma.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <ResumoCard icon={<Users className="w-4 h-4" />} label="Alunos" value={resumo.total_alunos} tone="neutral" />
            <ResumoCard icon={<Percent className="w-4 h-4" />} label="Freq. média" value={`${resumo.media_percentual}%`} tone="primary" />
            <ResumoCard icon={<Award className="w-4 h-4" />} label="Pontos médios" value={resumo.media_pontos} tone="primary" />
            <ResumoCard icon={<ShieldCheck className="w-4 h-4" />} label="OK" value={resumo.total_ok} tone="success" />
            <ResumoCard icon={<AlertTriangle className="w-4 h-4" />} label="Em risco / Crítico" value={`${resumo.total_em_risco} / ${resumo.total_criticos}`} tone={resumo.total_criticos > 0 ? 'danger' : 'warning'} />
          </div>

          {emRisco.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-3xl p-4 md:p-5">
              <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  <h3 className="font-bold text-amber-900 text-sm">Alunos em risco ({emRisco.length})</h3>
                </div>
                {alunosCriticos.length > 0 && (
                  <button
                    onClick={criarAvaliacaoRecuperacao}
                    disabled={criandoAvaliacao}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 text-white rounded-xl text-xs font-bold disabled:opacity-60"
                  >
                    <ClipboardList className="w-3.5 h-3.5" />
                    {criandoAvaliacao ? 'Criando...' : `Criar prova (${alunosCriticos.length} críticos)`}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {emRisco.map((a) => (
                  <span key={a.id}
                    className={cn('inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border',
                      a.critico ? 'bg-red-100 text-red-800 border-red-200' : 'bg-amber-100 text-amber-800 border-amber-200')}
                    title={`${a.percentual}% de presença`}>
                    {a.numero_chamada ? `${a.numero_chamada} ` : ''}{a.nome}
                    <span className="font-mono opacity-80">{a.percentual.toFixed(0)}%</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="hidden md:block w-full overflow-x-auto rounded-3xl border border-gray-100 shadow-sm bg-white">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-100 text-gray-600 text-xs uppercase font-bold tracking-wider">
                <tr>
                  <th className="px-5 py-4 min-w-[220px]">Aluno</th>
                  <th className="px-4 py-4 text-center">Aulas</th>
                  <th className="px-4 py-4 text-center">Faltas</th>
                  <th className="px-4 py-4 text-center">Pontos</th>
                  <th className="px-4 py-4 min-w-[200px]">Frequência</th>
                  <th className="px-4 py-4 text-center">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {alunos.map((a) => (
                  <tr key={a.id} className={cn('transition-colors',
                    a.critico ? 'bg-red-50/60 hover:bg-red-100/50' : a.em_risco ? 'bg-amber-50/60 hover:bg-amber-100/50' : 'hover:bg-cyan-50/40 odd:bg-white even:bg-gray-50/30')}>
                    <td className="px-5 py-3 font-semibold text-gray-900">
                      <div className="flex items-center gap-2">
                        {a.numero_chamada ? <span className="font-mono text-gray-400 text-xs w-6 text-right">{a.numero_chamada}</span> : <span className="w-6" />}
                        <span>{a.nome}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-700 font-semibold">{a.registros_total}</td>
                    <td className="px-4 py-3 text-center text-rose-600 font-semibold">{a.ausentes}</td>
                    <td className="px-4 py-3 text-center font-bold text-gray-900">{a.pontos.toFixed(1).replace('.', ',')}</td>
                    <td className="px-4 py-3"><BarraProgresso percentual={a.percentual} critico={a.critico} emRisco={a.em_risco} /></td>
                    <td className="px-4 py-3 text-center"><BadgeSituacao aluno={a} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden flex flex-col gap-3">
            {alunos.map((a) => (
              <div key={a.id} className={cn('p-4 rounded-2xl shadow-sm border flex flex-col gap-3',
                a.critico ? 'bg-red-50 border-red-200' : a.em_risco ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-100')}>
                <div className="flex justify-between items-start gap-2">
                  <span className="font-bold text-gray-900 text-sm">{a.numero_chamada ? `${a.numero_chamada} - ` : ''}{a.nome}</span>
                  <BadgeSituacao aluno={a} />
                </div>
                <div className="flex justify-between text-xs font-medium text-gray-600">
                  <span>Aulas: {a.registros_total}</span>
                  <span className="text-rose-600 font-semibold">Faltas: {a.ausentes}</span>
                  <span className="text-gray-900 font-bold">{a.pontos.toFixed(1).replace('.', ',')} pts</span>
                </div>
                <BarraProgresso percentual={a.percentual} critico={a.critico} emRisco={a.em_risco} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function formatarBR(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function ResumoCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: React.ReactNode; tone: 'neutral' | 'primary' | 'success' | 'warning' | 'danger' }) {
  const tones = { neutral: 'text-gray-700', primary: 'text-primary', success: 'text-emerald-600', warning: 'text-amber-600', danger: 'text-rose-600' };
  async function criarAvaliacaoRecuperacao() {
    if (alunosCriticos.length === 0) return;
    setCriandoAvaliacao(true);
    try {
      const gabarito: Record<string, string> = {};
      for (let i = 1; i <= 8; i++) gabarito[String(i)] = 'A';
      const turmaNormalizada = normalizarTurma(turmaId);
      const { data: avaliacao, error } = await supabase
        .from('avaliacoes')
        .insert({
          titulo: `Recuperação ${turmaNormalizada} — ${new Date().toLocaleDateString('pt-BR')}`,
          descricao: `Alunos críticos (frequência baixa) — ${alunosCriticos.length} alunos`,
          turma_id: turmaNormalizada,
          num_questoes: 10,
          gabarito,
          valor_questao: 1.0,
        })
        .select()
        .single();
      if (error) throw error;
      const ids = alunosCriticos.map((a: any) => a.id).join(',');
      navigate(`/avaliacoes/folha/${avaliacao.id}?criticos=${ids}`);
    } catch (e: any) {
      alert('Erro ao criar avaliação: ' + e.message);
    } finally {
      setCriandoAvaliacao(false);
    }
  }

  return (
    <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
      <div className={cn('flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide', tones[tone])}>{icon}{label}</div>
      <p className={cn('text-2xl font-bold mt-1', tones[tone])}>{value}</p>
    </div>
  );
}

function BarraProgresso({ percentual, critico, emRisco }: { percentual: number; critico: boolean; emRisco: boolean }) {
  const cor = critico ? 'bg-rose-500' : emRisco ? 'bg-amber-500' : 'bg-emerald-500';
  const fundo = critico ? 'bg-rose-100' : emRisco ? 'bg-amber-100' : 'bg-emerald-100';
  async function criarAvaliacaoRecuperacao() {
    if (alunosCriticos.length === 0) return;
    setCriandoAvaliacao(true);
    try {
      const gabarito: Record<string, string> = {};
      for (let i = 1; i <= 8; i++) gabarito[String(i)] = 'A';
      const turmaNormalizada = normalizarTurma(turmaId);
      const { data: avaliacao, error } = await supabase
        .from('avaliacoes')
        .insert({
          titulo: `Recuperação ${turmaNormalizada} — ${new Date().toLocaleDateString('pt-BR')}`,
          descricao: `Alunos críticos (frequência baixa) — ${alunosCriticos.length} alunos`,
          turma_id: turmaNormalizada,
          num_questoes: 10,
          gabarito,
          valor_questao: 1.0,
        })
        .select()
        .single();
      if (error) throw error;
      const ids = alunosCriticos.map((a: any) => a.id).join(',');
      navigate(`/avaliacoes/folha/${avaliacao.id}?criticos=${ids}`);
    } catch (e: any) {
      alert('Erro ao criar avaliação: ' + e.message);
    } finally {
      setCriandoAvaliacao(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <div className={cn('flex-1 h-2.5 rounded-full overflow-hidden', fundo)}>
        <div className={cn('h-full transition-all', cor)} style={{ width: `${Math.max(0, Math.min(100, percentual))}%` }} />
      </div>
      <span className="text-xs font-bold text-gray-700 w-12 text-right">{percentual.toFixed(1).replace('.', ',')}%</span>
    </div>
  );
}

function BadgeSituacao({ aluno }: { aluno: { critico: boolean; em_risco: boolean; registros_total: number } }) {
  if (aluno.registros_total === 0) return <span className="px-2 py-1 rounded-full text-[10px] font-bold text-gray-600 bg-gray-200">Sem dados</span>;
  if (aluno.critico) return <span className="px-2 py-1 rounded-full text-[10px] font-bold text-white bg-rose-500">Crítico</span>;
  if (aluno.em_risco) return <span className="px-2 py-1 rounded-full text-[10px] font-bold text-white bg-amber-500">Em risco</span>;
  return <span className="px-2 py-1 rounded-full text-[10px] font-bold text-white bg-emerald-500">OK</span>;
}
