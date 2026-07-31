import React from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  ANOS_ESCOLARES,
  COMPONENTES_CURRICULARES,
  CONTEXTUALIZACOES,
  DIFICULDADES,
  ESTILOS_QUESTAO,
  QUANTIDADES_PERMITIDAS,
  TIPOS_QUESTAO,
} from './tiposGeradorQuestoes';
import type { ParametrosGeracao, TipoQuestao } from './tiposGeradorQuestoes';
import { POLITICA_TIPOS_QUESTAO } from './regrasElaboracaoItens';
import { getCurriculumData } from '../../../data/curriculumData';

const CLASSE_INPUT = 'w-full px-3 py-2 rounded-xl border border-outline-variant bg-background text-sm text-on-surface';
const CLASSE_LABEL = 'text-xs text-on-surface-variant mb-1 block';

export interface GeradorQuestoesFormularioProps {
  valores: ParametrosGeracao;
  onChange: <K extends keyof ParametrosGeracao>(campo: K, valor: ParametrosGeracao[K]) => void;
  desabilitado: boolean;
}

/** Sugestões de conteúdo, só para Educação Física, tiradas do plano de curso oficial já existente. */
function sugestoesObjetoConhecimento(anoEscolar: number): string[] {
  // curriculumData usa bimestres 1-4; juntamos os objetos de conhecimento dos 4 para sugerir o ano inteiro.
  const bimestres = ['1', '2', '3', '4'];
  const sugestoes = new Set<string>();
  for (const bim of bimestres) {
    const dados = getCurriculumData(String(anoEscolar), bim);
    dados?.objetosConhecimento.forEach(o => sugestoes.add(o));
  }
  return Array.from(sugestoes);
}

export function GeradorQuestoesFormulario({ valores, onChange, desabilitado }: GeradorQuestoesFormularioProps) {
  const politicaTipo = POLITICA_TIPOS_QUESTAO[valores.tipoQuestao];
  const ehEducacaoFisica = valores.componenteCurricular === 'Educação Física';
  const sugestoesConhecimento = ehEducacaoFisica ? sugestoesObjetoConhecimento(valores.anoEscolar) : [];

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
        <label className={CLASSE_LABEL}>Unidade Temática</label>
        <input
          value={valores.unidadeTematica}
          onChange={e => onChange('unidadeTematica', e.target.value)}
          disabled={desabilitado}
          placeholder="Campo livre — ex: Esportes de invasão"
          className={CLASSE_INPUT}
        />
      </div>

      <div>
        <label className={CLASSE_LABEL}>Objeto de Conhecimento</label>
        <input
          value={valores.objetoConhecimento}
          onChange={e => onChange('objetoConhecimento', e.target.value)}
          disabled={desabilitado}
          placeholder="Campo livre — ex: Handebol"
          list="sugestoes-objeto-conhecimento"
          className={CLASSE_INPUT}
        />
        {sugestoesConhecimento.length > 0 && (
          <datalist id="sugestoes-objeto-conhecimento">
            {sugestoesConhecimento.map(s => <option key={s} value={s} />)}
          </datalist>
        )}
      </div>

      <div>
        <label className={CLASSE_LABEL}>Habilidade BNCC (ou referência da Matriz)</label>
        <input
          value={valores.habilidadeBncc}
          onChange={e => onChange('habilidadeBncc', e.target.value)}
          disabled={desabilitado}
          placeholder="Ex: EF67EF01"
          className={CLASSE_INPUT}
        />
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
