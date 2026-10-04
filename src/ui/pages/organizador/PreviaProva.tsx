// Organizador de Provas — pré-visualização (previewExam). Desenha as páginas A4 a partir do
// MESMO layout que o PDF usa: cada palavra fica na posição calculada, então o que se vê aqui é
// o que sai no PDF. (1 unidade = 1 pt; a página inteira é reduzida para caber na tela.)

import React, { useEffect, useRef, useState } from 'react';
import { A4 } from './medidas';
import { baseDaLinha, PADDING_CELULA, type Item, type ItemGrade, type ItemTexto, type Layout } from './layout';
import { todosOsBlocos, type Prova } from './tipos';

const ASCENT = 0.905; // Arial: ascendente em relação ao tamanho da fonte
const DESCENT = 0.212;

function Texto({ it, dx = 0, dy = 0 }: { it: ItemTexto; dx?: number; dy?: number }) {
  const familia = it.fonte === 'Times New Roman' ? '"Times New Roman", Times, serif' : 'Arial, Helvetica, sans-serif';
  return (
    <>
      {it.linhas.flatMap((linha, k) => {
        const base = it.y + dy + k * it.lh + baseDaLinha(it.lh, it.tamanho);
        return linha.palavras.map((p, n) => (
          <span
            key={`${k}-${n}`}
            style={{
              position: 'absolute',
              left: it.x + dx + p.x,
              top: base - ASCENT * it.tamanho,
              fontFamily: familia,
              fontSize: it.tamanho,
              lineHeight: `${(ASCENT + DESCENT) * it.tamanho}px`,
              fontWeight: p.b ? 700 : 400,
              fontStyle: p.i ? 'italic' : 'normal',
              whiteSpace: 'pre',
              color: '#000',
            }}
          >
            {p.t}
          </span>
        ));
      })}
    </>
  );
}

function Grade({ g }: { g: ItemGrade }) {
  const linha = '0.5px solid #787878';
  return (
    <>
      <div style={{ position: 'absolute', left: g.x, top: g.y, width: g.w, height: g.h, border: linha, boxSizing: 'border-box' }} />
      {g.linhas.map((l, r) => (
        <React.Fragment key={r}>
          {r > 0 && <div style={{ position: 'absolute', left: g.x, top: g.y + l.y, width: g.w, borderTop: linha }} />}
          {l.celulas.map((c, i) => (
            <React.Fragment key={i}>
              {i > 0 && <div style={{ position: 'absolute', left: g.x + c.x, top: g.y + l.y, height: l.h, borderLeft: linha }} />}
              <Texto it={{ k: 'texto', x: g.x + c.x + PADDING_CELULA, y: g.y + l.y + PADDING_CELULA, w: 0, h: 0, tamanho: g.tamanho, fonte: g.fonte, lh: g.lh, linhas: c.linhas }} />
            </React.Fragment>
          ))}
        </React.Fragment>
      ))}
    </>
  );
}

function Elemento({ it }: { it: Item; key?: React.Key }) {
  if (it.k === 'texto') return <Texto it={it} />;
  if (it.k === 'img') return <img alt="" src={it.src} style={{ position: 'absolute', left: it.x, top: it.y, width: it.w, height: it.h }} />;
  return <Grade g={it} />;
}

export function PreviaProva({ layout }: { layout: Layout }) {
  const caixa = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(0.6);
  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const ajustar = () => setEscala(Math.max(0.2, Math.min(1.3, (el.clientWidth - 2) / A4.w)));
    ajustar();
    const ro = new ResizeObserver(ajustar);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={caixa} className="space-y-3 w-full">
      {layout.paginas.map(p => (
        <div key={p.numero} className="mx-auto">
          <div style={{ width: A4.w * escala, height: A4.h * escala }} className="mx-auto bg-white shadow-md ring-1 ring-black/10 overflow-hidden relative">
            <div style={{ width: A4.w, height: A4.h, transform: `scale(${escala})`, transformOrigin: 'top left', position: 'absolute', left: 0, top: 0 }}>
              {p.itens.map((it, i) => <Elemento key={i} it={it} />)}
            </div>
          </div>
          <p className="text-center text-[11px] text-on-surface-variant mt-1">Página {p.numero} de {layout.paginas.length}</p>
        </div>
      ))}
    </div>
  );
}

/** Conteúdo importado, sem organização nenhuma (para conferir antes de organizar). */
export function PreviaOriginal({ prova }: { prova: Prova }) {
  const blocos = todosOsBlocos(prova);
  return (
    <div className="max-h-96 overflow-auto rounded-xl border border-outline-variant bg-white p-3 space-y-1.5 text-[13px] text-black" style={{ fontFamily: 'Arial, sans-serif' }}>
      {blocos.map((b, i) => {
        if (b.tipo === 'imagem') return <img key={i} alt="" src={b.src} style={{ maxWidth: '100%', maxHeight: 220 }} />;
        if (b.tipo === 'tabela') return (
          <table key={i} className="border-collapse text-xs"><tbody>{b.linhas.map((l, r) => <tr key={r}>{l.map((c, k) => <td key={k} className="border border-gray-400 px-1">{c}</td>)}</tr>)}</tbody></table>
        );
        return (
          <p key={i} style={{ marginLeft: b.tipo === 'alt' ? 12 : 0 }}>
            {b.trechos.map((t, k) => <span key={k} style={{ fontWeight: t.b ? 700 : 400, fontStyle: t.i ? 'italic' : 'normal' }}>{t.t}</span>)}
          </p>
        );
      })}
    </div>
  );
}
