// Diagramas da quadra de handebol desenhados por código (SVG), com as medidas
// oficiais: quadra 40 x 20 m, gol de 3 m, linha da área do goleiro a 6 m,
// linha de tiro livre (tracejada) a 9 m e linha de 7 m. Não usam IA: saem sempre
// certos e iguais. Cada diagrama entra no banco de imagens como um item comum.
//
// As variações NÃO trazem nomes escritos (exceto "medidas", "distâncias" e
// "posições com nomes"), pra o professor poder perguntar "que linha é esta?"
// sem a imagem entregar a resposta.

import type { ItemBancoImagem } from './bancoImagens';

const COR = {
  piso: '#EDBE68',
  area: '#55B7E8',
  areaDestaque: '#FF8A65',
  linha: '#FFFFFF',
  destaque: '#E53935',
  trave: '#D32F2F',
  rede: '#CFD8DC',
  jogador: '#1E63B5',
  goleiro: '#2E9E4F',
  texto: '#1F2937',
  cota: '#374151',
};

type Destaque = 'area6' | 'linha9' | 'linha7' | 'gol' | 'central' | null;

const Y_TRAVE_1 = 8.5;   // gol de 3 m centrado na largura de 20 m
const Y_TRAVE_2 = 11.5;

// Contorno da linha a `r` metros do gol: dois quartos de círculo (centrados nas
// traves) ligados por um trecho reto de 3 m — é o formato das linhas de 6 e 9 m.
function caminhoLinha(r: number): string {
  return `M 0 ${Y_TRAVE_1 - r} A ${r} ${r} 0 0 1 ${r} ${Y_TRAVE_1} L ${r} ${Y_TRAVE_2} A ${r} ${r} 0 0 1 0 ${Y_TRAVE_2 + r}`;
}

// Um lado da quadra com o gol em x = 0 (a quadra inteira espelha este lado).
function ladoDaQuadra(destaque: Destaque): string {
  const d6 = destaque === 'area6';
  const d9 = destaque === 'linha9';
  const d7 = destaque === 'linha7';
  const dGol = destaque === 'gol';
  return `
    <path d="${caminhoLinha(6)} Z" fill="${d6 ? COR.areaDestaque : COR.area}" stroke="${d6 ? COR.destaque : COR.linha}" stroke-width="${d6 ? 0.34 : 0.14}" stroke-linejoin="round"/>
    <path d="${caminhoLinha(9)}" fill="none" stroke="${d9 ? COR.destaque : COR.linha}" stroke-width="${d9 ? 0.34 : 0.14}" stroke-dasharray="0.7 0.5" clip-path="url(#recorte)"/>
    <line x1="7" y1="9.5" x2="7" y2="10.5" stroke="${d7 ? COR.destaque : COR.linha}" stroke-width="${d7 ? 0.4 : 0.16}" stroke-linecap="butt"/>
    ${d7 ? '<circle cx="7" cy="10" r="1.15" fill="none" stroke="#E53935" stroke-width="0.2"/>' : ''}
    <rect x="-1" y="${Y_TRAVE_1}" width="1" height="3" fill="${COR.rede}" stroke="${COR.trave}" stroke-width="0.2"/>
    ${dGol ? `<rect x="-1.7" y="${Y_TRAVE_1 - 0.7}" width="2.4" height="4.4" rx="0.6" fill="none" stroke="${COR.destaque}" stroke-width="0.24"/>` : ''}`;
}

function texto(x: number, y: number, conteudo: string, opcoes: { tamanho?: number; ancora?: 'start' | 'middle' | 'end'; rotacao?: number } = {}): string {
  const { tamanho = 0.95, ancora = 'middle', rotacao } = opcoes;
  const giro = rotacao ? ` transform="rotate(${rotacao} ${x} ${y})"` : '';
  return `<text x="${x}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="${tamanho}" font-weight="bold" text-anchor="${ancora}" fill="${COR.texto}" stroke="#FFFFFF" stroke-width="${tamanho * 0.28}" paint-order="stroke" stroke-linejoin="round"${giro}>${conteudo}</text>`;
}

