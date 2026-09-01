import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ImagePlus, Trash2, Upload } from 'lucide-react';
import {
  layoutQuaseQuadrado,
  recortarImagemComCaixas,
  redimensionarImagemParaDataUrl,
  type CaixaRecortePercentual,
} from '../charges/imagemQuadroUtils';

// Mesmo mecanismo de "Imagem única → recorte em pedaços por caixa" do Gerador
// de Charges (`GeradorChargesCard.tsx`), adaptado aqui pras Questões do
// Exercício de Fixação em vez dos Quadros da charge. Reaproveita as mesmas
// funções puras de `imagemQuadroUtils.ts` (upload/redimensionar/recortar);
// só o componente visual foi replicado, pra não mexer no arquivo de Charges
// (que já está funcionando) e manter os dois módulos independentes.

interface LayoutRecorte {
  colunasPorLinha: number[];
  label: string;
}

function labelColunasPorLinha(colunasPorLinha: number[]): string {
  if (colunasPorLinha.length === 1) return `1 linha × ${colunasPorLinha[0]} colunas (lado a lado)`;
  if (colunasPorLinha.every(c => c === 1)) return `${colunasPorLinha.length} linhas × 1 coluna (empilhados)`;
  if (colunasPorLinha.every(c => c === colunasPorLinha[0])) return `${colunasPorLinha.length} linhas × ${colunasPorLinha[0]} colunas (grade)`;
  return `${colunasPorLinha.length} fileiras desiguais (${colunasPorLinha.join(' + ')} pedaços)`;
}

function layoutsDeRecorte(numeroPedacos: number): LayoutRecorte[] {
  if (numeroPedacos <= 1) return [{ colunasPorLinha: [1], label: '1 pedaço (imagem inteira)' }];
  const quaseQuadrado = layoutQuaseQuadrado(numeroPedacos);
  const layouts: LayoutRecorte[] = [{ colunasPorLinha: quaseQuadrado, label: `${labelColunasPorLinha(quaseQuadrado)} — recomendado` }];
  const ladoALado = [numeroPedacos];
  const empilhados = Array.from({ length: numeroPedacos }, () => 1);
  if (labelColunasPorLinha(ladoALado) !== layouts[0].label.replace(' — recomendado', '')) {
    layouts.push({ colunasPorLinha: ladoALado, label: labelColunasPorLinha(ladoALado) });
  }
  if (labelColunasPorLinha(empilhados) !== layouts[0].label.replace(' — recomendado', '')) {
    layouts.push({ colunasPorLinha: empilhados, label: labelColunasPorLinha(empilhados) });
  }
  return layouts;
}

function gerarCaixasIniciais(layout: LayoutRecorte, numeroPedacos: number): CaixaRecortePercentual[] {
  const h = 100 / layout.colunasPorLinha.length;
  const caixas: CaixaRecortePercentual[] = [];
  let n = 1;
  layout.colunasPorLinha.forEach((colunasNaLinha, linha) => {
    const w = 100 / colunasNaLinha;
    for (let coluna = 0; coluna < colunasNaLinha && n <= numeroPedacos; coluna++) {
      caixas.push({ quadro: n, x: coluna * w, y: linha * h, w, h });
      n++;
    }
  });
  return caixas;
}

const TAMANHO_MINIMO_CAIXA_PERCENT = 4;
const clampPercent = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

interface ArrastoAtivo {
  quadro: number;
  modo: 'mover' | 'redimensionar';
  mouseInicioX: number;
  mouseInicioY: number;
  caixaInicio: CaixaRecortePercentual;
}

