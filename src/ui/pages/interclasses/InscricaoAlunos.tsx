import { useState, useEffect, useMemo, useRef, type FormEvent } from 'react';
import { CheckCircle2, Loader2, Pencil, Trash2, X, Link2, Check, Calendar } from 'lucide-react';
import { cn } from '../../AppLayout';
import { buscarAlunos, criarInscricaoInterclasses, atualizarInscricaoInterclasses, excluirInscricaoInterclasses, limparInscricoesInterclasses } from '../../../data/supabase';
import { agruparPorTime, categoriaFromTurma, MAXIMO_JOGADORES_TIME, minimoJogadoresPara, modalidadeConfig } from '../../../domain/interclasses';
import type { InscricaoInterclasses, Modalidade } from '../../../domain/interclasses';

interface AlunoOficial {
  id: string;
  nome: string;
  turma_id: string;
  numero_chamada: number | null;
  sexo: 'M' | 'F' | null;
}

const LABEL_GENERO: Record<'M' | 'F', string> = { M: '👦 Meninos', F: '👧 Meninas' };

interface Props {
  edicao: string;
  modalidade: Modalidade;
  inscricoes: InscricaoInterclasses[];
  turmas: string[];
  loading: boolean;
  onRefetch: () => Promise<void>;
  // Tela pública (sem login) usada pelos próprios alunos: some com Editar,
  // Excluir e "Limpar tudo" — só o professor logado pode alterar/apagar.
  modoPublico?: boolean;
}

const FORM_VAZIO = { nomeCompleto: '', turmaId: '', numeroChamada: '', numeroCamisa: '', nomeTime: '' };

// Datas do regulamento (Mini Projeto-Regulamento — Jogos Interclasses 2026):
// inscrições abertas de 11/09 até o Congresso Técnico, dia 02/10.
const INSCRICOES_INICIO = new Date('2026-09-11T00:00:00');
const INSCRICOES_FIM = new Date('2026-10-02T23:59:59');
const DATA_CONGRESSO_TECNICO = '02/10/2026';

