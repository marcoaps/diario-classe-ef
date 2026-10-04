// Organizador de Provas — tela. Independente do gerador de provas: importa uma prova pronta
// (DOCX, .doc/.html, PDF ou TXT), organiza em A4 + Arial 12 + duas colunas e exporta Word/PDF.
// O arquivo importado nunca é modificado; "Restaurar original" volta para ele.

import React, { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { saveAs } from 'file-saver';
import { ArrowLeft, FileDown, FileText, Loader2, RotateCcw, Sparkles, Upload } from 'lucide-react';
import { importarProva } from './importar';
import { paginarProva } from './layout';
import { gerarDocx } from './exportarDocx';
import { gerarPdf } from './exportarPdf';
import { PreviaOriginal, PreviaProva } from './PreviaProva';
import { CONFIG_PADRAO, ErroAmigavel, todosOsBlocos, totalDeQuestoes, type Configuracao, type Prova } from './tipos';

const SELECT = 'w-full px-3 py-2 rounded-xl border border-outline-variant bg-background text-sm text-on-surface';
const ROTULO = 'text-xs font-semibold text-on-surface-variant block mb-1';

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={ROTULO}>{rotulo}</label>
      {children}
    </div>
  );
}

const nomeBase = (nome: string): string => nome.replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|]/g, '').trim() || 'prova';

