import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Database, FileDown, FileText, History, Sparkles } from 'lucide-react';
import { GeradorChargesFormulario } from './GeradorChargesFormulario';
import { GeradorChargesCard } from './GeradorChargesCard';
import { criarParametrosPadraoCharges } from './tiposCharges';
import type { AtividadeCharge, ImagemQuadro, ImagemUnica, ParametrosGeracaoCharges, Personagem, QuestaoChargeIA } from './tiposCharges';
import { listarPersonagensAtivos } from './personagensChargesData';
import { gerarERevisarCharge } from './revisaoAutomaticaCharges';
import { montarPromptImagemPorQuadro } from './promptImagemCharges';
import { exportarChargeHTML, exportarChargePDF, exportarChargeProvaPDF, exportarChargeProvaWord, exportarChargeWord } from './exportarChargesGerador';
import { buscarChargeHistoricoPorId, salvarChargeNoHistorico, atualizarChargeHistorico } from './chargesDidaticasData';

type Etapa = 'formulario' | 'gerando' | 'resultado';
type FaseGeracao = 'roteiro' | 'questoes' | 'revisando';

const RAIO_ANEL = 34;
const CIRCUNFERENCIA_ANEL = 2 * Math.PI * RAIO_ANEL;

const PERCENTUAL_POR_FASE: Record<FaseGeracao, number> = { roteiro: 33, questoes: 66, revisando: 100 };
const TITULO_POR_FASE: Record<FaseGeracao, string> = {
  roteiro: 'Criando o roteiro da charge...',
  questoes: 'Elaborando as questões da atividade...',
  revisando: 'Revisando personagens, continuidade e adequação pedagógica...',
};

function BarraProgressoCharges({ fase, tentativa }: { fase: FaseGeracao; tentativa: number }) {
  const percentual = PERCENTUAL_POR_FASE[fase];
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
        <p className="font-bold text-on-surface text-sm">{TITULO_POR_FASE[fase]}</p>
        {tentativa > 0 && <p className="text-xs text-on-surface-variant mt-1">Tentativa {tentativa + 1} (regeneração automática)</p>}
      </div>
      <div className="w-full h-2.5 bg-background rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${percentual}%` }} />
      </div>
      <p className="text-center text-[11px] text-on-surface-variant">Isso pode levar alguns segundos — aguarde 😊</p>
    </div>
  );
}