function formatarDataBR(d: Date) {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function LinhaAlunoSelecao({ aluno, marcado, valorCamisa, onToggle, onCamisaChange, grande }: {
  aluno: AlunoOficial; marcado: boolean; valorCamisa?: string;
  onToggle: () => void; onCamisaChange: (v: string) => void; grande?: boolean;
}) {
  return (
    <label className={cn('flex items-center gap-2 cursor-pointer hover:bg-gray-50', marcado && 'bg-primary/5', grande ? 'px-4 py-3.5' : 'px-3 py-2')}>
      <input type="checkbox" checked={marcado} onChange={onToggle} className={cn('accent-primary flex-shrink-0', grande ? 'w-6 h-6' : 'w-4 h-4')} />
      <span className={cn('flex-1 text-on-surface truncate', grande ? 'text-lg' : 'text-sm')}>{aluno.nome}</span>
      {aluno.numero_chamada != null && <span className={cn('text-gray-400 flex-shrink-0', grande ? 'text-sm' : 'text-xs')}>chamada #{aluno.numero_chamada}</span>}
      {marcado && (
        <input
          type="number" min="1"
          value={valorCamisa ?? ''}
          onChange={e => onCamisaChange(e.target.value)}
          onClick={e => e.stopPropagation()}
          title="Número da camisa"
          className={cn('text-center border border-gray-200 rounded-lg outline-none focus:border-primary flex-shrink-0', grande ? 'w-16 text-base py-1.5' : 'w-14 text-xs py-1')}
        />
      )}
    </label>
  );
}

export function InscricaoAlunos({ edicao, modalidade, inscricoes, turmas, loading, onRefetch, modoPublico = false }: Props) {
  const [form, setForm] = useState(FORM_VAZIO);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [alunoIdVinculado, setAlunoIdVinculado] = useState<string | null>(null);
  const [alunosDaTurma, setAlunosDaTurma] = useState<AlunoOficial[]>([]);
  // Seleção múltipla — aluno.id -> nº de camisa (texto) — usada quando a turma
  // tem alunos cadastrados oficialmente (permite marcar vários de uma vez em
  // vez de inscrever um por um).
  const [selecionados, setSelecionados] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [excluindoId, setExcluindoId] = useState<string | null>(null);

  const [busca, setBusca] = useState('');
  const [filtroTurma, setFiltroTurma] = useState('TODAS');
  const [filtroTime, setFiltroTime] = useState('TODOS');
  const [filtroGenero, setFiltroGenero] = useState('TODOS');

  // Sugestões feitas na mão em vez de <datalist> nativo — no Chrome Android
  // o datalist nativo às vezes sobrepõe/esconde o texto digitado.
  const [sugestoesTimeAbertas, setSugestoesTimeAbertas] = useState(false);

  const formRef = useRef<HTMLDivElement>(null);

  // Alunos já cadastrados oficialmente na turma selecionada — usados para a
  // lista de seleção múltipla (ou, se a turma não tiver cadastro oficial,
  // ficam vazios e cai no modo de digitação manual).
  useEffect(() => {
    if (!form.turmaId) { setAlunosDaTurma([]); return; }
    let mounted = true;
    buscarAlunos(form.turmaId).then(data => {
      if (mounted) setAlunosDaTurma((data || []) as AlunoOficial[]);
    });
    return () => { mounted = false; };
  }, [form.turmaId]);

  // A cada troca de turma, a seleção múltipla anterior não faz mais sentido.
  useEffect(() => { setSelecionados({}); }, [form.turmaId]);

  const usaListaOficial = !editingId && alunosDaTurma.length > 0;

  function handleTurmaChange(turmaId: string) {
    setForm(f => ({ ...f, turmaId, nomeCompleto: '', numeroChamada: '' }));
    setAlunoIdVinculado(null);
  }

  function selecionarTimeSugestao(nome: string) {
    setForm(f => ({ ...f, nomeTime: nome }));
    setSugestoesTimeAbertas(false);
  }

  // Não reseta turmaId/nomeTime — depois de inscrever, o professor continua
  // adicionando mais alunos da mesma turma pro mesmo time, sem ter que
  // reselecionar tudo de novo a cada aluno.
  function limparFormulario() {
    setForm(f => ({ ...FORM_VAZIO, turmaId: f.turmaId, nomeTime: f.nomeTime }));
    setEditingId(null);
    setAlunoIdVinculado(null);
    setSelecionados({});
  }

  function iniciarEdicao(insc: InscricaoInterclasses) {
    setEditingId(insc.id);
    setAlunoIdVinculado(insc.aluno_id);
    setForm({
      nomeCompleto: insc.nome_completo,
      turmaId: insc.turma_id,
      numeroChamada: String(insc.numero_chamada),
      numeroCamisa: String(insc.numero_camisa),
      nomeTime: insc.nome_time,
    });
    setErro(null);
    setSucesso(null);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Camisas já usadas nesse time (edição atual) — usado tanto pra sugerir o
  // próximo número livre quanto pra barrar duplicidade.
  function camisasUsadasNoTime(nomeTime: string, ignorarId?: string | null): Set<number> {
    const norm = nomeTime.trim().toLowerCase();
    const usadas = new Set<number>();
    inscricoes.forEach(i => {
      if (i.id !== ignorarId && i.nome_time.trim().toLowerCase() === norm) usadas.add(i.numero_camisa);
    });
    return usadas;
  }

  function proximaCamisaLivre(usadas: Set<number>): number {
    let n = 1;
    while (usadas.has(n)) n++;
    return n;
  }

  // Aluno sem numero_chamada = nao esta mais ativo na turma (transferido/saiu
  // -- ver zeramento em massa feito na atualizacao do Simaed). Nao faz sentido
  // oferece-lo como opcao de inscricao no Interclasses.
  const alunosDisponiveis = useMemo(
    () => alunosDaTurma.filter(a => a.numero_chamada != null && !inscricoes.some(i => i.aluno_id === a.id)),
    [alunosDaTurma, inscricoes]
  );

  const alunosPorGenero = useMemo(() => ({
    M: alunosDisponiveis.filter(a => a.sexo === 'M'),
    F: alunosDisponiveis.filter(a => a.sexo === 'F'),
    semGenero: alunosDisponiveis.filter(a => !a.sexo),
  }), [alunosDisponiveis]);

  function marcarComProximaCamisa(prev: Record<string, string>, aluno: AlunoOficial): Record<string, string> {
    const usadas = camisasUsadasNoTime(form.nomeTime);
    Object.values(prev).forEach(v => { const n = parseInt(v, 10); if (!isNaN(n)) usadas.add(n); });
    return { ...prev, [aluno.id]: String(proximaCamisaLivre(usadas)) };
  }

  function toggleSelecionado(aluno: AlunoOficial) {
    setSelecionados(prev => {
      if (aluno.id in prev) {
        const next = { ...prev };
        delete next[aluno.id];
        return next;
      }
      return marcarComProximaCamisa(prev, aluno);
    });
  }

  function alternarGrupo(alunosDoGrupo: AlunoOficial[]) {
    const todosMarcados = alunosDoGrupo.length > 0 && alunosDoGrupo.every(a => a.id in selecionados);
    setSelecionados(prev => {
      let next = { ...prev };
      if (todosMarcados) {
        alunosDoGrupo.forEach(a => { delete next[a.id]; });
      } else {
        alunosDoGrupo.forEach(a => { if (!(a.id in next)) next = marcarComProximaCamisa(next, a); });
      }
      return next;
    });
  }

  function validar(): string | null {
    const nome = form.nomeCompleto.trim();
    if (!nome) return 'Informe o nome completo do aluno.';
    if (!form.turmaId) return 'Selecione a turma.';
    const chamada = parseInt(form.numeroChamada, 10);
    if (!Number.isInteger(chamada) || chamada <= 0 || String(chamada) !== form.numeroChamada.trim()) {
      return 'Informe um número de chamada válido (inteiro positivo).';
    }
    const camisa = parseInt(form.numeroCamisa, 10);
    if (!Number.isInteger(camisa) || camisa <= 0 || String(camisa) !== form.numeroCamisa.trim()) {
      return 'Informe um número de camisa válido (inteiro positivo).';
    }
    const time = form.nomeTime.trim();
    if (!time) return 'Informe o nome do time.';

    const nomeNorm = nome.toLowerCase();
    const timeNorm = time.toLowerCase();

    const duplicadoAluno = inscricoes.some(i => i.id !== editingId && (
      (alunoIdVinculado && i.aluno_id === alunoIdVinculado) ||
      (!alunoIdVinculado && i.turma_id === form.turmaId && i.nome_completo.trim().toLowerCase() === nomeNorm)
    ));
    if (duplicadoAluno) return `${nome} já está inscrito no Interclasses IOP ${edicao}.`;

    const camisaDuplicada = inscricoes.some(i => i.id !== editingId &&
      i.nome_time.trim().toLowerCase() === timeNorm && i.numero_camisa === camisa);
    if (camisaDuplicada) return `O número da camisa ${camisa} já está sendo utilizado por outro aluno do time ${time}.`;

    const jogadoresNoTime = inscricoes.filter(i => i.id !== editingId && i.nome_time.trim().toLowerCase() === timeNorm).length;
    if (jogadoresNoTime >= MAXIMO_JOGADORES_TIME) return `O time "${time}" já atingiu o máximo de ${MAXIMO_JOGADORES_TIME} jogadores.`;

    return null;
  }

  // Envio de UM registro por vez — usado pra editar uma inscrição existente,
  // ou pra inscrever manualmente em turmas sem cadastro oficial de alunos.
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const msgErro = validar();
    if (msgErro) { setErro(msgErro); setSucesso(null); return; }
    setErro(null);
    setSalvando(true);
    try {
      const payload = {
        edicao,
        aluno_id: alunoIdVinculado,
        nome_completo: form.nomeCompleto.trim(),
        turma_id: form.turmaId,
        numero_chamada: parseInt(form.numeroChamada, 10),
        numero_camisa: parseInt(form.numeroCamisa, 10),
        nome_time: form.nomeTime.trim(),
        modalidade,
        categoria: categoriaFromTurma(form.turmaId),
      };
      if (editingId) {
        await atualizarInscricaoInterclasses(editingId, payload);
        setSucesso('Inscrição atualizada com sucesso!');
      } else {
        await criarInscricaoInterclasses(payload);
        setSucesso(`Aluno inscrito com sucesso no Interclasses IOP ${edicao}!`);
      }
      await onRefetch();
      limparFormulario();
      setTimeout(() => setSucesso(null), 3500);
    } catch (e: any) {
      setErro('Erro ao salvar inscrição: ' + (e?.message || 'tente novamente.'));
    } finally {
      setSalvando(false);
    }
  }

  // Envio de VÁRIOS alunos marcados na lista oficial da turma de uma vez só.
  async function handleSubmitLote(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setSucesso(null);

    const nomeTime = form.nomeTime.trim();
    if (!nomeTime) { setErro('Informe o nome do time.'); return; }
    const ids = Object.keys(selecionados);
    if (ids.length === 0) { setErro('Selecione ao menos um aluno da lista.'); return; }

    const usadas = camisasUsadasNoTime(nomeTime);
    const vistoNoLote = new Set<number>();
    const erros: string[] = [];
    const validos: { aluno: AlunoOficial; camisa: number }[] = [];

    for (const id of ids) {
      const aluno = alunosDaTurma.find(a => a.id === id);
      if (!aluno) continue;
      if (!aluno.numero_chamada || aluno.numero_chamada <= 0) {
        erros.push(`${aluno.nome}: sem número de chamada cadastrado`);
        continue;
      }
      const camisa = parseInt(selecionados[id], 10);
      if (!Number.isInteger(camisa) || camisa <= 0) {
        erros.push(`${aluno.nome}: número de camisa inválido`);
        continue;
      }
      if (usadas.has(camisa) || vistoNoLote.has(camisa)) {
        erros.push(`${aluno.nome}: camisa ${camisa} já em uso no time`);
        continue;
      }
      vistoNoLote.add(camisa);
      validos.push({ aluno, camisa });
    }

    if (validos.length === 0) { setErro(erros.join(' | ') || 'Nenhum aluno válido para inscrever.'); return; }

    setSalvando(true);
    try {
      for (const { aluno, camisa } of validos) {
        await criarInscricaoInterclasses({
          edicao,
          aluno_id: aluno.id,
          nome_completo: aluno.nome,
          turma_id: form.turmaId,
          numero_chamada: aluno.numero_chamada!,
          numero_camisa: camisa,
          nome_time: nomeTime,
          modalidade,
          categoria: categoriaFromTurma(form.turmaId),
          genero: aluno.sexo,
        });
      }
      await onRefetch();
      setSelecionados({});
      setSucesso(`${validos.length} aluno(s) inscrito(s) com sucesso!${erros.length ? ` ${erros.length} ignorado(s).` : ''}`);
      setTimeout(() => setSucesso(null), 4500);
      if (erros.length) setErro(erros.join(' | '));
    } catch (e: any) {
      setErro('Erro ao inscrever alunos: ' + (e?.message || 'tente novamente.'));
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(insc: InscricaoInterclasses) {
    if (!window.confirm(`Excluir a inscrição de "${insc.nome_completo}"? Essa ação não pode ser desfeita.`)) return;
    setExcluindoId(insc.id);
    try {
      await excluirInscricaoInterclasses(insc.id);
      await onRefetch();
      if (editingId === insc.id) limparFormulario();
    } catch (e) {
      alert('Erro ao excluir a inscrição. Tente novamente.');
    } finally {
      setExcluindoId(null);
    }
  }

  const [limpandoTudo, setLimpandoTudo] = useState(false);
  const [linkCopiado, setLinkCopiado] = useState(false);

  const linkInscricaoPublico = typeof window !== 'undefined' ? `${window.location.origin}/interclasses/inscricao` : '';
  const linkResultadosPublico = typeof window !== 'undefined' ? `${window.location.origin}/interclasses/resultados` : '';

  async function copiarLinkInscricao() {
    try {
      await navigator.clipboard.writeText(linkInscricaoPublico);
      setLinkCopiado(true);
      setTimeout(() => setLinkCopiado(false), 2500);
    } catch {
      alert('Não foi possível copiar. Copie manualmente:\n\n' + linkInscricaoPublico);
    }
  }

  async function limparTudo() {
    if (inscricoes.length === 0) return;
    if (!window.confirm(`Isso vai apagar TODAS as ${inscricoes.length} inscrições do Interclasses ${edicao}. Essa ação não pode ser desfeita. Confirmar?`)) return;
    if (!window.confirm('Tem certeza mesmo? Não tem como recuperar depois.')) return;
    setLimpandoTudo(true);
    try {
      await limparInscricoesInterclasses(edicao);
      await onRefetch();
      limparFormulario();
    } catch (e) {
      alert('Erro ao limpar as inscrições. Tente novamente.');
    } finally {
      setLimpandoTudo(false);
    }
  }

  // Nomes de time já usados, um por equipe (ignorando maiúsculas/espaços — mesma
  // lógica de agrupamento da aba Equipes), pra alimentar sugestão e filtro.
  const timesUnicos = useMemo(() => agruparPorTime(inscricoes).map(e => e.nomeTime), [inscricoes]);

  const sugestoesTime = useMemo(() => {
    const termo = form.nomeTime.trim().toLowerCase();
    return timesUnicos.filter(t => !termo || t.toLowerCase().includes(termo));
  }, [timesUnicos, form.nomeTime]);

  const listaFiltrada = useMemo(() => {
    const buscaNorm = busca.trim().toLowerCase();
    const filtroTimeNorm = filtroTime.trim().toLowerCase();
    return inscricoes.filter(i =>
      (!buscaNorm || i.nome_completo.toLowerCase().includes(buscaNorm)) &&
      (filtroTurma === 'TODAS' || i.turma_id === filtroTurma) &&
      (filtroTime === 'TODOS' || i.nome_time.trim().toLowerCase() === filtroTimeNorm) &&
      (filtroGenero === 'TODOS' || i.genero === filtroGenero)
    );
  }, [inscricoes, busca, filtroTurma, filtroTime, filtroGenero]);

  const filtrosAtivos = busca.trim() !== '' || filtroTurma !== 'TODAS' || filtroTime !== 'TODOS' || filtroGenero !== 'TODOS';
  const corModalidade = modalidadeConfig(modalidade).cor;
  const equipesFiltradas = useMemo(() => agruparPorTime(listaFiltrada), [listaFiltrada]);

  const agora = new Date();
  const inscricoesEncerradas = agora > INSCRICOES_FIM;

  return (
    <div className="flex flex-col gap-4">
      <div className={cn(
        'rounded-2xl border px-4 py-3 flex items-center gap-3',
        modoPublico
          ? 'bg-white border-gray-100 shadow-sm'
          : inscricoesEncerradas ? 'bg-gray-50 border-gray-200' : 'bg-blue-50 border-blue-200'
      )}>
        <Calendar className={cn('w-5 h-5 shrink-0', inscricoesEncerradas ? 'text-gray-500' : 'text-blue-600')} />
        <div>
          <p className={cn('text-sm font-semibold', inscricoesEncerradas ? 'text-gray-700' : 'text-blue-900')}>
            {inscricoesEncerradas ? 'Inscrições encerradas' : `Inscrições abertas até ${formatarDataBR(INSCRICOES_FIM)}`}
          </p>
          <p className={cn('text-xs', inscricoesEncerradas ? 'text-gray-500' : 'text-blue-700')}>
            Período: {formatarDataBR(INSCRICOES_INICIO)} a {formatarDataBR(INSCRICOES_FIM)} · Congresso Técnico no dia {DATA_CONGRESSO_TECNICO}
          </p>
        </div>
      </div>

      {!modoPublico && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <h3 className="font-bold text-on-surface text-sm mb-1 flex items-center gap-1.5">
            <Link2 className="w-4 h-4 text-primary" /> Link público de inscrição
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            Compartilhe esse link com os alunos — eles se inscrevem sozinhos, sem precisar de login. Cada aluno escolhe a modalidade dentro da página.
          </p>
          <div className="flex items-center gap-2 mb-2">
            <input
              readOnly
              value={linkInscricaoPublico}
              onFocus={e => e.target.select()}
              className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-600 outline-none"
            />
            <button
              onClick={copiarLinkInscricao}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary hover:bg-primary-dark text-white text-xs font-bold transition-colors flex-shrink-0"
            >
              {linkCopiado ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
              {linkCopiado ? 'Copiado!' : 'Copiar'}
            </button>
          </div>
          <p className="text-[11px] text-gray-400">
            Pra acompanhar jogos e classificação sem login: <span className="text-gray-600 font-medium">{linkResultadosPublico}</span>
          </p>
        </div>
      )}

      {/* Formulário */}
      <div ref={formRef} className={cn('bg-white rounded-2xl border border-gray-100 shadow-sm', modoPublico ? 'p-5' : 'p-4')}>
        <div className="flex items-center justify-between mb-3">
          <h3 className={cn('font-bold', modoPublico ? 'text-xl' : 'text-sm text-on-surface')} style={modoPublico ? { color: corModalidade } : undefined}>
            {editingId ? '✎ Editar inscrição' : modoPublico ? '📝 Inscreva-se!' : `📝 Inscrição de Alunos — Interclasses ${edicao}`}
          </h3>
          {editingId && (
            <button onClick={limparFormulario} className="text-xs text-gray-500 hover:text-error flex items-center gap-1">
              <X className="w-3.5 h-3.5" /> Cancelar edição
            </button>
          )}
        </div>

        <form onSubmit={usaListaOficial ? handleSubmitLote : handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className={cn('font-semibold text-gray-500 mb-1 block', modoPublico ? 'text-sm' : 'text-xs')}>Turma/Série *</label>
            <select
              value={form.turmaId}
              onChange={e => handleTurmaChange(e.target.value)}
              required
              className={cn('w-full bg-gray-50 border border-gray-200 rounded-xl text-on-surface outline-none focus:border-primary', modoPublico ? 'px-4 py-3.5 text-lg' : 'px-3 py-2.5 text-sm')}
            >
              <option value="" disabled>Selecione a turma</option>
              {turmas.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {turmas.length === 0 && (
              <p className="text-[11px] text-gray-400 mt-1">Nenhuma turma encontrada no cadastro de alunos.</p>
            )}
          </div>

          <div className="relative">
            <label className={cn('font-semibold text-gray-500 mb-1 block', modoPublico ? 'text-sm' : 'text-xs')}>Nome do time *</label>
            <input
              type="text"
              autoComplete="off"
              value={form.nomeTime}
              onChange={e => { setForm(f => ({ ...f, nomeTime: e.target.value })); setSugestoesTimeAbertas(true); }}
              onFocus={() => setSugestoesTimeAbertas(true)}
              onBlur={() => setTimeout(() => setSugestoesTimeAbertas(false), 150)}
              placeholder="Ex: Os Pernas de Pau"
              required
              className={cn('w-full bg-gray-50 border border-gray-200 rounded-xl text-on-surface outline-none focus:border-primary', modoPublico ? 'px-4 py-3.5 text-lg' : 'px-3 py-2.5 text-sm')}
            />
            {sugestoesTimeAbertas && sugestoesTime.length > 0 && (
              <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
                {sugestoesTime.map(t => (
                  <button
                    key={t}
                    type="button"
                    onMouseDown={() => selecionarTimeSugestao(t)}
                    className="w-full text-left px-3 py-2 text-sm text-on-surface hover:bg-gray-50 truncate border-b border-gray-50 last:border-0"
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
            <p className="text-[11px] text-gray-400 mt-1">
              Não precisa ser igual ao nome da turma. Cada time deve ter entre {minimoJogadoresPara(modalidade)} e {MAXIMO_JOGADORES_TIME} jogadores. {timesUnicos.length > 0 && 'Se o time já existe, selecione a sugestão em vez de digitar de novo — evita duplicar o time por erro de digitação.'}
            </p>
          </div>

          {usaListaOficial ? (
            <div>
              <label className={cn('font-semibold text-gray-500 mb-1 block', modoPublico ? 'text-sm' : 'text-xs')}>
                Alunos da turma * (selecione um ou mais — {Object.keys(selecionados).length} selecionado{Object.keys(selecionados).length !== 1 ? 's' : ''})
              </label>
              <div className="border border-gray-200 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                {(['M', 'F'] as const).map(genero => {
                  const alunosDoGrupo = alunosPorGenero[genero];
                  if (alunosDoGrupo.length === 0) return null;
                  const todosMarcados = alunosDoGrupo.every(a => a.id in selecionados);
                  return (
                    <div key={genero}>
                      <div className={cn('flex items-center justify-between bg-gray-50 border-b border-gray-100', modoPublico ? 'px-4 py-2.5' : 'px-3 py-1.5')}>
                        <span className={cn('font-bold text-gray-600', modoPublico ? 'text-base' : 'text-xs')}>{LABEL_GENERO[genero]}</span>
                        <button type="button" onClick={() => alternarGrupo(alunosDoGrupo)} className={cn('text-primary font-semibold hover:underline', modoPublico ? 'text-sm' : 'text-[11px]')}>
                          {todosMarcados ? 'Desmarcar todos' : 'Marcar todos'}
                        </button>
                      </div>
                      <div className="divide-y divide-gray-50">
                        {alunosDoGrupo.map(a => (
                          <LinhaAlunoSelecao key={a.id} aluno={a} marcado={a.id in selecionados} valorCamisa={selecionados[a.id]} grande={modoPublico}
                            onToggle={() => toggleSelecionado(a)} onCamisaChange={v => setSelecionados(prev => ({ ...prev, [a.id]: v }))} />
                        ))}
                      </div>
                    </div>
                  );
                })}
                {alunosPorGenero.semGenero.length > 0 && (
                  <div>
                    {!modoPublico && (
                      <div className="px-3 py-1.5 bg-amber-50 border-b-2 border-amber-200">
                        <span className="text-xs font-bold text-amber-700">⚠️ Sem gênero marcado</span>
                        <p className="text-[10px] text-amber-600 mt-0.5">Use a tela "Marcar Gênero" (aba Turmas) pra classificar — por enquanto aparecem aqui, sem separar por menino/menina.</p>
                      </div>
                    )}
                    <div className="divide-y divide-gray-200">
                      {alunosPorGenero.semGenero.map(a => (
                        <LinhaAlunoSelecao key={a.id} aluno={a} marcado={a.id in selecionados} valorCamisa={selecionados[a.id]} grande={modoPublico}
                          onToggle={() => toggleSelecionado(a)} onCamisaChange={v => setSelecionados(prev => ({ ...prev, [a.id]: v }))} />
                      ))}
                    </div>
                  </div>
                )}
                {alunosDisponiveis.length === 0 && (
                  <div className="px-3 py-4 text-xs text-gray-400 text-center">Todos os alunos desta turma já estão inscritos no Interclasses {edicao}.</div>
                )}
              </div>
            </div>
          ) : (
            <>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Nome completo do aluno *</label>
                <input
                  type="text"
                  autoComplete="off"
                  value={form.nomeCompleto}
                  onChange={e => setForm(f => ({ ...f, nomeCompleto: e.target.value }))}
                  placeholder={form.turmaId ? 'Digite o nome do aluno' : 'Selecione a turma primeiro'}
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary"
                />
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Nº da chamada *</label>
                  <input
                    type="number" min="1" step="1"
                    value={form.numeroChamada}
                    onChange={e => setForm(f => ({ ...f, numeroChamada: e.target.value }))}
                    placeholder="Ex: 12"
                    required
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Nº da camisa *</label>
                  <input
                    type="number" min="1" step="1"
                    value={form.numeroCamisa}
                    onChange={e => setForm(f => ({ ...f, numeroCamisa: e.target.value }))}
                    placeholder="Ex: 10"
                    required
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary"
                  />
                </div>
              </div>
            </>
          )}

          {erro && (
            <div className="bg-error-container/60 border border-error/30 rounded-xl px-3 py-2 text-error text-xs font-medium">
              ⚠️ {erro}
            </div>
          )}
          {sucesso && (
            <div className="bg-secondary-container/60 border border-secondary/30 rounded-xl px-3 py-2 text-on-secondary-container text-xs font-medium flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> {sucesso}
            </div>
          )}

          <button
            type="submit"
            disabled={salvando || (usaListaOficial && Object.keys(selecionados).length === 0)}
            className={cn(
              'w-full rounded-xl disabled:opacity-50 text-white font-bold transition flex items-center justify-center gap-2 shadow-sm hover:brightness-95 active:brightness-90',
              modoPublico ? 'py-4 text-lg' : 'py-3 text-sm'
            )}
            style={{ background: '#f59e0b' }}
          >
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {salvando
              ? 'Salvando...'
              : editingId
                ? 'Salvar Alterações'
                : usaListaOficial
                  ? `Inscrever ${Object.keys(selecionados).length} Aluno${Object.keys(selecionados).length === 1 ? '' : 's'}`
                  : 'Inscrever Aluno'}
          </button>
        </form>
      </div>

      {/* Lista + filtros */}
      <div className={cn('bg-white rounded-2xl border border-gray-100 shadow-sm', modoPublico ? 'p-5' : 'p-4')}>
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <h3 className={cn('font-bold text-on-surface', modoPublico ? 'text-lg' : 'text-sm')}>{modoPublico ? 'Times inscritos' : `Alunos Inscritos — Interclasses ${edicao}`}</h3>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{listaFiltrada.length}/{inscricoes.length}</span>
            {!modoPublico && inscricoes.length > 0 && (
              <button
                onClick={limparTudo}
                disabled={limpandoTudo}
                className="flex items-center gap-1 text-[11px] text-error/70 hover:text-error font-medium disabled:opacity-40"
                title="Apagar todas as inscrições desta edição"
              >
                <Trash2 className="w-3 h-3" /> {limpandoTudo ? 'Limpando...' : 'Limpar tudo'}
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 mb-3">
          <input
            type="text"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="🔎 Buscar aluno pelo nome"
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-on-surface outline-none focus:border-primary"
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <select
              value={filtroTurma}
              onChange={e => setFiltroTurma(e.target.value)}
              className="w-full min-w-0 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-on-surface outline-none focus:border-primary"
            >
              <option value="TODAS">Todas as turmas</option>
              {turmas.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select
              value={filtroTime}
              onChange={e => setFiltroTime(e.target.value)}
              className="w-full min-w-0 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-on-surface outline-none focus:border-primary"
            >
              <option value="TODOS">Todos os times</option>
              {timesUnicos.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select
              value={filtroGenero}
              onChange={e => setFiltroGenero(e.target.value)}
              className="w-full min-w-0 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-on-surface outline-none focus:border-primary"
            >
              <option value="TODOS">Meninos e meninas</option>
              <option value="M">👦 Meninos</option>
              <option value="F">👧 Meninas</option>
            </select>
          </div>
          {filtrosAtivos && (
            <button
              onClick={() => { setBusca(''); setFiltroTurma('TODAS'); setFiltroTime('TODOS'); setFiltroGenero('TODOS'); }}
              className="self-end text-xs text-gray-500 hover:text-primary"
            >
              Limpar filtros
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex gap-2 items-center justify-center py-8 text-gray-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando inscrições...
          </div>
        ) : listaFiltrada.length === 0 ? (
          <div className="text-center text-gray-500 py-8 text-sm px-2">
            {inscricoes.length === 0
              ? 'Nenhum aluno inscrito ainda. Use o formulário acima para começar.'
              : 'Nenhuma inscrição encontrada com esses filtros.'}
          </div>
        ) : modoPublico ? (
          <div className="flex flex-col gap-3">
            {equipesFiltradas.map(eq => (
              <div key={eq.nomeTime} className="rounded-2xl border border-gray-100 overflow-hidden">
                <div className="flex items-center justify-between gap-2 px-4 py-2.5" style={{ background: `${corModalidade}14` }}>
                  <span className="font-bold text-base text-on-surface truncate">{eq.nomeTime}</span>
                  <span className={cn(
                    'text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0',
                    eq.completo ? 'bg-secondary-container text-on-secondary-container' : 'bg-amber-100 text-amber-700'
                  )}>
                    {eq.completo ? `✅ ${eq.alunos.length}/${MAXIMO_JOGADORES_TIME}` : `⏳ ${eq.alunos.length}/${eq.minimoJogadores}`}
                  </span>
                </div>
                <div className="divide-y divide-gray-50">
                  {eq.alunos.map(a => (
                    <div key={a.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="text-primary font-mono text-sm w-9 flex-shrink-0">#{a.numero_camisa}</span>
                      <span className="flex-1 text-base text-on-surface truncate">{a.nome_completo}</span>
                      <span className="text-gray-400 text-sm flex-shrink-0">{a.turma_id}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-xs min-w-[560px]">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="py-2 px-1 font-semibold">Nº</th>
                  <th className="py-2 px-1 font-semibold">Nome completo</th>
                  <th className="py-2 px-1 font-semibold">Turma</th>
                  <th className="py-2 px-1 font-semibold">Chamada</th>
                  <th className="py-2 px-1 font-semibold">Camisa</th>
                  <th className="py-2 px-1 font-semibold">Time</th>
                  {!modoPublico && <th className="py-2 px-1 font-semibold text-right">Ações</th>}
                </tr>
              </thead>
              <tbody>
                {listaFiltrada.map((insc, i) => (
                  <tr key={insc.id} className="border-b border-gray-50 last:border-0">
                    <td className="py-2 px-1 text-gray-400">{i + 1}</td>
                    <td className="py-2 px-1 font-medium text-on-surface whitespace-nowrap">{insc.nome_completo}</td>
                    <td className="py-2 px-1 text-gray-500 font-mono">{insc.turma_id}</td>
                    <td className="py-2 px-1 text-gray-500">{insc.numero_chamada}</td>
                    <td className="py-2 px-1 text-gray-500">#{insc.numero_camisa}</td>
                    <td className="py-2 px-1 text-gray-500 whitespace-nowrap">{insc.nome_time}</td>
                    {!modoPublico && (
                      <td className="py-2 px-1">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => iniciarEdicao(insc)} title="Editar" className="text-gray-400 hover:text-primary">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => excluir(insc)}
                            disabled={excluindoId === insc.id}
                            title="Excluir"
                            className={cn("text-gray-400 hover:text-error", excluindoId === insc.id && "opacity-40")}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
