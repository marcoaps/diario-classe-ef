import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Database, FileDown, FileText, Sparkles } from 'lucide-react';
import { GeradorQuestoesFormulario } from './GeradorQuestoesFormulario';
import { GeradorQuestoesCard } from './GeradorQuestoesCard';
import { criarParametrosPadrao } from './tiposGeradorQuestoes';
import type { ParametrosGeracao, QuestaoGerada } from './tiposGeradorQuestoes';
import { TAMANHO_LOTE, gerarQuestoesCompletas } from './geradorQuestoesIA';
import { revisarEAprovarQuestao, revisarLote } from './revisaoAutomaticaQuestoes';
import { OPCOES_EXPORTACAO_PADRAO, exportarQuestoesPDF, exportarQuestoesWord } from './exportarQuestoesGerador';
import type { OpcoesExportacao } from './exportarQuestoesGerador';
import { salvarQuestoesNoBanco } from './bancoQuestoesData';
import { preencherImagensDasQuestoes } from './buscarImagensGerador';

type Etapa = 'formulario' | 'gerando' | 'revisando' | 'buscando_imagens' | 'resultado';

const RAIO_ANEL = 34;
const CIRCUNFERENCIA_ANEL = 2 * Math.PI * RAIO_ANEL;

/** Frases decorativas que se revezam durante a espera — puramente cosméticas, não têm relação com o progresso real (que vem de `concluidas`/`total`). */
const FRASES_POR_ETAPA: Record<Etapa, string[]> = {
  formulario: [],
  gerando: [
    'Consultando as regras do guia SEE/AC...',
    'Elaborando enunciados claros e objetivos...',
    'Criando alternativas e distratores plausíveis...',
    'Verificando a habilidade e o nível de dificuldade...',
  ],
  revisando: [
    'Rodando o validador determinístico...',
    'Conferindo autorrevisão da IA...',
    'Checando ambiguidades e pistas de resposta...',
  ],
  buscando_imagens: [
    'Procurando fotos reais no banco de imagens...',
    'Selecionando a imagem mais adequada a cada questão...',
  ],
  resultado: [],
};

/**
 * Tela de progresso com anel circular animado (baseado no percentual REAL de
 * `concluidas`/`total`) e frases decorativas que se revezam a cada ~2,5s,
 * no mesmo espírito visual do "ProgressoGerando" usado em outras telas de IA
 * do app — só que aqui o progresso não é simulado por tempo.
 */
function BarraProgresso({ etapa, titulo, concluidas, total }: { etapa: Etapa; titulo: string; concluidas: number; total: number }) {
  const percentual = total > 0 ? Math.min(100, Math.round((concluidas / total) * 100)) : 0;
  const frases = FRASES_POR_ETAPA[etapa];
  const [fraseIdx, setFraseIdx] = useState(0);

  useEffect(() => {
    if (frases.length === 0) return;
    setFraseIdx(0);
    const intervalo = setInterval(() => setFraseIdx(i => (i + 1) % frases.length), 2500);
    return () => clearInterval(intervalo);
  }, [etapa, frases.length]);

  return (
    <div className="bg-surface border border-outline-variant rounded-2xl p-6 flex flex-col gap-4 items-center">
      <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center relative">
        <Sparkles className="w-8 h-8 text-primary animate-bounce" />
        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r={RAIO_ANEL} fill="none" stroke="currentColor" className="text-outline-variant" strokeWidth="5" />
          <circle
            cx="40" cy="40" r={RAIO_ANEL} fill="none" stroke="currentColor" className="text-primary" strokeWidth="5"
            strokeDasharray={CIRCUNFERENCIA_ANEL}
            strokeDashoffset={CIRCUNFERENCIA_ANEL * (1 - percentual / 100)}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.5s ease' }}
          />
        </svg>
      </div>
      <div className="text-center">
        <p className="font-bold text-on-surface text-sm">{titulo}</p>
        <p className="text-xs text-on-surface-variant mt-1">{concluidas} de {total} · {percentual}%</p>
      </div>
      <div className="w-full h-2.5 bg-background rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${percentual}%` }} />
      </div>
      {frases.length > 0 && (
        <p className="text-center text-xs text-on-surface-variant italic min-h-[1.5em] transition-opacity duration-300">{frases[fraseIdx]}</p>
      )}
      <p className="text-center text-[11px] text-on-surface-variant">Isso pode levar alguns segundos por lote de {TAMANHO_LOTE} questões — aguarde 😊</p>
    </div>
  );
}

