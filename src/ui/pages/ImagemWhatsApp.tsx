import React, { useEffect, useState } from 'react';
import { Download, Image as ImagemIcone, Loader2, Share2 } from 'lucide-react';
import { saveAs } from 'file-saver';
import type { LinhaResumo } from '../../domain/resumoProvasTurma';
import { arquivoListaWhatsApp } from './desenharListaWhatsApp';

// Imagem com quem ainda vai fazer a prova impressa, para o grupo da turma.
export function ImagemWhatsApp({ turma, bimestre, linhas }: { turma: string; bimestre: number; linhas: LinhaResumo[] }) {
  const [aberto, setAberto] = useState(false);
  const [data, setData] = useState('');
  const [imagem, setImagem] = useState<{ arquivo: File; url: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  // `linhas` é recalculado a cada desenho do painel; a chave evita redesenhar à toa.
  const chave = linhas.map(l => `${l.id}:${l.numero}:${l.nome}`).join('|');

  useEffect(() => {
    if (!aberto) return;
    let ativo = true;
    let url = '';
    setImagem(null);
    setErro(null);
    arquivoListaWhatsApp(turma, bimestre, linhas, data)
      .then(arquivo => {
        if (!ativo) return;
        url = URL.createObjectURL(arquivo);
        setImagem({ arquivo, url });
      })
      .catch(e => { if (ativo) setErro(e.message); });
    return () => { ativo = false; if (url) URL.revokeObjectURL(url); };
  }, [aberto, data, turma, bimestre, chave]);

  const podeCompartilhar = !!imagem && !!navigator.canShare?.({ files: [imagem.arquivo] });
  const compartilhar = async () => {
    setErro(null);
    try { await navigator.share({ files: [imagem!.arquivo] }); }
    catch (e: any) {
      if (e?.name !== 'AbortError') setErro('Não consegui compartilhar. Baixe a imagem e envie pelo WhatsApp.');
    }
  };

  const botao = 'min-h-11 px-3 rounded-xl text-[13px] font-extrabold flex items-center justify-center gap-2 active:scale-95 transition-all';

  return (
    <div className="border-t border-[#DCEBE2] px-3.5 py-3">
      <button type="button" aria-expanded={aberto} onClick={() => setAberto(a => !a)}
        className={`${botao} w-full border border-[#0B6B3A] bg-white text-[#0B6B3A]`}>
        <ImagemIcone className="w-4 h-4" aria-hidden />
        {aberto ? 'Fechar a imagem' : `Imagem da ${turma} para o WhatsApp`}
      </button>
      {aberto && (
        <div className="mt-3 space-y-3">
          <label className="block text-[13px] font-bold text-on-surface">
            Data da prova (opcional)
            <input type="date" value={data} onChange={e => setData(e.target.value)}
              className="mt-1 block w-full h-11 px-3 rounded-xl border border-[#DCEBE2] bg-white text-sm font-semibold text-on-surface" />
          </label>
          {imagem ? (
            <>
              <div className="max-h-80 overflow-y-auto rounded-xl border border-[#DCEBE2]">
                <img src={imagem.url} className="block w-full h-auto"
                  alt={`Prévia da lista da turma ${turma} com ${linhas.length} alunos para a prova impressa`} />
              </div>
              <div className="flex flex-wrap gap-2">
                {podeCompartilhar && (
                  <button type="button" onClick={compartilhar} className={`${botao} flex-1 bg-[#0B6B3A] text-white`}>
                    <Share2 className="w-4 h-4" aria-hidden /> Compartilhar
                  </button>
                )}
                <button type="button" onClick={() => saveAs(imagem.arquivo, imagem.arquivo.name)}
                  className={`${botao} flex-1 ${podeCompartilhar ? 'border border-[#0B6B3A] bg-white text-[#0B6B3A]' : 'bg-[#0B6B3A] text-white'}`}>
                  <Download className="w-4 h-4" aria-hidden /> Baixar imagem
                </button>
              </div>
              <p className="text-xs text-on-surface-variant">Envie só no grupo da turma {turma}.</p>
            </>
          ) : !erro && (
            <p role="status" className="flex items-center gap-2 text-[13px] font-semibold text-on-surface-variant">
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> Montando a imagem...
            </p>
          )}
          {erro && <p role="alert" className="text-xs font-semibold text-[#B42318]">{erro}</p>}
        </div>
      )}
    </div>
  );
}