function AjusteVisualRecorte({
  imagemDataUrl,
  caixas,
  onCaixasChange,
}: {
  imagemDataUrl: string;
  caixas: CaixaRecortePercentual[];
  onCaixasChange: (caixas: CaixaRecortePercentual[]) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [arrasto, setArrasto] = useState<ArrastoAtivo | null>(null);

  useEffect(() => {
    if (!arrasto) return;

    function aoMoverMouse(e: MouseEvent) {
      const container = containerRef.current;
      if (!container || !arrasto) return;
      const rect = container.getBoundingClientRect();
      const deltaX = ((e.clientX - arrasto.mouseInicioX) / rect.width) * 100;
      const deltaY = ((e.clientY - arrasto.mouseInicioY) / rect.height) * 100;

      onCaixasChange(
        caixas.map(c => {
          if (c.quadro !== arrasto.quadro) return c;
          if (arrasto.modo === 'mover') {
            return {
              ...c,
              x: clampPercent(arrasto.caixaInicio.x + deltaX, 0, 100 - c.w),
              y: clampPercent(arrasto.caixaInicio.y + deltaY, 0, 100 - c.h),
            };
          }
          return {
            ...c,
            w: clampPercent(arrasto.caixaInicio.w + deltaX, TAMANHO_MINIMO_CAIXA_PERCENT, 100 - c.x),
            h: clampPercent(arrasto.caixaInicio.h + deltaY, TAMANHO_MINIMO_CAIXA_PERCENT, 100 - c.y),
          };
        })
      );
    }

    function aoSoltarMouse() { setArrasto(null); }

    window.addEventListener('mousemove', aoMoverMouse);
    window.addEventListener('mouseup', aoSoltarMouse);
    return () => {
      window.removeEventListener('mousemove', aoMoverMouse);
      window.removeEventListener('mouseup', aoSoltarMouse);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrasto]);

  function iniciarArrasto(quadro: number, modo: 'mover' | 'redimensionar', e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const caixaAtual = caixas.find(c => c.quadro === quadro);
    if (!caixaAtual) return;
    setArrasto({ quadro, modo, mouseInicioX: e.clientX, mouseInicioY: e.clientY, caixaInicio: caixaAtual });
  }

  return (
    <div ref={containerRef} className="relative w-full select-none" style={{ touchAction: 'none' }}>
      <img src={imagemDataUrl} alt="Imagem única — ajuste as caixas de cada questão" className="w-full h-auto block rounded-lg" draggable={false} />
      {caixas.map(c => (
        <div
          key={c.quadro}
          onMouseDown={e => iniciarArrasto(c.quadro, 'mover', e)}
          className="absolute border-2 border-primary bg-primary/10 cursor-move"
          style={{ left: `${c.x}%`, top: `${c.y}%`, width: `${c.w}%`, height: `${c.h}%` }}
        >
          <span className="absolute top-0.5 left-0.5 bg-primary text-on-primary text-[10px] font-bold px-1.5 py-0.5 rounded">{c.quadro}</span>
          <div
            onMouseDown={e => iniciarArrasto(c.quadro, 'redimensionar', e)}
            className="absolute -right-1.5 -bottom-1.5 w-4 h-4 bg-primary rounded-full cursor-nwse-resize border-2 border-surface"
          />
        </div>
      ))}
    </div>
  );
}

export function RecorteImagemQuestoesControle({
  numeroQuestoes,
  onRecorte,
}: {
  numeroQuestoes: number;
  /** Chamado uma vez pra cada pedaço recortado (índice 1-based da questão, e a data URL do recorte, ou null pra limpar). */
  onRecorte: (indiceQuestao: number, dataUrl: string | null) => void;
}) {
  const inputArquivoRef = useRef<HTMLInputElement>(null);
  const [imagemUnicaDataUrl, setImagemUnicaDataUrl] = useState<string | null>(null);
  const layouts = useMemo(() => layoutsDeRecorte(numeroQuestoes), [numeroQuestoes]);
  const [layoutEscolhido, setLayoutEscolhido] = useState(0);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(false);
  const [ajusteAberto, setAjusteAberto] = useState(false);
  const [caixas, setCaixas] = useState<CaixaRecortePercentual[] | null>(null);

  useEffect(() => { setLayoutEscolhido(0); setAjusteAberto(false); setCaixas(null); setSucesso(false); }, [numeroQuestoes]);

  async function selecionarArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;
    setErro('');
    setSucesso(false);
    setProcessando(true);
    try {
      // Largura maior que o padrão (1600px) porque esta imagem é dividida em vários
      // pedaços — cada pedaço recortado herda só uma fração dessa largura, então
      // precisa de mais resolução de origem pra manter o texto dos balões legível.
      const resultado = await redimensionarImagemParaDataUrl(arquivo, 2400);
      setImagemUnicaDataUrl(resultado.dataUrl);
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setProcessando(false);
    }
  }

  async function recortar() {
    if (!imagemUnicaDataUrl) return;
    const layout = layouts[layoutEscolhido];
    setErro('');
    setSucesso(false);
    setProcessando(true);
    try {
      const caixasIniciais = gerarCaixasIniciais(layout, numeroQuestoes);
      const recortes = await recortarImagemComCaixas(imagemUnicaDataUrl, caixasIniciais);
      recortes.forEach(r => { if (r.quadro <= numeroQuestoes) onRecorte(r.quadro, r.dataUrl); });
      setSucesso(true);
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setProcessando(false);
    }
  }

  function abrirAjusteManual() {
    setCaixas(gerarCaixasIniciais(layouts[layoutEscolhido], numeroQuestoes));
    setAjusteAberto(true);
    setErro('');
    setSucesso(false);
  }

  async function aplicarRecortesManual() {
    if (!caixas || !imagemUnicaDataUrl) return;
    setErro('');
    setSucesso(false);
    setProcessando(true);
    try {
      const recortes = await recortarImagemComCaixas(imagemUnicaDataUrl, caixas);
      recortes.forEach(r => onRecorte(r.quadro, r.dataUrl));
      setSucesso(true);
      setAjusteAberto(false);
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setProcessando(false);
    }
  }

  function removerImagemUnica() {
    setImagemUnicaDataUrl(null);
    setAjusteAberto(false);
    setCaixas(null);
    setSucesso(false);
    for (let i = 1; i <= numeroQuestoes; i++) onRecorte(i, null);
  }

  return (
    <div className="bg-background border border-outline-variant rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-on-surface-variant">Imagem da atividade (opcional)</p>
        <input ref={inputArquivoRef} type="file" accept="image/*" onChange={selecionarArquivo} className="hidden" />
        {!imagemUnicaDataUrl && (
          <button
            onClick={() => inputArquivoRef.current?.click()}
            disabled={processando}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-on-primary text-xs font-bold disabled:opacity-60"
          >
            <Upload className="w-3.5 h-3.5" /> {processando ? 'Processando...' : 'Enviar imagem'}
          </button>
        )}
      </div>

      {erro && <p className="text-[11px] text-on-error-container bg-error-container rounded-lg px-2 py-1">{erro}</p>}

      {!imagemUnicaDataUrl ? (
        <p className="text-[11px] text-on-surface-variant italic">
          Envie uma imagem única (ex: uma charge/tira com várias cenas) pra dividir automaticamente em {numeroQuestoes} pedaço(s) — um por questão.
        </p>
      ) : (
        <div className="space-y-2">
          <img src={imagemUnicaDataUrl} alt="Imagem enviada" className="w-full max-w-sm rounded-xl border border-outline-variant" />
          <div className="flex gap-2">
            <button onClick={() => inputArquivoRef.current?.click()} className="flex items-center gap-1 text-[11px] text-primary font-semibold">
              <ImagePlus className="w-3 h-3" /> Trocar imagem
            </button>
            <button onClick={removerImagemUnica} className="flex items-center gap-1 text-[11px] text-on-error-container font-semibold">
              <Trash2 className="w-3 h-3" /> Remover
            </button>
          </div>

          <p className="text-[11px] text-on-surface-variant">
            Escolha o layout que bate com a imagem, pra dividir em {numeroQuestoes} pedaço(s) — um por questão.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={layoutEscolhido}
              onChange={e => { setLayoutEscolhido(Number(e.target.value)); setSucesso(false); setAjusteAberto(false); }}
              disabled={processando}
              className="px-2 py-1.5 rounded-lg border border-outline-variant bg-surface text-xs text-on-surface"
            >
              {layouts.map((l, i) => <option key={i} value={i}>{l.label}</option>)}
            </select>
            <button onClick={recortar} disabled={processando} className="px-3 py-1.5 rounded-xl bg-primary text-on-primary text-xs font-semibold disabled:opacity-60">
              {processando ? 'Recortando...' : 'Recortar'}
            </button>
            <button
              onClick={ajusteAberto ? () => setAjusteAberto(false) : abrirAjusteManual}
              disabled={processando}
              className="px-3 py-1.5 rounded-xl bg-secondary-container text-on-secondary-container text-xs font-semibold disabled:opacity-60"
            >
              {ajusteAberto ? 'Fechar ajuste manual' : 'Ajustar manualmente'}
            </button>
          </div>
          {sucesso && !erro && (
            <p className="text-[11px] text-on-surface-variant">
              Recortes aplicados às questões abaixo — se não bateu certinho, use "Ajustar manualmente".
            </p>
          )}

          {ajusteAberto && caixas && (
            <div className="space-y-2 pt-2 border-t border-outline-variant">
              <p className="text-[11px] text-on-surface-variant">
                Arraste cada caixa numerada até alinhar com o pedaço real da imagem. Use a bolinha no canto inferior direito pra redimensionar.
              </p>
              <AjusteVisualRecorte imagemDataUrl={imagemUnicaDataUrl} caixas={caixas} onCaixasChange={setCaixas} />
              <div className="flex gap-2">
                <button onClick={aplicarRecortesManual} disabled={processando} className="px-3 py-1.5 rounded-xl bg-primary text-on-primary text-xs font-semibold disabled:opacity-60">
                  {processando ? 'Aplicando...' : 'Aplicar recortes ajustados'}
                </button>
                <button
                  onClick={() => setCaixas(gerarCaixasIniciais(layouts[layoutEscolhido], numeroQuestoes))}
                  disabled={processando}
                  className="px-3 py-1.5 rounded-xl bg-secondary-container text-on-secondary-container text-xs font-semibold disabled:opacity-60"
                >
                  Resetar para grade
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
