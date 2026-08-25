import React, { useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Copy, ImagePlus, Pencil, Trash2, Upload } from 'lucide-react';
import { redimensionarImagemParaDataUrl, type ImagemRedimensionada } from './imagemQuadroUtils';
import { montarPromptImagemUnico } from './promptImagemCharges';
import type { AtividadeCharge, ImagemQuadro, ImagemUnica, QuestaoChargeIA } from './tiposCharges';

export interface GeradorChargesCardProps {
  atividade: AtividadeCharge;
  onEditarQuestao: (indice: number, alteracoes: Partial<QuestaoChargeIA>) => void;
  onImagemQuadro: (quadro: number, imagem: ImagemQuadro | null) => void;
  onImagemUnica: (imagem: ImagemUnica | null) => void;
}

/**
 * Controle de upload/preview de imagem reutilizável — usado tanto para a
 * imagem de um quadro individual quanto para a imagem única da tira
 * completa. Cuida do redimensionamento (via `redimensionarImagemParaDataUrl`)
 * e devolve o resultado bruto; quem chama decide como encaixar no tipo certo
 * (`ImagemQuadro` ou `ImagemUnica`).
 */
function UploadImagemControle({
  rotulo,
  imagemDataUrl,
  altTexto,
  onImagem,
}: {
  rotulo: string;
  imagemDataUrl: string | undefined | null;
  altTexto: string;
  onImagem: (resultado: ImagemRedimensionada | null) => void;
}) {
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState('');
  const inputArquivoRef = useRef<HTMLInputElement>(null);

  async function selecionarArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = ''; // permite selecionar o mesmo arquivo de novo depois de remover
    if (!arquivo) return;

    setErro('');
    setProcessando(true);
    try {
      const resultado = await redimensionarImagemParaDataUrl(arquivo);
      onImagem(resultado);
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setProcessando(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-on-surface-variant">{rotulo}</p>
        <input ref={inputArquivoRef} type="file" accept="image/*" onChange={selecionarArquivo} className="hidden" />
        {!imagemDataUrl && (
          <button
            onClick={() => inputArquivoRef.current?.click()}
            disabled={processando}
            className="flex items-center gap-1 text-[11px] text-primary font-semibold disabled:opacity-60"
          >
            <Upload className="w-3 h-3" /> {processando ? 'Processando...' : 'Enviar imagem'}
          </button>
        )}
      </div>

      {erro && <p className="text-[11px] text-on-error-container bg-error-container rounded-lg px-2 py-1">{erro}</p>}

      {imagemDataUrl ? (
        <div className="space-y-1.5">
          <img src={imagemDataUrl} alt={altTexto} className="w-full max-w-sm rounded-xl border border-outline-variant" />
          <div className="flex gap-2">
            <button onClick={() => inputArquivoRef.current?.click()} className="flex items-center gap-1 text-[11px] text-primary font-semibold">
              <ImagePlus className="w-3 h-3" /> Trocar imagem
            </button>
            <button onClick={() => onImagem(null)} className="flex items-center gap-1 text-[11px] text-on-error-container font-semibold">
              <Trash2 className="w-3 h-3" /> Remover
            </button>
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-on-surface-variant italic">
          Gere a imagem numa ferramenta externa (ChatGPT Images, Leonardo, etc.) usando o prompt abaixo, baixe o arquivo e envie aqui — ela será usada na exportação em vez do texto do prompt.
        </p>
      )}
    </div>
  );
}

function QuestaoItem({ questao, indice, onEditar }: { questao: QuestaoChargeIA; indice: number; onEditar: (alteracoes: Partial<QuestaoChargeIA>) => void }) {
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState(questao.enunciado);

  function salvar() {
    onEditar({ enunciado: rascunho });
    setEditando(false);
  }

  return (
    <div className="border border-outline-variant rounded-xl p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold text-on-surface-variant">
          Questão {indice + 1} · {questao.tipo === 'objetiva' ? 'Objetiva' : 'Discursiva'}
        </p>
        <button onClick={() => setEditando(v => !v)} className="text-on-surface-variant shrink-0">
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </div>

      {editando ? (
        <div className="space-y-2">
          <textarea
            value={rascunho}
            onChange={e => setRascunho(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-background text-sm text-on-surface resize-none"
          />
          <div className="flex gap-2">
            <button onClick={salvar} className="px-3 py-1.5 rounded-xl bg-primary text-on-primary text-xs font-semibold">Salvar</button>
            <button onClick={() => { setEditando(false); setRascunho(questao.enunciado); }} className="px-3 py-1.5 rounded-xl bg-secondary-container text-on-secondary-container text-xs font-semibold">Cancelar</button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-on-surface">{questao.enunciado}</p>
      )}

      {questao.alternativas ? (
        <div className="space-y-1.5">
          {questao.alternativas.map(alt => (
            <div
              key={alt.letra}
              className={[
                'text-sm px-3 py-2 rounded-xl border',
                alt.correta ? 'border-primary bg-primary/10 font-semibold text-on-surface' : 'border-outline-variant text-on-surface-variant',
              ].join(' ')}
            >
              ({alt.letra}) {alt.texto}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm px-3 py-2 rounded-xl border border-primary bg-primary/10 text-on-surface">
          <span className="font-semibold">Resposta esperada: </span>{questao.respostaEsperada}
        </div>
      )}
    </div>
  );
}

function QuadroItem({
  quadro,
  prompt,
  imagem,
  onImagem,
}: {
  quadro: AtividadeCharge['roteiro']['quadros'][number];
  prompt: string | undefined;
  imagem: ImagemQuadro | undefined;
  onImagem: (imagem: ImagemQuadro | null) => void;
}) {
  const [expandido, setExpandido] = useState(true);
  const [copiado, setCopiado] = useState(false);

  async function copiarPrompt() {
    if (!prompt) return;
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Clipboard indisponível (ex: contexto não seguro) — o professor pode selecionar o texto manualmente.
    }
  }

  return (
    <div className="border border-outline-variant rounded-xl p-3 space-y-2">
      <button onClick={() => setExpandido(v => !v)} className="w-full flex items-center justify-between gap-2 text-left">
        <p className="text-sm font-semibold text-on-surface">Quadro {quadro.numero}</p>
        {expandido ? <ChevronUp className="w-4 h-4 text-on-surface-variant" /> : <ChevronDown className="w-4 h-4 text-on-surface-variant" />}
      </button>

      {expandido && (
        <div className="space-y-2">
          <p className="text-sm text-on-surface">{quadro.descricaoCena}</p>
          <div className="flex flex-wrap gap-1.5">
            {quadro.personagensPresentes.map(nome => (
              <span key={nome} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-semibold">
                {nome}{quadro.expressoesFaciais[nome] ? ` · ${quadro.expressoesFaciais[nome]}` : ''}
              </span>
            ))}
          </div>
          <p className="text-[11px] text-on-surface-variant">Ângulo de câmera: {quadro.anguloCamera}</p>
          {quadro.elementosCenario.length > 0 && (
            <p className="text-[11px] text-on-surface-variant">Cenário: {quadro.elementosCenario.join(', ')}</p>
          )}
          {quadro.textoBalao && quadro.textoBalao.length > 0 && (
            <div className="space-y-1">
              {quadro.textoBalao.map((b, i) => (
                <p key={i} className="text-xs italic text-on-surface-variant border-l-2 border-outline-variant pl-2">
                  {b.personagem}: "{b.fala}"
                </p>
              ))}
            </div>
          )}

          <UploadImagemControle
            rotulo="Imagem do quadro"
            imagemDataUrl={imagem?.dataUrl}
            altTexto={`Ilustração do quadro ${quadro.numero}`}
            onImagem={resultado =>
              onImagem(resultado ? { quadro: quadro.numero, dataUrl: resultado.dataUrl, larguraOriginal: resultado.largura, alturaOriginal: resultado.altura } : null)
            }
          />

          {prompt && (
            <div className="bg-background border border-outline-variant rounded-xl p-2 space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold text-on-surface-variant">Prompt para gerar a imagem</p>
                <button onClick={copiarPrompt} className="flex items-center gap-1 text-[11px] text-primary font-semibold">
                  <Copy className="w-3 h-3" /> {copiado ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
              <p className="text-[11px] text-on-surface-variant whitespace-pre-wrap">{prompt}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function GeradorChargesCard({ atividade, onEditarQuestao, onImagemQuadro, onImagemUnica }: GeradorChargesCardProps) {
  const promptsPorQuadro = new Map(atividade.promptsImagem.map(p => [p.quadro, p.prompt]));
  const imagensPorQuadro = new Map(atividade.imagensQuadros.map(i => [i.quadro, i]));
  const [copiadoUnico, setCopiadoUnico] = useState(false);

  const promptUnico = useMemo(() => montarPromptImagemUnico({
    roteiro: atividade.roteiro,
    personagensUsados: atividade.personagensUsados,
    tipoImagem: atividade.parametros.tipoImagem,
    estiloIlustracao: atividade.parametros.estiloIlustracao,
    conteudo: atividade.parametros.conteudo,
  }), [atividade.roteiro, atividade.personagensUsados, atividade.parametros.tipoImagem, atividade.parametros.estiloIlustracao, atividade.parametros.conteudo]);

  async function copiarPromptUnico() {
    try {
      await navigator.clipboard.writeText(promptUnico);
      setCopiadoUnico(true);
      setTimeout(() => setCopiadoUnico(false), 2000);
    } catch {
      // Clipboard indisponível — o professor pode selecionar o texto manualmente.
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-surface border border-outline-variant rounded-2xl p-4 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-bold text-on-surface">{atividade.roteiro.tituloRoteiro}</p>
          {atividade.statusRevisao === 'aprovada' && (
            <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-primary text-on-primary font-semibold">
              <CheckCircle2 className="w-3 h-3" /> Aprovada
            </span>
          )}
          {atividade.statusRevisao === 'requer_revisao_manual' && (
            <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-error-container text-on-error-container font-semibold">
              <AlertTriangle className="w-3 h-3" /> Requer revisão manual
            </span>
          )}
        </div>
        <p className="text-sm text-on-surface-variant">{atividade.roteiro.sinopse}</p>

        {atividade.statusRevisao === 'requer_revisao_manual' && (
          <div className="text-[11px] text-on-error-container bg-error-container rounded-xl p-2">
            <p className="font-semibold mb-1">Motivos da última reprovação automática:</p>
            <ul className="list-disc list-inside space-y-0.5">
              {(atividade.historicoRevisao[atividade.historicoRevisao.length - 1]?.motivosFalha ?? []).map((m, i) => <li key={i}>{m}</li>)}
            </ul>
            <p className="mt-1">Revise manualmente o roteiro/questões abaixo antes de usar em sala.</p>
          </div>
        )}
      </div>

      <div className="bg-surface border border-outline-variant rounded-2xl p-4 space-y-2">
        <p className="text-sm font-semibold text-on-surface">Imagem única da tira completa</p>
        <p className="text-[11px] text-on-surface-variant">
          Alternativa a enviar uma imagem por quadro: gere a tira INTEIRA (todos os quadros já combinados numa grade) numa única chamada de IA de imagem, usando o prompt abaixo, e envie o resultado aqui. Se enviada, ela tem prioridade sobre as imagens individuais dos quadros na exportação.
        </p>
        <UploadImagemControle
          rotulo="Imagem da tira completa"
          imagemDataUrl={atividade.imagemUnica?.dataUrl}
          altTexto="Tira completa com todos os quadros"
          onImagem={resultado =>
            onImagemUnica(resultado ? { dataUrl: resultado.dataUrl, larguraOriginal: resultado.largura, alturaOriginal: resultado.altura } : null)
          }
        />
        <div className="bg-background border border-outline-variant rounded-xl p-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-on-surface-variant">Prompt para gerar a tira completa</p>
            <button onClick={copiarPromptUnico} className="flex items-center gap-1 text-[11px] text-primary font-semibold">
              <Copy className="w-3 h-3" /> {copiadoUnico ? 'Copiado!' : 'Copiar'}
            </button>
          </div>
          <p className="text-[11px] text-on-surface-variant whitespace-pre-wrap">{promptUnico}</p>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold text-on-surface">Quadros{atividade.imagemUnica ? ' (a imagem única acima já ilustra todos)' : ''}</p>
        {atividade.roteiro.quadros.map(quadro => (
          <QuadroItem
            key={quadro.numero}
            quadro={quadro}
            prompt={promptsPorQuadro.get(quadro.numero)}
            imagem={imagensPorQuadro.get(quadro.numero)}
            onImagem={imagem => onImagemQuadro(quadro.numero, imagem)}
          />
        ))}
      </div>

      {atividade.roteiro.textoApoio && (
        <div className="bg-surface border border-outline-variant rounded-2xl p-4 space-y-1">
          <p className="text-sm font-semibold text-on-surface">Texto de apoio</p>
          <p className="text-sm text-on-surface-variant">{atividade.roteiro.textoApoio}</p>
        </div>
      )}

      <div className="space-y-3">
        <p className="text-sm font-semibold text-on-surface">Questões</p>
        {atividade.questoes.map((questao, indice) => (
          <QuestaoItem key={indice} questao={questao} indice={indice} onEditar={alteracoes => onEditarQuestao(indice, alteracoes)} />
        ))}
      </div>

      <div className="bg-surface border border-outline-variant rounded-2xl p-4 space-y-3">
        {atividade.competencias.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-on-surface-variant mb-1">Competências</p>
            <ul className="list-disc list-inside text-sm text-on-surface space-y-0.5">
              {atividade.competencias.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </div>
        )}
        {atividade.habilidades.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-on-surface-variant mb-1">Habilidades trabalhadas</p>
            <ul className="list-disc list-inside text-sm text-on-surface space-y-0.5">
              {atividade.habilidades.map((h, i) => <li key={i}>{h}</li>)}
            </ul>
          </div>
        )}
        {atividade.objetivos.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-on-surface-variant mb-1">Objetivos</p>
            <ul className="list-disc list-inside text-sm text-on-surface space-y-0.5">
              {atividade.objetivos.map((o, i) => <li key={i}>{o}</li>)}
            </ul>
          </div>
        )}
        {atividade.observacoesProfessor && (
          <div>
            <p className="text-xs font-semibold text-on-surface-variant mb-1">Observações para o professor</p>
            <p className="text-sm text-on-surface-variant">{atividade.observacoesProfessor}</p>
          </div>
        )}
      </div>
    </div>
  );
}
