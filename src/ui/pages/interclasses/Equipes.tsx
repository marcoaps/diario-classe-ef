import { useMemo, useState } from 'react';
import { Loader2, Pencil, Check, X, Trash2, FileDown } from 'lucide-react';
import { agruparPorTime, EDICAO_PADRAO, MODALIDADES, modalidadeConfig,chaveElegibilidade, ELEGIBILIDADE_COR, ELEGIBILIDADE_LABEL, MAXIMO_JOGADORES_TIME, mensagemMinimoNaoAtingido } from '../../../domain/interclasses';
import type { InscricaoInterclasses } from '../../../domain/interclasses';
import { renomearTimeInterclasses, excluirInscricaoInterclasses, atualizarNotasVermelhasElegibilidade, moverTimeDeModalidade, copiarTimeParaModalidade } from '../../../data/supabase';
import type { ElegibilidadeInterclasses } from '../../../data/supabase';
import { baixarEquipesWord } from './exportarEquipesWord';

interface Props {
  inscricoes: InscricaoInterclasses[];
  elegibilidade: ElegibilidadeInterclasses[];
  loading: boolean;
  onRefetch: () => Promise<void>;
}

// Selo curto de "apto pra jogar" ao lado de cada jogador — mesma regra e
// mesmos dados usados na aba "Sugeridos p/ Corte" (ver AlunosSugeridosCorte.tsx),
// só que aqui já dentro do time montado, pra decidir sem trocar de aba. O
// Inapto mostra a contagem real de notas vermelhas (varia por aluno, ex.: 2,
// 3...) em vez de um texto fixo — mesmo padrão usado em InscricaoAlunos.tsx.
const ELEGIBILIDADE_ICONE: Record<ElegibilidadeInterclasses['status'], string> = {
  apto: '✅',
  atencao: '⚠️',
  inapto: '✂️',
  transferido: '↪️',
  remanejado: '↪️',
};

function textoElegibilidade(eleg: ElegibilidadeInterclasses): string {
  if (eleg.status === 'inapto') {
    const n = eleg.notas_vermelhas_final;
    return `Inapto (${n} nota${n !== 1 ? 's' : ''} vermelha${n !== 1 ? 's' : ''})`;
  }
  return ELEGIBILIDADE_LABEL[eleg.status];
}

function SeloElegibilidade({ eleg }: { eleg: ElegibilidadeInterclasses }) {
  return (
    <span
      className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap"
      style={{ color: ELEGIBILIDADE_COR[eleg.status], backgroundColor: `${ELEGIBILIDADE_COR[eleg.status]}1A` }}
      title={textoElegibilidade(eleg)}
    >
      {ELEGIBILIDADE_ICONE[eleg.status]} {textoElegibilidade(eleg)}
    </span>
  );
}

// Secretaria regularizou notas depois do instantâneo importado: o professor
// corrige o nº de notas vermelhas direto na lista do time.
async function ajustarNotasVermelhas(eleg: ElegibilidadeInterclasses, onRefetch: () => Promise<void>) {
  const resp = window.prompt(
    `Quantas notas vermelhas ${eleg.nome} tem agora (após a regularização da Secretaria)?
0 = apto · 1 = atenção (pode jogar) · 2 ou mais = inapto`,
    String(Math.max(0, eleg.notas_vermelhas_final - 1))
  );
  if (resp === null) return;
  const n = parseInt(resp, 10);
  if (!Number.isInteger(n) || n < 0 || String(n) !== resp.trim()) { alert('Digite um número inteiro (0, 1, 2...).'); return; }
  try {
    await atualizarNotasVermelhasElegibilidade(eleg.id, n);
    await onRefetch();
  } catch {
    alert('Não foi possível atualizar. Tente novamente.');
  }
}

