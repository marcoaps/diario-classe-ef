import React, { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  ANOS_ESCOLARES,
  BIMESTRES,
  COMPONENTES_CURRICULARES,
  CONTEXTUALIZACOES,
  DIFICULDADES,
  ESTILOS_QUESTAO,
  QUANTIDADES_PERMITIDAS,
  TIPOS_QUESTAO,
} from './tiposGeradorQuestoes';
import type { ParametrosGeracao, TipoQuestao } from './tiposGeradorQuestoes';
import { POLITICA_TIPOS_QUESTAO } from './regrasElaboracaoItens';
import { curriculumData } from '../../../data/curriculumData';
import { formatarHabilidadeBNCC, getHabilidadesBNCC } from '../../../data/bnccEducacaoFisicaData';

const CLASSE_INPUT = 'w-full px-3 py-2 rounded-xl border border-outline-variant bg-background text-sm text-on-surface';
const CLASSE_LABEL = 'text-xs text-on-surface-variant mb-1 block';

export interface GeradorQuestoesFormularioProps {
  valores: ParametrosGeracao;
  onChange: <K extends keyof ParametrosGeracao>(campo: K, valor: ParametrosGeracao[K]) => void;
  desabilitado: boolean;
}

/**
 * O Plano de Curso oficial (`curriculumData.ts`) só existe para Educação
 * Física, organizado por ano + bimestre — não tem um campo "Unidade
 * Temática" separado, nem vínculo direto entre cada habilidade e cada objeto
 * de conhecimento (são listas paralelas). Por isso o dropdown de Objeto de
 * Conhecimento só se aplica quando o componente curricular é Educação
 * Física; para os demais componentes, mantemos o campo de texto livre, já
 * que não há base de dados para eles. A Habilidade, quando o componente é
 * Educação Física, vem da BNCC oficial (`bnccEducacaoFisicaData.ts`), que é
 * organizada por bloco de anos (6º/7º e 8º/9º), não por bimestre.
 */
function dadosDoPlanoDeCurso(anoEscolar: number, bimestre: string) {
  return curriculumData[String(anoEscolar)]?.bimestres?.[bimestre] ?? null;
}