function seta(x1: number, y1: number, x2: number, y2: number): string {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${COR.cota}" stroke-width="0.14" marker-start="url(#ponta)" marker-end="url(#ponta)"/>`;
}

function definicoes(largura: number): string {
  return `<defs>
    <clipPath id="recorte"><rect x="0" y="0" width="${largura}" height="20"/></clipPath>
    <marker id="ponta" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="0.9" markerHeight="0.9" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M 0 1 L 10 5 L 0 9 z" fill="${COR.cota}"/></marker>
  </defs>`;
}

function moldura(viewBox: string, corpo: string, largura: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="${viewBox}">
  <rect x="-100" y="-100" width="300" height="300" fill="#FFFFFF"/>
  ${definicoes(largura)}
  ${corpo}
</svg>`;
}

// ---------- meia quadra (gol à esquerda) ----------

interface Jogador { x: number; y: number; nome: string; goleiro?: boolean }

// Ataque em 3-3 visto de cima, atacando o gol da esquerda: quem ataca olha para a
// esquerda, então o lado direito do jogador fica em cima (y menor).
const POSICOES: Jogador[] = [
  { x: 0.9, y: 10, nome: 'Goleiro', goleiro: true },
  { x: 6.7, y: 10, nome: 'Pivô' },
  { x: 5.2, y: 1.6, nome: 'Ponta direita' },
  { x: 5.2, y: 18.4, nome: 'Ponta esquerda' },
  { x: 10.2, y: 5.4, nome: 'Armador direito' },
  { x: 10.2, y: 14.6, nome: 'Armador esquerdo' },
  { x: 11.6, y: 10, nome: 'Armador central' },
];

function meiaQuadra(opcoes: { destaque?: Destaque; distancias?: boolean; posicoes?: 'sem-nomes' | 'com-nomes' }): string {
  const { destaque = null, distancias = false, posicoes } = opcoes;
  let extra = '';
  if (distancias) {
    extra += texto(4.7, 3.6, '6 m', { ancora: 'start' });
    extra += texto(7.2, 1.0, '9 m', { ancora: 'start' });
    extra += texto(7.35, 10.35, '7 m', { ancora: 'start' });
  }
  if (posicoes) {
    for (const j of POSICOES) {
      extra += `<circle cx="${j.x}" cy="${j.y}" r="0.75" fill="${j.goleiro ? COR.goleiro : COR.jogador}" stroke="#FFFFFF" stroke-width="0.14"/>`;
      if (posicoes === 'com-nomes') {
        const acimaDoCirculo = j.nome === 'Pivô' || j.nome === 'Armador central';
        extra += acimaDoCirculo
          ? texto(j.x, j.y + (j.nome === 'Pivô' ? -1.15 : 1.75), j.nome, { tamanho: 0.85 })
          : texto(j.x + 1.1, j.y + 0.3, j.nome, { tamanho: 0.85, ancora: 'start' });
      }
    }
  }
  const corpo = `
  <g>
    <rect x="0" y="0" width="20" height="20" fill="${COR.piso}"/>
    ${ladoDaQuadra(destaque)}
    <rect x="0" y="0" width="20" height="20" fill="none" stroke="${COR.linha}" stroke-width="0.2"/>
    ${extra}
  </g>`;
  return moldura('-8 -2 36 24', corpo, 20);
}

// ---------- quadra inteira ----------

function quadraInteira(opcoes: { destaque?: Destaque; medidas?: boolean }): string {
  const { destaque = null, medidas = false } = opcoes;
  const central = destaque === 'central';
  const ladoDireito = destaque === 'gol' || destaque === 'area6' || destaque === 'linha9' || destaque === 'linha7' ? destaque : null;
  let cotas = '';
  if (medidas) {
    cotas = `
      ${seta(0, -2.4, 40, -2.4)} ${texto(20, -3.1, '40 m', { tamanho: 1.4 })}
      ${seta(41.4, 0, 41.4, 20)} ${texto(43.0, 10.5, '20 m', { tamanho: 1.4, rotacao: -90 })}`;
  }
  const corpo = `
  <g>
    <rect x="0" y="0" width="40" height="20" fill="${COR.piso}"/>
    <g>${ladoDaQuadra(ladoDireito)}</g>
    <g transform="translate(40 0) scale(-1 1)">${ladoDaQuadra(null)}</g>
    <line x1="20" y1="0" x2="20" y2="20" stroke="${central ? COR.destaque : COR.linha}" stroke-width="${central ? 0.42 : 0.16}"/>
    <rect x="0" y="0" width="40" height="20" fill="none" stroke="${COR.linha}" stroke-width="0.2"/>
    ${cotas}
  </g>`;
  return moldura('-4 -6 48 32', corpo, 40);
}

// ---------- catálogo ----------

function paraDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function item(id: string, titulo: string, tags: string[], svg: string): ItemBancoImagem {
  return { id: `diag-${id}`, arquivo: paraDataUrl(svg), tipo: 'diagrama', titulo, tags, credito: '' };
}

const TAGS_QUADRA = ['quadra', 'campo', 'linhas', 'espaco', 'diagrama', 'desenho'];

export const DIAGRAMAS_QUADRA: ItemBancoImagem[] = [
  item('quadra-completa', 'Quadra completa (sem nomes)', [...TAGS_QUADRA, 'quadra completa', 'dimensoes'], quadraInteira({})),
  item('quadra-medidas', 'Quadra com medidas (40 m × 20 m)', [...TAGS_QUADRA, 'medidas', 'metros', 'comprimento', 'largura', 'tamanho', 'dimensoes'], quadraInteira({ medidas: true })),
  item('linha-central', 'Linha central destacada', [...TAGS_QUADRA, 'linha central', 'meio', 'meio da quadra', 'campo de ataque', 'campo de defesa'], quadraInteira({ destaque: 'central' })),
  item('meia-quadra', 'Meia quadra (sem nomes)', [...TAGS_QUADRA, 'meia quadra', 'area', 'gol'], meiaQuadra({})),
  item('area-goleiro', 'Área do goleiro (6 m) destacada', [...TAGS_QUADRA, 'area do goleiro', 'area', 'seis metros', '6 m', 'goleiro', 'gol'], meiaQuadra({ destaque: 'area6' })),
  item('linha-9m', 'Linha de tiro livre (9 m) destacada', [...TAGS_QUADRA, 'linha de 9', 'nove metros', '9 m', 'tiro livre', 'linha tracejada', 'falta'], meiaQuadra({ destaque: 'linha9' })),
  item('linha-7m', 'Linha de 7 metros destacada', [...TAGS_QUADRA, 'sete metros', '7 m', 'tiro de 7', 'penalti', 'sete', 'falta'], meiaQuadra({ destaque: 'linha7' })),
  item('gol', 'Gol destacado', [...TAGS_QUADRA, 'gol', 'trave', 'baliza', 'rede', 'meta'], meiaQuadra({ destaque: 'gol' })),
  item('distancias', 'Linhas de 6 m, 7 m e 9 m (com nomes)', [...TAGS_QUADRA, 'distancias', 'metros', '6 m', '7 m', '9 m', 'seis metros', 'sete metros', 'nove metros'], meiaQuadra({ distancias: true })),
  item('posicoes-sem-nomes', 'Posições em ataque (sem nomes)', ['posicao', 'posicoes', 'jogadores', 'ataque', 'formacao', 'goleiro', 'pivo', 'ponta', 'armador', 'sistema', 'tatica', 'diagrama', 'desenho', 'quadra'], meiaQuadra({ posicoes: 'sem-nomes' })),
  item('posicoes-com-nomes', 'Posições em ataque (com nomes)', ['posicao', 'posicoes', 'jogadores', 'ataque', 'formacao', 'goleiro', 'pivo', 'ponta', 'armador', 'sistema', 'tatica', 'diagrama', 'desenho', 'quadra'], meiaQuadra({ posicoes: 'com-nomes' })),
];
