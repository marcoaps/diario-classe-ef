import { useState, useEffect, useMemo, useRef, type FormEvent } from 'react';
import { CheckCircle2, Loader2, Pencil, Trash2, X } from 'lucide-react';
import { cn } from '../../AppLayout';
import { buscarAlunos, criarInscricaoInterclasses, atualizarInscricaoInterclasses, excluirInscricaoInterclasses, limparInscricoesInterclasses } from '../../../data/supabase';
import { agruparPorTime, MINIMO_JOGADORES_TIME, MAXIMO_JOGADORES_TIME } from '../../../domain/interclasses';
import type { InscricaoInterclasses } from '../../../domain/interclasses';

interface AlunoOficial {
  id: string;
  nome: string;
  turma_id: string;
  numero_chamada: number | null;
}

interface Props {
  edicao: string;
  inscricoes: InscricaoInterclasses[];
  turmas: string[];
  loading: boolean;
  onRefetch: () => Promise<void>;
  // Tela pública (sem login) usada pelos próprios alunos: some com Editar,
  // Excluir e "Limpar tudo" — só o professor logado pode alterar/apagar.
  modoPublico?: boolean;
}

const FORM_VAZIO = { nomeCompleto: '', turmaId: '', numeroChamada: '', numeroCamisa: '', nomeTime: '' };

