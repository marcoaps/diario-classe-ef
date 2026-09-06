import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../../data/supabase';
import { ClipboardList, Plus, QrCode, Camera, Trash2, ChevronDown, ChevronUp, BarChart2, Sparkles, Share2, Copy, Check, ListChecks } from 'lucide-react';
import type { Avaliacao, QuestaoObjetiva } from './tiposCorretorProvas';
import { ALTERNATIVAS_PADRAO, valorPorQuestaoObjetiva, arredondar, GRUPOS_CORRETOR, ehGrupoDeTurmas, labelTurmaOuGrupo } from './tiposCorretorProvas';
import { getTurmasDoGrupo, getLabelGrupo } from '../ProvasOnline';

const GRUPOS_ONLINE = ['6-7', '8', '9', '8-9'];

/** GRUPOS_CORRETOR (tiposCorretorProvas.ts) e os grupos de Provas Online
 * (ProvasOnline.tsx) evoluíram separados e não usam os mesmos ids -- quando
 * a avaliação já é um GRUPO_CORRETOR inteiro (ex: "GRUPO_8_9", 8º e 9º juntos),
 * turma_id NÃO é uma turma real, então a busca por turma abaixo nunca acha
 * nada e sempre caía no primeiro grupo (6º/7º) por engano. Mapeia direto.
 */
const GRUPO_CORRETOR_PARA_ONLINE: Record<string, string> = {
  GRUPO_6_7: '6-7',
  GRUPO_8_9: '8-9',
};

/** As Provas Online são compartilhadas por um código único por GRUPO de turmas
 * (não por turma individual) — mesmo modelo já usado quando a prova é criada
 * direto por lá. Aqui só descobrimos a qual grupo a turma da avaliação pertence. */
function grupoDaTurma(turmaId: string): string {
  if (GRUPO_CORRETOR_PARA_ONLINE[turmaId]) return GRUPO_CORRETOR_PARA_ONLINE[turmaId];
  return GRUPOS_ONLINE.find(id => getTurmasDoGrupo(id).includes(turmaId)) || GRUPOS_ONLINE[0];
}

const TURMAS = ['6F','7B','7C','7D','7E','7F','8A','8B','8C','8D','8E','8F','9A','9B','9C','9D','9E','9F'];
const BIMESTRES = ['1', '2', '3', '4'];
const MAX_OBJETIVAS = 60;
const MAX_DISCURSIVAS = 20;

function questaoVazia(numero: number): QuestaoObjetiva {
  return {
    numero,
    enunciado: '',
    alternativas: ALTERNATIVAS_PADRAO.map(letra => ({ letra, texto: '' })),
  };
}

