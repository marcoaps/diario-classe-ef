import React, { useEffect, useState } from 'react';
import { Check, Download, Images, Loader2, Share2 } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { Bimestre } from '../../domain/useRelatorioFrequencia';
import { ColetaImpressa, type TurmaPendente } from './BaixarListasImpressa';
import { arquivoListaWhatsApp } from './desenharListaWhatsApp';

// O Chrome recusa compartilhar mais de 10 arquivos de uma vez.
const POR_ENVIO = 10;

type Imagem = { turma: string; total: number; arquivo: File; url: string };

function emPartes<T>(itens: T[]): T[][] {
  const partes: T[][] = [];
  for (let i = 0; i < itens.length; i += POR_ENVIO) partes.push(itens.slice(i, i + POR_ENVIO));
  return partes;
}

// Uma imagem por turma com pendentes, enviadas juntas para o grupo.
export function ImagensTodasTurmas({ bimestre }: { bimestre: Bimestre }) {
  const [data, setData] = useState('');
  const [aberto, setAberto] = useState(false);
  const [consultando, setConsultando] = useState(false);
  const [turmas, setTurmas] = useState<TurmaPendente[] | null>(null);
  const [imagens, setImagens] = useState<Imagem[] | null>(null);
  const [enviadas, setEnviadas] = useState<number[]>([]);
  // Turmas que o professor desmarcou (por exemplo, já enviadas).
  const [fora, setFora] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  // Redesenha quando a consulta termina ou a data muda, sem consultar de novo.
  useEffect(() => {
    if (!turmas) return;
    let ativo = true;
    const urls: string[] = [];
    setImagens(null);
    setEnviadas([]);
    (async () => {
      const prontas: Imagem[] = [];
      for (const t of turmas) {
        const arquivo = await arquivoListaWhatsApp(t.turma, bimestre, t.linhas, data);
        if (!ativo) return;
        const url = URL.createObjectURL(arquivo);
        urls.push(url);
        prontas.push({ turma: t.turma, total: t.linhas.length, arquivo, url });
      }
      setImagens(prontas);
    })().catch(e => { if (ativo) setErro(e.message); });
    return () => { ativo = false; urls.forEach(u => URL.revokeObjectURL(u)); };
  }, [turmas, data, bimestre]);

  const alternar = () => {
    setErro(null);
    setTurmas(null);
    setImagens(null);
    setConsultando(!aberto);
    setAberto(!aberto);
  };
  // Cada consulta busca o banco de novo: quem já fez a prova sai da lista.
  const tentarDeNovo = () => { setErro(null); setTurmas(null); setImagens(null); setConsultando(true); };

  const marcadas: Imagem[] = imagens?.filter((i: Imagem) => !fora.includes(i.turma)) ?? [];
  const partes = emPartes(marcadas);
  const marcar = (turma: string) => {
    setEnviadas([]);
    setFora(v => v.includes(turma) ? v.filter(t => t !== turma) : [...v, turma]);
  };
  const podeCompartilhar = partes.length > 0 && partes.every(p => !!navigator.canShare?.({ files: p.map(i => i.arquivo) }));

  const compartilhar = async (n: number) => {
    setErro(null);
    try {
      await navigator.share({ files: partes[n].map(i => i.arquivo) });
      setEnviadas(v => v.includes(n) ? v : [...v, n]);
    } catch (e: any) {
      if (e?.name !== 'AbortError') setErro('Não consegui compartilhar. Baixe as imagens e envie pelo WhatsApp.');
    }
  };

  const baixar = async () => {
    setErro(null);
    try {
      const zip = new JSZip();
      for (const i of marcadas) zip.file(i.arquivo.name, i.arquivo);
      saveAs(await zip.generateAsync({ type: 'blob' }), `Prova_Impressa_${bimestre}Bim_imagens.zip`);
    } catch (e: any) { setErro(e.message); }
  };

  const botao = 'w-full min-h-11 px-3 py-2 rounded-xl text-[13px] font-extrabold flex items-center justify-center gap-2 active:scale-95 transition-all';
  const cheio = `${botao} bg-[#0B6B3A] text-white`;
  const vazado = `${botao} border border-[#0B6B3A] bg-white text-[#0B6B3A]`;
  const total = marcadas.reduce((s, i) => s + i.total, 0);

  return (
    <div className="mb-3">
      <button type="button" aria-expanded={aberto} onClick={alternar} className={vazado}>
        <Images className="w-4 h-4" aria-hidden />
        {aberto ? 'Fechar as imagens' : 'Imagens para o WhatsApp (18 turmas)'}
      </button>
      {aberto && (
        <section aria-label="Imagens das turmas" className="mt-2 bg-white rounded-[20px] border border-[#DCEBE2] p-3.5 space-y-3">
          <label className="block text-[13px] font-bold text-on-surface">
            Data da prova (opcional, vale para todas)
            <input type="date" value={data} onChange={e => setData(e.target.value)}
              className="mt-1 block w-full h-11 px-3 rounded-xl border border-[#DCEBE2] bg-white text-sm font-semibold text-on-surface" />
          </label>
          {imagens ? (
            <>
              <div>
                <p role="status" className="text-sm font-extrabold text-on-surface tabular-nums">
                  {marcadas.length === 0 ? 'Nenhuma turma marcada' : `${marcadas.length === 1 ? '1 turma marcada' : `${marcadas.length} turmas marcadas`} (${total === 1 ? '1 aluno' : `${total} alunos`})`}
                </p>
                <p className="text-xs text-on-surface-variant">Toque em uma turma já enviada para tirá-la do envio.</p>
              </div>
              <ul className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {imagens.map(i => {
                  const marcada = !fora.includes(i.turma);
                  return (
                    <li key={i.turma}>
                      <button type="button" aria-pressed={marcada} onClick={() => marcar(i.turma)}
                        aria-label={`Turma ${i.turma}, ${i.total} alunos`}
                        className="relative block w-full active:scale-95 transition-all">
                        <img src={i.url} alt=""
                          className={`w-full h-20 object-cover object-top rounded-lg border-2 ${marcada ? 'border-[#0B6B3A]' : 'border-[#DCEBE2] opacity-35 grayscale'}`} />
                        {marcada && (
                          <span className="absolute right-1 bottom-1 w-5 h-5 rounded-full bg-[#0B6B3A] text-white border border-white flex items-center justify-center">
                            <Check className="w-3 h-3" aria-hidden />
                          </span>
                        )}
                      </button>
                      <p className="mt-1 text-center text-xs font-bold text-on-surface-variant tabular-nums">{i.turma}: {i.total}</p>
                    </li>
                  );
                })}
              </ul>
              {podeCompartilhar && partes.map((p, n) => {
                const foi = enviadas.includes(n);
                const proxima = !foi && partes.findIndex((_, k) => !enviadas.includes(k)) === n;
                const faixa = p.length === 1 ? p[0].turma : `${p[0].turma} a ${p[p.length - 1].turma}`;
                return (
                  <button key={n} type="button" onClick={() => compartilhar(n)} className={proxima ? cheio : vazado}>
                    {foi ? <Check className="w-4 h-4" aria-hidden /> : <Share2 className="w-4 h-4" aria-hidden />}
                    {foi ? `Compartilhada: ${faixa}` : partes.length === 1 ? `Compartilhar ${faixa}` : `Compartilhar parte ${n + 1}: ${faixa}`}
                  </button>
                );
              })}
              {marcadas.length > 0 && (
                <button type="button" onClick={baixar} className={podeCompartilhar ? vazado : cheio}>
                  <Download className="w-4 h-4" aria-hidden /> Baixar marcadas (.zip)
                </button>
              )}
              {podeCompartilhar && partes.length > 1 && (
                <p className="text-xs text-on-surface-variant">O envio é dividido porque o navegador aceita até {POR_ENVIO} imagens por vez.</p>
              )}
            </>
          ) : !erro && (
            <p role="status" className="flex items-center gap-2 text-[13px] font-semibold text-on-surface-variant">
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> {turmas ? 'Montando as imagens...' : 'Consultando as 18 turmas...'}
            </p>
          )}
          {erro && (
            <div className="space-y-2">
              <p role="alert" className="text-xs font-semibold text-[#B42318]">{erro}</p>
              {!imagens && <button type="button" onClick={tentarDeNovo} className={vazado}>Tentar de novo</button>}
            </div>
          )}
        </section>
      )}
      {consultando && (
        <ColetaImpressa bimestre={bimestre} usar={setTurmas}
          onFim={e => { if (e) setErro(e); setConsultando(false); }} />
      )}
    </div>
  );
}
