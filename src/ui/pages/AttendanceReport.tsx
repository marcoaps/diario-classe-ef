import React, { useMemo, useState } from 'react';
import { useStore } from '../../store';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../data/supabase';
import { Loader2, BarChart3, AlertTriangle, FileSpreadsheet, FileText, ShieldCheck, Users, Percent, Award, Trash2, Calendar, X, BookOpen, ClipboardList, Download, ChevronDown } from 'lucide-react';
import { cn } from '../AppLayout';
import { useRelatorioFrequencia, type Bimestre, PONTOS_MAXIMOS, getPeriodoBimestre, bimestreAtual } from '../../domain/useRelatorioFrequencia';
import { exportarExcel, exportarPDF } from '../../domain/exportarFrequencia';
import { situacoesEfetivasDaTurma } from '../../domain/situacaoAluno';
import { exportarDiario } from '../../domain/exportarDiario';
import { exportarDiarioOficial } from '../../domain/exportarDiarioOficial';

const BIMESTRES: Bimestre[] = [1, 2, 3, 4];

function normalizarTurma(turmaId: string) {
  if (/^\d+[A-Z]$/i.test(turmaId.trim())) return turmaId.trim().toUpperCase();
  const match = turmaId.match(/(\d+).*?([A-Z])$/i);
  if (match) return `${match[1]}${match[2].toUpperCase()}`;
  return turmaId.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
}

const LETRAS = ['A', 'B', 'C', 'D'];
const GABARITO_INICIAL: Record<string, string> = {'1':'A','2':'A','3':'A','4':'A','5':'A','6':'A','7':'A','8':'A'};