export function GeradorQuestoes() {
  const navigate = useNavigate();

  const [params, setParams] = useState<ParametrosGeracao>(criarParametrosPadrao());
  const [etapa, setEtapa] = useState<Etapa>('formulario');
  const [progresso, setProgresso] = useState({ concluidas: 0, total: 0 });
  const [questoes, setQuestoes] = useState<QuestaoGerada[]>([]);
  const [erro, setErro] = useState('');
  const [salvandoBanco, setSalvandoBanco] = useState(false);
  const [mensagemBanco, setMensagemBanco] = useState('');
  const [revisandoIdIndividual, setRevisandoIdIndividual] = useState<string | null>(null);
  const [incluirNaoConformes, setIncluirNaoConformes] = useState(false);

  function atualizarParametro<K extends keyof ParametrosGeracao>(campo: K, valor: ParametrosGeracao[K]) {
    setParams(prev => ({ ...prev, [campo]: valor }));
  }

  /** Traduz/complementa mensagens de erro conhecidas da API da Claude para o professor entender e saber o que fazer. */
  function mensagemErroAmigavel(erro: unknown): string {
    const mensagem = (erro as Error).message ?? String(erro);
    if (mensagem.toLowerCase().includes('credit balance is too low')) {
      return 'Saldo insuficiente na conta da API da Claude. Peça ao responsável para adicionar créditos em console.anthropic.com/settings/billing.';
    }
    return mensagem;
  }

  async function handleGerarQuestoes() {
    if (!params.conteudo.trim()) {
      setErro('Preencha o campo "Conteúdo" antes de gerar as questões.');
      return;
    }
    setErro('');
    setEtapa('gerando');
    setProgresso({ concluidas: 0, total: params.quantidade });

    try {
      const geradas = await gerarQuestoesCompletas(params, (concluidas, total) => setProgresso({ concluidas, total }));
      setEtapa('revisando');
      setProgresso({ concluidas: 0, total: geradas.length });
      const revisadas = await revisarLote(geradas, params, (concluidas, total) => setProgresso({ concluidas, total }));

      const precisamDeImagem = revisadas.filter(q => q.imagemQuery).length;
      if (precisamDeImagem > 0) {
        setEtapa('buscando_imagens');
        setProgresso({ concluidas: 0, total: precisamDeImagem });
        const comImagens = await preencherImagensDasQuestoes(revisadas, (concluidas, total) => setProgresso({ concluidas, total }));
        setQuestoes(comImagens);
      } else {
        setQuestoes(revisadas);
      }
      setEtapa('resultado');
    } catch (e) {
      setErro(`Erro ao gerar questões: ${mensagemErroAmigavel(e)}`);
      setEtapa('formulario');
    }
  }

  function handleEditarQuestao(idTemporario: string, alteracoes: Partial<QuestaoGerada>) {
    setQuestoes(prev => prev.map(q => (q.idTemporario === idTemporario ? { ...q, ...alteracoes } : q)));
  }

  async function handleRevisarNovamente(idTemporario: string) {
    const questaoAtual = questoes.find(q => q.idTemporario === idTemporario);
    if (!questaoAtual) return;
    setRevisandoIdIndividual(idTemporario);
    try {
      const revisada = await revisarEAprovarQuestao({ ...questaoAtual, tentativasRevisao: 0, historicoRevisao: [] }, params);
      setQuestoes(prev => prev.map(q => (q.idTemporario === idTemporario ? { ...revisada, idTemporario } : q)));
    } catch (e) {
      setErro(`Erro ao revisar novamente: ${mensagemErroAmigavel(e)}`);
    } finally {
      setRevisandoIdIndividual(null);
    }
  }

  function opcoesExportacaoAtuais(): OpcoesExportacao {
    return { ...OPCOES_EXPORTACAO_PADRAO, incluirNaoConformesOficial: incluirNaoConformes };
  }

  async function handleExportarPDF() {
    try {
      await exportarQuestoesPDF(questoes, params, opcoesExportacaoAtuais());
    } catch (e) {
      setErro(`Erro ao exportar PDF: ${(e as Error).message}`);
    }
  }

  async function handleExportarWord() {
    try {
      await exportarQuestoesWord(questoes, params, opcoesExportacaoAtuais());
    } catch (e) {
      setErro(`Erro ao exportar Word: ${(e as Error).message}`);
    }
  }

  async function handleSalvarNoBanco() {
    setSalvandoBanco(true);
    setMensagemBanco('');
    try {
      const paraSalvar = questoes.filter(q => incluirNaoConformes || q.conformeReferenciaOficial);
      await salvarQuestoesNoBanco(paraSalvar, params);
      setMensagemBanco(`${paraSalvar.length} questão(ões) salva(s) no Banco de Questões.`);
    } catch (e) {
      setErro(`Erro ao salvar no Banco de Questões: ${(e as Error).message}`);
    } finally {
      setSalvandoBanco(false);
    }
  }

  function handleNovaGeracao() {
    setQuestoes([]);
    setErro('');
    setMensagemBanco('');
    setEtapa('formulario');
  }

  const aprovadas = questoes.filter(q => q.statusRevisao === 'aprovada').length;
  const pendentes = questoes.filter(q => q.statusRevisao === 'requer_revisao_manual').length;

  return (
    <div className="py-4 space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={() => navigate('/avaliacoes')} className="p-1 rounded-lg text-on-surface-variant">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <Sparkles className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-bold text-on-surface">Gerador de Questões</h1>
      </div>

      {erro && (
        <div className="bg-error-container text-on-error-container text-xs px-3 py-2 rounded-xl">{erro}</div>
      )}

      {etapa === 'formulario' && (
        <div className="bg-surface border border-outline-variant rounded-2xl p-4 space-y-4">
          <p className="text-sm font-semibold text-on-surface">Parâmetros da geração</p>
          <GeradorQuestoesFormulario valores={params} onChange={atualizarParametro} desabilitado={false} />
          <button
            onClick={handleGerarQuestoes}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-semibold"
          >
            <Sparkles className="w-4 h-4" />
            Gerar Questões
          </button>
        </div>
      )}

      {etapa === 'gerando' && (
        <BarraProgresso etapa={etapa} titulo="Gerando questões com a IA..." concluidas={progresso.concluidas} total={progresso.total} />
      )}

      {etapa === 'revisando' && (
        <BarraProgresso etapa={etapa} titulo="Revisando questões (validador + autorrevisão da IA)..." concluidas={progresso.concluidas} total={progresso.total} />
      )}

      {etapa === 'buscando_imagens' && (
        <BarraProgresso etapa={etapa} titulo="Buscando imagens reais para as questões com suporte visual..." concluidas={progresso.concluidas} total={progresso.total} />
      )}

      {etapa === 'resultado' && (
        <div className="space-y-4">
          <div className="bg-surface border border-outline-variant rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm font-semibold text-on-surface">
                {questoes.length} questão(ões) geradas — {aprovadas} aprovada(s){pendentes > 0 ? `, ${pendentes} pendente(s) de revisão manual` : ''}
              </p>
              <button onClick={handleNovaGeracao} className="px-3 py-1.5 rounded-xl bg-secondary-container text-on-secondary-container text-xs font-semibold">
                Nova geração
              </button>
            </div>

            <label className="flex items-center gap-2 text-xs text-on-surface-variant">
              <input type="checkbox" checked={incluirNaoConformes} onChange={e => setIncluirNaoConformes(e.target.checked)} />
              Incluir na exportação/banco questões fora do padrão oficial SEE/AC (Verdadeiro/Falso, Associação, Completar)
            </label>

            <div className="flex flex-wrap gap-2">
              <button onClick={handleExportarPDF} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-on-primary text-xs font-semibold">
                <FileDown className="w-3.5 h-3.5" /> Exportar PDF
              </button>
              <button onClick={handleExportarWord} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-on-primary text-xs font-semibold">
                <FileText className="w-3.5 h-3.5" /> Exportar Word
              </button>
              <button
                onClick={handleSalvarNoBanco}
                disabled={salvandoBanco}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary-container text-on-secondary-container text-xs font-semibold disabled:opacity-60"
              >
                <Database className="w-3.5 h-3.5" /> {salvandoBanco ? 'Salvando...' : 'Salvar no Banco de Questões'}
              </button>
            </div>
            {mensagemBanco && <p className="text-xs text-primary font-semibold">{mensagemBanco}</p>}
          </div>

          <div className="space-y-3">
            {questoes.map(questao => (
              <GeradorQuestoesCard
                key={questao.idTemporario}
                questao={questao}
                onEditar={handleEditarQuestao}
                onRevisarNovamente={handleRevisarNovamente}
                revisando={revisandoIdIndividual === questao.idTemporario}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
