import React, { useEffect } from 'react';
import {
  ANOS_ESCOLARES,
  BIMESTRES,
  ESTILOS_ILUSTRACAO,
  NIVEIS_CHARGES,
  NUMEROS_QUADROS,
  QUANTIDADES_QUESTOES_CHARGES,
  TIPOS_IMAGEM,
  TIPOS_QUESTOES_CHARGES,
  COMPONENTE_CURRICULAR_CHARGES,
} from './tiposCharges';
import type { EstiloIlustracao, NivelCharges, NumeroQuadros, ParametrosGeracaoCharges, TipoImagem, TipoQuestoesCharges } from './tiposCharges';
import { PersonagensSeletor } from './PersonagensSeletor';
import { curriculumData } from '../../../data/curriculumData';

const CLASSE_INPUT = 'w-full px-3 py-2 rounded-xl border border-outline-variant bg-background text-sm text-on-surface';
const CLASSE_LABEL = 'text-xs text-on-surface-variant mb-1 block';

export interface GeradorChargesFormularioProps {
  valores: ParametrosGeracaoCharges;
  onChange: <K extends keyof ParametrosGeracaoCharges>(campo: K, valor: ParametrosGeracaoCharges[K]) => void;
  desabilitado: boolean;
}

/**
 * O Plano de Curso oficial (`curriculumData.ts`) só existe para Educação
 * Física (único componente deste gerador), organizado por ano + bimestre —
 * não tem um campo "Unidade Temática" separado, nem vínculo direto entre
 * cada habilidade e cada objeto de conhecimento (são listas paralelas).
 * Mesma decisão já tomada no Gerador de Questões (`GeradorQuestoesFormulario.tsx`).
 */
function dadosDoPlanoDeCurso(anoEscolar: number, bimestre: string) {
  return curriculumData[String(anoEscolar)]?.bimestres?.[bimestre] ?? null;
}