const PARTICULAS = new Set(['de','da','das','do','dos','e','em','no','na','nos','nas']);
function formatarNome(nome: string): string {
  return nome.toLowerCase().split(' ').map((p, i) =>
    i > 0 && PARTICULAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)
  ).join(' ');
}
export function AttendanceReport() {
  const { classRooms } = useStore();
  const [deleting, setDeleting] = useState(false);
  const [menuExportar, setMenuExportar] = useState(false);
  const [dataFiltro, setDataFiltro] = useState<string>('');
  const [exportandoDiario, setExportandoDiario] = useState(false);
  const [exportandoDiarioOficial, setExportandoDiarioOficial] = useState(false);
  const [criandoAvaliacao, setCriandoAvaliacao] = useState(false);
  const [calculandoNota, setCalculandoNota] = useState(false);
  const [notasCalculadas, setNotasCalculadas] = useState(false);
  const [nomesExcluidos, setNomesExcluidos] = useState<Set<string>>(new Set());
  const [nomesAEE, setNomesAEE] = useState<Set<string>>(new Set());
  const [nomesTransferidos, setNomesTransferidos] = useState<Set<string>>(new Set());
  const [showGabarito, setShowGabarito] = useState(false);
  const [temaProva, setTemaProva] = useState('');
  const [gabaritoInput, setGabaritoInput] = useState<Record<string, string>>({...GABARITO_INICIAL});
  const navigate = useNavigate();


  const uniqueClassRooms = useMemo(
    () => Array.from(new Map(classRooms.map((cr) => [cr.name, cr])).values()).sort(
      (a: any, b: any) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true }),
    ),
    [classRooms],
  );

  const [turmaId, setTurmaId] = useState<string>(uniqueClassRooms[0]?.name ?? '');
  const [bimestre, setBimestre] = useState<Bimestre>(() => bimestreAtual());

  // Transferidos/remanejados DESTA turma. Antes era só por nome em todas as
  // turmas — aluno remanejado de outra turma saía como "Transf." também na
  // turma nova. Agora vale a situação da turma selecionada (ver situacaoAluno.ts).
  React.useEffect(() => {
    let mounted = true;
    async function carregarExcluidos() {
      const norm = (s: string) => s.toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '');
      const turmaNorm = turmaId ? normalizarTurma(turmaId) : '';
      const [{ data: aee }, { data: transf }] = await Promise.all([
        supabase.from('alunos_especiais').select('nome'),
        supabase.from('notas').select('nome, turma, situacao, data_situacao').or('situacao.ilike.%transferi%,situacao.ilike.%remanej%'),
      ]);
      const linhas = transf || [];
      const situacoes = situacoesEfetivasDaTurma(
        linhas.filter((l: any) => l.turma === turmaNorm),
        linhas.filter((l: any) => l.turma !== turmaNorm && l.situacao?.toLowerCase().includes('remanej')),
      );
      const aeeSet = new Set<string>((aee || []).map((e: any) => norm(e.nome as string)));
      const transfSet = new Set<string>(Array.from(situacoes.keys()).map(norm));
      if (!mounted) return;
      setNomesAEE(aeeSet);
      setNomesTransferidos(transfSet);
      setNomesExcluidos(new Set<string>([...aeeSet, ...transfSet]));
    }
    carregarExcluidos();
    return () => { mounted = false; };
  }, [turmaId]);

  React.useEffect(() => {
    if (!turmaId && uniqueClassRooms.length > 0) setTurmaId(uniqueClassRooms[0].name);
  }, [uniqueClassRooms, turmaId]);

  const { alunos, resumo, loading, erro, periodo, periodoEfetivo, recarregar } = useRelatorioFrequencia(
    turmaId || null, bimestre, undefined, dataFiltro || null,
  );

  const [notasTrabalhosPorAluno, setNotasTrabalhosPorAluno] = useState<Record<string, number>>({});

  React.useEffect(() => {
    let mounted = true;
    async function carregarNotasTrabalhos() {
      if (!turmaId) { setNotasTrabalhosPorAluno({}); return; }
      const turmaNorm = normalizarTurma(turmaId);
      const { data: trabalhosData } = await supabase
        .from('trabalhos').select('id').eq('turma', turmaNorm).eq('bimestre', bimestre);
      const trabalhoIds = (trabalhosData || []).map((t: any) => t.id);
      if (trabalhoIds.length === 0) { if (mounted) setNotasTrabalhosPorAluno({}); return; }
      const { data: registrosData } = await supabase
        .from('trabalhos_registros').select('aluno_id, nota').in('trabalho_id', trabalhoIds);
      const soma: Record<string, number> = {};
      (registrosData || []).forEach((r: any) => {
        if (r.nota !== null) soma[r.aluno_id] = (soma[r.aluno_id] || 0) + Number(r.nota);
      });
      if (mounted) setNotasTrabalhosPorAluno(soma);
    }
    carregarNotasTrabalhos();
    return () => { mounted = false; };
  }, [turmaId, bimestre]);

  const emRisco = alunos.filter((a) => a.em_risco || a.critico);
  const alunosCriticos = alunos.filter((a) =>
    a.registros_total > 0 && a.percentual === 0 && !nomesExcluidos.has(a.nome.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
  );

  const handleExcel = () => exportarExcel({ turma: turmaId, bimestre, periodo, periodoEfetivo, dataFiltro: dataFiltro || null, alunos, resumo, nomesAEE, nomesTransferidos, notasTrabalhosPorAluno });
  const handlePDF   = () => exportarPDF({ turma: turmaId, bimestre, periodo, periodoEfetivo, dataFiltro: dataFiltro || null, alunos, resumo });

  const handleDiario = async () => {
    if (alunos.length === 0) return;
    setExportandoDiario(true);
    try {
      const turmaNorm = normalizarTurma(turmaId);
      const ano = new Date().getFullYear();
      const p = getPeriodoBimestre(bimestre, ano);
      const alunoIds = alunos.map(a => a.id);
      const { data: freqData, error: freqErr } = await supabase.from('frequencia').select('aluno_id, data, presente').in('aluno_id', alunoIds).gte('data', p.inicio).lte('data', p.fim);
      if (freqErr) throw freqErr;
      const frequenciaPorDia: Record<string, Record<string, boolean>> = {};
      (freqData || []).forEach((r: any) => { if (!frequenciaPorDia[r.data]) frequenciaPorDia[r.data] = {}; frequenciaPorDia[r.data][r.aluno_id] = r.presente; });
      await exportarDiario({ turma: turmaNorm, bimestre, alunos, frequenciaPorDia });
    } catch (e: any) { alert('Erro ao gerar diário: ' + e.message); }
    finally { setExportandoDiario(false); }
  };

  const handleDiarioOficial = async () => {
    if (alunos.length === 0) return;
    setExportandoDiarioOficial(true);
    try {
      const turmaNorm = normalizarTurma(turmaId);
      const ano = new Date().getFullYear();
      const p = getPeriodoBimestre(bimestre, ano);
      const alunoIds = alunos.map(a => a.id);
      const { data: freqData, error: freqErr } = await supabase.from('frequencia').select('aluno_id, data, presente').in('aluno_id', alunoIds).gte('data', p.inicio).lte('data', p.fim);
      if (freqErr) throw freqErr;
      const frequenciaPorDia: Record<string, Record<string, boolean>> = {};
      (freqData || []).forEach((r: any) => { if (!frequenciaPorDia[r.data]) frequenciaPorDia[r.data] = {}; frequenciaPorDia[r.data][r.aluno_id] = r.presente; });
      await exportarDiarioOficial({ turma: turmaNorm, bimestre, alunos, frequenciaPorDia });
    } catch (e: any) { alert('Erro ao gerar diário oficial: ' + e.message); }
    finally { setExportandoDiarioOficial(false); }
  };

  const handleExcluir = async () => {
    const label = dataFiltro ? `do dia ${formatarBR(dataFiltro)}` : `do ${bimestre}º Bimestre`;
    if (!window.confirm(`Excluir TODOS os registros de frequência da turma ${turmaId} ${label}?\n\nEsta ação não pode ser desfeita.`)) return;
    setDeleting(true);
    try {
      const turmaNorm = normalizarTurma(turmaId);
      const ano = new Date().getFullYear();
      const p = dataFiltro ? { inicio: dataFiltro, fim: dataFiltro } : getPeriodoBimestre(bimestre, ano);
      const { data: alunosData, error: errAlunos } = await supabase.from('alunos').select('id').eq('turma_id', turmaNorm);
      if (errAlunos) throw errAlunos;
      const alunoIds = (alunosData || []).map((a: any) => a.id);
      if (alunoIds.length === 0) { alert('Nenhum aluno encontrado.'); return; }
      const { error } = await supabase.from('frequencia').delete().in('aluno_id', alunoIds).gte('data', p.inicio).lte('data', p.fim);
      if (error) throw error;
      alert(`Frequência ${label} da turma ${turmaId} excluída!`);
      if (recarregar) recarregar();
    } catch (err: any) { alert('Erro ao excluir. Tente novamente.'); }
    finally { setDeleting(false); }
  };

  async function criarAvaliacaoRecuperacao() {
    if (alunosCriticos.length === 0) return;
    setCriandoAvaliacao(true);
    setShowGabarito(false);
    try {
      const turmaNormalizada = normalizarTurma(turmaId);
      const { data: avaliacao, error } = await supabase.from('avaliacoes').insert({
        titulo: `${temaProva.trim() || 'Avaliação'} – ${turmaNormalizada} – ${bimestre}ºBimestre – ${new Date().getFullYear()}`,
        descricao: `Alunos críticos (sem presença) – ${alunosCriticos.length} alunos`,
        turma_id: turmaNormalizada,
        num_questoes: 10,
        gabarito: gabaritoInput,
        valor_questao: 1.0,
      }).select().single();
      if (error) throw error;
      const ids = alunosCriticos.map((a: any) => a.id).join(',');
      navigate(`/avaliacoes/folha/${avaliacao.id}?criticos=${ids}`);
    } catch (e: any) { alert('Erro ao criar avaliação: ' + e.message); }
    finally { setCriandoAvaliacao(false); }
  }

  // Nota total = pontos de frequência (0 a 0,35 por aula, conforme o nível
  // de participação: NP 0,20 / PP 0,275 / PI e PA 0,35 / NPJ e AUS 0 — já
  // calculado em a.pontos) + soma das notas de trabalhos do bimestre. Sem
  // teto durante o bimestre (nota parcial acumulando); o teto de 10,0 só é
  // aplicado no fechamento, ao calcular e salvar em "notas.nota_ef".
  function notaTotal(pontos: number, somaTrabalhos: number, comTeto: boolean): number {
    const total = pontos + somaTrabalhos;
    return comTeto ? Math.min(total, 10.0) : total;
  }

  function normNome(s: string) { return s.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g,''); }

  async function calcularESalvarNotasEf() {
    if (alunos.length === 0) return;
    if (!window.confirm(`Calcular e salvar nota_ef para ${alunos.length} alunos da turma ${turmaId} (2º Bimestre)?\n\nIsso irá atualizar o campo nota_ef de cada aluno com pontos de frequência + nota de trabalho, limitado a 10,0.`)) return;
    setCalculandoNota(true);
    setNotasCalculadas(false);
    try {
      const turmaNorm = normalizarTurma(turmaId);
      const updates = alunos
        .filter(a => a.registros_total > 0)
        .map(a => ({
          turma: turmaNorm,
          bimestre: 2,
          nome: a.nome,
          numero: a.numero_chamada ?? 0,
          nota_ef: notaTotal(a.pontos, notasTrabalhosPorAluno[a.id] ?? 0, true),
        }));
      if (updates.length === 0) { alert('Nenhum aluno com registros de frequência.'); return; }
      const { error } = await supabase
        .from('notas')
        .upsert(updates, { onConflict: 'turma,bimestre,nome' });
      if (error) throw error;
      setNotasCalculadas(true);
      setTimeout(() => setNotasCalculadas(false), 4000);
    } catch (e: any) {
      alert('Erro ao salvar notas: ' + e.message);
    } finally {
      setCalculandoNota(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 font-sans animate-in fade-in pb-8 bg-background p-4 md:p-6 md:relative md:left-1/2 md:-translate-x-1/2 md:w-[min(1100px,96vw)]">
      <div className="flex items-center justify-between gap-3 relative">
        <h2 className="text-xl font-extrabold tracking-tight text-on-surface">Frequência</h2>
        <button
          type="button"
          onClick={() => setMenuExportar(m => !m)}
          className="h-11 px-4 rounded-[14px] bg-[#0B6B3A] text-white text-[13px] font-extrabold flex items-center gap-1.5 active:scale-95 transition-all"
        >
          <Download className="w-4 h-4" /> Exportar <ChevronDown className="w-4 h-4" />
        </button>
        {menuExportar && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setMenuExportar(false)} />
            <div className="absolute right-0 top-12 z-40 w-64 bg-white rounded-2xl border border-outline-variant shadow-xl overflow-hidden flex flex-col">
              <button type="button" onClick={() => { setMenuExportar(false); handleExcel(); }} disabled={loading || alunos.length === 0} className="flex items-center gap-3 px-4 py-3 text-sm font-semibold text-left active:bg-surface-container disabled:opacity-50"><FileSpreadsheet className="w-4 h-4 text-[#0B6B3A]" /> Nota {bimestre}BIM-{new Date().getFullYear()} (Excel)</button>
              <button type="button" onClick={() => { setMenuExportar(false); handlePDF(); }} disabled={loading || alunos.length === 0} className="flex items-center gap-3 px-4 py-3 text-sm font-semibold text-left border-t border-surface-container active:bg-surface-container disabled:opacity-50"><FileText className="w-4 h-4 text-[#0B6B3A]" /> PDF</button>
              <button type="button" onClick={() => { setMenuExportar(false); handleDiario(); }} disabled={loading || exportandoDiario || alunos.length === 0} className="flex items-center gap-3 px-4 py-3 text-sm font-semibold text-left border-t border-surface-container active:bg-surface-container disabled:opacity-50">
                {exportandoDiario ? <Loader2 className="w-4 h-4 animate-spin text-[#0B6B3A]" /> : <BookOpen className="w-4 h-4 text-[#0B6B3A]" />}
                {exportandoDiario ? 'Gerando...' : 'Diário'}
              </button>
              <button type="button" onClick={() => { setMenuExportar(false); handleDiarioOficial(); }} disabled={loading || exportandoDiarioOficial || alunos.length === 0} className="flex items-center gap-3 px-4 py-3 text-sm font-semibold text-left border-t border-surface-container active:bg-surface-container disabled:opacity-50">
                {exportandoDiarioOficial ? <Loader2 className="w-4 h-4 animate-spin text-[#0B6B3A]" /> : <FileSpreadsheet className="w-4 h-4 text-[#0B6B3A]" />}
                {exportandoDiarioOficial ? 'Gerando...' : 'Diário oficial'}
              </button>
              <button type="button" onClick={() => { setMenuExportar(false); calcularESalvarNotasEf(); }} disabled={loading || calculandoNota || alunos.length === 0} className="flex items-center gap-3 px-4 py-3 text-sm font-semibold text-left border-t border-surface-container active:bg-surface-container disabled:opacity-50">
                {calculandoNota ? <Loader2 className="w-4 h-4 animate-spin text-[#0B6B3A]" /> : <BarChart3 className="w-4 h-4 text-[#0B6B3A]" />}
                {calculandoNota ? 'Calculando...' : 'Calcular e salvar Nota EF'}
              </button>
              <button type="button" onClick={() => { setMenuExportar(false); handleExcluir(); }} disabled={loading || deleting || alunos.length === 0} className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-left text-[#B42318] border-t border-surface-container active:bg-[#FDECEA] disabled:opacity-50">
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {deleting ? 'Excluindo...' : 'Limpar frequência'}
              </button>
            </div>
          </>
        )}
      </div>
      {notasCalculadas && <p className="text-xs font-bold text-[#0B6B3A] bg-[#E3F2EA] rounded-xl px-3 py-2">Notas salvas!</p>}

      <div className="bg-white rounded-[18px] border border-outline-variant p-4">
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Turma</label>
            <select value={turmaId} onChange={(e) => setTurmaId(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none">
              {uniqueClassRooms.length === 0 ? <option value="">Nenhuma turma</option> : null}
              {uniqueClassRooms.map((cr: any) => <option key={cr.id} value={cr.name}>{cr.name}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Bimestre</label>
            <div className="flex bg-surface-container rounded-xl p-[3px] h-11">
              {BIMESTRES.map((b) => (
                <button key={b} type="button" onClick={() => setBimestre(b)}
                  className={cn('flex-1 rounded-[9px] text-[13px] transition-all',
                    bimestre === b ? 'bg-[#0B6B3A] text-white font-extrabold' : 'text-on-surface-variant font-bold')}>
                  {b}º
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center gap-3">
            <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
            <div className="flex-1">
              <label className="text-xs font-semibold text-gray-500 block mb-1">
                Filtrar por data específica <span className="text-gray-400 font-normal">(opcional – não afeta o Diário)</span>
              </label>
              <div className="flex items-center gap-2">
                <input type="date" value={dataFiltro} onChange={(e) => setDataFiltro(e.target.value)} className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none" />
                {dataFiltro && (
                  <button onClick={() => setDataFiltro('')} className="flex items-center gap-1 px-3 py-2 rounded-xl bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100 border border-red-200">
                    <X className="w-3.5 h-3.5" /> Limpar filtro
                  </button>
                )}
              </div>
            </div>
          </div>
          {dataFiltro && (
            <div className="mt-2 flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2">
              <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <p className="text-xs text-blue-700 font-medium">Mostrando apenas a chamada do dia <strong>{formatarBR(dataFiltro)}</strong></p>
            </div>
          )}
        </div>
        <p className="text-[11px] text-gray-400 mt-3">
          {dataFiltro ? `Data: ${formatarBR(dataFiltro)}` : `Período: ${formatarBR(periodo.inicio)} a ${formatarBR(periodo.fim)} • ${PONTOS_MAXIMOS} aulas • ${PONTOS_MAXIMOS * 0.5} pts máx`}
        </p>
      </div>

      {erro ? <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-sm">{erro}</div> : null}

      {loading ? (
        <div className="flex flex-col gap-2 items-center justify-center py-20 text-gray-500">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="text-sm font-medium">Analisando dados...</span>
        </div>
      ) : alunos.length === 0 ? (
        <div className="text-center text-gray-500 py-10 font-medium bg-white rounded-2xl border border-gray-100 shadow-sm">Nenhum aluno encontrado para essa turma.</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <ResumoCard icon={<Users className="w-4 h-4" />} label="Alunos" value={resumo.total_alunos} tone="neutral" />
            <ResumoCard icon={<Percent className="w-4 h-4" />} label="Freq. média" value={`${resumo.media_percentual}%`} tone="primary" />
            <ResumoCard icon={<Award className="w-4 h-4" />} label="Pontos médios" value={resumo.media_pontos} tone="primary" />
            <ResumoCard icon={<ShieldCheck className="w-4 h-4" />} label="OK" value={resumo.total_ok} tone="success" />
            <ResumoCard icon={<AlertTriangle className="w-4 h-4" />} label="Em risco / Crítico" value={`${resumo.total_em_risco} / ${resumo.total_criticos}`} tone={resumo.total_criticos > 0 ? 'danger' : 'warning'} />
          </div>

          {/* Contadores por nível de participação — nunca mistura AUS com NP/NPJ */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {[
              { sigla: 'PI', label: 'Participação Integral', valor: resumo.total_pi, cor: 'bg-teal-50 text-teal-700 border-teal-200' },
              { sigla: 'PP', label: 'Participação Parcial', valor: resumo.total_pp, cor: 'bg-amber-50 text-amber-700 border-amber-200' },
              { sigla: 'NP', label: 'Não Participou', valor: resumo.total_np, cor: 'bg-red-50 text-red-700 border-red-200',
                sub: resumo.total_np > 0 ? `${resumo.total_np - resumo.total_np_com_trabalho} sem trabalho` : undefined },
              { sigla: 'PA', label: 'Participação Adaptada', valor: resumo.total_pa, cor: 'bg-blue-50 text-blue-700 border-blue-200' },
              { sigla: 'NPJ', label: 'Não Participou — Justificado', valor: resumo.total_npj, cor: 'bg-purple-50 text-purple-700 border-purple-200' },
              { sigla: 'AUS', label: 'Ausente', valor: resumo.total_aus, cor: 'bg-gray-100 text-gray-600 border-gray-200' },
            ].map(item => (
              <div key={item.sigla} title={item.label} className={cn('rounded-xl border p-2.5 text-center', item.cor)}>
                <p className="text-[10px] font-bold uppercase tracking-wide">{item.sigla}</p>
                <p className="text-lg font-bold">{item.valor}</p>
                {'sub' in item && item.sub && <p className="text-[9px] font-semibold opacity-70 leading-tight">{item.sub}</p>}
              </div>
            ))}
          </div>

          {emRisco.length > 0 && (
            <div className="bg-[#FFF5F4] border border-[#F1C7C2] rounded-[18px] p-4">
              <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                <div className="flex items-center gap-2.5">
                  <span className="w-9 h-9 rounded-[10px] bg-[#C2352B] text-white flex items-center justify-center"><AlertTriangle className="w-[18px] h-[18px]" /></span>
                  <h3 className="font-extrabold text-[#7A1A12] text-[15px]">{emRisco.length} alunos em risco</h3>
                </div>
                {alunosCriticos.length > 0 && (
                  <button
                    onClick={() => { setShowGabarito(g => !g); setGabaritoInput({...GABARITO_INICIAL}); setTemaProva(''); }}
                    disabled={criandoAvaliacao}
                    className="flex items-center gap-1.5 px-3 h-11 bg-[#C2352B] text-white rounded-xl text-xs font-extrabold disabled:opacity-60"
                  >
                    <ClipboardList className="w-3.5 h-3.5" />
                    {criandoAvaliacao ? 'Criando...' : `Criar prova (${alunosCriticos.length} críticos)`}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {emRisco.map((a) => (
                  <span key={a.id}
                    className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border bg-white',
                      a.percentual === 0 && a.registros_total > 0 ? 'text-[#7A1A12] border-[#F1C7C2]' : 'text-amber-800 border-amber-200')}
                    title={`${a.percentual}% de presença`}>
                    {a.numero_chamada ? `${a.numero_chamada} ` : ''}{formatarNome(a.nome)}
                    <span className="font-mono opacity-80">{a.percentual.toFixed(0)}%</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Painel de gabarito manual */}
          {showGabarito && (
            <div className="bg-white rounded-3xl border border-rose-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">Gabarito da prova</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Selecione a alternativa correta para cada questão</p>
                </div>
                <button onClick={() => setShowGabarito(false)} className="text-gray-400 hover:text-gray-600 p-1"><X className="w-4 h-4" /></button>
              </div>
              <div className="mb-4">
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Tema da prova <span className="text-gray-400 font-normal">(usado pela IA para gerar enunciados e texto de apoio)</span>
                </label>
                <input
                  type="text"
                  value={temaProva}
                  onChange={e => setTemaProva(e.target.value)}
                  placeholder="Ex: Voleibol, Futsal, Atletismo, Saúde e Qualidade de Vida..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none bg-gray-50"
                />
              </div>
              <div className="grid grid-cols-2 gap-3 mb-5">
                {[1,2,3,4,5,6,7,8].map(n => (
                  <div key={n} className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-500 w-5 shrink-0">Q{n}</span>
                    {LETRAS.map(l => (
                      <button key={l}
                        type="button"
                        onClick={() => setGabaritoInput(prev => ({...prev, [String(n)]: l}))}
                        className={cn(
                          'w-9 h-9 rounded-full text-xs font-bold border transition-all active:scale-95',
                          gabaritoInput[String(n)] === l
                            ? 'bg-primary text-white border-primary shadow-sm'
                            : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
                        )}
                      >{l}</button>
                    ))}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                {[1,2,3,4,5,6,7,8].map(n => (
                  <span key={n} className="inline-flex items-center gap-1 bg-gray-100 rounded-lg px-2 py-1 text-xs font-mono">
                    <span className="text-gray-500">Q{n}:</span>
                    <span className="font-bold text-primary">{gabaritoInput[String(n)]}</span>
                  </span>
                ))}
              </div>
              <button
                type="button"
                onClick={criarAvaliacaoRecuperacao}
                disabled={criandoAvaliacao}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-rose-600 text-white font-bold text-sm disabled:opacity-60 hover:bg-rose-700 active:scale-95 transition-all"
              >
                <ClipboardList className="w-4 h-4" />
                {criandoAvaliacao ? 'Criando...' : `Confirmar e criar prova (${alunosCriticos.length} alunos)`}
              </button>
            </div>
          )}

          <div className="hidden md:block w-full overflow-x-auto rounded-3xl border border-gray-100 shadow-sm bg-white">
            <table className="w-full text-sm text-left" style={{minWidth:"900px"}}>
              <thead className="bg-gray-100 text-gray-600 text-xs uppercase font-bold tracking-wider">
                <tr>
                  <th className="px-5 py-4 min-w-[220px]">Aluno</th>
                  <th className="px-4 py-4 text-center">Aulas</th>
                  <th className="px-4 py-4 text-center">Faltas</th>
                  <th className="px-4 py-4 text-center" title="NP 0,20 · PP 0,275 · PI e PA 0,35 · NPJ e AUS não pontuam, por aula">Pontos Freq.</th>
                  <th className="px-4 py-4 min-w-[200px]">Frequência</th>
                  <th className="px-4 py-4 text-center">Situação</th>
                  <th className="px-4 py-4 text-center" title="Soma das notas de todos os trabalhos do aluno neste bimestre">Nota Trabalho</th>
                  <th className="px-4 py-4 text-center" title="Pontos de frequência + Nota Trabalho">Nota EF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {alunos.map((a) => {
                  const notaTrabalho = notasTrabalhosPorAluno[a.id] ?? 0;
                  return (
                  <tr key={a.id} className={cn('transition-colors',
                    a.percentual === 0 && a.registros_total > 0 ? 'bg-red-50/60 hover:bg-red-100/50'
                    : a.em_risco || a.critico ? 'bg-amber-50/60 hover:bg-amber-100/50'
                    : 'hover:bg-cyan-50/40 odd:bg-white even:bg-gray-50/30')}>
                    <td className="px-5 py-3 font-semibold text-gray-900">
                      <div className="flex items-center gap-2">
                        {a.numero_chamada ? <span className="font-mono text-gray-400 text-xs w-6 text-right">{a.numero_chamada}</span> : <span className="w-6" />}
                        <span>{formatarNome(a.nome)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-700 font-semibold">{a.registros_total}</td>
                    <td className="px-4 py-3 text-center text-rose-600 font-semibold">{a.ausentes}</td>
                    <td className="px-4 py-3 text-center font-bold text-gray-900">{a.pontos.toFixed(1).replace('.', ',')}</td>
                    <td className="px-4 py-3"><BarraProgresso percentual={a.percentual} critico={a.critico} emRisco={a.em_risco} /></td>
                    <td className="px-4 py-3 text-center"><BadgeSituacao aluno={a} /></td>
                    <td className="px-4 py-3 text-center font-semibold text-gray-700">{notaTrabalho > 0 ? notaTrabalho.toFixed(1).replace('.', ',') : '—'}</td>
                    <td className="px-4 py-3 text-center font-bold text-violet-700">{notaTotal(a.pontos, notaTrabalho, false).toFixed(1).replace('.', ',')}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="md:hidden flex flex-col gap-3">
            {alunos.map((a) => {
              const notaTrabalho = notasTrabalhosPorAluno[a.id] ?? 0;
              return (
              <div key={a.id} className="p-3.5 rounded-2xl border border-outline-variant bg-white flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-on-surface-variant w-5 shrink-0">{a.numero_chamada || ''}</span>
                  <span className="flex-1 min-w-0 font-bold text-sm text-on-surface">{formatarNome(a.nome)}</span>
                  <BadgeSituacao aluno={a} />
                </div>
                <div className="pl-7"><BarraProgresso percentual={a.percentual} critico={a.critico} emRisco={a.em_risco} /></div>
                <div className="pl-7 flex flex-wrap gap-x-3.5 gap-y-1 text-xs text-on-surface-variant">
                  <span>{a.registros_total} aulas</span>
                  <span className={a.ausentes > 0 ? 'text-[#B42318] font-bold' : ''}>{a.ausentes} {a.ausentes === 1 ? 'falta' : 'faltas'}</span>
                  <span>{a.pontos.toFixed(1).replace('.', ',')} pts freq.</span>
                  <span>Trabalho <strong className="text-on-surface">{notaTrabalho > 0 ? notaTrabalho.toFixed(1).replace('.', ',') : '—'}</strong></span>
                  <span>Nota EF <strong className="text-on-surface">{notaTotal(a.pontos, notaTrabalho, false).toFixed(1).replace('.', ',')}</strong></span>
                </div>
              </div>
              );
            })}
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
  const tones = { neutral: 'text-on-surface', primary: 'text-[#0B6B3A]', success: 'text-[#0B6B3A]', warning: 'text-amber-600', danger: 'text-[#B42318]' };
  return (
    <div className="bg-white p-3.5 rounded-[18px] border border-outline-variant">
      <div className="flex items-center gap-1.5 text-xs font-bold text-on-surface-variant">{icon}{label}</div>
      <p className={cn('text-[28px] leading-tight font-extrabold tracking-tight mt-1', tones[tone])}>{value}</p>
    </div>
  );
}

function BarraProgresso({ percentual, critico, emRisco }: { percentual: number; critico: boolean; emRisco: boolean }) {
  const cor = critico ? 'bg-[#C2352B]' : emRisco ? 'bg-amber-500' : 'bg-[#0B6B3A]';
  const fundo = critico ? 'bg-[#FBE1DE]' : emRisco ? 'bg-amber-100' : 'bg-[#E3F2EA]';
  const txt = critico ? 'text-[#B42318]' : emRisco ? 'text-amber-700' : 'text-[#0B6B3A]';
  return (
    <div className="flex items-center gap-2.5">
      <div className={cn('flex-1 h-1.5 rounded-full overflow-hidden', fundo)}>
        <div className={cn('h-full transition-all', cor)} style={{ width: `${Math.max(0, Math.min(100, percentual))}%` }} />
      </div>
      <span className={cn('text-xs font-bold w-12 text-right', txt)}>{percentual.toFixed(1).replace('.', ',')}%</span>
    </div>
  );
}

function BadgeSituacao({ aluno }: { aluno: { critico: boolean; em_risco: boolean; registros_total: number; percentual: number } }) {
  if (aluno.registros_total === 0) return <span className="px-2 py-[3px] rounded-md text-[11px] font-extrabold text-on-surface-variant bg-[#E7ECE9]">Sem dados</span>;
  if (aluno.percentual === 0) return <span className="px-2 py-[3px] rounded-md text-[11px] font-extrabold text-white bg-[#C2352B]">Crítico</span>;
  if (aluno.em_risco || aluno.critico) return <span className="px-2 py-[3px] rounded-md text-[11px] font-extrabold text-white bg-amber-500">Em risco</span>;
  return <span className="px-2 py-[3px] rounded-md text-[11px] font-extrabold text-[#0B6B3A] bg-[#E3F2EA]">OK</span>;
}
