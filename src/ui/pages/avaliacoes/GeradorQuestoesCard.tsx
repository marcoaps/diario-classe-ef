import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Pencil, RefreshCw } from 'lucide-react';
import { DIFICULDADES, TIPOS_QUESTAO } from './tiposGeradorQuestoes';
import type { QuestaoGerada } from './tiposGeradorQuestoes';

export interface GeradorQuestoesCardProps {
  questao: QuestaoGerada;
  onEditar: (idTemporario: string, alteracoes: Partial<QuestaoGerada>) => void;
  onRevisarNovamente: (idTemporario: string) => void;
  revisando: boolean;
}

function labelDificuldade(valor: QuestaoGerada['dificuldade']): string {
  return DIFICULDADES.find(d => d.valor === valor)?.label ?? valor;
}

function labelTipoQuestao(valor: QuestaoGerada['tipoQuestao']): string {
  return TIPOS_QUESTAO.find(t => t.valor === valor)?.label ?? valor;
}

export function GeradorQuestoesCard({ questao, onEditar, onRevisarNovamente, revisando }: GeradorQuestoesCardProps) {
  const [expandido, setExpandido] = useState(true);
  const [editando, setEditando] = useState(false);
  const [enunciadoRascunho, setEnunciadoRascunho] = useState(questao.enunciado);

  const corBorda = questao.statusRevisao === 'requer_revisao_manual'
    ? 'border-amber-400'
    : !questao.conformeReferenciaOficial
      ? 'border-amber-300'
      : 'border-outline-variant';

  function salvarEdicaoEnunciado() {
    onEditar(questao.idTemporario, { enunciado: enunciadoRascunho });
    setEditando(false);
  }

  return (
    <div className={`bg-surface border ${corBorda} rounded-2xl p-4 space-y-3`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-on-surface">
              {questao.tituloInterno || 'Questão sem título'}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-semibold">
              {labelDificuldade(questao.dificuldade)}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-semibold">
              {labelTipoQuestao(questao.tipoQuestao)}
            </span>
            {questao.statusRevisao === 'aprovada' && (
              <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-primary text-on-primary font-semibold">
                <CheckCircle2 className="w-3 h-3" /> Aprovada
              </span>
            )}
            {questao.statusRevisao === 'requer_revisao_manual' && (
              <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-error-container text-on-error-container font-semibold">
                <AlertTriangle className="w-3 h-3" /> Requer revisão manual
              </span>
            )}
            {!questao.conformeReferenciaOficial && (
              <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold">
                <AlertTriangle className="w-3 h-3" /> Fora do padrão oficial
              </span>
            )}
          </div>
          {questao.habilidadeBncc && (
            <p className="text-[11px] text-on-surface-variant">Habilidade: {questao.habilidadeBncc} · Conteúdo: {questao.conteudo}</p>
          )}
        </div>
        <button onClick={() => setExpandido(!expandido)} className="text-on-surface-variant shrink-0">
          {expandido ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {expandido && (
        <div className="space-y-3">
          {questao.contexto && (
            <p className="text-xs italic text-on-surface-variant border-l-2 border-outline-variant pl-2">{questao.contexto}</p>
          )}

          {questao.imagemQuery && (
            questao.imagemUrl ? (
              <img
                src={questao.imagemUrl}
                alt={questao.imagemQuery}
                className="w-full max-w-sm rounded-xl border border-outline-variant"
              />
            ) : (
              <p className="text-[11px] text-on-surface-variant italic">Nenhuma foto encontrada para "{questao.imagemQuery}" — a questão será exportada sem imagem.</p>
            )
          )}

          {editando ? (
            <div className="space-y-2">
              <textarea
                value={enunciadoRascunho}
                onChange={e => setEnunciadoRascunho(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-background text-sm text-on-surface resize-none"
              />
              <div className="flex gap-2">
                <button onClick={salvarEdicaoEnunciado} className="px-3 py-1.5 rounded-xl bg-primary text-on-primary text-xs font-semibold">
                  Salvar
                </button>
                <button onClick={() => { setEditando(false); setEnunciadoRascunho(questao.enunciado); }} className="px-3 py-1.5 rounded-xl bg-secondary-container text-on-secondary-container text-xs font-semibold">
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm text-on-surface flex-1">{questao.enunciado}</p>
              <button onClick={() => setEditando(true)} className="text-on-surface-variant shrink-0">
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {questao.alternativas && (
            <div className="space-y-1.5">
              {questao.alternativas.map(alt => (
                <div
                  key={alt.letra}
                  className={[
                    'text-sm px-3 py-2 rounded-xl border',
                    alt.correta ? 'border-primary bg-primary/10 font-semibold text-on-surface' : 'border-outline-variant text-on-surface-variant',
                  ].join(' ')}
                >
                  <span>({alt.letra}) {alt.texto}</span>
                  {!alt.correta && alt.comentarioDistrator && (
                    <p className="text-[11px] mt-1 text-on-surface-variant italic">Por que está errada: {alt.comentarioDistrator}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {!questao.alternativas && questao.respostaCorreta && (
            <div className="text-sm px-3 py-2 rounded-xl border border-primary bg-primary/10 text-on-surface">
              <span className="font-semibold">Resposta esperada: </span>{questao.respostaCorreta}
            </div>
          )}

          {questao.statusRevisao === 'requer_revisao_manual' && (
            <div className="space-y-2">
              <div className="text-[11px] text-on-error-container bg-error-container rounded-xl p-2">
                <p className="font-semibold mb-1">Motivos da última reprovação:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  {(questao.historicoRevisao[questao.historicoRevisao.length - 1]?.motivosFalha ?? []).map((m, i) => <li key={i}>{m}</li>)}
                </ul>
              </div>
              <button
                onClick={() => onRevisarNovamente(questao.idTemporario)}
                disabled={revisando}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-on-primary text-xs font-semibold disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${revisando ? 'animate-spin' : ''}`} />
                {revisando ? 'Revisando...' : 'Tentar revisar novamente'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