export function Avaliacoes() {
  const navigate = useNavigate();
  const location = useLocation();
  const [lista, setLista] = useState<Avaliacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [criando, setCriando] = useState(false);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const [avisoImportacao, setAvisoImportacao] = useState('');
  const [publicando, setPublicando] = useState<string | null>(null);
  const [codigosPublicados, setCodigosPublicados] = useState<Record<string, string>>({});
  const [copiadoOnline, setCopiadoOnline] = useState<string | null>(null);

  // Dados gerais
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [disciplina, setDisciplina] = useState('Educação Física');
  const [turmaId, setTurmaId] = useState('');
  const [bimestre, setBimestre] = useState('');
  const [dataProva, setDataProva] = useState('');
  const [professor, setProfessor] = useState('');
  const [observacoes, setObservacoes] = useState('');

  // Quantidades e pontuação — NADA disso é fixo no código, o professor
  // define a quantidade de questões livremente (ex: 4, 8, 10, 20, 30...).
  const [qtdObjetivasStr, setQtdObjetivasStr] = useState('8');
  const [qtdDiscursivasStr, setQtdDiscursivasStr] = useState('2');
  const [valorTotalObjetivas, setValorTotalObjetivas] = useState('8.0');
  const [valorTotalDiscursivas, setValorTotalDiscursivas] = useState('2.0');

  // Conteúdo das questões
  const [questoesObjetivas, setQuestoesObjetivas] = useState<QuestaoObjetiva[]>(
    Array.from({ length: 8 }, (_, i) => questaoVazia(i + 1))
  );
  const [gabarito, setGabarito] = useState<Record<string, string>>({});
  const [enunciadosDiscursivas, setEnunciadosDiscursivas] = useState<Record<string, string>>({ '9': '', '10': '' });
  const [textoApoio, setTextoApoio] = useState('');

  const [gerandoObjetivas, setGerandoObjetivas] = useState(false);
  const [gerandoDiscursivas, setGerandoDiscursivas] = useState(false);
  const [gerandoTexto, setGerandoTexto] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const qtdObjetivas = Math.max(0, Math.min(MAX_OBJETIVAS, parseInt(qtdObjetivasStr) || 0));
  const qtdDiscursivas = Math.max(0, Math.min(MAX_DISCURSIVAS, parseInt(qtdDiscursivasStr) || 0));

  // Mantém o array de questões objetivas sincronizado com a quantidade
  // digitada, preservando o que já foi escrito ao aumentar/diminuir.
  useEffect(() => {
    setQuestoesObjetivas(prev => {
      if (prev.length === qtdObjetivas) return prev;
      const proximo = Array.from({ length: qtdObjetivas }, (_, i) => prev[i] ?? questaoVazia(i + 1));
      return proximo.map((q, i) => ({ ...q, numero: i + 1 }));
    });
  }, [qtdObjetivas]);

  useEffect(() => {
    setEnunciadosDiscursivas(prev => {
      const proximo: Record<string, string> = {};
      for (let i = 1; i <= qtdDiscursivas; i++) {
        const chave = String(qtdObjetivas + i);
        proximo[chave] = prev[chave] ?? '';
      }
      return proximo;
    });
  }, [qtdDiscursivas, qtdObjetivas]);

  function limparFormulario() {
    setTitulo(''); setDescricao(''); setTurmaId(''); setBimestre(''); setDataProva('');
    setProfessor(''); setObservacoes(''); setTextoApoio('');
    setQtdObjetivasStr('8'); setQtdDiscursivasStr('2');
    setValorTotalObjetivas('8.0'); setValorTotalDiscursivas('2.0');
    setQuestoesObjetivas(Array.from({ length: 8 }, (_, i) => questaoVazia(i + 1)));
    setGabarito({}); setEnunciadosDiscursivas({ '9': '', '10': '' });
    setAvisoImportacao('');
  }

  /**
   * Chama /api/claude e devolve o texto da resposta, já validando o status
   * HTTP -- sem isso, um erro da API (ex: sem crédito) cai direto no
   * `data.content?.[0]?.text || ''` e vira string vazia, fazendo o JSON.parse
   * falhar mais adiante com uma mensagem genérica que não diz o motivo real.
   */
  async function chamarClaudeTexto(prompt: string, maxTokens: number): Promise<string> {
    const resp = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] })
    });
    const data = await resp.json();
    if (!resp.ok) {
      throw new Error(data?.error?.message || data?.error || `A IA respondeu com erro ${resp.status}.`);
    }
    const text = data.content?.[0]?.text || '';
    if (!text.trim()) throw new Error('A IA devolveu uma resposta vazia.');
    return text;
  }

  /** Extrai o bloco JSON (array ou objeto) do texto, tolerando cercas ```json
   * e frases extras que a IA às vezes inclui mesmo quando instruída a não o fazer. */
  function extrairJSON(texto: string): string {
    const semCercas = texto.replace(/```json|```/gi, '').trim();
    const match = semCercas.match(/[\[{][\s\S]*[\]}]/);
    return match ? match[0] : semCercas;
  }

  async function gerarQuestoesObjetivasIA() {
    if (!titulo.trim()) { setErro('Informe o título da avaliação antes de gerar com IA.'); return; }
    if (qtdObjetivas < 1) { setErro('Defina a quantidade de questões objetivas antes de gerar com IA.'); return; }
    setGerandoObjetivas(true);
    setErro('');
    try {
      const text = await chamarClaudeTexto(
        `Você é professor de ${disciplina} do Ensino Fundamental. Gere EXATAMENTE ${qtdObjetivas} questões de múltipla escolha sobre o tema: "${titulo}"${descricao ? ' - ' + descricao : ''}. Cada questão deve ter um enunciado claro (2-4 linhas), 4 alternativas (A, B, C, D) plausíveis e apenas uma correta. Responda APENAS com um array JSON, sem texto adicional, neste formato exato: [{"enunciado":"...","alternativas":[{"letra":"A","texto":"..."},{"letra":"B","texto":"..."},{"letra":"C","texto":"..."},{"letra":"D","texto":"..."}],"correta":"A"}]`,
        4096
      );
      const parsed = JSON.parse(extrairJSON(text)) as Array<{ enunciado: string; alternativas: { letra: string; texto: string }[]; correta: string }>;
      const novasQuestoes: QuestaoObjetiva[] = [];
      const novoGabarito: Record<string, string> = {};
      parsed.slice(0, qtdObjetivas).forEach((q, i) => {
        const numero = i + 1;
        novasQuestoes.push({ numero, enunciado: q.enunciado, alternativas: q.alternativas });
        novoGabarito[String(numero)] = (q.correta || '').toUpperCase().trim();
      });
      while (novasQuestoes.length < qtdObjetivas) novasQuestoes.push(questaoVazia(novasQuestoes.length + 1));
      setQuestoesObjetivas(novasQuestoes);
      setGabarito(novoGabarito);
    } catch (e) {
      setErro('Erro ao gerar questões objetivas com IA: ' + (e as Error).message);
    } finally {
      setGerandoObjetivas(false);
    }
  }

  async function gerarEnunciadosDiscursivasIA() {
    if (!titulo.trim()) { setErro('Informe o título da avaliação antes de gerar com IA.'); return; }
    if (qtdDiscursivas < 1) { setErro('Defina a quantidade de questões discursivas antes de gerar com IA.'); return; }
    setGerandoDiscursivas(true);
    setErro('');
    try {
      const numeros = Array.from({ length: qtdDiscursivas }, (_, i) => qtdObjetivas + i + 1);
      const text = await chamarClaudeTexto(
        `Você é professor de ${disciplina} do Ensino Fundamental. Gere questões dissertativas sobre o tema: "${titulo}"${descricao ? ' - ' + descricao : ''}. Cada questão deve pedir que o aluno explique ou justifique conceitos, ter entre 2 e 4 linhas. Gere exatamente uma questão para cada um destes números: ${numeros.join(', ')}. Responda APENAS com um objeto JSON válido (sem comentários, sem reticências, sem texto antes ou depois), com uma chave de texto por número, por exemplo: {"${numeros[0]}": "texto da questão"}`,
        1500
      );
      const parsed = JSON.parse(extrairJSON(text)) as Record<string, string>;
      const novo: Record<string, string> = {};
      numeros.forEach(n => { novo[String(n)] = parsed[String(n)] || ''; });
      setEnunciadosDiscursivas(novo);
    } catch (e) {
      setErro('Erro ao gerar enunciados discursivos com IA: ' + (e as Error).message);
    } finally {
      setGerandoDiscursivas(false);
    }
  }

  async function gerarTextoApoioIA() {
    if (!titulo.trim()) { setErro('Informe o título antes de gerar o texto de apoio.'); return; }
    setGerandoTexto(true);
    setErro('');
    try {
      const text = await chamarClaudeTexto(
        `Você é professor de ${disciplina} do Ensino Fundamental. Crie um TEXTO DE APOIO para uma avaliação sobre o tema: "${titulo}"${descricao ? ' - ' + descricao : ''}. O texto deve: ter entre 15 e 25 linhas, ser informativo e adequado para alunos do Ensino Fundamental II, abordar os principais conceitos do tema, conter TODAS as respostas das questões de forma implícita ou explícita, usar linguagem clara e acessível. Retorne APENAS o texto, sem título nem introdução.`,
        1500
      );
      setTextoApoio(text.trim());
    } catch (e) {
      setErro('Erro ao gerar texto de apoio: ' + (e as Error).message);
    } finally {
      setGerandoTexto(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  // Chegou aqui vindo do "Criar avaliação com estas questões" do Gerador de
  // Questões: abre o formulário já preenchido, mas com turma/data/pontuação
  // em branco para o professor revisar antes de salvar. Limpa o state da
  // navegação em seguida para não reaplicar isso num back/refresh.
  useEffect(() => {
    const dados = (location.state as any)?.questoesGeradas;
    if (!dados) return;
    setCriando(true);
    setTitulo(dados.titulo || '');
    setDisciplina(dados.disciplina || 'Educação Física');
    setBimestre(dados.bimestre || '');
    setQtdObjetivasStr(String(dados.questoesObjetivas.length));
    setQtdDiscursivasStr(String(Object.keys(dados.enunciadosDiscursivas).length));
    setQuestoesObjetivas(dados.questoesObjetivas);
    setGabarito(dados.gabarito);
    setEnunciadosDiscursivas(dados.enunciadosDiscursivas);
    setAvisoImportacao(
      `Questões importadas do Gerador (${dados.questoesObjetivas.length} objetiva(s), ${Object.keys(dados.enunciadosDiscursivas).length} discursiva(s))`
      + (dados.ignoradas > 0 ? ` — ${dados.ignoradas} ficaram de fora por não serem múltipla escolha/dissertativa.` : '.')
      + ' Confira turma, bimestre, data e pontuação antes de salvar.'
    );
    navigate(location.pathname, { replace: true, state: {} });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  async function carregar() {
    setLoading(true);
    const { data } = await supabase
      .from('avaliacoes')
      .select('*')
      .order('criado_em', { ascending: false });
    setLista((data || []) as Avaliacao[]);
    setLoading(false);
  }

  function validar(): string | null {
    if (!titulo.trim()) return 'Informe o título da avaliação.';
    if (!turmaId) return 'Selecione uma turma.';
    if (qtdObjetivas < 1 && qtdDiscursivas < 1) return 'A avaliação precisa ter pelo menos 1 questão.';
    for (const q of questoesObjetivas) {
      if (!q.enunciado.trim()) return `Questão objetiva ${q.numero} está sem enunciado.`;
      if (q.alternativas.some(a => !a.texto.trim())) return `Questão objetiva ${q.numero} tem alternativa em branco.`;
      if (!gabarito[String(q.numero)]) return `Questão objetiva ${q.numero} está sem resposta definida no gabarito.`;
    }
    if (Object.keys(gabarito).length !== qtdObjetivas) {
      return 'O gabarito não tem a mesma quantidade de respostas que o número de questões objetivas.';
    }
    for (let i = 1; i <= qtdDiscursivas; i++) {
      const chave = String(qtdObjetivas + i);
      if (!enunciadosDiscursivas[chave]?.trim()) return `Questão discursiva ${chave} está sem enunciado.`;
    }
    const valObj = parseFloat(valorTotalObjetivas) || 0;
    const valDisc = parseFloat(valorTotalDiscursivas) || 0;
    if (qtdObjetivas > 0 && valObj <= 0) return 'Informe a pontuação total das questões objetivas.';
    if (qtdDiscursivas > 0 && valDisc <= 0) return 'Informe a pontuação total das questões discursivas.';
    return null;
  }

  async function salvar() {
    const mensagem = validar();
    if (mensagem) { setErro(mensagem); return; }
    setSalvando(true);
    setErro('');
    const { error } = await supabase.from('avaliacoes').insert({
      titulo: titulo.trim(),
      descricao: descricao.trim() || null,
      disciplina,
      turma_id: turmaId,
      bimestre: bimestre || null,
      data_prova: dataProva || null,
      professor: professor.trim() || null,
      observacoes: observacoes.trim() || null,
      quantidade_objetivas: qtdObjetivas,
      quantidade_discursivas: qtdDiscursivas,
      alternativas: [...ALTERNATIVAS_PADRAO],
      gabarito,
      valor_total_objetivas: parseFloat(valorTotalObjetivas) || 0,
      valor_total_discursivas: parseFloat(valorTotalDiscursivas) || 0,
      questoes_objetivas: questoesObjetivas,
      questoes_subjetivas: enunciadosDiscursivas,
      texto_apoio: textoApoio.trim() || null,
      // campos legados mantidos para telas antigas que ainda os leem
      num_questoes: qtdObjetivas + qtdDiscursivas,
      valor_questao: qtdObjetivas > 0 ? (parseFloat(valorTotalObjetivas) || 0) / qtdObjetivas : 0,
    });
    setSalvando(false);
    if (error) { setErro('Erro ao salvar: ' + error.message); return; }
    limparFormulario();
    setCriando(false);
    carregar();
  }

  async function excluir(id: string) {
    if (!confirm('Excluir esta avaliação e todas as respostas/folhas relacionadas?')) return;
    await supabase.from('avaliacoes').delete().eq('id', id);
    carregar();
  }

  /**
   * Publica a avaliação (já usada no Corretor de Provas em papel) como uma
   * Prova Online também, sem redigitar nada -- copia as questões objetivas
   * (múltipla escolha, com o gabarito virando o índice da alternativa certa
   * em `opcoes`) e as discursivas (corrigidas por IA na hora da resposta) pra
   * dentro das tabelas `provas`/`questoes` que o /responder já lê.
   */
  async function publicarOnline(av: Avaliacao) {
    setPublicando(av.id);
    setErro('');
    try {
      const valorObjetiva = arredondar(valorPorQuestaoObjetiva(av), 2);
      const qtdDisc = av.quantidade_discursivas || 0;
      const valorPorDiscursiva = qtdDisc > 0 ? arredondar(av.valor_total_discursivas / qtdDisc, 2) : 0;
      const codigo = Math.random().toString(36).substring(2, 8).toUpperCase();
      const grupo = grupoDaTurma(av.turma_id);

      const { data: prova, error } = await supabase.from('provas').insert({
        titulo: av.titulo,
        descricao: av.descricao || '',
        turma_id: grupo,
        codigo,
        data_limite: null,
      }).select().single();
      if (error) throw error;

      const questoesObjetivasInsert = (av.questoes_objetivas || []).map(q => {
        const letraCorreta = av.gabarito?.[String(q.numero)];
        const indice = q.alternativas.findIndex(a => a.letra === letraCorreta);
        return {
          prova_id: prova.id,
          enunciado: q.enunciado,
          imagem_base64: null,
          tipo: 'multipla_escolha',
          opcoes: q.alternativas.map(a => a.texto),
          resposta_correta: indice >= 0 ? String(indice) : null,
          pontos: valorObjetiva,
          ordem: q.numero,
        };
      });
      const questoesDiscursivasInsert = Object.entries(av.questoes_subjetivas || {}).map(([numero, enunciado]) => ({
        prova_id: prova.id,
        enunciado,
        imagem_base64: null,
        tipo: 'dissertativa',
        opcoes: null,
        resposta_correta: null,
        pontos: valorPorDiscursiva,
        ordem: Number(numero),
      }));

      const { error: errQ } = await supabase.from('questoes').insert([...questoesObjetivasInsert, ...questoesDiscursivasInsert]);
      if (errQ) throw errQ;

      setCodigosPublicados(prev => ({ ...prev, [av.id]: codigo }));
    } catch (e: any) {
      setErro('Erro ao publicar prova online: ' + e.message);
    } finally {
      setPublicando(null);
    }
  }

  function copiarMensagemOnline(av: Avaliacao, codigo: string) {
    const baseUrl = window.location.origin;
    const labelGrupo = getLabelGrupo(grupoDaTurma(av.turma_id));
    const texto =
      `📝 *${av.titulo}*\n🏫 ${labelGrupo}\n\n` +
      `Acesse:\n${baseUrl}/responder\n\n` +
      `🔑 Código: *${codigo}*\n\n_Instituto Odilon Pratagi_`;
    navigator.clipboard.writeText(texto);
    setCopiadoOnline(av.id);
    setTimeout(() => setCopiadoOnline(null), 3000);
  }

  function setLetraCorreta(numero: number, letra: string) {
    setGabarito(prev => ({ ...prev, [String(numero)]: letra }));
  }

  function atualizarQuestao(numero: number, alteracoes: Partial<QuestaoObjetiva>) {
    setQuestoesObjetivas(prev => prev.map(q => q.numero === numero ? { ...q, ...alteracoes } : q));
  }

  function atualizarAlternativa(numero: number, letra: string, texto: string) {
    setQuestoesObjetivas(prev => prev.map(q => q.numero === numero
      ? { ...q, alternativas: q.alternativas.map(a => a.letra === letra ? { ...a, texto } : a) }
      : q));
  }

  return (
    <div className="py-4 space-y-4">
      {/* Cabecalho */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-bold text-on-surface">Avaliações</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button
            onClick={() => navigate('/avaliacoes/gabarito-rapido')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-outline-variant text-on-surface text-sm font-semibold"
          >
            <ClipboardList className="w-4 h-4" />
            Só o Gabarito
          </button>
          <button
            onClick={() => navigate('/avaliacoes/gerador')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary-container text-on-secondary-container text-sm font-semibold"
          >
            <Sparkles className="w-4 h-4" />
            Gerador de Questões
          </button>
          <button
            onClick={() => { setCriando(!criando); setErro(''); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-on-primary text-sm font-semibold"
          >
            <Plus className="w-4 h-4" />
            Nova
          </button>
        </div>
      </div>

      {/* Formulario de criacao */}
      {criando && (
        <div className="bg-surface border border-outline-variant rounded-2xl p-4 space-y-4">
          <p className="text-sm font-semibold text-on-surface">Nova avaliação</p>

          {avisoImportacao && (
            <div className="bg-secondary-container text-on-secondary-container text-xs px-3 py-2 rounded-xl">{avisoImportacao}</div>
          )}

          <div className="space-y-3">
            <div>
              <label className="text-xs text-on-surface-variant mb-1 block">Título *</label>
              <input
                value={titulo}
                onChange={e => setTitulo(e.target.value)}
                placeholder="Ex: Prova Bimestral 1B 2026"
                className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-background text-sm text-on-surface"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-on-surface-variant mb-1 block">Disciplina</label>
                <input
                  value={disciplina}
                  onChange={e => setDisciplina(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-background text-sm text-on-surface"
                />
              </div>
              <div>
                <label className="text-xs text-on-surface-variant mb-1 block">Turma *</label>
                <select
                  value={turmaId}
                  onChange={e => setTurmaId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-background text-sm text-on-surface"
                >
                  <option value="">Selecione...</option>
                  <optgroup label="Turmas">
                    {TURMAS.map(t => <option key={t} value={t}>{t}</option>)}
                  </optgroup>
                  <optgroup label="Grupos (várias turmas de uma vez)">
                    {GRUPOS_CORRETOR.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                  </optgroup>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-on-surface-variant mb-1 block">Bimestre</label>
                <select
                  value={bimestre}
                  onChange={e => setBimestre(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-background text-sm text-on-surface"
                >
                  <option value="">-</option>
                  {BIMESTRES.map(b => <option key={b} value={b}>{b}º</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-on-surface-variant mb-1 block">Data</label>
                <input
                  type="date"
                  value={dataProva}
                  onChange={e => setDataProva(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-background text-sm text-on-surface"
                />
              </div>
              <div>
                <label className="text-xs text-on-surface-variant mb-1 block">Professor(a)</label>
                <input
                  value={professor}
                  onChange={e => setProfessor(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-background text-sm text-on-surface"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-on-surface-variant mb-1 block">Descrição (opcional)</label>
              <input
                value={descricao}
                onChange={e => setDescricao(e.target.value)}
                placeholder="Ex: Conteúdo: esportes coletivos"
                className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-background text-sm text-on-surface"
              />
            </div>
          </div>

          {/* Quantidades e pontuacao */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-on-surface-variant mb-1 block">Nº de questões objetivas</label>
              <input
                type="number" min="0" max={MAX_OBJETIVAS} step="1"
                value={qtdObjetivasStr}
                onChange={e => setQtdObjetivasStr(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-background text-sm text-on-surface"
              />
            </div>
            <div>
              <label className="text-xs text-on-surface-variant mb-1 block">Nº de questões discursivas</label>
              <input
                type="number" min="0" max={MAX_DISCURSIVAS} step="1"
                value={qtdDiscursivasStr}
                onChange={e => setQtdDiscursivasStr(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-background text-sm text-on-surface"
              />
            </div>
            <div>
              <label className="text-xs text-on-surface-variant mb-1 block">Valor total — objetivas</label>
              <input
                type="number" min="0" step="0.5"
                value={valorTotalObjetivas}
                onChange={e => setValorTotalObjetivas(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-background text-sm text-on-surface"
              />
            </div>
            <div>
              <label className="text-xs text-on-surface-variant mb-1 block">Valor total — discursivas</label>
              <input
                type="number" min="0" step="0.5"
                value={valorTotalDiscursivas}
                onChange={e => setValorTotalDiscursivas(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-background text-sm text-on-surface"
              />
            </div>
          </div>
          <p className="text-xs text-on-surface-variant">
            Alternativas: A a D (padrão desta versão) · Valor por questão objetiva: {qtdObjetivas > 0 ? ((parseFloat(valorTotalObjetivas) || 0) / qtdObjetivas).toFixed(2) : '0.00'} pts
          </p>

          {/* Questões objetivas */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-on-surface-variant">
                Questões Objetivas (1 a {qtdObjetivas})
              </p>
              <button
                onClick={gerarQuestoesObjetivasIA}
                disabled={gerandoObjetivas || qtdObjetivas < 1}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-on-primary text-xs font-semibold disabled:opacity-60"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {gerandoObjetivas ? 'Gerando...' : 'Gerar com IA'}
              </button>
            </div>
            {gerandoObjetivas && (
              <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                Gerando {qtdObjetivas} questões com base no título...
              </div>
            )}
            <div className="space-y-3 max-h-[28rem] overflow-y-auto pr-1">
              {questoesObjetivas.map(q => (
                <div key={q.numero} className="bg-background border border-outline-variant rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-on-surface-variant">{q.numero}.</span>
                    <textarea
                      value={q.enunciado}
                      onChange={e => atualizarQuestao(q.numero, { enunciado: e.target.value })}
                      rows={2}
                      placeholder="Enunciado da questão..."
                      className="flex-1 px-2 py-1.5 rounded-lg border border-outline-variant bg-surface text-sm text-on-surface resize-none"
                    />
                  </div>
                  <div className="space-y-1.5 pl-6">
                    {q.alternativas.map(alt => (
                      <div key={alt.letra} className="flex items-center gap-2">
                        <button
                          onClick={() => setLetraCorreta(q.numero, alt.letra)}
                          title="Marcar como resposta correta"
                          className={[
                            'w-6 h-6 flex-shrink-0 rounded-full text-xs font-bold border transition-all',
                            gabarito[String(q.numero)] === alt.letra
                              ? 'bg-primary text-on-primary border-primary'
                              : 'bg-surface text-on-surface-variant border-outline-variant'
                          ].join(' ')}
                        >
                          {alt.letra}
                        </button>
                        <input
                          value={alt.texto}
                          onChange={e => atualizarAlternativa(q.numero, alt.letra, e.target.value)}
                          placeholder={`Alternativa ${alt.letra}`}
                          className="flex-1 px-2 py-1 rounded-lg border border-outline-variant bg-surface text-xs text-on-surface"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Enunciados das dissertativas */}
          {qtdDiscursivas > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-on-surface-variant">
                  Questões Discursivas — Enunciados
                </p>
                <button
                  onClick={gerarEnunciadosDiscursivasIA}
                  disabled={gerandoDiscursivas}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-on-primary text-xs font-semibold disabled:opacity-60"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {gerandoDiscursivas ? 'Gerando...' : 'Gerar com IA'}
                </button>
              </div>
              {gerandoDiscursivas && (
                <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                  <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  Gerando enunciados com base no título...
                </div>
              )}
              {Array.from({ length: qtdDiscursivas }, (_, i) => qtdObjetivas + i + 1).map(n => (
                <div key={n}>
                  <label className="text-xs text-on-surface-variant mb-1 block">Questão {n}</label>
                  <textarea
                    value={enunciadosDiscursivas[String(n)] || ''}
                    onChange={e => setEnunciadosDiscursivas(prev => ({ ...prev, [String(n)]: e.target.value }))}
                    rows={3}
                    placeholder="Clique em Gerar com IA ou digite o enunciado..."
                    className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-background text-sm text-on-surface resize-none"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Texto de Apoio */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-on-surface-variant">Texto de Apoio (opcional)</p>
              <button
                onClick={gerarTextoApoioIA}
                disabled={gerandoTexto}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary-container text-on-secondary-container text-xs font-semibold disabled:opacity-60"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {gerandoTexto ? 'Gerando...' : 'Gerar com IA'}
              </button>
            </div>
            {gerandoTexto && (
              <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                Gerando texto com respostas embutidas...
              </div>
            )}
            <textarea
              value={textoApoio}
              onChange={e => setTextoApoio(e.target.value)}
              rows={5}
              placeholder="A IA gera um texto cujas respostas estão contidas nele. Página 1 = texto, página 2 = questões."
              className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-background text-sm text-on-surface resize-none"
            />
          </div>

          <div>
            <label className="text-xs text-on-surface-variant mb-1 block">Observações (opcional)</label>
            <textarea
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-background text-sm text-on-surface resize-none"
            />
          </div>

          {erro && <p className="text-xs text-red-500">{erro}</p>}

          <div className="flex gap-2">
            <button
              onClick={() => setCriando(false)}
              className="flex-1 py-2 rounded-xl border border-outline-variant text-sm text-on-surface-variant"
            >
              Cancelar
            </button>
            <button
              onClick={salvar}
              disabled={salvando}
              className="flex-1 py-2 rounded-xl bg-primary text-on-primary text-sm font-semibold disabled:opacity-50"
            >
              {salvando ? 'Salvando...' : 'Salvar avaliação'}
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : lista.length === 0 ? (
        <div className="text-center py-12 text-on-surface-variant text-sm">
          Nenhuma avaliação criada ainda.
        </div>
      ) : (
        <div className="space-y-2">
          {lista.map(av => (
            <div key={av.id} className="bg-surface border border-outline-variant rounded-2xl overflow-hidden">
              <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer"
                onClick={() => setExpandido(expandido === av.id ? null : av.id)}
              >
                <div>
                  <p className="text-sm font-semibold text-on-surface">{av.titulo}</p>
                  <p className="text-xs text-on-surface-variant">
                    {ehGrupoDeTurmas(av.turma_id) ? labelTurmaOuGrupo(av.turma_id) : `Turma ${av.turma_id}`} · {av.quantidade_objetivas ?? av.num_questoes ?? 0} objetivas
                    {(av.quantidade_discursivas ?? 0) > 0 ? ` + ${av.quantidade_discursivas} discursivas` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded-full font-medium">
                    {new Date(av.criado_em).toLocaleDateString('pt-BR')}
                  </span>
                  {expandido === av.id
                    ? <ChevronUp className="w-4 h-4 text-on-surface-variant" />
                    : <ChevronDown className="w-4 h-4 text-on-surface-variant" />}
                </div>
              </div>

              {expandido === av.id && (
                <div className="border-t border-outline-variant px-4 py-3 space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(av.gabarito || {}).sort((a, b) => Number(a[0]) - Number(b[0])).map(([n, letra]) => (
                      <div key={n} className="flex items-center gap-1 bg-secondary-container rounded-lg px-2 py-1">
                        <span className="text-xs text-on-surface-variant">{n}.</span>
                        <span className="text-xs font-bold text-on-secondary-container">{letra}</span>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => navigate(`/avaliacoes/folha/${av.id}`)}
                      className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-primary text-on-primary text-xs font-semibold"
                    >
                      <QrCode className="w-4 h-4" />
                      Folhas QR
                    </button>
                    <button
                      onClick={() => navigate(`/avaliacoes/corrigir/${av.id}`)}
                      className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-secondary-container text-on-secondary-container text-xs font-semibold"
                    >
                      <Camera className="w-4 h-4" />
                      Corrigir
                    </button>
                    <button
                      onClick={() => navigate(`/avaliacoes/correcoes/${av.id}`)}
                      className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-surface border border-outline-variant text-on-surface text-xs font-semibold"
                    >
                      <ListChecks className="w-4 h-4" />
                      Correções
                    </button>
                    <button
                      onClick={() => navigate(`/avaliacoes/resultados/${av.id}`)}
                      className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-surface border border-outline-variant text-on-surface text-xs font-semibold"
                    >
                      <BarChart2 className="w-4 h-4" />
                      Resultados
                    </button>
                  </div>
                  <button
                    onClick={() => excluir(av.id)}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl border border-error text-error text-xs font-semibold"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Excluir avaliação
                  </button>

                  {codigosPublicados[av.id] ? (
                    <div className="flex items-center justify-between gap-2 bg-secondary-container rounded-xl px-3 py-2">
                      <div>
                        <p className="text-xs text-on-secondary-container">Prova online publicada — código:</p>
                        <p className="text-sm font-black tracking-widest text-on-secondary-container">{codigosPublicados[av.id]}</p>
                      </div>
                      <button
                        onClick={() => copiarMensagemOnline(av, codigosPublicados[av.id])}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-on-primary text-xs font-semibold shrink-0"
                      >
                        {copiadoOnline === av.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiadoOnline === av.id ? 'Copiado!' : 'Copiar mensagem'}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => publicarOnline(av)}
                      disabled={publicando === av.id}
                      className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-outline-variant text-on-surface text-xs font-semibold disabled:opacity-60"
                    >
                      <Share2 className="w-4 h-4" />
                      {publicando === av.id ? 'Publicando...' : 'Publicar como Prova Online'}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
