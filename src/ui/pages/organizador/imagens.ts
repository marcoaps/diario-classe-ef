// Organizador de Provas — leitura e normalização de imagens (JPEG/PNG em data URL, tamanho natural em px).

import type { Bloco } from './tipos';

const LARGURA_MAXIMA_PX = 1400;

export function carregarImagem(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, falha) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => falha(new Error('imagem inválida'));
    img.src = src;
  });
}

/** Converte qualquer imagem em JPEG/PNG de tamanho razoável; devolve o tamanho natural em px. */
export async function normalizarImagem(src: string): Promise<Extract<Bloco, { tipo: 'imagem' }>> {
  const img = await carregarImagem(src);
  const w0 = img.naturalWidth || img.width;
  const h0 = img.naturalHeight || img.height;
  if (!w0 || !h0) throw new Error('imagem sem dimensões');
  const escala = Math.min(1, LARGURA_MAXIMA_PX / w0);
  const w = Math.max(1, Math.round(w0 * escala));
  const h = Math.max(1, Math.round(h0 * escala));
  const jpeg = /^data:image\/jpe?g/i.test(src);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  if (jpeg) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); }
  ctx.drawImage(img, 0, 0, w, h);
  return jpeg
    ? { tipo: 'imagem', src: canvas.toDataURL('image/jpeg', 0.9), w, h, formato: 'JPEG' }
    : { tipo: 'imagem', src: canvas.toDataURL('image/png'), w, h, formato: 'PNG' };
}