export function GeradorCharges() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const idParaAbrir = searchParams.get('id');

  const [params, setParams] = useState<ParametrosGeracaoCharges>(criarParametrosPadraoCharges());
  const [etapa, setEtapa] = useState<Etapa>('formulario');
  const [fase, setFase] = useState<FaseGeracao>('roteiro');
  const [tentativa, setTentativa] = useState(0);
  const [atividade, setAtividade] = useState<AtividadeCharge | null>(null);
  const [erro, setErro] = useState('');
  const [salvandoHistorico, setSalvandoHistorico] = useState(false);
  const [mensagemHistorico, setMensagemHistorico] = useState('');
  const [carregandoAtividadeExistente, setCarregandoAtividadeExistente] = useState(Boolean(idParaAbrir));

  useEffect(() => {
    if (!idParaAbrir) return;
    buscarChargeHistoricoPorId(idParaAbrir)
      .then(encontrada => {
        if (encontrada) {
          setAtividade(encontrada);
          setParams(encontrada.parametros);
          setEtapa('resultado');
        }
      })
      .catch(e => setErro(`Erro ao carregar atividade do histórico: ${(e as Error).message}`))
      .finally(() => setCarregandoAtividadeExistente(false));
  }, [idParaAbrir]);

  function atualizarParametro<K extends keyof ParametrosGeracaoCharges>(campo: K, valor: ParametrosGeracaoCharges[K]) {
    setParams(prev => ({ ...prev, [campo]: valor }));
  }

  function mensagemErroAmigavel(erro: unknown): string {
    const mensagem = (erro as Error).message ?? String(erro);
    if (mensagem.toLowerCase().includes('credit balance is too low')) {
      return 'Saldo insuficiente na conta da API da Claude. Peça ao responsável para adicionar créditos em console.anthropic.com/settings/billing.';
    }
    if (mensagem.toLowerCase().includes('json malformado')) {
      return 'A IA devolveu uma resposta malformada mais de uma vez. Tente gerar novamente — geralmente é uma falha pontual.';
    }
    return mensagem;
  }

  async function handleGerarCharge() {
    if (!params.conteudo.trim()) {
      setErro('Preencha o campo "Conteúdo" antes de gerar a charge.');
      return;
    }
    if (params.conteudo.trim() === params.objetoConhecimento.trim()) {
      setErro('O campo "Conteúdo" ainda está com o texto genérico do Objeto de Conhecimento — sem um esporte/prática específico, a IA escolhe qualquer exemplo da categoria e a checagem automática pode reprovar o resultado à toa. Edite o campo "Conteúdo" pra nomear o esporte, ex: "Handebol — Defesa Legal".');
      return;
    }
    if (params.personagensSelecionadosIds.length === 0) {
      setErro('Selecione ao menos 1 personagem para gerar a charge.');
      return;
    }

    setErro('');
    setEtapa('gerando');
    setFase('roteiro');
    setTentativa(0);

    try {
      const todosPersonagens = await listarPersonagensAtivos();
      const personagensSelecionados = todosPersonagens.filter(p => params.personagensSelecionadosIds.includes(p.id));
      if (personagensSelecionados.length === 0) {
        throw new Error('Os personagens selecionados não foram encontrados — recarregue a página e selecione novamente.');
      }

      const resultado = await gerarERevisarCharge(params, personagensSelecionados, (novaFase, novaTentativa) => {
        setFase(novaFase);
        setTentativa(novaTentativa);
      });

      const promptsImagem = montarPromptImagemPorQuadro({
        roteiro: resultado.roteiro,
        personagensUsados: personagensSelecionados,
        tipoImagem: params.tipoImagem,
        estiloIlustracao: params.estiloIlustracao,
        conteudo: params.conteudo,
      });

      const agora = new Date().toISOString();
      const novaAtividade: AtividadeCharge = {
        id: `local-${Date.now()}`,
        parametros: params,
        roteiro: resultado.roteiro,
        questoes: resultado.questoesEMetadados.questoes,
        competencias: resultado.questoesEMetadados.competencias,
        habilidades: resultado.questoesEMetadados.habilidades,
        objetivos: resultado.questoesEMetadados.objetivos,
        observacoesProfessor: resultado.questoesEMetadados.observacoesProfessor,
        personagensUsados: personagensSelecionados,
        promptsImagem,
        imagensQuadros: [],
        imagemUnica: null,
        statusRevisao: resultado.statusRevisao,
        tentativasRevisao: resultado.tentativasRevisao,
        historicoRevisao: resultado.historicoRevisao,
        criadoEm: agora,
        atualizadoEm: agora,
      };

      setAtividade(novaAtividade);
      setEtapa('resultado');

      // Salva automaticamente no histórico assim que a charge fica pronta —
      // não depende mais do professor lembrar de clicar em "Salvar no histórico".
      // Se falhar, a charge continua visível na tela (id "local-...") e o
      // botão "Salvar no histórico" serve de retry manual.
      try {
        const novoId = await salvarChargeNoHistorico(novaAtividade);
        setAtividade(prev => (prev && prev.id === novaAtividade.id ? { ...prev, id: novoId } : prev));
      } catch (erroSalvar) {
        console.error('Erro ao salvar charge automaticamente no histórico:', erroSalvar);
      }
    } catch (e) {
      setErro(`Erro ao gerar a charge: ${mensagemErroAmigavel(e)}`);
      setEtapa('formulario');
    }
  }

  function handleEditarQuestao(indice: number, alteracoes: Partial<QuestaoChargeIA>) {
    setAtividade(prev => {
      if (!prev) return prev;
      const questoes = prev.questoes.map((q, i) => (i === indice ? { ...q, ...alteracoes } : q));
      return { ...prev, questoes, atualizadoEm: new Date().toISOString() };
    });
  }

  function handleImagemQuadro(quadro: number, imagem: ImagemQuadro | null) {
    setAtividade(prev => {
      if (!prev) return prev;
      const semEsteQuadro = prev.imagensQuadros.filter(i => i.quadro !== quadro);
      const imagensQuadros = imagem ? [...semEsteQuadro, imagem] : semEsteQuadro;
      return { ...prev, imagensQuadros, atualizadoEm: new Date().toISOString() };
    });
  }

  function handleImagemUnica(imagem: ImagemUnica | null) {
    setAtividade(prev => (prev ? { ...prev, imagemUnica: imagem, atualizadoEm: new Date().toISOString() } : prev));
  }

  async function handleExportarPDF(modeloImpressao: 1 | 2 | 4) {
    if (!atividade) return;
    try {
      await exportarChargePDF(atividade, { modeloImpressao, incluirPromptsImagem: modeloImpressao === 1 });
    } catch (e) {
      setErro(`Erro ao exportar PDF: ${(e as Error).message}`);
    }
  }

  async function handleExportarProvaPDF() {
    if (!atividade) return;
    try {
      await exportarChargeProvaPDF(atividade);
    } catch (e) {
      setErro(`Erro ao exportar PDF (Prova): ${(e as Error).message}`);
    }
  }

  async function handleExportarProvaWord() {
    if (!atividade) return;
    try {
      await exportarChargeProvaWord(atividade);
    } catch (e) {
      setErro(`Erro ao exportar Word (Prova): ${(e as Error).message}`);
    }
  }

  async function handleExportarWord() {
    if (!atividade) return;
    try {
      await exportarChargeWord(atividade);
    } catch (e) {
      setErro(`Erro ao exportar Word: ${(e as Error).message}`);
    }
  }

  function handleExportarHTML() {
    if (!atividade) return;
    try {
      exportarChargeHTML(atividade);
    } catch (e) {
      setErro(`Erro ao exportar HTML: ${(e as Error).message}`);
    }
  }

  async function handleSalvarNoHistorico() {
    if (!atividade) return;
    setSalvandoHistorico(true);
    setMensagemHistorico('');
    try {
      if (atividade.id.startsWith('local-')) {
        const novoId = await salvarChargeNoHistorico(atividade);
        setAtividade(prev => (prev ? { ...prev, id: novoId } : prev));
        setMensagemHistorico('Atividade salva no histórico.');
      } else {
        await atualizarChargeHistorico(atividade.id, atividade);
        setMensagemHistorico('Alterações salvas no histórico.');
      }
    } catch (e) {
      setErro(`Erro ao salvar no histórico: ${(e as Error).message}`);
    } finally {
      setSalvandoHistorico(false);
    }
  }

  function handleNovaGeracao() {
    setAtividade(null);
    setErro('');
    setMensagemHistorico('');
    setEtapa('formulario');
  }

  if (carregandoAtividadeExistente) {
    return <div className="py-8 text-center text-sm text-on-surface-variant">Carregando atividade...</div>;
  }

  return (
    <div className="py-4 pb-24 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/ia')} className="p-1 rounded-lg text-on-surface-variant">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Sparkles className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-bold text-on-surface">Gerador de Charges Didáticas</h1>
        </div>
        <button onClick={() => navigate('/ia/charges/historico')} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-secondary-container text-on-secondary-container text-xs font-semibold shrink-0">
          <History className="w-3.5 h-3.5" /> Histórico
        </button>
      </div>

      {erro && (
        <div className="bg-error-container text-on-error-container text-xs px-3 py-2 rounded-xl">{erro}</div>
      )}

      {etapa === 'formulario' && (
        <div className="bg-surface border border-outline-variant rounded-2xl p-4 space-y-4">
          <p className="text-sm font-semibold text-on-surface">Parâmetros da geração</p>
          <GeradorChargesFormulario valores={params} onChange={atualizarParametro} desabilitado={false} />
          <button
            onClick={handleGerarCharge}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-semibold"
          >
            <Sparkles className="w-4 h-4" />
            Gerar Charge
          </button>
        </div>
      )}

      {etapa === 'gerando' && <BarraProgressoCharges fase={fase} tentativa={tentativa} />}

      {etapa === 'resultado' && atividade && (
        <div className="space-y-4">
          <div className="bg-surface border border-outline-variant rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm font-semibold text-on-surface">Atividade gerada</p>
              <button onClick={handleNovaGeracao} className="px-3 py-1.5 rounded-xl bg-secondary-container text-on-secondary-container text-xs font-semibold">
                Nova geração
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <button onClick={() => handleExportarPDF(1)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-on-primary text-xs font-semibold">
                <FileDown className="w-3.5 h-3.5" /> PDF (1/folha)
              </button>
              <button onClick={() => handleExportarPDF(2)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-on-primary text-xs font-semibold">
                <FileDown className="w-3.5 h-3.5" /> PDF (2/folha)
              </button>
              <button onClick={() => handleExportarPDF(4)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-on-primary text-xs font-semibold">
                <FileDown className="w-3.5 h-3.5" /> PDF (4/folha)
              </button>
              <button onClick={handleExportarProvaPDF} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary-container text-on-secondary-container text-xs font-semibold">
                <FileDown className="w-3.5 h-3.5" /> PDF (Prova)
              </button>
              <button onClick={handleExportarProvaWord} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary-container text-on-secondary-container text-xs font-semibold">
                <FileText className="w-3.5 h-3.5" /> Word (Prova)
              </button>
              <button onClick={handleExportarWord} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-on-primary text-xs font-semibold">
                <FileText className="w-3.5 h-3.5" /> Word
              </button>
              <button onClick={handleExportarHTML} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-on-primary text-xs font-semibold">
                <FileText className="w-3.5 h-3.5" /> HTML
              </button>
              <button
                onClick={handleSalvarNoHistorico}
                disabled={salvandoHistorico}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary-container text-on-secondary-container text-xs font-semibold disabled:opacity-60"
              >
                <Database className="w-3.5 h-3.5" /> {salvandoHistorico ? 'Salvando...' : 'Salvar no histórico'}
              </button>
            </div>
            {mensagemHistorico && <p className="text-xs text-primary font-semibold">{mensagemHistorico}</p>}
          </div>

          <GeradorChargesCard
            atividade={atividade}
            onEditarQuestao={handleEditarQuestao}
            onImagemQuadro={handleImagemQuadro}
            onImagemUnica={handleImagemUnica}
          />

          <div className="h-28" aria-hidden="true" />
        </div>
      )}
    </div>
  );
}