export function GeradorChargesFormulario({ valores, onChange, desabilitado }: GeradorChargesFormularioProps) {
  const dadosPlano = dadosDoPlanoDeCurso(valores.anoEscolar, valores.bimestre);

  // Sempre que Ano Escolar ou Bimestre mudarem, sincroniza Objeto de
  // Conhecimento, Habilidade e Conteúdo com o Plano de Curso daquele
  // ano/bimestre, selecionando automaticamente o primeiro item de cada lista.
  useEffect(() => {
    if (!dadosPlano) return;
    if (!dadosPlano.objetosConhecimento.includes(valores.objetoConhecimento)) {
      const primeiroObjeto = dadosPlano.objetosConhecimento[0] ?? '';
      onChange('objetoConhecimento', primeiroObjeto);
      onChange('conteudo', primeiroObjeto);
    }
    if (!dadosPlano.habilidades.includes(valores.habilidadeBncc)) {
      onChange('habilidadeBncc', dadosPlano.habilidades[0] ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valores.anoEscolar, valores.bimestre]);

  function selecionarObjetoConhecimento(valor: string) {
    onChange('objetoConhecimento', valor);
    onChange('conteudo', valor);
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={CLASSE_LABEL}>Componente Curricular</label>
          <input value={COMPONENTE_CURRICULAR_CHARGES} disabled className={`${CLASSE_INPUT} opacity-70`} />
        </div>
        <div>
          <label className={CLASSE_LABEL}>Ano Escolar</label>
          <select
            value={valores.anoEscolar}
            onChange={e => onChange('anoEscolar', Number(e.target.value) as ParametrosGeracaoCharges['anoEscolar'])}
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
          onChange={e => onChange('bimestre', e.target.value as ParametrosGeracaoCharges['bimestre'])}
          disabled={desabilitado}
          className={CLASSE_INPUT}
        >
          {BIMESTRES.map(b => <option key={b.valor} value={b.valor}>{b.label}</option>)}
        </select>
        <p className="text-[11px] text-on-surface-variant mt-1">
          O Plano de Curso não possui um campo de Unidade Temática separado — os campos abaixo já vêm do Objeto de Conhecimento do bimestre selecionado.
        </p>
      </div>

      <div>
        <label className={CLASSE_LABEL}>Objeto de Conhecimento</label>
        {dadosPlano ? (
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
            className={CLASSE_INPUT}
          />
        )}
      </div>

      <div>
        <label className={CLASSE_LABEL}>Habilidade (Plano de Curso / BNCC)</label>
        {dadosPlano ? (
          <select
            value={valores.habilidadeBncc}
            onChange={e => onChange('habilidadeBncc', e.target.value)}
            disabled={desabilitado}
            className={CLASSE_INPUT}
          >
            {dadosPlano.habilidades.map(h => <option key={h} value={h}>{h}</option>)}
          </select>
        ) : (
          <input
            value={valores.habilidadeBncc}
            onChange={e => onChange('habilidadeBncc', e.target.value)}
            disabled={desabilitado}
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
          placeholder="Ex: Handebol — Defesa Legal"
          className={CLASSE_INPUT}
        />
        <p className="text-[11px] text-on-surface-variant mt-1">Carregado a partir do Objeto de Conhecimento selecionado — pode editar/resumir antes de gerar.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={CLASSE_LABEL}>Tipo de imagem</label>
          <select
            value={valores.tipoImagem}
            onChange={e => onChange('tipoImagem', e.target.value as TipoImagem)}
            disabled={desabilitado}
            className={CLASSE_INPUT}
          >
            {TIPOS_IMAGEM.map(t => <option key={t.valor} value={t.valor}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className={CLASSE_LABEL}>Número de quadros</label>
          <select
            value={valores.numeroQuadros}
            onChange={e => onChange('numeroQuadros', Number(e.target.value) as NumeroQuadros)}
            disabled={desabilitado}
            className={CLASSE_INPUT}
          >
            {NUMEROS_QUADROS.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className={CLASSE_LABEL}>Estilo da ilustração</label>
        <select
          value={valores.estiloIlustracao}
          onChange={e => onChange('estiloIlustracao', e.target.value as EstiloIlustracao)}
          disabled={desabilitado}
          className={CLASSE_INPUT}
        >
          {ESTILOS_ILUSTRACAO.map(e => <option key={e.valor} value={e.valor}>{e.label}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={CLASSE_LABEL}>Quantidade de questões</label>
          <select
            value={valores.quantidadeQuestoes}
            onChange={e => onChange('quantidadeQuestoes', Number(e.target.value) as ParametrosGeracaoCharges['quantidadeQuestoes'])}
            disabled={desabilitado}
            className={CLASSE_INPUT}
          >
            {QUANTIDADES_QUESTOES_CHARGES.map(q => <option key={q} value={q}>{q}</option>)}
          </select>
        </div>
        <div>
          <label className={CLASSE_LABEL}>Tipo das questões</label>
          <select
            value={valores.tipoQuestoes}
            onChange={e => onChange('tipoQuestoes', e.target.value as TipoQuestoesCharges)}
            disabled={desabilitado}
            className={CLASSE_INPUT}
          >
            {TIPOS_QUESTOES_CHARGES.map(t => <option key={t.valor} value={t.valor}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className={CLASSE_LABEL}>Nível</label>
          <select
            value={valores.nivel}
            onChange={e => onChange('nivel', e.target.value as NivelCharges)}
            disabled={desabilitado}
            className={CLASSE_INPUT}
          >
            {NIVEIS_CHARGES.map(n => <option key={n.valor} value={n.valor}>{n.label}</option>)}
          </select>
        </div>
      </div>

      <PersonagensSeletor
        selecionadosIds={valores.personagensSelecionadosIds}
        onChangeSelecionados={ids => onChange('personagensSelecionadosIds', ids)}
        desabilitado={desabilitado}
      />

      <div>
        <label className={CLASSE_LABEL}>Observações adicionais</label>
        <textarea
          value={valores.observacoesAdicionais}
          onChange={e => onChange('observacoesAdicionais', e.target.value)}
          disabled={desabilitado}
          rows={3}
          placeholder="Ex: focar na regra do impedimento, mencionar o uniforme do time da escola..."
          className={`${CLASSE_INPUT} resize-none`}
        />
      </div>
    </div>
  );
}