export function Equipes({ inscricoes, elegibilidade, loading, onRefetch }: Props) {
  const equipes = useMemo(() => agruparPorTime(inscricoes), [inscricoes]);
  const nomesExistentes = useMemo(() => equipes.map(e => e.nomeTime), [equipes]);

  const elegibilidadePorAlunoId = useMemo(() => {
    const mapa = new Map<string, ElegibilidadeInterclasses>();
    elegibilidade.forEach(e => { if (e.aluno_id) mapa.set(e.aluno_id, e); });
    return mapa;
  }, [elegibilidade]);
  const elegibilidadePorChave = useMemo(() => {
    const mapa = new Map<string, ElegibilidadeInterclasses>();
    elegibilidade.forEach(e => mapa.set(chaveElegibilidade(e.turma_id, e.nome), e));
    return mapa;
  }, [elegibilidade]);

  function elegibilidadeDoAluno(a: InscricaoInterclasses): ElegibilidadeInterclasses | undefined {
    if (a.aluno_id && elegibilidadePorAlunoId.has(a.aluno_id)) return elegibilidadePorAlunoId.get(a.aluno_id);
    return elegibilidadePorChave.get(chaveElegibilidade(a.turma_id, a.nome_completo));
  }

  const [renomeando, setRenomeando] = useState<string | null>(null);
  const [novoNome, setNovoNome] = useState('');
  const [salvando, setSalvando] = useState(false);
  // Marcados pra exclusão em lote — usado pra ajustar o time ao tamanho
  // exigido (mín. 8 / máx. 10) sem precisar ir até a aba "Inscrição de
  // Alunos" e excluir um por um.
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [excluindoLote, setExcluindoLote] = useState(false);

  function iniciarRenomear(nomeAtual: string) {
    setRenomeando(nomeAtual);
    setNovoNome(nomeAtual);
  }

  function toggleSelecionado(id: string) {
    setSelecionados(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function excluirSelecionados(eq: { nomeTime: string; alunos: InscricaoInterclasses[] }) {
    const alunosMarcados = eq.alunos.filter(a => selecionados.has(a.id));
    if (alunosMarcados.length === 0) return;
    if (!window.confirm(`Excluir ${alunosMarcados.length} aluno(s) selecionado(s) do time "${eq.nomeTime}"? Essa ação não pode ser desfeita.`)) return;
    setExcluindoLote(true);
    try {
      for (const a of alunosMarcados) await excluirInscricaoInterclasses(a.id);
      setSelecionados(prev => {
        const next = new Set(prev);
        alunosMarcados.forEach(a => next.delete(a.id));
        return next;
      });
      await onRefetch();
    } catch (e) {
      alert('Erro ao excluir os alunos selecionados. Tente novamente.');
    } finally {
      setExcluindoLote(false);
    }
  }

  // Baixa um .docx editável (fonte 11 pt, uma tabela por equipe) — imprimir a
  // tela do app traria abas/botões junto e o navegador encolhia tudo numa folha.
  async function baixarWord() {
    const mod = modalidadeConfig(equipes[0]?.alunos[0]?.modalidade ?? 'futsal');
    await baixarEquipesWord({
      titulo: `Equipes inscritas — ${mod.label} · Interclasses IOP ${EDICAO_PADRAO}`,
      subtitulo: `Instituto Odilon Pratagi · ${equipes.length} equipe${equipes.length !== 1 ? 's' : ''} · gerado em ${new Date().toLocaleDateString('pt-BR')}`,
      nomeArquivo: `Equipes-${mod.label}-Interclasses-${EDICAO_PADRAO}`,
      equipes: equipes.map(eq => ({
        nome: eq.nomeTime,
        turmas: eq.turmas.join(', '),
        jogadores: eq.alunos.map(a => {
          const eleg = elegibilidadeDoAluno(a);
          return {
            nome: a.nome_completo,
            turma: a.turma_id,
            situacao: eleg ? textoElegibilidade(eleg) : '—',
            status: eleg?.status ?? '',
          };
        }),
      })),
    });
  }

  // Inscreveu o time na modalidade errada: move todos os jogadores de uma vez.
  async function moverTime(eq: { nomeTime: string; alunos: InscricaoInterclasses[] }, destino: string) {
    const origem = eq.alunos[0]?.modalidade ?? 'futsal';
    const rotulo = modalidadeConfig(destino).label;
    if (!window.confirm(`Mover o time "${eq.nomeTime}" (${eq.alunos.length} aluno${eq.alunos.length !== 1 ? 's' : ''}) de ${modalidadeConfig(origem).label} para ${rotulo}?\n\nEles deixam de estar inscritos em ${modalidadeConfig(origem).label}.`)) return;
    try {
      await moverTimeDeModalidade(EDICAO_PADRAO, eq.alunos, eq.nomeTime, origem, destino);
      await onRefetch();
    } catch (e: any) {
      alert(e?.message || 'Erro ao mover o time. Tente novamente.');
    }
  }

  // Mesmo time em outra modalidade, sem tirar da original. Se o time já existe
  // lá, só acrescenta quem falta.
  async function copiarTime(eq: { nomeTime: string; alunos: InscricaoInterclasses[] }, destino: string) {
    const origem = eq.alunos[0]?.modalidade ?? 'futsal';
    const rotulo = modalidadeConfig(destino).label;
    if (!window.confirm(`Copiar o time "${eq.nomeTime}" (${eq.alunos.length} aluno${eq.alunos.length !== 1 ? 's' : ''}) de ${modalidadeConfig(origem).label} para ${rotulo}?

Ele continua em ${modalidadeConfig(origem).label}. Quem já estiver inscrito em ${rotulo} é ignorado.`)) return;
    try {
      const { copiados, ignorados } = await copiarTimeParaModalidade(EDICAO_PADRAO, eq.alunos, eq.nomeTime, destino, MAXIMO_JOGADORES_TIME);
      await onRefetch();
      alert(`${copiados} aluno(s) copiado(s) para ${rotulo}.` + (ignorados.length ? `\n\nIgnorados:\n${ignorados.join('\n')}` : ''));
    } catch (e: any) {
      alert(e?.message || 'Erro ao copiar o time. Tente novamente.');
    }
  }

  async function confirmarRenomear(eq: { nomeTime: string; alunos: InscricaoInterclasses[] }) {
    const nome = novoNome.trim();
    if (!nome || nome === eq.nomeTime) { setRenomeando(null); return; }
    setSalvando(true);
    try {
      await renomearTimeInterclasses(eq.alunos.map(a => a.id), nome);
      await onRefetch();
      setRenomeando(null);
    } catch (e) {
      alert('Erro ao renomear o time. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  if (loading) {
    return (
      <div className="flex gap-2 items-center justify-center py-8 text-gray-500 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando equipes...
      </div>
    );
  }

  if (equipes.length === 0) {
    return (
      <div className="text-center text-gray-500 py-10 font-medium px-4">
        Nenhuma equipe formada ainda. Inscreva alunos na aba "Inscrição de Alunos".
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={baixarWord}
        className="self-end flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:opacity-90"
      >
        <FileDown className="w-4 h-4" /> Baixar Word
      </button>
      {equipes.map(eq => (
        <div key={eq.nomeTime} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
            {renomeando === eq.nomeTime ? (
              <div className="flex items-center gap-1.5 flex-1 min-w-[160px]">
                <input
                  list="times-existentes-equipes"
                  value={novoNome}
                  onChange={e => setNovoNome(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') confirmarRenomear(eq); if (e.key === 'Escape') setRenomeando(null); }}
                  autoFocus
                  disabled={salvando}
                  className="flex-1 bg-gray-50 border border-primary/40 rounded-lg px-2 py-1 text-sm text-on-surface outline-none focus:border-primary"
                />
                <button onClick={() => confirmarRenomear(eq)} disabled={salvando} className="text-secondary hover:text-secondary flex-shrink-0" title="Salvar">
                  <Check className="w-4 h-4" />
                </button>
                <button onClick={() => setRenomeando(null)} disabled={salvando} className="text-gray-400 hover:text-error flex-shrink-0" title="Cancelar">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 min-w-0">
                <h3 className="font-bold text-on-surface text-sm truncate">{eq.nomeTime}</h3>
                <button onClick={() => iniciarRenomear(eq.nomeTime)} className="text-gray-300 hover:text-primary flex-shrink-0" title="Renomear ou mesclar com outro time">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <select
                value=""
                onChange={e => {
                  const [acao, destino] = e.target.value.split(':');
                  if (acao === 'mover') moverTime(eq, destino);
                  if (acao === 'copiar') copiarTime(eq, destino);
                }}
                className="text-[11px] text-gray-500 bg-gray-50 border border-gray-200 rounded-full px-2 py-0.5 outline-none cursor-pointer"
                title="Inscreveu na modalidade errada? Mova o time. Quer o mesmo time em outro esporte? Copie."
              >
                <option value="">Mover / copiar…</option>
                <optgroup label="Mover para (sai desta modalidade)">
                  {MODALIDADES.filter(m => m.id !== (eq.alunos[0]?.modalidade ?? 'futsal')).map(m => (
                    <option key={m.id} value={`mover:${m.id}`}>{m.icone} {m.label}</option>
                  ))}
                </optgroup>
                <optgroup label="Copiar para (continua aqui também)">
                  {MODALIDADES.filter(m => m.id !== (eq.alunos[0]?.modalidade ?? 'futsal')).map(m => (
                    <option key={m.id} value={`copiar:${m.id}`}>{m.icone} {m.label}</option>
                  ))}
                </optgroup>
              </select>
              <span className="text-[11px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{eq.turmas.join(', ')}</span>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${eq.cheio ? 'bg-gray-200 text-gray-600' : eq.completo ? 'bg-secondary-container text-on-secondary-container' : 'bg-amber-100 text-amber-700'}`}>
                {eq.cheio ? `🔒 Cheio (${eq.alunos.length}/${MAXIMO_JOGADORES_TIME})` : eq.completo ? `✅ Completo (${eq.alunos.length}/${MAXIMO_JOGADORES_TIME})` : `⏳ Faltam ${eq.minimoJogadores - eq.alunos.length}`}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            {eq.alunos.map((a, i) => {
              const eleg = elegibilidadeDoAluno(a);
              return (
                <label key={a.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 -mx-1 px-1 rounded-lg">
                  <input
                    type="checkbox"
                    checked={selecionados.has(a.id)}
                    onChange={() => toggleSelecionado(a.id)}
                    className="accent-error w-4 h-4 flex-shrink-0"
                  />
                  <span className="text-gray-400 text-xs w-5 flex-shrink-0">{i + 1}.</span>
                  <span className="text-primary font-mono text-xs w-8 flex-shrink-0">#{a.numero_camisa}</span>
                  <span className="flex-1 text-on-surface truncate">{a.nome_completo}</span>
                  <span className="text-gray-400 text-xs flex-shrink-0">{a.turma_id}</span>
                  {eleg && (eleg.status === 'inapto' || eleg.status === 'atencao') && (
                    <button
                      type="button"
                      onClick={e => { e.preventDefault(); ajustarNotasVermelhas(eleg, onRefetch); }}
                      className="text-[11px] text-primary font-semibold hover:underline flex-shrink-0"
                      title="Atualizar o número de notas vermelhas (ex.: Secretaria regularizou)"
                    >
                      Atualizar
                    </button>
                  )}
                  {eleg ? <SeloElegibilidade eleg={eleg} /> : (
                    <span className="text-[10px] text-gray-300 flex-shrink-0" title="Sem dado de elegibilidade importado do SIMAED">—</span>
                  )}
                </label>
              );
            })}
          </div>
          <div className="flex items-center justify-between gap-2 mt-2">
            <span className="text-[11px] text-gray-400">{eq.alunos.length} jogador{eq.alunos.length !== 1 ? 'es' : ''}</span>
            {eq.alunos.some(a => selecionados.has(a.id)) && (
              <button
                onClick={() => excluirSelecionados(eq)}
                disabled={excluindoLote}
                className="flex items-center gap-1 text-[11px] text-error font-bold hover:underline disabled:opacity-40"
              >
                <Trash2 className="w-3 h-3" />
                {excluindoLote ? 'Excluindo...' : `Excluir ${eq.alunos.filter(a => selecionados.has(a.id)).length} selecionado(s)`}
              </button>
            )}
          </div>
          {!eq.completo && (
            <div className="mt-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-amber-700 text-[11px] font-medium">
              {mensagemMinimoNaoAtingido(eq.alunos[0]?.modalidade)}
            </div>
          )}
        </div>
      ))}
      <datalist id="times-existentes-equipes">
        {nomesExistentes.map(n => <option key={n} value={n} />)}
      </datalist>
      <p className="text-[11px] text-gray-400 text-center px-4">
        Toque no ✎ ao lado do nome do time pra corrigir digitação — se você digitar o nome exato de outro time já existente, os dois se juntam automaticamente.
      </p>
    </div>
  );
}
