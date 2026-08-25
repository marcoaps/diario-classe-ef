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
import { getObjetosConhecimentoDoAno } from '../../../data/curriculumData';
import { formatarHabilidadeBNCC, getHabilidadesBNCC } from '../../../data/bnccEducacaoFisicaData';

const CLASSE_INPUT = 'w-full px-3 py-2 rounded-xl border border-outline-variant bg-background text-sm text-on-surface';
const CLASSE_LABEL = 'text-xs text-on-surface-variant mb-1 block';

export interface GeradorChargesFormularioProps {
  valores: ParametrosGeracaoCharges;
  onChange: <K extends keyof ParametrosGeracaoCharges>(campo: K, valor: ParametrosGeracaoCharges[K]) => void;
  desabilitado: boolean;
}

/**
 * Objeto de Conhecimento junta os 4 bimestres do Plano de Curso do Acre
 * (`curriculumData.ts`) para dar liberdade de escolher qualquer conteúdo do
 * ano, independente do Bimestre selecionado (que fica só como referência de
 * registro). Habilidade vem da BNCC oficial (`bnccEducacaoFisicaData.ts`),
 * organizada por bloco de anos (6º/7º e 8º/9º) — também independe do
 * Bimestre. Mesma decisão já tomada no Gerador de Questões
 * (`GeradorQuestoesFormulario.tsx`).
 */
export function GeradorChargesFormulario({ valores, onChange, desabilitado }: GeradorChargesFormularioProps) {
  const objetosConhecimento = getObjetosConhecimentoDoAno(valores.anoEscolar);
  const habilidadesBNCC = getHabilidadesBNCC(valores.anoEscolar);

  // Sempre que o Ano Escolar mudar, sincroniza Objeto de Conhecimento/
  // Conteúdo e Habilidade com as listas daquele ano, selecionando
  // automaticamente o primeiro item de cada uma.
  useEffect(() => {
    if (!objetosConhecimento.includes(valores.objetoConhecimento)) {
      const primeiroObjeto = objetosConhecimento[0] ?? '';
      onChange('objetoConhecimento', primeiroObjeto);
      onChange('conteudo', primeiroObjeto);
    }
    const opcoesHabilidade = habilidadesBNCC.map(formatarHabilidadeBNCC);
    if (!opcoesHabilidade.includes(valores.habilidadeBncc)) {
      onChange('habilidadeBncc', opcoesHabilidade[0] ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valores.anoEscolar]);

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
          Usado só como referência de registro — não filtra mais o Objeto de Conhecimento nem a Habilidade abaixo.
        </p>
      </div>

      <div>
        <label className={CLASSE_LABEL}>Objeto de Conhecimento</label>
        <select
          value={valores.objetoConhecimento}
          onChange={e => selecionarObjetoConhecimento(e.target.value)}
          disabled={desabilitado}
          className={CLASSE_INPUT}
        >
          {objetosConhecimento.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <p className="text-[11px] text-on-surface-variant mt-1">
          Lista completa do {valores.anoEscolar}º Ano (todos os bimestres) — escolha livre, não depende do Bimestre selecionado.
        </p>
      </div>

      <div>
        <label className={CLASSE_LABEL}>Habilidade (BNCC oficial)</label>
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
        {valores.conteudo === valores.objetoConhecimento ? (
          <p className="text-[11px] text-amber-600 dark:text-amber-500 font-medium mt-1">
            ⚠ Ainda está com o texto genérico do Objeto de Conhecimento — sem um esporte/prática específico, a IA pode escolher qualquer exemplo da categoria (ex: "Esportes de invasão" pode virar basquete, futebol, handebol...). Edite para nomear o esporte, ex: "Handebol — Defesa Legal".
          </p>
        ) : (
          <p className="text-[11px] text-on-surface-variant mt-1">Carregado a partir do Objeto de Conhecimento selecionado — pode editar/resumir antes de gerar.</p>
        )}
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
