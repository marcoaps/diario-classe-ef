import React, { useEffect, useState, useMemo } from 'react';
import { useStore } from '../../store';
import { MIN_PASSING_GRADE, MAX_ABSENCES_TOTAL, ClassRoom, Student } from '../../domain/types';
import { bimestreAtual as bimestreVigente } from '../../domain/useRelatorioFrequencia';
import { AgendaDia } from './AgendaDia';
import { ChevronRight, UserX, Users, Download, Upload, Loader2, X, CheckSquare, BarChart3, Edit, Trash2, ChevronDown, GraduationCap, ChevronUp, Share2, Copy, CheckCircle, ClipboardCheck, CaseSensitive, UserCheck, ShieldAlert, type LucideIcon } from 'lucide-react';
import { cn } from '../AppLayout';
import { buscarAlunos, salvarNotas, sincronizarNomesAlunos, supabase } from '../../data/supabase';
import { formatarNome } from '../../utils/formatarNome';
import { v4 as uuidv4 } from 'uuid';
import { useNavigate } from 'react-router-dom';

const LOGO_URL = "https://i.imgur.com/3t5GEnQ.jpeg";
const LOGO_IOP = "/Logo_IOP.png";

function extractYear(name: string): number {
  const match = name.match(/^(\d+)/);
  if (match) return parseInt(match[1], 10);
  const fallback = name.match(/(\d+)/);
  return fallback ? parseInt(fallback[1], 10) : 0;
}

function groupByYear(classRooms: ClassRoom[]): Map<number, ClassRoom[]> {
  const map = new Map<number, ClassRoom[]>();
  for (const cr of classRooms) {
    const year = extractYear(cr.name);
    if (!map.has(year)) map.set(year, []);
    map.get(year)!.push(cr);
  }
  return map;
}

const YEAR_COLORS: Record<number, { bg: string; text: string; dot: string }> = {
  6: { bg: '#eff6ff', text: '#1d4ed8', dot: '#2563eb' },
  7: { bg: '#f5f3ff', text: '#6d28d9', dot: '#7c3aed' },
  8: { bg: '#ecfdf5', text: '#065f46', dot: '#059669' },
  9: { bg: '#fff7ed', text: '#92400e', dot: '#d97706' },
};

type AcaoTipo = 'route' | 'import' | 'turmas' | 'corrigirNomes' | 'compartilhar';
interface Acao { Icon: LucideIcon; title: string; sub: string; action: AcaoTipo; value: string }

const chaveTurma = (nome: string) => nome.replace(/[^0-9A-Za-z]/g, '').toUpperCase();

// Atalhos de fluxo de trabalho. Chamada, Notas e Relatórios já estão na barra de baixo.
const ATALHOS: Acao[] = [
  { Icon: ClipboardCheck, title: 'Lançar Trabalhos',    sub: 'Registrar entregas',      action: 'route',        value: '/trabalhos' },
  { Icon: Share2,         title: 'Compartilhar Portal', sub: 'Enviar link no WhatsApp', action: 'compartilhar', value: '' },
  { Icon: GraduationCap,  title: 'Consultar Alunos',    sub: 'Provas, resultados e QR', action: 'route',        value: '/alunos' },
  { Icon: BarChart3,      title: 'Exportar Relatório',  sub: 'Frequência e notas',      action: 'route',        value: '/report' },
];

// Gerenciar turmas: o que se usa toda semana separado do que é ocasional.
const ROTINA: Acao[] = [
  { Icon: ClipboardCheck, title: 'Trabalhos / Entregas', sub: 'Registrar entregas',      action: 'route', value: '/trabalhos' },
  { Icon: GraduationCap,  title: 'Consulta de Alunos',   sub: 'Provas, resultados e QR', action: 'route', value: '/alunos' },
];
const MANUTENCAO: Acao[] = [
  { Icon: Download,      title: 'Importar Lista de Alunos', sub: 'Adicionar alunos à turma', action: 'import',        value: '' },
  { Icon: Edit,          title: 'Editar Dados da Turma',    sub: 'Gerenciar a lista',        action: 'turmas',        value: '' },
  { Icon: UserCheck,     title: 'Divisão de Gênero',        sub: 'Meninos e meninas',        action: 'route',         value: '/genero' },
  { Icon: CaseSensitive, title: 'Padronização de Nomes',    sub: 'Ajustar maiúsculas',       action: 'corrigirNomes', value: '' },
];