export function OrganizadorProvas() {
  const navigate = useNavigate();
  const entrada = useRef<HTMLInputElement>(null);
  const [original, setOriginal] = useState<Prova | null>(null);
  const [config, setConfig] = useState<Configuracao>(CONFIG_PADRAO);
  const [organizada, setOrganizada] = useState(false);
  const [importando, setImportando] = useState(false);
  const [exportando, setExportando] = useState<'docx' | 'pdf' | null>(null);
  const [erro, setErro] = useState('');
  const [verOriginal, setVerOriginal] = useState(false);

  // O layout é recalculado a partir do original sempre que a configuração muda; o original não é tocado.
  const layout = useMemo(() => {
    if (!original || !organizada || totalDeQuestoes(original) === 0) return null;
    try {
      return paginarProva(original, config);
    } catch (e) {
      console.error('[Organizador de Provas] falha no layout', e);
      return null;
    }
  }, [original, organizada, config]);

  const alterar = (parcial: Partial<Configuracao>) => setConfig(c => ({ ...c, ...parcial }));

  async function aoEscolher(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;
    setErro('');
    setOrganizada(false);
    setOriginal(null);
    setImportando(true);
    try {
      const prova = await importarProva(arquivo);
      setOriginal(prova);
      if (totalDeQuestoes(prova) === 0) setErro('Não foi possível identificar as questões automaticamente. Confira se cada questão começa com "Questão 1", "1." ou "01)".');
    } catch (err) {
      setErro(err instanceof ErroAmigavel ? err.amigavel : 'Não foi possível importar este arquivo.');
      if (!(err instanceof ErroAmigavel)) console.error('[Organizador de Provas]', err);
    } finally {
      setImportando(false);
    }
  }

  function organizar() {
    setErro('');
    setOrganizada(true);
  }

  function restaurar() {
    setOrganizada(false);
    setConfig(CONFIG_PADRAO);
    setErro('');
  }

  async function exportar(formato: 'docx' | 'pdf') {
    if (!original || !layout) return;
    setErro('');
    setExportando(formato);
    try {
      const nome = `${nomeBase(original.nomeArquivo)}_organizada`;
      if (formato === 'docx') saveAs(await gerarDocx(original, layout), `${nome}.docx`);
      else saveAs(gerarPdf(layout), `${nome}.pdf`);
    } catch (e) {
      console.error('[Organizador de Provas] exportação', e);
      setErro(formato === 'docx' ? 'Não foi possível gerar o arquivo Word.' : 'Não foi possível gerar o arquivo PDF.');
    } finally {
      setExportando(null);
    }
  }

  const totalImagens = original ? todosOsBlocos(original).filter(b => b.tipo === 'imagem').length : 0;

  return (
    <div className="py-4 space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={() => navigate('/ia')} className="p-1 rounded-lg text-on-surface-variant">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-base font-bold text-on-surface">📄 Organizador de Provas</h1>
          <p className="text-xs text-on-surface-variant">Organize e padronize uma prova pronta: A4, Arial 12, duas colunas.</p>
        </div>
      </div>

      <div className="bg-surface border border-outline-variant rounded-2xl p-3 space-y-2">
        <input ref={entrada} type="file" accept=".docx,.doc,.html,.htm,.pdf,.txt" className="hidden" onChange={aoEscolher} />
        <button onClick={() => entrada.current?.click()} disabled={importando} className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-primary text-on-primary font-semibold text-sm disabled:opacity-60">
          {importando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {importando ? 'Lendo a prova...' : original ? 'Importar outra prova' : 'Importar prova'}
        </button>
        <p className="text-[11px] text-on-surface-variant">
          Formatos aceitos: DOCX, PDF e TXT (também o .doc exportado pelo gerador). O arquivo original não é alterado. Para manter as imagens, prefira DOCX.
        </p>
      </div>

      {erro && <p className="text-xs text-error font-semibold">{erro}</p>}

      {original && (
        <>
          <div className="bg-surface border border-outline-variant rounded-2xl p-3 space-y-2">
            <p className="text-sm font-bold text-on-surface">{original.nomeArquivo}</p>
            <p className="text-xs text-on-surface-variant">
              {totalDeQuestoes(original)} questão(ões) identificada(s) · {totalImagens} imagem(ns) · {original.secoes.length > 1 ? `${original.secoes.length} cabeçalhos (um por aluno)` : original.secoes[0]?.cabecalho.length ? 'cabeçalho encontrado' : 'sem cabeçalho'}
            </p>
            {original.avisos.map((a, i) => <p key={i} className="text-xs text-amber-700 bg-amber-50 rounded-lg px-2 py-1.5">{a}</p>)}
            <button onClick={() => setVerOriginal(v => !v)} className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-surface-variant text-on-surface-variant text-xs font-semibold">
              <FileText className="w-3.5 h-3.5" /> {verOriginal ? 'Ocultar prova importada' : 'Visualizar prova importada'}
            </button>
            {verOriginal && <PreviaOriginal prova={original} />}
          </div>

          <div className="bg-surface border border-outline-variant rounded-2xl p-3 space-y-3">
            <p className="text-xs font-semibold text-on-surface">Configurações</p>
            <div className="grid grid-cols-2 gap-3">
              <Campo rotulo="Fonte">
                <select className={SELECT} value={config.fonte} onChange={e => alterar({ fonte: e.target.value as Configuracao['fonte'] })}>
                  <option>Arial</option>
                  <option>Times New Roman</option>
                </select>
              </Campo>
              <Campo rotulo="Tamanho">
                <select className={SELECT} value={config.tamanho} onChange={e => alterar({ tamanho: Number(e.target.value) })}>
                  {[10, 11, 12, 13, 14].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </Campo>
              <Campo rotulo="Colunas">
                <select className={SELECT} value={config.colunas} onChange={e => alterar({ colunas: Number(e.target.value) as 1 | 2 })}>
                  <option value={2}>2</option>
                  <option value={1}>1</option>
                </select>
              </Campo>
              <Campo rotulo="Espaçamento">
                <select className={SELECT} value={config.espacamento} onChange={e => alterar({ espacamento: Number(e.target.value) })}>
                  <option value={1}>1,0</option>
                  <option value={1.15}>1,15</option>
                  <option value={1.5}>1,5</option>
                </select>
              </Campo>
              <Campo rotulo="Margens">
                <select className={SELECT} value={config.margens} onChange={e => alterar({ margens: e.target.value as Configuracao['margens'] })}>
                  <option value="estreita">Estreita</option>
                  <option value="normal">Normal</option>
                  <option value="larga">Larga</option>
                </select>
              </Campo>
              <Campo rotulo="Imagens: tamanho">
                <select className={SELECT} value={config.imagemTamanho} onChange={e => alterar({ imagemTamanho: e.target.value as Configuracao['imagemTamanho'] })}>
                  <option value="auto">Automático</option>
                  <option value="pequena">Pequena</option>
                  <option value="media">Média</option>
                  <option value="grande">Grande</option>
                </select>
              </Campo>
              <Campo rotulo="Imagens: alinhamento">
                <select className={SELECT} value={config.imagemAlinhamento} onChange={e => alterar({ imagemAlinhamento: e.target.value as Configuracao['imagemAlinhamento'] })}>
                  <option value="centro">Centralizado</option>
                  <option value="esquerda">Esquerda</option>
                  <option value="direita">Direita</option>
                </select>
              </Campo>
              <div className="grid grid-cols-2 gap-2">
                <Campo rotulo="Margem sup. (pt)">
                  <input type="number" min={0} max={30} className={SELECT} value={config.imagemMargemSup} onChange={e => alterar({ imagemMargemSup: Math.max(0, Math.min(30, Number(e.target.value) || 0)) })} />
                </Campo>
                <Campo rotulo="Margem inf. (pt)">
                  <input type="number" min={0} max={30} className={SELECT} value={config.imagemMargemInf} onChange={e => alterar({ imagemMargemInf: Math.max(0, Math.min(30, Number(e.target.value) || 0)) })} />
                </Campo>
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-on-surface">
              <input type="checkbox" checked={config.removerLogo} onChange={e => alterar({ removerLogo: e.target.checked })} />
              Remover a logo do cabeçalho (economiza espaço)
            </label>
            <p className="text-[11px] text-on-surface-variant">Cada questão (texto + imagem + alternativas) é mantida junta. A fonte nunca é reduzida para caber: a questão inteira vai para o próximo espaço.</p>
            <div className="flex gap-2">
              <button onClick={organizar} disabled={totalDeQuestoes(original) === 0} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-primary text-on-primary font-semibold text-sm disabled:opacity-50">
                <Sparkles className="w-4 h-4" /> {organizada ? 'Organizar novamente' : 'Organizar automaticamente'}
              </button>
              {organizada && (
                <button onClick={restaurar} className="flex items-center justify-center gap-1 px-3 rounded-2xl bg-surface-variant text-on-surface-variant text-xs font-semibold">
                  <RotateCcw className="w-4 h-4" /> Restaurar original
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {layout && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-on-surface">Pré-visualização · {layout.paginas.length} página(s)</p>
            <div className="flex gap-2">
              <button onClick={() => exportar('docx')} disabled={exportando !== null} className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-semibold disabled:opacity-60">
                {exportando === 'docx' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />} Exportar Word
              </button>
              <button onClick={() => exportar('pdf')} disabled={exportando !== null} className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-secondary-container text-on-secondary-container text-xs font-semibold disabled:opacity-60">
                {exportando === 'pdf' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />} Exportar PDF
              </button>
            </div>
          </div>
          {layout.totalGigantes > 0 && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-2 py-1.5">
              {layout.totalGigantes} questão(ões) são maiores que uma coluna inteira e precisaram continuar na coluna seguinte.
            </p>
          )}
          <PreviaProva layout={layout} />
        </div>
      )}
    </div>
  );
}