export function InscricaoAlunos({ edicao, inscricoes, turmas, loading, onRefetch, modoPublico = false }: Props) {
  const [form, setForm] = useState(FORM_VAZIO);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [alunoIdVinculado, setAlunoIdVinculado] = useState<string | null>(null);
  const [alunosDaTurma, setAlunosDaTurma] = useState<AlunoOficial[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [excluindoId, setExcluindoId] = useState<string | null>(null);

  const [busca, setBusca] = useState('');
  const [filtroTurma, setFiltroTurma] = useState('TODAS');
  const [filtroTime, setFiltroTime] = useState('TODOS');

  // Sugestões feitas na mão em vez de <datalist> nativo — no Chrome Android
  // o datalist nativo às vezes sobrepõe/esconde o texto digitado.
  const [sugestoesAlunoAbertas, setSugestoesAlunoAbertas] = useState(false);
  const [sugestoesTimeAbertas, setSugestoesTimeAbertas] = useState(false);

  const formRef = useRef<HTMLDivElement>(null);

  // Alunos já cadastrados oficialmente na turma selecionada — usados para
  // sugerir o nome e autopreencher o nº de chamada.
  useEffect(() => {
    if (!form.turmaId) { setAlunosDaTurma([]); return; }
    let mounted = true;
    buscarAlunos(form.turmaId).then(data => {
      if (mounted) setAlunosDaTurma((data || []) as AlunoOficial[]);
    });
    return () => { mounted = false; };
  }, [form.turmaId]);

  function handleTurmaChange(turmaId: string) {
    setForm(f => ({ ...f, turmaId, nomeCompleto: '', numeroChamada: '' }));
    setAlunoIdVinculado(null);
  }

  function handleNomeChange(nome: string) {
    setForm(f => ({ ...f, nomeCompleto: nome }));
    const match = alunosDaTurma.find(a => a.nome.trim().toLowerCase() === nome.trim().toLowerCase());
    if (match) {
      setAlunoIdVinculado(match.id);
      if (match.numero_chamada) setForm(f => ({ ...f, nomeCompleto: nome, numeroChamada: String(match.numero_chamada) }));
    } else {
      setAlunoIdVinculado(null);
    }
  }

  function selecionarAlunoSugestao(aluno: AlunoOficial) {
    setForm(f => ({ ...f, nomeCompleto: aluno.nome, numeroChamada: aluno.numero_chamada ? String(aluno.numero_chamada) : f.numeroChamada }));
    setAlunoIdVinculado(aluno.id);
    setSugestoesAlunoAbertas(false);
  }

  function selecionarTimeSugestao(nome: string) {
    setForm(f => ({ ...f, nomeTime: nome }));
    setSugestoesTimeAbertas(false);
  }

  const sugestoesAluno = useMemo(() => {
    const termo = form.nomeCompleto.trim().toLowerCase();
    // Sem limite artificial — uma turma inteira (até ~36 alunos) cabe numa
    // lista rolável, e cortar a lista escondia quem vinha depois do 8º.
    return alunosDaTurma.filter(a => !termo || a.nome.toLowerCase().includes(termo));
  }, [alunosDaTurma, form.nomeCompleto]);

  function limparFormulario() {
    setForm(FORM_VAZIO);
    setEditingId(null);
    setAlunoIdVinculado(null);
    setAlunosDaTurma([]);
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
      (filtroTime === 'TODOS' || i.nome_time.trim().toLowerCase() === filtroTimeNorm)
    );
  }, [inscricoes, busca, filtroTurma, filtroTime]);

  const filtrosAtivos = busca.trim() !== '' || filtroTurma !== 'TODAS' || filtroTime !== 'TODOS';

  return (
    <div className="flex flex-col gap-4">
      {/* Formulário */}
      <div ref={formRef} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-on-surface text-sm">
            {editingId ? '✎ Editar inscrição' : `📝 Inscrição de Alunos — Interclasses ${edicao}`}
          </h3>
          {editingId && (
            <button onClick={limparFormulario} className="text-xs text-gray-500 hover:text-error flex items-center gap-1">
              <X className="w-3.5 h-3.5" /> Cancelar edição
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Turma/Série *</label>
            <select
              value={form.turmaId}
              onChange={e => handleTurmaChange(e.target.value)}
              required
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary"
            >
              <option value="" disabled>Selecione a turma</option>
              {turmas.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {turmas.length === 0 && (
              <p className="text-[11px] text-gray-400 mt-1">Nenhuma turma encontrada no cadastro de alunos.</p>
            )}
          </div>

          <div className="relative">
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Nome completo do aluno *</label>
            <input
              type="text"
              autoComplete="off"
              value={form.nomeCompleto}
              onChange={e => { handleNomeChange(e.target.value); setSugestoesAlunoAbertas(true); }}
              onFocus={() => setSugestoesAlunoAbertas(true)}
              onBlur={() => setTimeout(() => setSugestoesAlunoAbertas(false), 150)}
              placeholder={form.turmaId ? 'Digite ou selecione o aluno da turma' : 'Selecione a turma primeiro'}
              required
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary"
            />
            {sugestoesAlunoAbertas && form.turmaId && sugestoesAluno.length > 0 && (
              <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
                {sugestoesAluno.map(a => (
                  <button
                    key={a.id}
                    type="button"
                    onMouseDown={() => selecionarAlunoSugestao(a)}
                    className="w-full text-left px-3 py-2 text-sm text-on-surface hover:bg-gray-50 flex items-center justify-between gap-2 border-b border-gray-50 last:border-0"
                  >
                    <span className="truncate">{a.nome}</span>
                    {a.numero_chamada != null && <span className="text-gray-400 text-xs flex-shrink-0">#{a.numero_chamada}</span>}
                  </button>
                ))}
              </div>
            )}
            {alunoIdVinculado && (
              <p className="text-[11px] text-secondary mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Aluno reconhecido no cadastro da turma — nº de chamada preenchido automaticamente.
              </p>
            )}
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

          <div className="relative">
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Nome do time *</label>
            <input
              type="text"
              autoComplete="off"
              value={form.nomeTime}
              onChange={e => { setForm(f => ({ ...f, nomeTime: e.target.value })); setSugestoesTimeAbertas(true); }}
              onFocus={() => setSugestoesTimeAbertas(true)}
              onBlur={() => setTimeout(() => setSugestoesTimeAbertas(false), 150)}
              placeholder="Ex: Os Pernas de Pau"
              required
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary"
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
              Não precisa ser igual ao nome da turma. Cada time deve ter entre {MINIMO_JOGADORES_TIME} e {MAXIMO_JOGADORES_TIME} jogadores. {timesUnicos.length > 0 && 'Se o time já existe, selecione a sugestão em vez de digitar de novo — evita duplicar o time por erro de digitação.'}
            </p>
          </div>

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
            disabled={salvando}
            className="w-full py-3 rounded-xl bg-primary hover:bg-primary-dark disabled:opacity-50 text-white text-sm font-bold transition-colors flex items-center justify-center gap-2"
          >
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {salvando ? 'Salvando...' : editingId ? 'Salvar Alterações' : 'Inscrever Aluno'}
          </button>
        </form>
      </div>

      {/* Lista + filtros */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <h3 className="font-bold text-on-surface text-sm">Alunos Inscritos — Interclasses {edicao}</h3>
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

        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          <input
            type="text"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="🔎 Buscar aluno pelo nome"
            className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-on-surface outline-none focus:border-primary"
          />
          <select
            value={filtroTurma}
            onChange={e => setFiltroTurma(e.target.value)}
            className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-on-surface outline-none focus:border-primary"
          >
            <option value="TODAS">Todas as turmas</option>
            {turmas.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select
            value={filtroTime}
            onChange={e => setFiltroTime(e.target.value)}
            className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-on-surface outline-none focus:border-primary"
          >
            <option value="TODOS">Todos os times</option>
            {timesUnicos.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          {filtrosAtivos && (
            <button
              onClick={() => { setBusca(''); setFiltroTurma('TODAS'); setFiltroTime('TODOS'); }}
              className="text-xs text-gray-500 hover:text-primary px-2 whitespace-nowrap"
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