function ListaAcoes({ titulo, descricao, itens, onAcao, corrigindoNomes }: {
  titulo: string;
  descricao?: string;
  itens: Acao[];
  onAcao: (action: AcaoTipo, value: string) => void;
  corrigindoNomes: boolean;
}) {
  return (
    <div className="bg-white rounded-[20px] border border-[#DCEBE2] shadow-[0_1px_2px_rgba(5,59,32,0.05)] overflow-hidden">
      <div className="px-4 pt-3.5 pb-2.5">
        <h3 className="text-sm font-extrabold text-[#10231A]">{titulo}</h3>
        {descricao && <p className="text-xs text-[#5B6B63] mt-0.5">{descricao}</p>}
      </div>
      {itens.map(item => {
        const ocupado = item.action === 'corrigirNomes' && corrigindoNomes;
        return (
          <button
            key={item.title}
            onClick={() => onAcao(item.action, item.value)}
            disabled={ocupado}
            className="w-full flex items-center gap-3 px-4 py-2.5 min-h-[56px] text-left border-t border-[#EDF3EF] active:bg-[#F1F8F4] transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:bg-[#F1F8F4]"
          >
            <span className="w-9 h-9 rounded-xl bg-[#E3F8EC] flex items-center justify-center shrink-0">
              {ocupado
                ? <Loader2 className="w-[18px] h-[18px] animate-spin text-[#0B6B3A]" aria-hidden />
                : <item.Icon className="w-[18px] h-[18px] text-[#0B6B3A]" aria-hidden />}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-bold text-[#10231A] leading-tight">{item.title}</span>
              <span className="block text-xs text-[#5B6B63] mt-0.5">{ocupado ? 'Verificando...' : item.sub}</span>
            </span>
            <ChevronRight className="w-4 h-4 text-[#9DB3A6] shrink-0" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}

// Ação destrutiva fica recolhida, longe do toque acidental. O apagamento em si só
// acontece na tela /reset, que pede confirmação explícita antes de excluir.
function ZonaDePerigo({ onAbrirReset }: { onAbrirReset: () => void }) {
  const [aberta, setAberta] = useState(false);
  return (
    <div className="rounded-[20px] border border-[#F3D0CB] bg-[#FFF8F7] overflow-hidden">
      <button
        type="button"
        onClick={() => setAberta(a => !a)}
        aria-expanded={aberta}
        aria-controls="zona-de-perigo"
        className="w-full flex items-center gap-3 px-4 min-h-[52px] text-left focus-visible:outline-none focus-visible:bg-[#FDECEA]"
      >
        <ShieldAlert className="w-[18px] h-[18px] text-[#B42318] shrink-0" aria-hidden />
        <span className="flex-1 text-sm font-bold text-[#B42318]">Zona de perigo</span>
        <ChevronDown className={cn('w-4 h-4 text-[#B42318] transition-transform duration-200', aberta && 'rotate-180')} aria-hidden />
      </button>
      {aberta && (
        <div id="zona-de-perigo" className="px-4 pb-4 flex flex-col gap-3">
          <p className="text-xs leading-snug text-[#5B6B63]">
            O Reset Histórico apaga as notas e médias bimestrais de uma turma ou de todas. Nada é apagado ao tocar aqui:
            na próxima tela você escolhe o que apagar e confirma antes.
          </p>
          <button
            type="button"
            onClick={onAbrirReset}
            className="self-start flex items-center gap-2 px-4 h-11 rounded-full text-sm font-bold text-[#B42318] bg-white border border-[#E8B4AD] active:bg-[#FDECEA] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B42318]"
          >
            <Trash2 className="w-4 h-4" aria-hidden /> Abrir Reset Histórico
          </button>
        </div>
      )}
    </div>
  );
}

export function Dashboard() {
  const navigate = useNavigate();
  const { classRooms, students, setStudents, selectedClassId, setSelectedClassId, recentClassIds, loading } = useStore();
  const [buscaTurma, setBuscaTurma] = useState('');
  const [classToConfirm, setClassToConfirm] = useState<ClassRoom | null>(null);
  const [showCompartilhar, setShowCompartilhar] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [fetchedStudents, setFetchedStudents] = useState<Student[]>([]);
  const [studentCounts, setStudentCounts] = useState<Record<string, number>>({});
  const [showImportModal, setShowImportModal] = useState(false);
  const [importMode, setImportMode] = useState<'lista' | 'pdf'>('lista');
  const [importText, setImportText] = useState('');
  const [importClassId, setImportClassId] = useState('ALL');
  const [importing, setImporting] = useState(false);
  const [pdfProcessing, setPdfProcessing] = useState(false);
  const [pdfResultMsg, setPdfResultMsg] = useState<string | null>(null);
  const [showEditListModal, setShowEditListModal] = useState(false);
  const [editListText, setEditListText] = useState('');
  const [savingList, setSavingList] = useState(false);
  const [editModalMode, setEditModalMode] = useState<'destructive' | 'sync'>('destructive');
  const [cardMessage, setCardMessage] = useState<string | null>(null);
  const [openYears, setOpenYears] = useState<Set<number>>(new Set<number>());
  const [showTurmas, setShowTurmas] = useState(false);
  const [corrigindoNomes, setCorrigindoNomes] = useState(false);

  const handleCorrigirNomesTodasTurmas = async () => {
    setCorrigindoNomes(true);
    try {
      const { data, error } = await supabase.from('alunos').select('id, nome, turma_id');
      if (error) throw error;
      const candidatos = (data || [])
        .map((a: any) => ({ id: a.id, turma_id: a.turma_id, nomeAtual: a.nome as string, nomeNovo: formatarNome(a.nome) }))
        .filter(a => a.nomeNovo !== a.nomeAtual);

      if (candidatos.length === 0) {
        alert('Nenhum nome em caixa alta encontrado — todas as turmas já estão certinhas.');
        return;
      }

      const turmasAfetadas = new Set(candidatos.map(c => c.turma_id));
      const exemplos = candidatos.slice(0, 10).map(c => `${c.nomeAtual} -> ${c.nomeNovo}`).join('\n');
      const confirmMsg = `Encontrados ${candidatos.length} aluno(s) em ${turmasAfetadas.size} turma(s) com nome em caixa alta.\n\nExemplos:\n${exemplos}${candidatos.length > 10 ? '\n...' : ''}\n\nCorrigir a capitalização de todos agora?`;
      if (!window.confirm(confirmMsg)) return;

      const resultados = await Promise.all(
        candidatos.map(c => supabase.from('alunos').update({ nome: c.nomeNovo }).eq('id', c.id))
      );
      const falhas = resultados.filter(r => r.error).length;
      if (falhas > 0) {
        alert(`${candidatos.length - falhas} nome(s) corrigido(s), mas ${falhas} falharam. Tente novamente.`);
      } else {
        alert(`${candidatos.length} nome(s) corrigido(s) em ${turmasAfetadas.size} turma(s)!`);
      }
    } catch (e: any) {
      alert('Erro ao corrigir nomes: ' + e.message);
    } finally {
      setCorrigindoNomes(false);
    }
  };

  const toggleYear = (year: number) => {
    setOpenYears(prev => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year); else next.add(year);
      return next;
    });
  };

  const uniqueClassRooms = useMemo(() => Array.from(
    new Map<string, ClassRoom>(classRooms.map(cr => [cr.name, cr])).values()
  ), [classRooms]);

  const sortedClassRooms = useMemo(() => uniqueClassRooms.sort((a, b) =>
    a.name.localeCompare(b.name, 'pt-BR', { numeric: true })
  ), [uniqueClassRooms]);

  const groupedByYear = useMemo(() => groupByYear(sortedClassRooms), [sortedClassRooms]);
  const years = useMemo(() => Array.from(groupedByYear.keys()).sort((a, b) => a - b), [groupedByYear]);

  // Busca rápida por turma ("6ºF", "6f", "6 f" etc. todos encontram a mesma
  // turma) — ignora acentos/símbolos pra comparar só letras e números.
  const buscaNormalizada = buscaTurma.trim().toLowerCase().replace(/[^0-9a-z]/g, '');
  const turmasBuscadas = useMemo(() => {
    if (!buscaNormalizada) return [];
    return sortedClassRooms.filter(cr =>
      cr.name.toLowerCase().replace(/[^0-9a-z]/g, '').includes(buscaNormalizada)
    );
  }, [sortedClassRooms, buscaNormalizada]);

  const recentClassRooms = useMemo(() =>
    recentClassIds
      .map(id => sortedClassRooms.find(cr => cr.id === id))
      .filter((cr): cr is ClassRoom => !!cr),
  [recentClassIds, sortedClassRooms]);

  const fetchCounts = async () => {
    const counts: Record<string, number> = {};
    await Promise.all(uniqueClassRooms.map(async (cr) => {
      try {
        const alunos = await buscarAlunos(cr.name.replace("º", ""));
        counts[cr.id] = alunos.length;
      } catch (e) { console.error(e); }
    }));
    setStudentCounts(counts);
  };

  useEffect(() => {
    if (uniqueClassRooms.length === 0) return;
    let mounted = true;
    fetchCounts().then(() => { if (!mounted) return; });
    return () => { mounted = false; };
  }, [uniqueClassRooms]);

  const handleMenuClick = (action: AcaoTipo, value: string) => {
    if (action === 'route') navigate(value);
    else if (action === 'turmas') { setShowTurmas(true); setTimeout(() => document.getElementById('turmas-list')?.scrollIntoView({ behavior: 'smooth' }), 100); }
    else if (action === 'import') setShowImportModal(true);
    else if (action === 'corrigirNomes') handleCorrigirNomesTodasTurmas();
    else if (action === 'compartilhar') setShowCompartilhar(true);
  };

  const handleImport = async () => {
    const lines = importText.split('\n').map(l => l.trim().replace(/\s+/g, ' ')).filter(l => l.length > 0);
    if (lines.length === 0) { alert('Nenhum nome encontrado.'); return; }
    if (importClassId === 'ALL') { alert('Selecione uma turma para importar.'); return; }
    setImporting(true);
    const turmaNormalizada = importClassId.replace("º", "").replace(/\s/g, "").toUpperCase();
    const normalizeName = (n: string) => n.trim().toLowerCase().replace(/\s+/g, ' ');
    const toInsertMap = new Map<string, string>();
    lines.forEach(name => { const k = normalizeName(name); if (!toInsertMap.has(k)) toInsertMap.set(k, name); });
    const toInsert = Array.from(toInsertMap.values()).map(nome => ({ nome, turma_id: turmaNormalizada, token_acesso: uuidv4() }));
    try {
      const { data: existing } = await supabase.from('alunos').select('nome, turma_id, numero_chamada').eq('turma_id', turmaNormalizada);
      const existingNames = new Set(existing?.map((e: any) => normalizeName(e.nome)) || []);
      const filteredInsert = toInsert.filter(item => !existingNames.has(normalizeName(item.nome)));
      const ignoredCount = toInsert.length - filteredInsert.length;
      if (filteredInsert.length > 0) {
        const maxNumero = existing?.reduce((max, e) => { const num = typeof e.numero_chamada === 'number' ? e.numero_chamada : parseInt(e.numero_chamada || '0', 10); return !isNaN(num) && num > max ? num : max; }, 0) || 0;
        const { error } = await supabase.from('alunos').insert(filteredInsert.map((item, idx) => ({ ...item, numero_chamada: maxNumero + idx + 1 })));
        if (error) throw error;
      }
      alert(`${filteredInsert.length} alunos novos adicionados.\n${ignoredCount} alunos já existiam e foram ignorados.`);
      setShowImportModal(false); setImportText(''); setImportClassId('ALL');
      await fetchCounts();
    } catch (err) { alert('Erro ao importar. ' + (err as Error).message); }
    finally { setImporting(false); }
  };

  const handlePdfImport = async (file: File) => {
    if (importClassId === 'ALL') { alert('Selecione uma turma para importar.'); return; }
    setPdfProcessing(true);
    setPdfResultMsg(null);
    try {
      const toBase64 = (f: File): Promise<string> =>
        new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res((r.result as string).split(',')[1]);
          r.onerror = rej;
          r.readAsDataURL(f);
        });
      const base64 = await toBase64(file);
      const resp = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5',
          max_tokens: 8000,
          messages: [{
            role: 'user',
            content: [
              { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
              {
                type: 'text',
                text: 'Extraia os dados dos alunos deste PDF da RELACAO DE NOTAS E CONCEITOS. Retorne SOMENTE um array JSON valido, sem markdown, sem explicacoes, sem texto extra. Formato exato: [{"num":1,"nome":"NOME COMPLETO","situacao":"Em Curso","data_situacao":""}]. Para alunos transferidos use situacao "Foi Transferido". Para remanejados use "Remanejado". O campo nome deve conter APENAS o nome do aluno, nunca a situacao. Use aspas duplas. Se nao houver data da situacao deixe string vazia.',
              },
            ],
          }],
        }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error('API erro ' + resp.status);
      let text = json.content[0].text;
      let clean = text.replace(/```json|```/g, '').trim();
      const lastBracket = clean.lastIndexOf('}');
      if (lastBracket !== -1 && !clean.endsWith(']')) {
        clean = clean.substring(0, lastBracket + 1) + ']';
      }
      const extraidos: { num: number; nome: string; situacao?: string; data_situacao?: string }[] = JSON.parse(clean);
      if (!Array.isArray(extraidos) || extraidos.length === 0) throw new Error('Não consegui ler nenhum aluno neste PDF.');

      const turmaNormalizada = importClassId.replace(/º/g, '').replace(/\s/g, '').toUpperCase();

      const { data: existentesData, error: exErr } = await supabase
        .from('alunos').select('id, nome, numero_chamada').eq('turma_id', turmaNormalizada);
      if (exErr) throw exErr;
      const existentes = existentesData || [];
      const maxNumeroExistente = existentes.reduce((max, a: any) => Math.max(max, a.numero_chamada ?? 0), 0);
      const nomesExistentesLower = new Set(existentes.map((a: any) => String(a.nome).toLowerCase().trim()));

      // 1) Corrige nomes dos alunos que já existem (casa por posição/numero)
      const { changed, failed } = await sincronizarNomesAlunos(
        turmaNormalizada,
        extraidos.map(e => ({ numero: e.num, nome: e.nome }))
      );

      // 2) Insere quem ainda não existe (numero maior que o maior já cadastrado e nome novo)
      const novos = extraidos.filter(e =>
        e.num > maxNumeroExistente && !nomesExistentesLower.has(String(e.nome).toLowerCase().trim())
      );
      let inseridos = 0;
      if (novos.length > 0) {
        const inserts = novos.map(e => ({
          nome: e.nome,
          turma_id: turmaNormalizada,
          numero_chamada: e.num,
          token_acesso: uuidv4(),
        }));
        const { data: insData, error: insErr } = await supabase.from('alunos').insert(inserts).select('id');
        if (insErr) throw insErr;
        inseridos = insData?.length ?? 0;
      }

      // 3) Grava a situação (transferido/remanejado/em curso) no bimestre atual
      const bim = bimestreAtual();
      await salvarNotas(turmaNormalizada, bim, extraidos.map(e => ({
        numero: e.num,
        nome: e.nome,
        nota: null,
        situacao: e.situacao || 'Em Curso',
        data_situacao: e.data_situacao || '',
        faltas: 0,
      })));

      setPdfResultMsg(
        `${inseridos} aluno(s) novo(s) · ${changed} nome(s) corrigido(s)${failed > 0 ? ` (${failed} falharam)` : ''} · situações do ${bim}º bimestre gravadas`
      );
      await fetchCounts();
    } catch (e: any) {
      alert('Erro ao processar PDF: ' + (e?.message || JSON.stringify(e)));
    } finally {
      setPdfProcessing(false);
    }
  };

  const handleEditList = () => {
    if (!classToConfirm || fetchedStudents.length === 0) return;
    const sorted = [...fetchedStudents].sort((a, b) => {
      const na = typeof a.numero_chamada === 'number' ? a.numero_chamada : parseInt(String(a.numero_chamada || '999'), 10);
      const nb = typeof b.numero_chamada === 'number' ? b.numero_chamada : parseInt(String(b.numero_chamada || '999'), 10);
      return (isNaN(na) ? 999 : na) - (isNaN(nb) ? 999 : nb);
    });
    setEditListText(sorted.map(s => s.name).join('\n'));
    setEditModalMode('destructive');
    setShowEditListModal(true);
  };

  const handleOpenSync = () => {
    if (!classToConfirm || fetchedStudents.length === 0) return;
    const sorted = [...fetchedStudents].sort((a, b) => {
      const na = typeof a.numero_chamada === 'number' ? a.numero_chamada : parseInt(String(a.numero_chamada || '999'), 10);
      const nb = typeof b.numero_chamada === 'number' ? b.numero_chamada : parseInt(String(b.numero_chamada || '999'), 10);
      return (isNaN(na) ? 999 : na) - (isNaN(nb) ? 999 : nb);
    });
    setEditListText(sorted.map(s => s.name).join('\n'));
    setEditModalMode('sync');
    setShowEditListModal(true);
  };

  const handleSyncNomes = async () => {
    if (!classToConfirm) return;
    setSavingList(true);
    const lines = editListText.split('\n').map(l => l.trim().replace(/\s+/g, ' ')).filter(l => l.length > 0);
    const sorted = [...fetchedStudents].sort((a, b) => {
      const na = typeof a.numero_chamada === 'number' ? a.numero_chamada : parseInt(String(a.numero_chamada || '999'), 10);
      const nb = typeof b.numero_chamada === 'number' ? b.numero_chamada : parseInt(String(b.numero_chamada || '999'), 10);
      return (isNaN(na) ? 999 : na) - (isNaN(nb) ? 999 : nb);
    });
    const n = Math.min(lines.length, sorted.length);
    let changed = 0;
    let failed = 0;
    try {
      for (let i = 0; i < n; i++) {
        const aluno = sorted[i];
        const novoNome = lines[i];
        if (novoNome && novoNome !== aluno.name) {
          const { data, error } = await supabase.from('alunos').update({ nome: novoNome }).eq('id', aluno.id).select('id');
          if (error || !data || data.length === 0) { failed++; continue; }
          aluno.name = novoNome;
          changed++;
        }
      }
      const atualizados = sorted.map(a => ({ ...a }));
      setFetchedStudents(atualizados);
      setStudents(prev => prev.map(s => {
        const match = atualizados.find(a => a.id === s.id);
        return match ? { ...s, name: match.name } : s;
      }));
      setShowEditListModal(false);
      const obsContagem = lines.length !== sorted.length
        ? ` (lista colada tinha ${lines.length} nomes, turma tem ${sorted.length} — comparei só os ${n} primeiros)`
        : '';
      setCardMessage(
        failed > 0
          ? `${changed} nome(s) corrigido(s), ${failed} falharam — faça login de novo`
          : changed > 0
            ? `${changed} nome(s) corrigido(s)${obsContagem}`
            : `Nenhuma diferença encontrada${obsContagem}`
      );
      setTimeout(() => setCardMessage(null), 5000);
    } catch (err: any) {
      alert('Erro ao sincronizar: ' + err.message);
    }
    setSavingList(false);
  };

  const handleSaveList = async () => {
    if (!classToConfirm) return;
    setSavingList(true);
    const lines = editListText.split('\n').map(l => l.trim().replace(/\s+/g, ' ')).filter(l => l.length > 0);
    const turmaNormalizada = classToConfirm.name.replace(/º/g, '').replace(/\s/g, '').toUpperCase();
    const uniqueLines: string[] = [];
    const seen = new Set<string>();
    for (const line of lines) { const lower = line.toLowerCase(); if (!seen.has(lower)) { seen.add(lower); uniqueLines.push(line); } }
    try {
      // Buscar alunos existentes para preservar ID, token_acesso e numero_chamada —
      // o ID liga cada aluno às chamadas/notas já lançadas e o numero_chamada é a
      // posição histórica dele na chamada, então nenhum dos dois pode mudar para
      // quem já estava na turma, mesmo que a lista colada venha em outra ordem.
      const { data: existentes } = await supabase.from('alunos').select('id, nome, token_acesso, numero_chamada').eq('turma_id', turmaNormalizada);
      const mapaExistentes = new Map((existentes || []).map((a: any) => [a.nome.toLowerCase().trim(), a]));

      // Só remove quem realmente saiu da lista colada.
      const nomesNovaLista = new Set(uniqueLines.map(l => l.toLowerCase().trim()));
      const removidos = (existentes || []).filter((a: any) => !nomesNovaLista.has(a.nome.toLowerCase().trim()));
      if (removidos.length > 0) {
        const { error: delError } = await supabase.from('alunos').delete().in('id', removidos.map((a: any) => a.id));
        if (delError) throw new Error('Erro ao remover alunos que saíram da lista: ' + delError.message);
      }

      if (uniqueLines.length > 0) {
        // Aluno novo ou remanejado entra sempre depois do maior número de
        // chamada já existente na turma — nunca no meio, nunca renumerando
        // quem já estava lá.
        let proximoNumero = (existentes || []).reduce((max, a: any) => {
          const num = typeof a.numero_chamada === 'number' ? a.numero_chamada : parseInt(a.numero_chamada || '0', 10);
          return !isNaN(num) && num > max ? num : max;
        }, 0) + 1;

        const mapped = await Promise.all(uniqueLines.map(async (name) => {
          const existente = mapaExistentes.get(name.toLowerCase().trim());
          if (existente) {
            const numero_chamada = typeof existente.numero_chamada === 'number' ? existente.numero_chamada : parseInt(existente.numero_chamada || '0', 10);
            const { error } = await supabase.from('alunos').update({ nome: name }).eq('id', existente.id);
            if (error) throw new Error(`Erro ao atualizar "${name}": ` + error.message);
            return { id: existente.id, classRoomId: classToConfirm.id, name, numero_chamada };
          }
          const numero_chamada = proximoNumero++;
          const { data, error } = await supabase
            .from('alunos')
            .insert({ nome: name, turma_id: turmaNormalizada, numero_chamada, token_acesso: uuidv4() })
            .select('id')
            .single();
          if (error) throw new Error(`Erro ao inserir "${name}": ` + error.message);
          return { id: data!.id, classRoomId: classToConfirm.id, name, numero_chamada };
        }));
        mapped.sort((a, b) => (a.numero_chamada ?? 0) - (b.numero_chamada ?? 0));
        setFetchedStudents(mapped);
        setStudentCounts(prev => ({ ...prev, [classToConfirm.id]: mapped.length }));
      } else {
        setFetchedStudents([]); setStudentCounts(prev => ({ ...prev, [classToConfirm.id]: 0 }));
      }
      setShowEditListModal(false);
      setCardMessage('Turma atualizada com sucesso');
      setTimeout(() => setCardMessage(null), 3000);
    } catch (err: any) {
      alert('Erro ao salvar: ' + err.message);
      setCardMessage('Erro: ' + err.message);
      setTimeout(() => setCardMessage(null), 5000);
    }
    setSavingList(false);
  };

  const handleClassClick = async (cr: ClassRoom) => {
    setClassToConfirm(cr); setFetching(true); setFetchedStudents([]);
    try {
      const alunos = await buscarAlunos(cr.name.replace("º", ""));
      if (alunos.length > 0) setFetchedStudents(alunos.map(a => ({ id: a.id ? String(a.id) : uuidv4(), classRoomId: cr.id, name: a.nome || a.name || 'Sem nome', numero_chamada: a.numero_chamada })));
    } catch (e) { console.error(e); }
    setFetching(false);
  };

  const handleDeleteAluno = async (alunoId: string, nome: string) => {
    if (!confirm(`Excluir "${nome}" da turma?\n\nEssa ação não pode ser desfeita.`)) return;
    try {
      const { data, error } = await supabase.from('alunos').delete().eq('id', alunoId).select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Nada foi excluído. Faça login novamente e tente de novo.');
      }
      setFetchedStudents(prev => prev.filter(s => s.id !== alunoId));
      setStudents(prev => prev.filter(s => s.id !== alunoId));
      if (classToConfirm) {
        setStudentCounts(prev => ({ ...prev, [classToConfirm.id]: Math.max(0, (prev[classToConfirm.id] || 1) - 1) }));
      }
    } catch (err: any) {
      alert('Erro ao excluir: ' + err.message);
    }
  };

  const handleRenameAluno = async (alunoId: string, nomeAtual: string) => {
    const novoNome = prompt('Corrigir nome do aluno:', nomeAtual);
    if (!novoNome || !novoNome.trim() || novoNome.trim() === nomeAtual) return;
    const nomeCorrigido = novoNome.trim();
    try {
      const { data, error } = await supabase.from('alunos').update({ nome: nomeCorrigido }).eq('id', alunoId).select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Nada foi atualizado. Faça login novamente e tente de novo.');
      }
      setFetchedStudents(prev => prev.map(s => s.id === alunoId ? { ...s, name: nomeCorrigido } : s));
      setStudents(prev => prev.map(s => s.id === alunoId ? { ...s, name: nomeCorrigido } : s));
    } catch (err: any) {
      alert('Erro ao renomear: ' + err.message);
    }
  };

  const bimestreAtual = () => bimestreVigente();

  const handleMarcarSituacao = async (aluno: Student) => {
    if (!classToConfirm) return;
    const bim = bimestreAtual();
    const escolha = prompt(
      `Situação de "${aluno.name}" no ${bim}º bimestre.\n\nDigite: transferido, remanejado ou em curso`,
      'transferido'
    );
    if (!escolha) return;
    const normalizado = escolha.trim().toLowerCase();
    let situacao: string;
    if (normalizado.includes('remanej')) situacao = 'Remanejado';
    else if (normalizado.includes('transf')) situacao = 'Foi Transferido';
    else if (normalizado.includes('curso')) situacao = 'Em Curso';
    else { alert('Não entendi. Digite "transferido", "remanejado" ou "em curso".'); return; }

    let dataSituacao = '';
    if (situacao !== 'Em Curso') {
      const hoje = new Date();
      const sugestao = `${String(hoje.getDate()).padStart(2, '0')}/${String(hoje.getMonth() + 1).padStart(2, '0')}/${hoje.getFullYear()}`;
      const dataInformada = prompt('Data da situação (DD/MM/AAAA):', sugestao);
      if (!dataInformada) return;
      dataSituacao = dataInformada.trim();
    }

    const turmaNormalizada = classToConfirm.name.replace(/º/g, '').replace(/\s/g, '').toUpperCase();
    try {
      await salvarNotas(turmaNormalizada, bim, [{
        numero: typeof aluno.numero_chamada === 'number' ? aluno.numero_chamada : parseInt(String(aluno.numero_chamada || '0'), 10),
        nome: aluno.name,
        nota: null,
        situacao,
        data_situacao: dataSituacao,
        faltas: 0,
      }]);
      setCardMessage(`Situação atualizada: ${aluno.name} — ${situacao}`);
      setTimeout(() => setCardMessage(null), 4000);
    } catch (err: any) {
      alert('Erro ao salvar situação: ' + err.message);
    }
  };

  // nº de alunos por turma no formato do AgendaDia ("6F")
  const contagemPorTurma = useMemo(() => {
    const m: Record<string, number> = {};
    for (const cr of sortedClassRooms) {
      const n = studentCounts[cr.id];
      if (n) m[cr.name.replace(/[^0-9A-Za-z]/g, '').toUpperCase()] = n;
    }
    return m;
  }, [sortedClassRooms, studentCounts]);

  // Turma ativa (a selecionada no app) e turmas existentes, para o cartão "Chamada de Hoje"
  const turmaAtiva = useMemo(() => {
    const cr = sortedClassRooms.find(c => c.id === selectedClassId);
    return cr ? chaveTurma(cr.name) : null;
  }, [sortedClassRooms, selectedClassId]);
  const turmasDisponiveis = useMemo(() => new Set(sortedClassRooms.map(cr => chaveTurma(cr.name))), [sortedClassRooms]);
  const abrirChamadaDaTurma = (t: string) => {
    const cr = sortedClassRooms.find(x => chaveTurma(x.name) === t);
    if (cr) { setSelectedClassId(cr.id); navigate('/attendance'); }
  };

  const totalStudents = Object.values(studentCounts).reduce((acc: number, count: number) => acc + count, 0);
  const totalByYear = (year: number) => (groupedByYear.get(year) || []).reduce((acc, cr) => acc + (studentCounts[cr.id] || 0), 0);

  if (loading) return <div className="p-4 text-center mt-10">Carregando dados offline...</div>;

  return (
    <div className="flex flex-col gap-5 pb-28 min-h-screen" style={{ background: 'linear-gradient(180deg, #E4F6EC 0%, #EEF9F3 260px, #F4FBF7 100%)' }}>

      {/* Cabeçalho: verde-floresta com as linhas de uma quadra ao fundo */}
      <header
        className="relative overflow-hidden text-white px-5 pt-5 pb-16 rounded-b-[32px]"
        style={{ background: 'radial-gradient(120% 90% at 92% -10%, #1E7F4C 0%, rgba(30,127,76,0) 58%), linear-gradient(165deg, #0E5C35 0%, #083D24 100%)' }}
      >
        <svg aria-hidden="true" className="absolute -right-12 -bottom-8 w-[330px] h-[230px] opacity-[0.11] pointer-events-none" viewBox="0 0 330 230" fill="none" stroke="#fff" strokeWidth="1.6">
          <line x1="165" y1="-10" x2="165" y2="240" />
          <circle cx="165" cy="115" r="54" />
          <circle cx="165" cy="115" r="3.5" fill="#fff" />
          <path d="M330 52 H268 A64 64 0 0 0 268 178 H330" />
          <path d="M0 52 H62 A64 64 0 0 1 62 178 H0" />
        </svg>

        <div className="relative flex items-center gap-3">
          <div className="w-11 h-11 rounded-full border-2 border-[#F2B632] overflow-hidden shrink-0 bg-white flex items-center justify-center">
            <img src={LOGO_IOP} alt="IOP" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-extrabold text-[14px] leading-tight truncate">Instituto Odilon Pratagi</p>
            <p className="text-xs text-[#BFE3CD] truncate">Escola Estadual · Brasiléia – AC</p>
          </div>
          <span className="shrink-0 px-3 py-1.5 rounded-full bg-[#F2B632] text-[#3A2A00] text-xs font-extrabold tabular-nums">
            {bimestreVigente()}º bimestre
          </span>
        </div>

        <div className="relative mt-6">
          <p className="text-[13px] font-semibold text-[#BFE3CD] first-letter:uppercase">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <h1 className="text-[34px] font-extrabold tracking-[-0.035em] leading-[1.05] mt-0.5">Olá, Professor!</h1>
          <p className="mt-3 flex items-center gap-3 text-sm text-[#BFE3CD] tabular-nums">
            <span><b className="text-white font-extrabold text-base">{totalStudents}</b> alunos</span>
            <span className="w-px h-4 bg-white/25" aria-hidden="true" />
            <span><b className="text-white font-extrabold text-base">{sortedClassRooms.length}</b> turmas</span>
          </p>
        </div>
      </header>

      <div className="px-4 grid gap-5 -mt-12 relative z-10 lg:grid-cols-2 lg:items-start">

        {/* Botão Central do Aluno — oculto (mantido para uso futuro) */}
        <button
          onClick={() => navigate('/alunos')}
          className="w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-all active:scale-95"
          style={{ background: '#1a2e6e', display: 'none' }}
        >
          <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.12)' }}>
            <GraduationCap className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-black text-white text-base">Central do Aluno</p>
            <p className="text-blue-300 text-xs mt-0.5">QR Codes · Provas · Resultados</p>
          </div>
          <span className="px-3 py-1.5 rounded-full text-xs font-black text-white shrink-0" style={{ background: '#dc2626' }}>
            ACESSAR ↗
          </span>
        </button>

        <div className="flex flex-col gap-5 min-w-0">
          {/* Chamada de hoje: um só cartão com a turma ativa e a ação principal.
              Sem aula no dia, mostra só o aviso (sem botão de chamada). */}
          <AgendaDia
            contagens={contagemPorTurma}
            turmaAtiva={turmaAtiva}
            turmasDisponiveis={turmasDisponiveis}
            onTurmaClick={abrirChamadaDaTurma}
          />

          {/* Últimas turmas acessadas: troca rápida de contexto logo abaixo do cartão principal */}
          {recentClassRooms.length > 0 && (
            <section aria-label="Últimas turmas acessadas" className="flex flex-col gap-2.5">
              <h2 className="text-[13px] font-extrabold text-[#5B6B63] px-1">Últimas turmas acessadas</h2>
              <div className="flex flex-wrap gap-2">
                {recentClassRooms.map(cr => {
                  const cor = (YEAR_COLORS[extractYear(cr.name)] || { dot: '#64748b' }).dot;
                  return (
                    <button
                      key={cr.id}
                      onClick={() => { setSelectedClassId(cr.id); navigate('/attendance'); }}
                      className="flex items-center gap-2 pl-3 pr-3.5 h-11 rounded-full text-sm font-extrabold bg-white text-[#10231A] border border-[#DCEBE2] shadow-[0_1px_2px_rgba(5,59,32,0.05)] active:scale-95 transition-transform duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7A3D]"
                    >
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: cor }} aria-hidden />
                      {cr.name}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Acesso rápido: atalhos de fluxo de trabalho (Chamada, Notas e Relatórios já estão na barra de baixo) */}
          <section aria-label="Acesso rápido" className="flex flex-col gap-2.5">
            <h2 className="text-[13px] font-extrabold text-[#5B6B63] px-1">Acesso rápido</h2>
            <div className="grid grid-cols-2 gap-2.5">
              {ATALHOS.map(item => (
                <button
                  key={item.title}
                  onClick={() => handleMenuClick(item.action, item.value)}
                  className="flex flex-col items-start justify-between gap-3 p-3.5 min-h-[112px] rounded-[20px] text-left bg-white border border-[#DCEBE2] shadow-[0_1px_2px_rgba(5,59,32,0.05)] transition-transform duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#0B7A3D]"
                >
                  <span className="w-10 h-10 rounded-xl bg-[#E3F8EC] text-[#0B6B3A] flex items-center justify-center">
                    <item.Icon className="w-5 h-5" aria-hidden />
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span className="text-[14px] font-extrabold leading-tight text-[#10231A]">{item.title}</span>
                    <span className="text-xs leading-snug text-[#5B6B63]">{item.sub}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-5 min-w-0">

        {/* Bloco Turmas colapsável */}
        <div id="turmas-list" className="scroll-mt-20">
          <button
            onClick={() => setShowTurmas(prev => !prev)}
            className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-white rounded-[20px] border border-[#DCEBE2] shadow-[0_1px_2px_rgba(5,59,32,0.05)] hover:bg-[#F5FCF8] transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7A3D]"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-10 h-10 rounded-xl bg-[#E3F8EC] flex items-center justify-center shrink-0">
                <Users className="w-5 h-5 text-[#0B6B3A]" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-extrabold leading-tight text-[#10231A] whitespace-nowrap">Turmas e Alunos</span>
                <span className="block text-xs mt-0.5 text-[#5B6B63] tabular-nums">{totalStudents} alunos</span>
              </span>
            </div>
            {showTurmas ? <ChevronUp className="w-5 h-5 text-gray-400 shrink-0" /> : <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" />}
          </button>

          {showTurmas && (
            <div className="mt-2 relative">
              <input
                type="text"
                value={buscaTurma}
                onChange={(e) => setBuscaTurma(e.target.value)}
                placeholder="Buscar turma... (ex: 6ºF, 7B, 9c)"
                className="w-full bg-white border border-[#EAF7EF] rounded-2xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-200 shadow-sm"
              />
              {buscaTurma && (
                <button
                  onClick={() => setBuscaTurma('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {showTurmas && buscaNormalizada && (
            <div className="flex flex-col divide-y divide-[#F0FAF4] border border-[#EAF7EF] rounded-2xl overflow-hidden bg-white shadow-sm mt-2">
              {turmasBuscadas.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">Nenhuma turma encontrada para "{buscaTurma}".</p>
              ) : turmasBuscadas.map(cr => (
                <div key={cr.id} onClick={() => handleClassClick(cr)}
                  className={cn("flex items-center justify-between px-4 py-3 cursor-pointer transition-colors", selectedClassId === cr.id ? "bg-[#E3F8EC]" : "hover:bg-[#F5FCF8]")}>
                  <div>
                    <span className="text-sm font-bold text-gray-900">{cr.name}</span>
                    <span className="text-xs text-gray-400 ml-2">{studentCounts[cr.id] || 0} alunos</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedClassId(cr.id); navigate('/attendance'); }}
                      title="Ir direto para a chamada desta turma"
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-[#E3F8EC] text-[#0B7A3D] border border-[#BEEBD1] hover:bg-[#BEEBD1] active:scale-95 transition-all"
                    >
                      <CheckSquare className="w-3.5 h-3.5" /> Chamada
                    </button>
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {showTurmas && !buscaNormalizada && (
            <div className="flex flex-col gap-2 mt-2">
              {years.map(year => {
                const turmas = groupedByYear.get(year) || [];
                const isOpen = openYears.has(year);
                const colors = YEAR_COLORS[year] || { bg: '#f8fafc', text: '#475569', dot: '#64748b' };
                return (
                  <div key={year} className="rounded-2xl border border-[#EAF7EF] overflow-hidden bg-white shadow-sm">
                    <button onClick={() => toggleYear(year)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0" style={{ background: colors.bg, color: colors.text }}>
                          {year}º
                        </div>
                        <div className="text-left">
                          <p className="font-bold text-sm text-gray-900">{year}º Ano — EF II</p>
                          <p className="text-xs text-gray-400">{turmas.length} {turmas.length === 1 ? 'turma' : 'turmas'} · {totalByYear(year)} alunos</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ background: colors.dot }} />
                        <ChevronDown className={cn("w-4 h-4 text-gray-400 transition-transform duration-300", isOpen ? "rotate-180" : "")} />
                      </div>
                    </button>
                    {isOpen && (
                      <div className="flex flex-col divide-y divide-[#F0FAF4] border-t border-[#EAF7EF]">
                        {turmas.map(cr => (
                          <div key={cr.id} onClick={() => handleClassClick(cr)}
                            className={cn("flex items-center justify-between px-4 py-3 cursor-pointer transition-colors", selectedClassId === cr.id ? "bg-[#E3F8EC]" : "hover:bg-[#F5FCF8]")}>
                            <div>
                              <span className="text-sm font-bold text-gray-900">{cr.name}</span>
                              <span className="text-xs text-gray-400 ml-2">{studentCounts[cr.id] || 0} alunos</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={(e) => { e.stopPropagation(); setSelectedClassId(cr.id); navigate('/attendance'); }}
                                title="Ir direto para a chamada desta turma"
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-[#E3F8EC] text-[#0B7A3D] border border-[#BEEBD1] hover:bg-[#BEEBD1] active:scale-95 transition-all"
                              >
                                <CheckSquare className="w-3.5 h-3.5" /> Chamada
                              </button>
                              {selectedClassId === cr.id && <span className="text-xs font-bold text-[#0B7A3D] bg-[#BEEBD1] px-2 py-0.5 rounded-full">Selecionada</span>}
                              <ChevronRight className="w-4 h-4 text-gray-300" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

          {/* Gerenciar turmas: rotina de uso frequente separada da manutenção ocasional */}
          <section aria-label="Gerenciar turmas" className="flex flex-col gap-3">
            <h2 className="text-[13px] font-extrabold text-[#5B6B63] px-1">Gerenciar turmas</h2>
            <ListaAcoes titulo="Rotina pedagógica" itens={ROTINA} onAcao={handleMenuClick} corrigindoNomes={corrigindoNomes} />
            <ListaAcoes titulo="Ferramentas de manutenção" descricao="Uso ocasional: listas, nomes e dados das turmas" itens={MANUTENCAO} onAcao={handleMenuClick} corrigindoNomes={corrigindoNomes} />
            <ZonaDePerigo onAbrirReset={() => navigate('/reset')} />
          </section>
        </div>
      </div>

      {/* Modal: Compartilhar Portal */}
      {showCompartilhar && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-6 w-full max-w-sm flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-green-50">
                  <Share2 className="w-5 h-5 text-green-600" />
                </div>
                <h3 className="text-lg font-black text-gray-900">Compartilhar Portal</h3>
              </div>
              <button onClick={() => setShowCompartilhar(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
              <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Link da Avaliação</p>
              <p className="font-mono text-sm text-gray-800 break-all">{window.location.origin}/responder</p>
            </div>

            <p className="text-xs text-gray-500 text-center">O aluno acessa o link e digita o código da prova informado pelo professor.</p>

            {/* Botão WhatsApp */}
            <a
              href={`https://wa.me/?text=${encodeURIComponent(
                `📚 *Portal do Aluno — Instituto Odilon Pratagi*\n\n` +
                `Acesse o link abaixo para realizar sua avaliação online:\n` +
                `👉 ${window.location.origin}/responder\n\n` +
                `Digite o código da prova informado pelo professor.\n\n` +
                `_Instituto Odilon Pratagi — Brasiléia/AC_`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-black text-white text-base transition-all active:scale-95"
              style={{ background: '#25D366' }}
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Compartilhar no WhatsApp
            </a>

            {/* Botão Copiar link */}
            <button
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/responder`);
                setCopiado(true);
                setTimeout(() => setCopiado(false), 2500);
              }}
              className={cn('w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm transition-all',
                copiado ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')}
            >
              {copiado ? <><CheckCircle className="w-4 h-4" /> Link copiado!</> : <><Copy className="w-4 h-4" /> Copiar link</>}
            </button>
          </div>
        </div>
      )}

      {/* Modal: Confirmar turma */}
      {classToConfirm && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-6 w-full max-w-sm flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#E3F8EC' }}>
                <Users className="w-5 h-5 text-[#0B7A3D]" />
              </div>
              <h3 className="text-lg font-black text-gray-900">Acessar {classToConfirm.name}?</h3>
            </div>
            <div className="bg-[#F9FCFA] rounded-2xl p-3 border border-[#EAF7EF]">
              {fetching ? <p className="text-sm text-center py-4 text-gray-500 animate-pulse">Buscando alunos...</p> : (
                <>
                  <p className="text-[#0B7A3D] font-bold text-sm mb-2">{fetchedStudents.length} alunos matriculados</p>
                  <ul className="text-sm flex flex-col gap-1 max-h-40 overflow-y-auto">
                    {fetchedStudents.length > 0
                      ? fetchedStudents.map(s => (
                          <li key={s.id} className="flex items-center justify-between gap-2 text-gray-700">
                            <span className="truncate">{s.numero_chamada ? <span className="font-mono text-gray-400 mr-2">{s.numero_chamada} -</span> : null}{s.name}</span>
                            <span className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleMarcarSituacao(s); }}
                                className="text-gray-300 hover:text-amber-600 p-1"
                                title="Marcar situação (transferido/remanejado)"
                              >
                                <UserX className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleRenameAluno(s.id, s.name); }}
                                className="text-gray-300 hover:text-blue-600 p-1"
                                title="Corrigir nome"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteAluno(s.id, s.name); }}
                                className="text-gray-300 hover:text-red-600 p-1"
                                title="Excluir aluno"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </span>
                          </li>
                        ))
                      : <li className="text-gray-400">Nenhum aluno encontrado.</li>}
                  </ul>
                  {fetchedStudents.length > 0 && (
                    <div className="flex gap-2 mt-3">
                      <button onClick={handleOpenSync} className="flex-1 py-2 rounded-xl font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs transition-colors border border-blue-200">Sincronizar Nomes</button>
                      <button onClick={handleEditList} className="flex-1 py-2 rounded-xl font-bold text-xs transition-colors border" style={{ background: '#FBF1E7', color: '#B4713A', borderColor: '#F0DAC0' }}>Editar Lista da Turma</button>
                    </div>
                  )}
                  {cardMessage && <p className="text-xs font-bold text-[#0B7A3D] text-center mt-1">{cardMessage}</p>}
                </>
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setClassToConfirm(null)} className="flex-1 py-3 rounded-2xl font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">Cancelar</button>
              <button
                onClick={() => { setStudents(prev => [...prev.filter(s => s.classRoomId !== classToConfirm.id), ...fetchedStudents]); setSelectedClassId(classToConfirm.id); setClassToConfirm(null); }}
                className="flex-1 py-3 rounded-2xl font-black text-white transition-all active:scale-95 shadow-md shadow-emerald-900/10"
                style={{ background: '#0B7A3D' }}>
                Acessar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Importar */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-6 w-full max-w-sm flex flex-col gap-4 shadow-2xl relative">
            <button onClick={() => { setShowImportModal(false); setPdfResultMsg(null); }} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            <h3 className="text-xl font-black text-gray-900">Importar Alunos</h3>

            <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
              <button
                onClick={() => { setImportMode('lista'); setPdfResultMsg(null); }}
                className={cn('flex-1 py-2 rounded-lg text-xs font-bold transition-all', importMode === 'lista' ? 'bg-white shadow-sm text-[#0B7A3D]' : 'text-gray-500')}
              >
                Colar Lista
              </button>
              <button
                onClick={() => { setImportMode('pdf'); setPdfResultMsg(null); }}
                className={cn('flex-1 py-2 rounded-lg text-xs font-bold transition-all', importMode === 'pdf' ? 'bg-white shadow-sm text-[#0B7A3D]' : 'text-gray-500')}
              >
                Carregar PDF do Simaed
              </button>
            </div>

            <div>
              <label className="font-bold text-gray-600 block mb-1 text-sm">Turma de Destino</label>
              <select value={importClassId} onChange={(e) => setImportClassId(e.target.value)} className="w-full bg-[#F9FCFA] border border-[#EAF7EF] rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-200 text-sm">
                <option value="ALL">Selecione uma turma</option>
                {sortedClassRooms.map(cr => <option key={cr.id} value={cr.name}>{cr.name}</option>)}
              </select>
            </div>

            {importMode === 'lista' ? (
              <>
                <div>
                  <label className="font-bold text-gray-600 block mb-1 text-sm">Lista de Nomes (um por linha)</label>
                  <textarea value={importText} onChange={(e) => setImportText(e.target.value)} placeholder="Maria Silva&#10;João Paulo" rows={6} className="w-full bg-[#F9FCFA] border border-[#EAF7EF] rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-200 resize-none font-medium text-sm" />
                </div>
                <button onClick={handleImport} disabled={importing} className="w-full py-3 rounded-2xl font-black text-white transition-all active:scale-95 disabled:opacity-50" style={{ background: '#0B7A3D' }}>
                  {importing ? 'Importando...' : 'Importar Alunos'}
                </button>
              </>
            ) : (
              <>
                <p className="text-xs text-gray-500">
                  Sobe o PDF "Relação de Notas e Conceitos" do Simaed: corrige nomes, adiciona alunos novos e grava a situação (Transferido/Remanejado) do bimestre atual — tudo de uma vez.
                </p>
                <label className={cn(
                  'w-full py-6 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors',
                  pdfProcessing ? 'border-gray-200 bg-gray-50' : 'border-blue-200 bg-blue-50 hover:bg-blue-100'
                )}>
                  {pdfProcessing ? (
                    <>
                      <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                      <span className="text-xs font-bold text-blue-700">Analisando PDF...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-6 h-6 text-blue-600" />
                      <span className="text-xs font-bold text-blue-700">Toque para escolher o PDF</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    disabled={pdfProcessing}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePdfImport(f); e.target.value = ''; }}
                  />
                </label>
                {pdfResultMsg && (
                  <p className="text-xs font-bold text-[#0B7A3D] text-center bg-[#E3F8EC] border border-[#BEEBD1] rounded-xl py-2 px-3">{pdfResultMsg}</p>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal: Editar lista */}
      {showEditListModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-6 w-full max-w-lg max-h-[90vh] flex flex-col gap-4 shadow-2xl relative">
            <button onClick={() => setShowEditListModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            <h3 className="text-xl font-black text-gray-900">{editModalMode === 'sync' ? 'Sincronizar Nomes' : 'Editar Lista da Turma'}</h3>
            <p className="text-sm text-gray-500">
              {editModalMode === 'sync'
                ? 'Cole a lista oficial (mesma ordem/número de chamada). Só os nomes diferentes são corrigidos — ninguém é apagado ou perde histórico.'
                : 'Adicione alunos novos (entram sempre no final) ou remova quem saiu. Quem já está na turma mantém o número de chamada e a posição originais, mesmo mudando a ordem aqui.'}
            </p>
            <div className="flex-1 overflow-y-auto min-h-[300px]">
              <textarea value={editListText} onChange={(e) => setEditListText(e.target.value)} className="w-full h-full min-h-[300px] bg-[#F9FCFA] border border-[#EAF7EF] rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-200 font-medium" placeholder="João&#10;Maria&#10;Pedro" spellCheck={false} />
            </div>
            <button
              onClick={editModalMode === 'sync' ? handleSyncNomes : handleSaveList}
              disabled={savingList}
              className="w-full py-3 rounded-2xl font-black text-white transition-all active:scale-95 disabled:opacity-50"
              style={{ background: editModalMode === 'sync' ? '#1d4ed8' : '#0B7A3D' }}
            >
              {savingList ? 'Salvando...' : editModalMode === 'sync' ? 'Sincronizar' : 'Salvar Lista'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const StudentRiskCard: React.FC<{ student: Student }> = ({ student }) => {
  const isGradeRisk = student.currentAverage !== undefined && student.currentAverage < MIN_PASSING_GRADE;
  const isAbsenceRisk = student.totalAbsences !== undefined && student.totalAbsences >= (MAX_ABSENCES_TOTAL * 0.75);
  return (
    <div className="p-3 rounded-2xl bg-white border border-red-100 flex flex-col gap-2 relative overflow-hidden shadow-sm">
      <div className={cn("absolute left-0 top-0 bottom-0 w-1.5", isAbsenceRisk ? "bg-amber-400" : "bg-red-500")} />
      <span className="font-bold text-gray-900 pl-2">{student.name}</span>
      <div className="flex gap-2 flex-wrap pl-2">
        {isGradeRisk && <span className="px-2 py-0.5 rounded bg-red-50 text-red-600 text-xs font-bold">Nota baixa</span>}
        {isAbsenceRisk && <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 text-xs font-bold flex items-center gap-1"><UserX className="w-3 h-3" /> Faltas Altas</span>}
      </div>
    </div>
  );
};