export function GeradorQuestoesFormulario({ valores, onChange, desabilitado }: GeradorQuestoesFormularioProps) {
  const politicaTipo = POLITICA_TIPOS_QUESTAO[valores.tipoQuestao];
  const ehEducacaoFisica = valores.componenteCurricular === 'Educação Física';
  const dadosPlano = ehEducacaoFisica ? dadosDoPlanoDeCurso(valores.anoEscolar, valores.bimestre) : null;
  const habilidadesBNCC = ehEducacaoFisica ? getHabilidadesBNCC(valores.anoEscolar) : [];

  // Sempre que Ano Escolar ou Bimestre mudarem (ou o componente deixar de ser
  // Educação Física), garante que Objeto de Conhecimento e Conteúdo fiquem
  // sincronizados com o Plano de Curso daquele ano/bimestre, e a Habilidade
  // com a lista oficial da BNCC para o bloco de anos correspondente,
  // selecionando automaticamente o primeiro item de cada lista.
  useEffect(() => {
    if (!ehEducacaoFisica) return;
    if (dadosPlano && !dadosPlano.objetosConhecimento.includes(valores.objetoConhecimento)) {
      const primeiroObjeto = dadosPlano.objetosConhecimento[0] ?? '';
      onChange('objetoConhecimento', primeiroObjeto);
      onChange('conteudo', primeiroObjeto);
    }
    const opcoesHabilidade = habilidadesBNCC.map(formatarHabilidadeBNCC);
    if (!opcoesHabilidade.includes(valores.habilidadeBncc)) {
      onChange('habilidadeBncc', opcoesHabilidade[0] ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ehEducacaoFisica, valores.anoEscolar, valores.bimestre]);

  function selecionarObjetoConhecimento(valor: string) {
    onChange('objetoConhecimento', valor);
    onChange('conteudo', valor); // Conteúdo acompanha o Objeto de Conhecimento escolhido, mas continua editável logo abaixo.
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={CLASSE_LABEL}>Componente Curricular</label>
          <select
            value={valores.componenteCurricular}
            onChange={e => onChange('componenteCurricular', e.target.value as ParametrosGeracao['componenteCurricular'])}
            disabled={desabilitado}
            className={CLASSE_INPUT}
          >
            {COMPONENTES_CURRICULARES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className={CLASSE_LABEL}>Ano Escolar</label>
          <select
            value={valores.anoEscolar}
            onChange={e => onChange('anoEscolar', Number(e.target.value) as ParametrosGeracao['anoEscolar'])}
            disabled={desabilitado}
            className={CLASSE_INPUT}
          >
            {ANOS_ESCOLARES.map(a => <option key={a} value={a}>{a}º Ano</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className={CLASSE_LABEL}>Bimestre (Plano de Curso oficial)</label>
        <select
          value={valores.bimestre}
          onChange={e => onChange('bimestre', e.target.value as ParametrosGeracao['bimestre'])}
          disabled={desabilitado}
          className={CLASSE_INPUT}
        >
          {BIMESTRES.map(b => <option key={b.valor} value={b.valor}>{b.label}</option>)}
        </select>
      </div>

      <div>
        <label className={CLASSE_LABEL}>Objeto de Conhecimento</label>
        {ehEducacaoFisica && dadosPlano ? (
          <select
            value={valores.objetoConhecimento}
            onChange={e => selecionarObjetoConhecimento(e.target.value)}
            disabled={desabilitado}
            className={CLASSE_INPUT}
          >
            {dadosPlano.objetosConhecimento.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : (
          <input
            value={valores.objetoConhecimento}
            onChange={e => onChange('objetoConhecimento', e.target.value)}
            disabled={desabilitado}
            placeholder="Campo livre — ex: Verbos no presente do indicativo"
            className={CLASSE_INPUT}
          />
        )}
      </div>

      <div>
        <label className={CLASSE_LABEL}>Habilidade (BNCC oficial)</label>
        {ehEducacaoFisica ? (
          <>
            <select
              value={valores.habilidadeBncc}
              onChange={e => onChange('habilidadeBncc', e.target.value)}
              disabled={desabilitado}
              className={CLASSE_INPUT}
            >
              {habilidadesBNCC.map(h => {
                const opcao = formatarHabilidadeBNCC(h);
                return <option key={h.codigo} value={opcao}>{opcao}</option>;
              })}
            </select>
            <p className="text-[11px] text-on-surface-variant mt-1">
              Habilidades oficiais da BNCC para {valores.anoEscolar <= 7 ? '6º e 7º anos' : '8º e 9º anos'} — independem do bimestre.
            </p>
          </>
        ) : (
          <input
            value={valores.habilidadeBncc}
            onChange={e => onChange('habilidadeBncc', e.target.value)}
            disabled={desabilitado}
            placeholder="Ex: EF67EF01"
            className={CLASSE_INPUT}
          />
        )}
      </div>

      <div>
        <label className={CLASSE_LABEL}>Conteúdo *</label>
        <input
          value={valores.conteudo}
          onChange={e => onChange('conteudo', e.target.value)}
          disabled={desabilitado}
          placeholder="Ex: Futsal, Jogos Cooperativos, Handebol, Atletismo, Voleibol..."
          className={CLASSE_INPUT}
        />
        {ehEducacaoFisica && (
          <p className="text-[11px] text-on-surface-variant mt-1">Carregado a partir do Objeto de Conhecimento selecionado — pode editar/resumir antes de gerar.</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={CLASSE_LABEL}>Quantidade de questões</label>
          <select
            value={valores.quantidade}
            onChange={e => onChange('quantidade', Number(e.target.value) as ParametrosGeracao['quantidade'])}
            disabled={desabilitado}
            className={CLASSE_INPUT}
          >
            {QUANTIDADES_PERMITIDAS.map(q => <option key={q} value={q}>{q}</option>)}
          </select>
        </div>
        <div>
          <label className={CLASSE_LABEL}>Nível de dificuldade</label>
          <select
            value={valores.dificuldade}
            onChange={e => onChange('dificuldade', e.target.value as ParametrosGeracao['dificuldade'])}
            disabled={desabilitado}
            className={CLASSE_INPUT}
          >
            {DIFICULDADES.map(d => <option key={d.valor} value={d.valor}>{d.label}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className={CLASSE_LABEL}>Tipo de questão</label>
        <select
          value={valores.tipoQuestao}
          onChange={e => onChange('tipoQuestao', e.target.value as TipoQuestao)}
          disabled={desabilitado}
          className={CLASSE_INPUT}
        >
          {TIPOS_QUESTAO.map(t => <option key={t.valor} value={t.valor}>{t.label}</option>)}
        </select>
        {valores.tipoQuestao === 'multipla_escolha' && valores.quantidade >= 2 && (
          <p className="text-[11px] text-on-surface-variant mt-1">
            Gera automaticamente uma mistura: ~80% múltipla escolha e ~20% dissertativas (ambas elegíveis a foto de apoio).
          </p>
        )}
        {politicaTipo.nivelAlerta !== 'nenhum' && (
          <div className={[
            'mt-2 flex items-start gap-2 px-3 py-2 rounded-xl text-xs',
            politicaTipo.nivelAlerta === 'proibido_oficial'
              ? 'bg-error-container text-on-error-container'
              : 'bg-secondary-container text-on-secondary-container',
          ].join(' ')}>
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{politicaTipo.mensagemInterface}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={CLASSE_LABEL}>Contextualização</label>
          <select
            value={valores.contextualizacao}
            onChange={e => onChange('contextualizacao', e.target.value as ParametrosGeracao['contextualizacao'])}
            disabled={desabilitado}
            className={CLASSE_INPUT}
          >
            {CONTEXTUALIZACOES.map(c => <option key={c.valor} value={c.valor}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className={CLASSE_LABEL}>Estilo da questão</label>
          <select
            value={valores.estilo}
            onChange={e => onChange('estilo', e.target.value as ParametrosGeracao['estilo'])}
            disabled={desabilitado}
            className={CLASSE_INPUT}
          >
            {ESTILOS_QUESTAO.map(e => <option key={e.valor} value={e.valor}>{e.label}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}
